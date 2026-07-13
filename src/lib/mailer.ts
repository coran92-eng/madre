import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional mailer.
 *  - If SMTP_URL is set (e.g. smtps://user:pass@smtp.eu-provider.com:465), sends
 *    real email via nodemailer. Use an EU provider to keep RGPD compliance.
 *  - Otherwise logs to the server console so the flow works in dev without
 *    leaking links to the browser. Never surface reset URLs in HTTP responses.
 */
let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = process.env.SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

export async function sendMail(to: string, subject: string, body: string): Promise<void> {
  const from = process.env.MAIL_FROM || "no-reply@madre.local";
  const t = getTransport();

  if (!t) {
    console.log(
      `\n──── [MAIL:dev] ────\nFrom: ${from}\nTo:   ${to}\nSubj: ${subject}\n\n${body}\n────────────────────\n`
    );
    return;
  }

  try {
    await t.sendMail({ from, to, subject, text: body });
  } catch (err) {
    // Do not break the user flow (e.g. password reset) on a mail failure.
    console.error("[mailer] send failed:", err);
  }
}
