import nodemailer from "nodemailer";

/**
 * Utility function to send an email using nodemailer.
 * Configured via environment variables:
 * - MAIL_HOST (e.g., smtp.gmail.com)
 * - MAIL_PORT (e.g., 587 or 465)
 * - MAIL_USER (your SMTP email address)
 * - MAIL_PASS (your SMTP password or App Password)
 */
const mailSender = async (
  email: string,
  title: string,
  body: string,
): Promise<any> => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: false, // true for port 465, false for 587
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Real-Time Kanban Board" <${process.env.MAIL_USER || "no-reply@kanban.com"}>`,
      to: `${email}`,
      subject: `${title}`,
      html: `${body}`,
    });

    console.log("Email sent successfully: ", info.messageId || info.response);
    return info;
  } catch (error) {
    console.error("Error occurred while sending mail: ", error);
    throw error;
  }
};

export default mailSender;
