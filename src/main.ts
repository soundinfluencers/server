import {NestFactory, Reflector} from '@nestjs/core';
import {SwaggerModule, DocumentBuilder} from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import {AppModule} from './modules/app/app.module';
import {ResponseTransformInterceptor} from "./common/interceptors/response-transform.interceptor";
import {AllExceptionsFilter} from "./common/filters/exceptions.filter";
import {ValidationPipe} from "@nestjs/common";
import {RolesGuard} from "./common/guards/roles.guard";
import {JwtGuard} from "./common/guards/jwt.guard";

function parseOrigins(env?: string): string[] {
    return (env ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS);
    const reflector = app.get(Reflector);

    app.useGlobalGuards(
        new JwtGuard(reflector),
        new RolesGuard(reflector),
    );
    app.use(cookieParser());
    app.use(bodyParser.json({limit: '50mb'}));
    app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

    app.useGlobalInterceptors(new ResponseTransformInterceptor()); // interceptor for transforming responses to client side
    app.useGlobalFilters(new AllExceptionsFilter()); // global exception filter
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true, // transform payload into DTO classes
        }),
    );
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) return callback(null, true);

            return callback(new Error(`CORS blocked for origin: ${origin}`), false);
        },
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Authorization, Cookie',
        exposedHeaders: 'Set-Cookie',
    });

    app.use((req, res, next) => {
        res.removeHeader('X-Frame-Options');
        next();
    });

    // if (process.env.NODE_ENV === 'production') {
    //     app.use('/api', new SwaggerAuthMiddleware().use);
    // }

    const config = new DocumentBuilder()
        .setTitle('Sound Influencers API')
        .setDescription('REST API documentation')
        .setVersion('2.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT access token',
            },
            'access-token',
        )
        .addSecurityRequirements('access-token')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup(
        process.env.NODE_ENV === 'production' ? 'api' : 'dev-api',
        app,
        document,
        {
            swaggerOptions: {
                persistAuthorization: true,
                plugins: [
                    function () {
                        return {
                            afterLoad: (system: any) => {
                                (window as any).swaggerSystem = system;

                                const authorizeWhenReady = (token: string) => {
                                    const interval = setInterval(() => {
                                        if (system.authActions?.authorize) {
                                            system.authActions.authorize({
                                                'access-token': {
                                                    name: 'access-token',
                                                    schema: {
                                                        type: 'http',
                                                        scheme: 'bearer',
                                                    },
                                                    value: token,
                                                },
                                            });
                                            clearInterval(interval);
                                        }
                                    }, 100);
                                };

                                const savedToken = localStorage.getItem('swagger_access_token');
                                if (savedToken) {
                                    authorizeWhenReady(savedToken);
                                }

                                console.log(savedToken, 'saved Token')

                                const waitForTopbar = setInterval(() => {
                                    const topbar = window.document.querySelector('.topbar');
                                    if (!topbar) return;
                                    clearInterval(waitForTopbar);

                                    if (!window.document.getElementById('swagger-login-btn')) {
                                        const createButton = (id: string, text: string, bg: string) => {
                                            const btn = window.document.createElement('button');
                                            btn.id = id;
                                            btn.innerText = text;
                                            btn.style.cssText = `
                                            margin-left:10px;
                                            padding:6px 12px;
                                            border-radius:6px;
                                            background:${bg};
                                            color:#fff;
                                            border:none;
                                            cursor:pointer;
                                        `;
                                            topbar.appendChild(btn);
                                            return btn;
                                        };

                                        const loginBtn = createButton('swagger-login-btn', 'Login', '#4F46E5');
                                        const logoutBtn = createButton('swagger-logout-btn', 'Logout', '#EF4444');
                                        const refreshBtn = createButton('swagger-refresh-btn', 'Refresh', '#10B981');

                                        logoutBtn.onclick = () => {
                                            system.authActions.logout('access-token');
                                            localStorage.removeItem('swagger_access_token');
                                            alert('Logged out');
                                            window.location.reload();
                                        };

                                        loginBtn.onclick = () => {
                                            const modal = window.document.createElement('div');
                                            modal.id = 'login-modal';
                                            modal.style.cssText = `
                                            position: fixed;
                                            top: 0;
                                            left: 0;
                                            width: 100%;
                                            height: 100%;
                                            background: rgba(0,0,0,0.5);
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            z-index: 9999;
                                        `;
                                            modal.innerHTML = `
                                            <div style="
                                                background:#fff;
                                                padding:20px;
                                                border-radius:8px;
                                                min-width:300px;
                                                display:flex;
                                                flex-direction:column;
                                                gap:10px;
                                            ">
                                                <h3>Login</h3>
                                                <input id="login-email" placeholder="Email" />
                                                <input id="login-password" type="password" placeholder="Password" />
                                                <input id="login-role" placeholder="client" />
                                                <div style="display:flex; gap:10px; justify-content:flex-end;">
                                                    <button id="login-submit" style="background:#4F46E5;color:#fff;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;">Login</button>
                                                    <button id="login-close" style="background:#ccc;color:#000;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;">Close</button>
                                                </div>
                                            </div>
                                        `;
                                            window.document.body.appendChild(modal);

                                            window.document.getElementById('login-close')!.onclick = () => modal.remove();

                                            window.document.getElementById('login-submit')!.onclick = async () => {
                                                const email = (window.document.getElementById('login-email') as HTMLInputElement).value;
                                                const password = (window.document.getElementById('login-password') as HTMLInputElement).value;
                                                const role = (window.document.getElementById('login-role') as HTMLInputElement).value.toLowerCase();

                                                try {
                                                    const res = await fetch(`${window.location.origin}/auth/login`, {
                                                        method: 'POST',
                                                        headers: {'Content-Type': 'application/json'},
                                                        body: JSON.stringify({ email, password, role }),
                                                    }).then(r => r.json());

                                                    if (res.data?.accessToken) {
                                                        const token = res.data.accessToken.replace(/^Bearer\s+/i, '');
                                                        localStorage.setItem('swagger_access_token', token);
                                                        authorizeWhenReady(token);
                                                        alert('Logged in');
                                                        modal.remove();
                                                    } else {
                                                        alert('Login failed: ' + JSON.stringify(res));
                                                    }
                                                } catch (e) {
                                                    alert('Login error: ' + e);
                                                }
                                            };
                                        };

                                        refreshBtn.onclick = async () => {
                                            try {
                                                const res = await fetch(`${window.location.origin}/auth/refresh`, {
                                                    method: 'POST',
                                                    credentials: 'include',
                                                }).then(r => r.json());

                                                if (!res?.data?.accessToken) {
                                                    alert('Refresh failed');
                                                    return;
                                                }

                                                const token = res.data.accessToken.replace(/^Bearer\s+/i, '');
                                                localStorage.setItem('swagger_access_token', token);
                                                authorizeWhenReady(token);
                                                alert('Token refreshed');
                                            } catch (e) {
                                                alert('Refresh error: ' + e);
                                            }
                                        };
                                    }
                                }, 500);
                            },
                        };
                    },
                ],
            },
        },
    );


    await app.listen(3001);
}

bootstrap();
