import {Types} from 'mongoose';
import {SocialMediaType} from './social-media.types';
import {SocialAccount} from '../../database/schemas/users/influencer.schema';

export interface MigrateSocialAccountData {
    influencerId: string;
    socialAccountToMigrateId: string;
    socialMediaOfAccount: SocialMediaType;
}

export interface SocialAccountMigrationContext {
    socialAccountId: Types.ObjectId;
    socialMedia: SocialMediaType;
    socialAccountUsername: string;
    socialAccount: SocialAccount;

    sourceInfluencerId: Types.ObjectId;
    targetInfluencerId: Types.ObjectId;
    targetInfluencerEmail: string;
}
