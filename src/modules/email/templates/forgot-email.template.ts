import {ForgotPasswordEmailDto, NewPasswordEmailDto} from "../dto/forgot-email.dto";
import {escapeHtml} from "./campaign-email.template";

export const buildForgotPasswordEmailTemplate = (data: ForgotPasswordEmailDto) => {
    const firstName = escapeHtml(data.userFirstName ?? "Unknown client");

    return `<p>Dear ${firstName},</p>
            <p>It looks like you've requested a password reset for your account. Please use the following confirmation code to reset your password:</p>
            <p>Confirmation Code: ${data.code}</p>
            <p>You can reset your password by clicking on the 'Forgot Password' link on our website and entering this confirmation code when prompted.</p>
            <p>If you have any questions or encounter any issues, please don't hesitate to contact our support team or reply to this message.</p>
            <p>Best regards,</p>
            <p>SoundInfluencers team</p>`
};

export const buildNewPasswordEmailTemplate = (data: NewPasswordEmailDto) => {
    const firstName = escapeHtml(data.userFirstName ?? "Unknown client");

    return `<p>Dear ${firstName},</p>
               <p>This is your temporary password: ${data.password}</p>
               <p>Best regards,</p>
               <p>SoundInfluencers team</p>`;
}