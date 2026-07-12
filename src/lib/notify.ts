import "server-only";
import { sendMail } from "./mailer";

/**
 * Notify a person by email. Thin wrapper over the mailer so notification call
 * sites stay declarative; in dev (no SMTP) the message is logged to the console.
 * Never throws into the caller — a failed notification must not roll back a
 * completed business action.
 */
export async function notify(to: string | null | undefined, subject: string, body: string): Promise<void> {
  if (!to) return;
  try {
    await sendMail(to, `MADRE · ${subject}`, `${body}\n\n— Corte de Manga`);
  } catch (err) {
    console.error("[notify] failed", subject, err);
  }
}
