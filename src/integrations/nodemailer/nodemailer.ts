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
const sendMail = async (to = '', title = '', text = '', type = '', path: string | Buffer = '') => {
    const mailOptions = (() => {
        if (type === 'pdf') {
            const attachment =
                Buffer.isBuffer(path)
                    ? { filename: 'invoice.pdf', content: path, contentType: 'application/pdf' }
                    : { filename: 'invoice.pdf', path };

            return {
                from: process.env.EMAIL_USER,
                to: process.env.NODE_ENV === 'development' ? process.env.EMAIL_USER : to,
                subject: title,
                html: text,
                attachments: [attachment],
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
