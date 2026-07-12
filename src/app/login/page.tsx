import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await needsSetup()) redirect("/setup");
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-bold text-madre">MADRE</h1>
          <p className="text-stone-500 text-sm mt-1">Gestión de personal</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
