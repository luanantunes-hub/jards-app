"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro não tratado na rota", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-black/35">Erro inesperado</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-.03em] text-[#282525]">Não foi possível abrir esta área.</h1>
        <p className="mt-2 text-sm leading-6 text-black/45">Tente novamente. Se o problema continuar, a equipe poderá localizar o erro pelo registro desta ocorrência.</p>
        <button
          onClick={reset}
          className="mt-6 rounded border border-[#2E8932] bg-white px-4 py-2.5 text-[0.8125rem] font-semibold text-[#2E8932] transition hover:bg-black/[.04]"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}

