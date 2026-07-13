import { redirect } from "next/navigation";
import { getPendingTwoFactorSession } from "@/lib/auth";
import VerifyTwoFactorForm from "./VerifyTwoFactorForm";

export const dynamic = "force-dynamic";

export default async function VerifyTwoFactorPage() {
  const session = await getPendingTwoFactorSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-bold text-madre">MADRE</h1>
          <p className="text-stone-500 text-sm mt-1">Verificación en dos pasos</p>
        </div>
        <VerifyTwoFactorForm email={session.user.email} />
      </div>
    </main>
  );
}
