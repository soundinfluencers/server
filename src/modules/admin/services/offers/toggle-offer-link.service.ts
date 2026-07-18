import { HttpException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { OfferAccountLinkRepository } from "src/database/repositories/offers/offer-account-link.repository";
import { OfferRepository } from "src/database/repositories/offers/offer.repository";
import { AdminCreateOfferDto, AdminOffersMatrixToggleLinkDto } from "../../dto/offers/admin-offers-matrix.dto";
import { FilteredNestLogger } from "src/common/logger/filtered-nest-logger";
import { ObjId } from "src/common/types/base.types";
import { InfluencerRepository } from "src/database/repositories/users/influencer.repository";
import { safeParseToNumber } from "src/common/utils/base.util";
import { CREATE_OFFER_SERVICE, CreateOfferService } from "./create-offer.service";

export const TOGGLE_OFFER_LINK_SERVICE = Symbol('TOGGLE_OFFER_LINK_SERVICE');

// Toggles account link for specified offer and updates meta information - combinedFollowers, networksAmount, etc.
// Creates a working copy if offer published, so clients can see original version, while admin is working on updates.
// After publishing offer, working copy must replace original version.
@Injectable()
export class ToggleOfferLinkService {
    private readonly logger = new FilteredNestLogger(ToggleOfferLinkService.name);

    constructor(
        private readonly offerRepository: OfferRepository,
        private readonly offerAccountLinkRepository: OfferAccountLinkRepository,
        private readonly influencerRepository: InfluencerRepository,
        @Inject(CREATE_OFFER_SERVICE)
        private readonly createOfferService: CreateOfferService,
    ) { }

    async exec(payload: AdminOffersMatrixToggleLinkDto): Promise<void> {
        const offerId = new ObjId(payload.offerId);
        const influencerId = new ObjId(payload.influencerId);
        const accountId = new ObjId(payload.accountId);

        this.logger.debug(`PAYLOAD: ${JSON.stringify({
            offerId: offerId,
            influencerId: influencerId,
            accountId: accountId,
            connected: payload.connected
        }, null, '\t')}`);

        const session = await this.offerAccountLinkRepository.startSession();
        session.startTransaction();

        try {
            // Finds offer
            const offer = await this.offerRepository.findOne({ _id: offerId }, { session });

            if (!offer) {
                this.logger.warn(`
          Offer ${offerId} wasn't found, while ${payload.connected === true ? 'creating' : 'deleting'} new account link for influencer id: ${influencerId} and social account id: ${accountId}. 
        `);
                throw new NotFoundException('Offer not found');
            }

            const influencer = await this.influencerRepository.findOne({ _id: influencerId }, { session });

            if (!influencer) {
                this.logger.warn(`
          Influencer ${influencerId} wasn't found, while ${payload.connected === true ? 'creating' : 'deleting'} new account link for offer id ${offerId} and social account id: ${accountId}. 
        `);
                throw new NotFoundException('Influencer not found');
            }

            const socialMedia = offer.socialMedia.split('_')[0];
            const socialAccount = influencer[socialMedia]?.find(
                acc => acc._id.toString() === accountId.toString()
            ) ?? undefined;

            if (!socialAccount) {
                this.logger.warn(`
          Social account ${accountId} wasn't found, while ${payload.connected === true ? 'creating' : 'deleting'} new account link for offer id ${offerId} and influencer id: ${influencerId}. 
        `);
                throw new NotFoundException('Social account not found');
            }

            // Offer's meta information
            const offerWorkingCopyId = new ObjId();
            const isPublished = offer.isPublished;
            let combinedFollowers = offer.combinedFollowers ?? 0;
            let networksAmount = safeParseToNumber(offer.networksAmount, 0);

            this.logger.debug(`NETWORKS AMOUNT BEFORE TOGGLING LINK: ${typeof networksAmount + ' ' + networksAmount}`);
            this.logger.debug(`COMBINED FOLLOWERS BEFORE TOGGLING LINK: ${typeof combinedFollowers + ' ' + combinedFollowers}`);

            this.logger.debug(`OFFER INFO: ${JSON.stringify(offer, null, '\t')}`);
            this.logger.debug(`: ${JSON.stringify({
                influencerId: influencer._id,
                accountId: socialAccount._id,
                username: socialAccount.username,
                followers: socialAccount.followers,
            }, null, '\t')}`);

            // If offer published, creates a working copy
            // Otherwise, updates existing offer`
            if (isPublished === true) {
                this.logger.debug(`${socialMedia} OFFER ${offer.title} is published, so creating a working copy with _id ${offerWorkingCopyId}.`)

                // Creating offer's working copy
                const offerWorkingCopy = await this.createOfferService.exec({
                    requestedId: offerWorkingCopyId,
                    offerName: offer.title,
                    socialMedia: offer.socialMedia,
                    price: offer.price,
                    genre: offer.genre,
                    combinedFollowers: combinedFollowers,
                    networksAmount: networksAmount.toString(),
                    storyAndPostDetails: offer.storyAndPostDetails,
                    referenceId: offerId,
                } satisfies AdminCreateOfferDto, session);

                if (!offerWorkingCopy) {
                    this.logger.warn(`
            Offer account links weren't copied, while toggling new link with influencer id ${influencerId} and social account id ${accountId} for offer ${offerId}. 
            \nCreate offer working copy info: type ${typeof offerWorkingCopy}, value ${JSON.stringify(offerWorkingCopy, null, '\t')}.
          `);
                    throw new InternalServerErrorException('Something went wrong');
                }

                // Copying offer's accounts links
                const insertLinksResult = await this.offerAccountLinkRepository.copyLinksToOffer(offerId, offerWorkingCopyId, session);

                if (!Number.isFinite(insertLinksResult) || insertLinksResult <= 0) {
                    this.logger.warn(`
            Offer account links weren't copied, while toggling new link with influencer id ${influencerId} and social account id ${accountId} for offer ${offerId}. 
            \nInsert result info: type ${typeof insertLinksResult}, value ${insertLinksResult ?? 'undefined'}.
          `);
                    throw new InternalServerErrorException('Something went wrong');
                }
            } else {
                // Updating existing offer
                const updateResult = await this.offerRepository.updateOne(
                    { _id: offerId },
                    {
                        $set: {
                            isPublished: false,
                            networksAmount: networksAmount.toString(),
                            combinedFollowers: combinedFollowers,
                        }
                    },
                    { session: session }
                );

                this.logger.debug(`UPDATE OFFER RESULT: ${JSON.stringify(updateResult, null, '\t')}`);

                if (updateResult.modifiedCount === 0) {
                    this.logger.warn(`
            Offer account links weren't copied, while toggling new link with influencer id ${influencerId} and social account id ${accountId} for offer ${offerId}. 
            \nUpdate result: ${JSON.stringify(updateResult, null, '\t')}.
          `);
                    throw new InternalServerErrorException('Something went wrong');
                }
            }

            this.logger.debug(`OFFER WORKING COPY ID: ${offerWorkingCopyId}`);

            if (payload.connected === true) {
                await this.offerAccountLinkRepository.addLink(isPublished === true ? offerWorkingCopyId : offerId, influencerId, accountId, session);
                networksAmount++;
                combinedFollowers += safeParseToNumber(socialAccount.followers);
            } else {
                const linksAmount = await this.offerAccountLinkRepository.countByOfferId(isPublished === true ? offerWorkingCopyId : offerId);

                this.logger.debug(`${socialMedia} OFFER ${offerId} LINKS AMOUNT: ${linksAmount}`)

                if (isPublished === false && (!Number.isFinite(linksAmount) || linksAmount <= 0)) {
                    this.logger.warn(`No offer account links were found while trying to remove link for influencer ${influencerId} with ${socialMedia} account ${accountId} for offer ${offerId}`);
                    return;
                }

                await this.offerAccountLinkRepository.removeLink(isPublished === true ? offerWorkingCopyId : offerId, influencerId, accountId, session);
                networksAmount--;
                combinedFollowers -= safeParseToNumber(socialAccount.followers);
            }

            this.logger.debug(`NETWORKS AMOUNT AFTER TOGGLING LINK: ${typeof networksAmount + ' ' + networksAmount}`);
            this.logger.debug(`COMBINED FOLLOWERS AFTER TOGGLING LINK: ${typeof combinedFollowers + ' ' + combinedFollowers}`);

            if (networksAmount < 0) {
                this.logger.warn(`Networks amount became less than zero after toggling link for ${socialMedia} account ${accountId} in offer ${offerId}: ${typeof networksAmount + ' ' + networksAmount}`);
                throw new InternalServerErrorException("Something went wrong");
            }
            if (combinedFollowers < 0) {
                this.logger.warn(`Combined followers became less than zero after toggling link for ${socialMedia} account ${accountId} in offer ${offerId}: ${typeof combinedFollowers + ' ' + combinedFollowers}`);
                throw new InternalServerErrorException("Something went wrong");
            }

            this.logger.debug(`${socialMedia} OFFER ${offer.title} is published: ${isPublished}`);

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            if (!(err instanceof HttpException)) {
                this.logger.error(`
          Error while toggling offer ${offerId} link for influencer id ${influencerId} and social account id ${accountId}. 
        `, err instanceof Error ? err.stack : undefined);
                throw new InternalServerErrorException('Something went wrong');
            }
            throw err;
        } finally {
            await session.endSession();
        }
    }
}