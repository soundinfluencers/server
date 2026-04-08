import {BadRequestException, Injectable} from "@nestjs/common";
import {Influencer} from "../../../database/schemas/users/influencer.schema";
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {ObjId} from "../../../common/types/base.types";

type InputDto = Partial<Influencer>;

interface IUpdateInfluencerService {
    // Execute service and get updated influencer model
    exec(
        influencerId: string,
        data: InputDto,
    ): Promise<Influencer>;

    // Builds update query
    buildUpdateQuery(data: InputDto): Partial<InputDto>;
}

@Injectable()
export class UpdateInfluencerService implements IUpdateInfluencerService {
    constructor(
        private readonly influencerRepository: InfluencerRepository
    ) {
    }

    private readonly bannedFields: string[] = [
        '_id',
        'schemaVersion',
        'refreshToken',
        'password',
        'role',
        'verifiedStatus',
        'instagram',
        'tiktok',
        'spotify',
        'soundcloud',
        'facebook',
        'youtube',
        'press',
    ]

    async exec(
        influencerId: string,
        data: InputDto,
    ): Promise<Influencer> {
        if (typeof influencerId !== 'string' || influencerId.trim() === '') {
            throw new BadRequestException("Invalid influencer id");
        }

        const query = this.buildUpdateQuery(data);

        const updatedUser = await this.influencerRepository.findOneAndUpdate(
            {_id: new ObjId(influencerId)},
            {$set: query},
            {new: true}
        );

        if (!updatedUser) {
            throw new BadRequestException("Influencer not found");
        }

        return updatedUser satisfies Influencer;
    }

    buildUpdateQuery(data: InputDto): Partial<InputDto> {
        const updateQuery: Partial<InputDto> = {};

        for (const [key, value] of Object.entries(data)) {
            if (this.bannedFields.includes(key)) continue;

            if (key === 'email') {
                updateQuery[key] = value.trim().toLowerCase();
                continue;
            }

            if (key === 'balance') {
                if (typeof value !== 'number' || value < 0) {
                    throw new BadRequestException("Invalid balance");
                }
            }

            if (value !== undefined) {
                updateQuery[key] = typeof value === 'string'
                    ? value.trim()
                    : value;
            }
        }

        return updateQuery;
    }
}