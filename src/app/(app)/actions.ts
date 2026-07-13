"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser, destroySession, clientIp } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";

export async function setLang(lang: string) {
  cookies().set(LANG_COOKIE, normalizeLang(lang), { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) {
    await audit({ actorId: user.id, actorEmail: user.email, action: "auth.logout", entity: "User", entityId: user.id, ip: clientIp() });
  }
  await destroySession();
  redirect("/login");
}
