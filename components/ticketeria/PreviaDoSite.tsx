"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { enderecoDaPrevia, medidasDaPrevia, type ModoDaPrevia } from "@/lib/ticketeria/editor-site";

// A prévia ao lado do editor de páginas (construtor, passo 3; desenho aprovado pelo dono em 20/11/2026): a página de verdade (o rascunho, a mesma de "Ver a prévia") num quadro do tamanho de um
// celular ou de um computador (reduzido). `versao` muda a cada mudança no editor, e o quadro recarrega sozinho.

const MODOS: { modo: ModoDaPrevia; rotulo: string; Icone: typeof Smartphone }[] = [{ modo: "celular", rotulo: "Celular", Icone: Smartphone }, { modo: "computador", rotulo: "Computador", Icone: Monitor }];

export function PreviaDoSite({ siteId, slug, versao, modoInicial = "celular" }: { siteId: string; slug: string; versao: number; modoInicial?: ModoDaPrevia }) {
  const [modo, setModo] = useState<ModoDaPrevia>(modoInicial);
  const m = medidasDaPrevia(modo);
  return (
    <aside aria-label="Prévia do rascunho" className="rounded-xl border border-black/[.1] bg-white p-3 lg:sticky lg:top-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[0.8125rem] font-normal text-[#282525]">Prévia do rascunho</h3>
        <div role="group" aria-label="Tamanho da prévia" className="flex overflow-hidden rounded-xl border border-black/[.12] text-[0.75rem]">
          {MODOS.map(({ modo: id, rotulo, Icone }) => (
            <button key={id} type="button" aria-pressed={modo === id} onClick={() => setModo(id)} className={`inline-flex h-8 items-center gap-1.5 px-2.5 transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${modo === id ? "bg-[#1C0E33] text-white" : "text-black/60 hover:bg-black/[.04]"}`}>
              <Icone size={13} aria-hidden="true" />{rotulo}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center overflow-hidden rounded-xl bg-black/[.04] p-2" style={{ height: m.alturaVista + 16 }}>
        <div style={{ width: modo === "celular" ? m.largura : m.larguraVista - 16, height: m.alturaVista, overflow: "hidden", borderRadius: modo === "celular" ? 20 : 8, border: "3px solid #282525", background: "#fff" }}>
          <iframe
            key={`${slug}-${versao}-${modo}`}
            src={enderecoDaPrevia(siteId, slug)}
            title={`Prévia da página ${slug}`}
            loading="lazy"
            style={{ width: m.largura, height: m.altura, border: 0, transform: `scale(${m.escala})`, transformOrigin: "top left" }}
          />
        </div>
      </div>
      <p className="mt-2 text-[0.6875rem] leading-snug text-black/50">É a página de verdade, no tamanho do {modo === "celular" ? "celular" : "computador (reduzida)"}, e se atualiza a cada mudança.</p>
    </aside>
  );
}
