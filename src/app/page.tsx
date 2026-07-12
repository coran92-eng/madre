import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  if (await needsSetup()) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
