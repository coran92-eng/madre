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

// nodemailer.createTransport({ url, ...otherOptions }) silently DISCARDS
// otherOptions — internally it re-parses just the url string and ignores
// everything else passed alongside it. So connection timeouts must be set by
// parsing the URL ourselves into a plain options object instead of relying
// on the string/url shorthand.
function parseSmtpUrl(raw: string) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : u.protocol === "smtps:" ? 465 : 587,
    secure: u.protocol === "smtps:",
    auth: u.username ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined,
    // Sin esto, un proveedor SMTP inalcanzable (puerto bloqueado, host
    // equivocado...) deja la conexión colgada indefinidamente en vez de
    // fallar rápido — grave en serverless, donde eso agota el tiempo de la
    // función entera en vez de solo el envío del email.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  };
}

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = process.env.SMTP_URL;
  transporter = url ? nodemailer.createTransport(parseSmtpUrl(url)) : null;
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

/**
 * Checks the SMTP connection + auth without sending an email (nodemailer's
 * transporter.verify()). Used by /api/health so a misconfigured provider
 * (bad credentials, unverified sender, blocked port...) shows the real error
 * instead of emails silently vanishing into the function logs.
 */
export async function verifyMailer(): Promise<{ configured: boolean; ok?: boolean; error?: string }> {
  const t = getTransport();
  if (!t) return { configured: false };
  try {
    await t.verify();
    return { configured: true, ok: true };
  } catch (err) {
    return { configured: true, ok: false, error: err instanceof Error ? err.message.split("\n")[0] : "error desconocido" };
  }
}
