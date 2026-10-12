const nodemailer = require("nodemailer");


// =====================================================
// TRANSPORTEUR SMTP
// Identifiants dans le .env (SMTP_*)
// =====================================================

const transporter = nodemailer.createTransport({

    host: process.env.SMTP_HOST,

    port: Number(process.env.SMTP_PORT),

    secure: process.env.SMTP_SECURE === "true",

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }

});


// Expéditeur affiché dans les e-mails
transporter.from =
    `"${process.env.SMTP_FROM_NAME || "Fléchissons"}" <${process.env.SMTP_USER}>`;


module.exports = transporter;
