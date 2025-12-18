import {SocialMediaType} from "../../../common/types/social-media.types";
import {SocialAccount} from "../../../database/schemas/users/influencer.schema";
import {Types} from "mongoose";

// Context for migrating social account to new owner
export interface SocialAccountMigrationContext {
    socialAccountId: Types.ObjectId;
    socialMedia: SocialMediaType;
    socialAccount: SocialAccount;

    sourceInfluencerId: Types.ObjectId;
    targetInfluencerId: Types.ObjectId;
}
