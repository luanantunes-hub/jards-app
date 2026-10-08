// Área do convidado (P5.3): quem acompanha prestações de outras organizações
// por convite. Fica fora do painel, que é da organização da própria conta.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SairDoConvidado } from "./SairDoConvidado";

export const metadata: Metadata = {
  title: "Acesso de convidado",
  robots: { index: false, follow: false },
};

export default async function LayoutDoConvidado({ children }: { children: React.ReactNode }) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login?next=/convidado");

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <header className="border-b bg-white" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="mx-auto flex h-14 max-w-pagina items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/convidado" className="flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo em SVG estático */}
            <img src="/jards-logo.svg" alt="Jards" className="h-5" />
            <span className="hidden text-[0.75rem] text-black/45 sm:inline">Acesso de convidado</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-[0.75rem] text-black/45 md:inline">{user.email}</span>
            <Link href="/dashboard" className="rounded px-2 py-1.5 text-[0.75rem] text-black/55 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              Minha conta
            </Link>
            <SairDoConvidado />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
