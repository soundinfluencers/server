import {Module} from '@nestjs/common';
import {AuthService} from './auth.service';
import {AuthController} from './auth.controller';
import {JwtStrategy} from "../../common/strategies/jwt.strategy";
import {AdminRequestsModule} from "../admin/admin.module";

@Module({
    imports: [AdminRequestsModule],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtStrategy,
    ],
    exports: [AuthService]
})
export class AuthModule {
}
