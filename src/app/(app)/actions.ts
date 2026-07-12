"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, destroySession, clientIp } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function logout() {
  const user = await getCurrentUser();
  if (user) {
    await audit({ actorId: user.id, actorEmail: user.email, action: "auth.logout", entity: "User", entityId: user.id, ip: clientIp() });
  }
  await destroySession();
  redirect("/login");
}
