import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {ProposalSystemController} from "./proposal-system.controller";
import {ProposalSystemService} from "./proposal-system.service";
import {Client, ClientSchema} from "../auth/schemas/client.schema";
import {Influencer, InfluencerSchema} from "../auth/schemas/influencer.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Client.name, schema: ClientSchema },
            { name: Influencer.name, schema: InfluencerSchema },
        ]),
    ],
    controllers: [ProposalSystemController],
    providers: [ProposalSystemService],
})
export class ProposalSystemModule {}
