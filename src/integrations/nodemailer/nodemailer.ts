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

const sendMail = async (to = '', title = '', text = '', type = '', path = '') => {
    const mailOptions = (() => {
        if (type === 'pdf') {
            return {
                from: process.env.EMAIL_USER,
                to: process.env.NODE_ENV === 'development' ? 'process.env.EMAIL_USER' : to,
                subject: title,
                html: text,
                attachments: [
                    {
                        filename: 'invoice.pdf',
                        path,
                    },
                ],
            };
        } else if (type === 'html') {
            return {
                from: process.env.EMAIL_USER,
                to: process.env.NODE_ENV === 'development' ? 'process.env.EMAIL_USER' : to,
                subject: title,
                html: text,
            };
        } else {
            return {
                from: process.env.EMAIL_USER,
                to: process.env.NODE_ENV === 'development' ? 'process.env.EMAIL_USER' : to,
                subject: title,
                text: text,
            };
        }
    })();

    transporter.sendMail(mailOptions, (error, info) => {
        const timestamp = new Date().toLocaleString();
        if (error) {
            console.error(
                'Ошибка при отправке письма на почту ' + mailOptions.to + ' ',
                error,
                timestamp,
            );
        } else {
            console.log('Письмо успешно отправлено на почту ' + mailOptions.to + ' ');
            console.log('ID сообщения:', info.messageId, timestamp);
        }
    });
};

export default sendMail;
