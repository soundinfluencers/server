import { Injectable } from "@nestjs/common";
import { BaseRepository } from "../base.repository";
import { Bundle } from "src/database/schemas/bundles/bundle.schema";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BundleAccountLink } from "src/database/schemas/bundles/bundle-account-link.schema";

@Injectable()
export class BundleRepository extends BaseRepository<Bundle> {
    constructor(
        @InjectModel(Bundle.name)
        private readonly bundleModel: Model<Bundle>,
        @InjectModel(BundleAccountLink.name)
        private readonly bundleAccountLinkModel: Model<BundleAccountLink>,
    ) {
        super(bundleModel);
    }
}