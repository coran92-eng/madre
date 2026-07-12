import "server-only";

/**
 * Pluggable transactional mailer. In production wire an EU SMTP/API provider
 * (env: SMTP_URL / MAIL_FROM). Until then it logs to the server console so the
 * password-reset flow is fully functional in dev without leaking links to the
 * browser. Never surface the reset URL in the HTTP response.
 */
export async function sendMail(to: string, subject: string, body: string): Promise<void> {
  const from = process.env.MAIL_FROM || "no-reply@madre.local";
  // TODO: integrate real provider here (nodemailer / API) when SMTP is configured.
  console.log(
    `\n──── [MAIL] ────\nFrom: ${from}\nTo:   ${to}\nSubj: ${subject}\n\n${body}\n────────────────\n`
  );
}
