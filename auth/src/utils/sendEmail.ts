import nodemailer from "nodemailer";

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP credentials are not defined in env");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com", // for Gmail
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true, // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }, 
  });

  await transporter.sendMail({
    from: `"Chat App" <${process.env.SMTP_USER}>`, // sender address
    to,
    subject,
    html,
  });
};
