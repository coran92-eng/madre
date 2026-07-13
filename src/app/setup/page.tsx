import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/bootstrap";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  const year = new Date().getUTCFullYear();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-bold text-madre">MADRE</h1>
          <p className="text-stone-500 text-sm mt-1">
            Asistente de primer arranque · Corte de Manga
          </p>
        </div>
        <SetupForm defaultYear={year} />
        <p className="text-xs text-stone-400 text-center mt-4">
          Este asistente solo aparece una vez: crea la cuenta superadmin, el local y
          la configuración de vacaciones del año. Todo lo demás se gestiona después
          desde el panel.
        </p>
      </div>
    </main>
  );
}
