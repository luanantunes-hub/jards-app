"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { enderecoDoEvento } from "@/lib/ticketeria/evento-site";

// A linha "Página no site" da tela do evento (C2; desenho aprovado pelo dono em 20/11/2026): o endereço da página do evento no domínio do produtor, com Copiar. Só aparece com o evento
// publicado, o site no ar e um domínio ativo; sem isso, a página não existe e a linha não aparece.

export function PaginaDoEventoNoSite({ lojaId, slug, publicado }: { lojaId: string; slug: string; publicado: boolean }) {
  const [dominio, setDominio] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"parado" | "copiado" | "erro">("parado");

  useEffect(() => {
    if (!publicado) return;
    let ativo = true;
    void (async () => {
      const t = clienteDaTicketeria(createClient());
      const { data: site } = await t.from("ticketeria_sites").select("id, situacao").eq("loja_id", lojaId).maybeSingle();
      if (!site || site.situacao !== "publicado") return;
      const { data: dominios } = await t.from("ticketeria_site_dominios").select("dominio").eq("site_id", site.id).eq("situacao", "ativo").order("created_at").limit(1);
      if (ativo) setDominio(dominios?.[0]?.dominio ?? null);
    })();
    return () => { ativo = false; };
  }, [lojaId, publicado]);

  if (!publicado || !dominio) return null;
  const endereco = enderecoDoEvento(dominio, slug);

  async function copiar() {
    try { await navigator.clipboard.writeText(endereco); setCopiado("copiado"); setTimeout(() => setCopiado("parado"), 3000); } catch { setCopiado("erro"); }
  }

  return (
    <div className="mb-6 flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-black/[.1] bg-white px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Página no site</p>
        <a href={endereco} target="_blank" rel="noopener noreferrer" className="block break-all text-[0.8125rem] text-[#282525] underline-offset-2 hover:underline">{endereco.replace(/^https:\/\//, "")}</a>
      </div>
      <button type="button" onClick={() => void copiar()} aria-live="polite" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl text-[0.75rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
        {copiado === "copiado" && <Check size={12} aria-hidden="true" className="text-[#2E8932]" />}
        {copiado === "erro" ? "Não foi possível copiar" : copiado === "copiado" ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
