import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { NegotiationInboundProcessor } from './negotiation-inbound.processor';
import { RedisLeaderLock } from './redis-leader-lock';
import { ImapSyncStateRepository } from '../../../database/repositories/negotiation/imap-sync-state.repository';

const RECONNECT_DELAY_MS = 15_000;
const LEADER_KEY = 'negotiation:imap:leader';
const LEADER_TTL_MS = 30_000;
const RENEW_INTERVAL_MS = 10_000;
const ELECTION_RETRY_MS = 15_000;
const MAILBOX = 'INBOX';

// Background consumer that watches the Zoho mailbox over IMAP IDLE and feeds
// new replies into the negotiation processor.
//
// Across multiple instances only ONE is active at a time, elected via a Redis
// leader lease (RedisLeaderLock). Set NEGOTIATION_IMAP_ENABLED=false to opt an
// instance out of the election entirely. Idempotency (unique messageId) remains
// the final guard against double processing.
@Injectable()
export class ZohoInboundService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZohoInboundService.name);
  private readonly ownerId = randomUUID();

  private client?: ImapFlow;
  private running = false;
  private isLeader = false;
  private draining = false;
  private pendingDrain = false;

  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private electionTimer?: ReturnType<typeof setTimeout>;
  private renewTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: NegotiationInboundProcessor,
    private readonly lock: RedisLeaderLock,
    private readonly syncStateRepository: ImapSyncStateRepository,
  ) {}

  onModuleInit(): void {
    if ((this.config.get<string>('NEGOTIATION_IMAP_ENABLED') ?? 'true') !== 'true') {
      this.logger.log('Negotiation IMAP consumer disabled (NEGOTIATION_IMAP_ENABLED!=true)');
      return;
    }
    this.running = true;
    void this.runElection();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.isLeader = false;
    this.clearTimer('reconnectTimer');
    this.clearTimer('electionTimer');
    this.clearTimer('renewTimer');
    await this.disconnectClient();
    await this.lock.release(LEADER_KEY, this.ownerId);
  }

  // --- Leadership -----------------------------------------------------------

  private async runElection(): Promise<void> {
    if (!this.running || this.isLeader) {
      return;
    }

    let acquired = false;
    try {
      acquired = await this.lock.acquire(LEADER_KEY, this.ownerId, LEADER_TTL_MS);
    } catch (err: any) {
      this.logger.warn(`Leader election failed: ${err?.message ?? err}`);
    }

    if (acquired) {
      this.isLeader = true;
      this.logger.log('Acquired IMAP consumer leadership');
      this.scheduleRenew();
      await this.connect();
    } else {
      this.scheduleElection();
    }
  }

  private scheduleElection(): void {
    if (!this.running || this.electionTimer) {
      return;
    }
    this.electionTimer = setTimeout(() => {
      this.electionTimer = undefined;
      void this.runElection();
    }, ELECTION_RETRY_MS);
  }

  private scheduleRenew(): void {
    this.renewTimer = setTimeout(async () => {
      this.renewTimer = undefined;
      if (!this.running || !this.isLeader) {
        return;
      }

      let renewed = false;
      try {
        renewed = await this.lock.renew(LEADER_KEY, this.ownerId, LEADER_TTL_MS);
      } catch (err: any) {
        this.logger.warn(`Lock renew failed: ${err?.message ?? err}`);
      }

      if (!renewed) {
        this.logger.warn('Lost IMAP consumer leadership — stepping down');
        await this.stepDown();
        return;
      }
      this.scheduleRenew();
    }, RENEW_INTERVAL_MS);
  }

  private async stepDown(): Promise<void> {
    this.isLeader = false;
    this.clearTimer('renewTimer');
    this.clearTimer('reconnectTimer');
    await this.disconnectClient();
    this.scheduleElection();
  }

  // --- IMAP -----------------------------------------------------------------

  private buildClient(): ImapFlow {
    const user = this.config.get<string>('ZOHO_IMAP_USER') ?? this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('ZOHO_IMAP_PASS') ?? this.config.get<string>('EMAIL_PASS');

    return new ImapFlow({
      host: this.config.get<string>('ZOHO_IMAP_HOST') ?? 'imap.zoho.eu',
      port: Number(this.config.get<string>('ZOHO_IMAP_PORT') ?? 993),
      secure: true,
      auth: { user: user ?? '', pass: pass ?? '' },
      logger: false,
    });
  }

  private async connect(): Promise<void> {
    if (!this.running || !this.isLeader) {
      return;
    }

    const client = this.buildClient();
    this.client = client;

    client.on('error', (err) => this.logger.warn(`IMAP error: ${err?.message ?? err}`));
    client.on('close', () => {
      if (this.running && this.isLeader) {
        this.scheduleReconnect();
      }
    });
    // Fired by the server (via IDLE) whenever new mail arrives.
    client.on('exists', () => {
      void this.drain();
    });

    try {
      await client.connect();
      await client.mailboxOpen(MAILBOX);
      this.logger.log('IMAP connected — watching INBOX for negotiation replies');
      await this.drain(); // catch up on anything that arrived while we were down
    } catch (err: any) {
      this.logger.error(`IMAP connect failed: ${err?.message ?? err}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.running || !this.isLeader || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private async disconnectClient(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client) {
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
    }
  }

  // Process every new UID after the persisted cursor. Failed messages are left
  // behind the cursor and retried on the next sweep.
  private async drain(): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }
    // Coalesce concurrent triggers: remember the request and re-sweep once the
    // current pass finishes, so mail arriving mid-drain is never missed.
    if (this.draining) {
      this.pendingDrain = true;
      return;
    }
    this.draining = true;

    try {
      do {
        this.pendingDrain = false;
        await this.sweepNewMessages(client);
      } while (this.pendingDrain);
    } finally {
      this.draining = false;
    }
  }

  // Local part of the negotiation inbox, e.g. "inbox" in inbox@domain. Used to
  // scope the IMAP search to plus-addressed replies only, so the consumer never
  // touches unrelated mail in a shared mailbox.
  private recipientPrefix(): string {
    const emailUser = this.config.get<string>('EMAIL_USER') ?? '';
    const local =
      this.config.get<string>('NEGOTIATION_INBOX_LOCAL') || emailUser.split('@')[0] || '';
    return `${local}+`;
  }

  private async sweepNewMessages(client: ImapFlow): Promise<void> {
    try {
      const lastSeenUid = await this.syncStateRepository.getLastSeenUid(MAILBOX);
      const uidRange = `${lastSeenUid + 1}:*`;

      this.logger.log(`[IMAP] sweep start, lastSeenUid=${lastSeenUid}, uidRange=${uidRange}`);

      // Only plus-addressed (negotiation) replies - never personal mail.
      const uids = await client.search(
          { uid: uidRange },
          { uid: true },
      );

      this.logger.log(`[IMAP] found uids=${JSON.stringify(uids)}`);

      if (!uids || uids.length === 0) {
        return;
      }

      for (const uid of uids.sort((a, b) => a - b)) {
        const processed = await this.processUid(client, uid);
        if (!processed) {
          return;
        }
      }
    } catch (err: any) {
      this.logger.error(`IMAP drain failed: ${err?.message ?? err}`);
    }
  }

  private async processUid(client: ImapFlow, uid: number): Promise<boolean> {
    try {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!message || !message.source) {
        this.logger.warn(`Inbound uid=${uid} has no source; advancing IMAP cursor`);
        await this.syncStateRepository.markUidProcessed(MAILBOX, uid);
        return true;
      }

      const parsed = await simpleParser(message.source);
      await this.processor.process(parsed, { mailbox: MAILBOX, uid });
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      await this.syncStateRepository.markUidProcessed(MAILBOX, uid);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to process inbound uid=${uid}: ${err?.message ?? err}`);
      return false;
    }
  }

  private clearTimer(name: 'reconnectTimer' | 'electionTimer' | 'renewTimer'): void {
    const timer = this[name];
    if (timer) {
      clearTimeout(timer);
      this[name] = undefined;
    }
  }
}
