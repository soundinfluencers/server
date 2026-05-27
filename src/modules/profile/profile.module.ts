import { Global, Module } from '@nestjs/common';
import { ProfileService } from './services/profile.service';
import { ProfileController } from './profile.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from '../../database/schemas/users/client.schema';
import { Influencer, InfluencerSchema } from '../../database/schemas/users/influencer.schema';
import { AuthService } from '../auth/auth.service';
import { UpdateSocialAccountService } from './services/update-social-account.service';
import { UpdateInfluencerService } from './services/update-influencer.service';
import { CreateSocialAccountService } from './services/create-social-account.service';
import { AuthModule } from '../auth/auth.module';
import { AdminRequestsModule } from '../admin/admin.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
    ]),
    AuthModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}

@Global()
@Module({
  providers: [CreateSocialAccountService],
  exports: [CreateSocialAccountService],
})
export class CreateSocialAccountModule {}

@Global()
@Module({
  imports: [AdminRequestsModule],
  providers: [UpdateSocialAccountService],
  exports: [UpdateSocialAccountService],
})
export class UpdateSocialAccountModule {}

@Global()
@Module({
  providers: [UpdateInfluencerService],
  exports: [UpdateInfluencerService],
})
export class UpdateInfluencerModule {}
