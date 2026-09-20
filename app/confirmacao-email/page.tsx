"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle, CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmacaoEmailPage() {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setConfirmed(Boolean(data.user?.email_confirmed_at)));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <section className="w-full max-w-sm text-center">
        <img src="/jards-logo.svg" alt="Jards" className="mx-auto mb-10 h-7" />
        {confirmed === null ? (
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#7259B5]" aria-label="Validando confirmação" />
        ) : confirmed === false ? (
          <>
            <CircleAlert size={42} className="mx-auto mb-5 text-[#B07A14]" strokeWidth={1.5} />
            <h1 className="font-display text-2xl font-bold text-[#0D0D0D]">Link inválido ou expirado</h1>
            <p className="mt-3 text-sm leading-6 text-black/50">Tente entrar novamente ou solicite um novo cadastro.</p>
            <a href="/login" className="mt-7 inline-flex items-center gap-2 rounded border border-black/12 bg-white px-4 py-2.5 text-sm font-medium text-black/60 transition hover:bg-black/[.04]">
              Ir para o login <ArrowRight size={14} />
            </a>
          </>
        ) : (
          <>
            <CheckCircle size={42} className="mx-auto mb-5 text-[#2E8932]" strokeWidth={1.5} />
            <h1 className="font-display text-2xl font-bold text-[#0D0D0D]">E-mail confirmado</h1>
            <p className="mt-3 text-sm leading-6 text-black/50">Sua conta está pronta. Você já pode acessar seu espaço no Jards.</p>
            <a href="/dashboard" className="mt-7 inline-flex items-center gap-2 rounded border border-[#7259B5]/25 bg-white px-4 py-2.5 text-sm font-medium text-[#7259B5] transition hover:bg-black/[.04]">
              Entrar no Jards <ArrowRight size={14} />
            </a>
          </>
        )}
      </section>
    </main>
  );
}
