import {CanActivate, ExecutionContext, Injectable} from "@nestjs/common";
import * as jwt from "jsonwebtoken";

@Injectable()
export class JwtGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        const auth = req.headers.authorization;
        if (!auth) return false;

        const token = auth.split(' ')[1];
        if (!token) return false;

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.user = payload;
            return true;
        } catch {
            return false;
        }
    }
}
