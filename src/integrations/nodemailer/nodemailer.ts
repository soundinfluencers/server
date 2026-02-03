const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.eu',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// todo: сделать так чтобы sendMail принимал один обьект + создать утилиту которая будет билдить этот обьект
const sendMail = async (to = '', title = '', text = '', type = '', path = '') => {
    const mailOptions = (() => {
        if (type === 'pdf') {
            return {
                from: process.env.EMAIL_USER,
                to,
                subject: title,
                html: text,
                attachments: [{ filename: 'invoice.pdf', path }],
            };
        }

        if (type === 'html') {
            return {
                from: process.env.EMAIL_USER,
                to: process.env.NODE_ENV === 'development' ? process.env.EMAIL_USER : to,
                subject: title,
                html: text,
            };
        }

        return {
            from: process.env.EMAIL_USER,
            to: process.env.NODE_ENV === 'development' ? process.env.EMAIL_USER : to,
            subject: title,
            text,
        };
    })();

    return transporter.sendMail(mailOptions);
};

export default sendMail;
