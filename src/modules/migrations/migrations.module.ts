import {Module} from "@nestjs/common";
import {MigrationsController} from "./migrations.controller";
import {MigrationsService} from "./migrations.service";
import {ProfileService} from "../profile/profile.service";

@Module({
    controllers: [MigrationsController],
    providers: [MigrationsService]
})
export class MigrationsModule {}
