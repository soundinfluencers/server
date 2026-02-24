export class ForgotPasswordEmailDto {
    userFirstName: string;
    email: string;
    code: string
}

export class NewPasswordEmailDto {
    userFirstName: string;
    email: string;
    password: string;
}