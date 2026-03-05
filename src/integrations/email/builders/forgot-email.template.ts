import {ForgotPasswordEmailDto, NewPasswordEmailDto} from "../dto/templates/forgot-email.dto";
import {escapeHtmlForEmail} from "../utils/email.utils";

export const buildForgotPasswordEmailTemplate = (data: ForgotPasswordEmailDto) => {
    const firstName = escapeHtmlForEmail(data.userFirstName ?? "Unknown client");

    return `<p>Dear ${firstName},</p>
            <p>It looks like you've requested a password reset for your account. Please use the following link to reset your password:</p>
            <p>Reset link: ${data.link}</p>
            <p>If you have any questions or encounter any issues, please don't hesitate to contact our support team or reply to this message.</p>
            <p>Best regards,</p>
            <p>SoundInfluencers team</p>`
};

export const buildNewPasswordEmailTemplate = (data: NewPasswordEmailDto) => {
    const firstName = escapeHtmlForEmail(data.userFirstName ?? "Unknown client");

    return `<p>Dear ${firstName},</p>
               <p>Your password has been updated</p>
               <p>Best regards,</p>
               <p>SoundInfluencers team</p>`;
}