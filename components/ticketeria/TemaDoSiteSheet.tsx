"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { TEMAS_DO_SITE, type TemaDoSite } from "@/lib/ticketeria/estados";
import { TEMAS, temaDoSite, variaveisDoTema } from "@/lib/ticketeria/temas";
import { textoSobreCor } from "@/lib/ticketeria/site";

// A folha "Tema do site": cinco temas, cada um com uma prévia pequena feita com as mesmas variáveis que o site usa. Desenho aprovado pelo dono em 20/11/2026.

/** A prévia pequena de um tema: cabeçalho na cor de destaque, um título, duas linhas de texto e um botão, no fundo, na fonte, nos cantos e no botão do tema. */
export function PreviaDoTema({ tema, cor }: { tema: TemaDoSite; cor: string }) {
  const t = TEMAS[tema];
  const v = variaveisDoTema(tema, cor);
  return (
    <div aria-hidden="true" className="w-24 shrink-0 overflow-hidden border" style={{ ...v, backgroundColor: "var(--site-fundo)", borderColor: "var(--site-borda)", borderRadius: `calc(${t.raio} * .8)` }}>
      <div className="h-2.5" style={{ backgroundColor: cor, color: textoSobreCor(cor) }} />
      <div className="space-y-1 p-1.5">
        <div className="h-1.5 w-3/5" style={{ backgroundColor: "var(--site-texto)", borderRadius: "var(--site-raio)", opacity: 0.9 }} />
        <div className="h-1 w-11/12" style={{ backgroundColor: "var(--site-texto)", opacity: 0.25, borderRadius: 2 }} />
        <div className="mt-1.5 h-2.5 w-11" style={{ backgroundColor: "var(--site-botao)", borderRadius: `calc(${t.raio} * .6)` }} />
      </div>
    </div>
  );
}

export function TemaDoSiteSheet({ siteId, temaAtual, cor, onClose, onSaved }: { siteId: string; temaAtual: string; cor: string; onClose: () => void; onSaved: () => void }) {
  const [escolha, setEscolha] = useState<TemaDoSite>(temaDoSite(temaAtual).id);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    setSalvando(true);
    setErro(null);
    const { data, error } = await clienteDaTicketeria(createClient()).from("ticketeria_sites").update({ tema: escolha }).eq("id", siteId).select("id");
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar este site." : "Não foi possível salvar o tema. Tente de novo."); return; }
    if (!data || data.length === 0) { setErro("Você não pode mudar este site."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo="Tema do site" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Salvar" onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-3">
        {erro && <Aviso texto={erro} />}
        <div role="radiogroup" aria-label="Tema do site" className="space-y-2">
          {TEMAS_DO_SITE.map(id => {
            const t = TEMAS[id];
            const marcado = escolha === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={marcado} disabled={salvando} onClick={() => setEscolha(id)} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50 ${marcado ? "border-[#1C0E33]" : "border-black/[.1] hover:border-black/25"}`}>
                <PreviaDoTema tema={id} cor={cor} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[0.8125rem] text-[#282525]" style={{ fontFamily: t.fonteDosTitulos }}>{t.nome}{marcado && <Check size={12} aria-hidden="true" />}</span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-snug text-black/55">{t.descricao}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[0.75rem] text-black/55">O tema vale na hora, na prévia e no site publicado. A cor do site continua sendo a cor de destaque.</p>
      </div>
    </TopSheet>
  );
}
