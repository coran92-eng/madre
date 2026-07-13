"use client";

import Link from "next/link";

export default function AppError({ error }: { error: Error & { digest?: string } }) {
  const denied = /permiso|autenticado/i.test(error.message);
  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <div className="card p-8">
        <h1 className="text-xl font-bold text-stone-900">
          {denied ? "Sin permiso" : "Algo ha ido mal"}
        </h1>
        <p className="text-stone-500 mt-2 text-sm">
          {denied
            ? "No tienes acceso a esta sección con tu rol."
            : "Ha ocurrido un error inesperado. Inténtalo de nuevo."}
        </p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
