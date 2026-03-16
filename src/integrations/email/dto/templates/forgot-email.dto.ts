export class ForgotPasswordEmailDto {
    firstName: string;
    link: string
}

export class ConfirmNewEmailDto {
    firstName: string;
    email: string;
    link: string
}