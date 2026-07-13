import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/auth";

// La raíz consulta la BD (asistente de arranque): nunca se prerenderiza.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (await needsSetup()) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
