import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../base.repository";
import { InjectModel } from "@nestjs/mongoose";
import { Bundle } from "src/database/schemas/bundles/bundle.schema";
import { BundleAccountLink } from "src/database/schemas/bundles/bundle-account-link.schema";
import { Model } from "mongoose";

@Injectable()
export class BundleAccountLinkRepository extends BaseRepository<BundleAccountLink> {
    constructor(
        @InjectModel(Bundle.name)
        private readonly bundleModel: Model<Bundle>,
        @InjectModel(BundleAccountLink.name)
        private readonly bundleAccountLinkModel: Model<BundleAccountLink>,
    ) {
        super(bundleAccountLinkModel);
    }
}