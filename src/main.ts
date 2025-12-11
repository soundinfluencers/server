import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './modules/app/app.module';
import {ResponseTransformInterceptor} from "./common/interceptors/response-transform.interceptor";
import {AllExceptionsFilter} from "./common/filters/exceptions.filter";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.use(cookieParser());
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    app.enableCors({
        origin: [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:3001',
            'http://192.168.0.105:5173',
            'http://192.168.0.105:3000',
            'http://192.168.0.105:3001',
            'https://nazar.soundinfluencers.com',
            'https://go.soundinfluencers.com',
        ],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
        allowedHeaders: 'Content-Type, Authorization',
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
        .addCookieAuth('refreshToken', {
            type: 'apiKey',
            in: 'cookie',
        })
        .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup(process.env.NODE_ENV === 'production' ? 'api' : 'dev-api', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            plugins: [
                function () {
                    return {
                        afterLoad: (system: any) => {
                            const waitForTopbar = setInterval(() => {
                                const topbar = window.document.querySelector('.topbar');
                                if (!topbar) return;

                                clearInterval(waitForTopbar);

                                if (!window.document.getElementById('swagger-login-btn')) {
                                    const loginBtn = window.document.createElement('button');
                                    loginBtn.id = 'swagger-login-btn';
                                    loginBtn.innerText = 'Login';
                                    loginBtn.style.cssText = `
                    margin-left:10px;
                    padding:6px 12px;
                    border-radius:6px;
                    background:#4F46E5;
                    color:#fff;
                    border:none;
                    cursor:pointer;
                  `;
                                    topbar.appendChild(loginBtn);

                                    const logoutBtn = window.document.createElement('button');
                                    logoutBtn.id = 'swagger-logout-btn';
                                    logoutBtn.innerText = 'Logout';
                                    logoutBtn.style.cssText = `
                    margin-left:10px;
                    padding:6px 12px;
                    border-radius:6px;
                    background:#EF4444;
                    color:#fff;
                    border:none;
                    cursor:pointer;
                  `;
                                    topbar.appendChild(logoutBtn);

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
                      <div id="login-box" style="
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
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                          <button id="login-submit" style="background:#4F46E5;color:#fff;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;">Login</button>
                          <button id="login-close" style="background:#ccc;color:#000;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;">Close</button>
                        </div>
                      </div>
                    `;
                                        window.document.body.appendChild(modal);

                                        (window.document.getElementById('login-close') as HTMLButtonElement).onclick = () => {
                                            modal.remove();
                                        };

                                        (window.document.getElementById('login-submit') as HTMLButtonElement).onclick = async () => {
                                            const email = (window.document.getElementById('login-email') as HTMLInputElement).value;
                                            const password = (window.document.getElementById('login-password') as HTMLInputElement).value;

                                            const baseUrl = window.location.origin;
                                            try {
                                                const res = await fetch(`${baseUrl}/auth/login`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ email, password }),
                                                }).then(r => r.json());

                                                if (res.data.accessToken) {
                                                    const token = res.data.accessToken.replace(/^Bearer\s+/i, '');
                                                    localStorage.setItem('swagger_access_token', token);

                                                    system.authActions.authorize({
                                                        'access-token': {
                                                            name: 'Authorization',
                                                            schema: { type: 'http', scheme: 'bearer' },
                                                            value: token,
                                                        },
                                                    });

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

                                    const saved = localStorage.getItem('swagger_access_token');
                                    if (saved) {
                                        system.authActions.authorize({
                                            'access-token': {
                                                name: 'Authorization',
                                                schema: { type: 'http', scheme: 'bearer' },
                                                value: saved,
                                            },
                                        });
                                    }
                                }
                            }, 500);
                        },
                    };
                },
            ],
        },
    });

    await app.listen(3001);
}

bootstrap();
