import {SocialMediaType} from "../../../common/types/social-media.types";
import {SocialAccount} from "../../../database/schemas/users/influencer.schema";
import {Types} from "mongoose";

// Context for migrating social account to new owner
export interface SocialAccountMigrationContext {
    socialAccountId: Types.ObjectId;
    socialMedia: SocialMediaType;
    socialAccountUsername: string;
    socialAccount: SocialAccount;

    // Old owner id
    sourceInfluencerId: Types.ObjectId;

    // New owner id
    targetInfluencerId: Types.ObjectId;
    // New owner email
    targetInfluencerEmail: string;
}
