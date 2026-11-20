"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { AVISO_DO_PARCELAMENTO, ESCOLHAS_DE_PARCELAS, frasesDoParcelamento, mensagemDoErroDoParcelamento, rotuloDaEscolha } from "@/lib/ticketeria/parcelas";

// O parcelamento no cartão, em Recebimentos: o cartão mostra até quantas vezes a loja oferece; "Mudar" abre a folha com as escolhas (edição sempre por folha, nunca campo solto).

const LINK = "rounded-xl text-[0.8125rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

export function CartaoDoParcelamento({ parcelasMax, podeEditar = false, onMudar }: { parcelasMax: number; podeEditar?: boolean; onMudar?: () => void }) {
  return (
    <section aria-label="Parcelamento no cartão" className="rounded-xl border border-black/[.1] bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[0.9375rem] font-normal text-[#282525]">Parcelamento no cartão</h2>
          <p className="mt-1 max-w-xl text-[0.8125rem] text-black/60">{frasesDoParcelamento(parcelasMax)}</p>
        </div>
        {podeEditar && onMudar && <button type="button" onClick={onMudar} className={`shrink-0 ${LINK}`}>Mudar</button>}
      </div>
    </section>
  );
}

export function ParcelamentoSheet({ lojaId, parcelasMax, onClose, onSaved }: { lojaId: string; parcelasMax: number; onClose: () => void; onSaved: () => void }) {
  const [escolha, setEscolha] = useState(parcelasMax);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    setSalvando(true);
    setErro(null);
    const { data, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").update({ parcelas_max: escolha }).eq("id", lojaId).select("id");
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoParcelamento(error)); return; }
    // Sem erro e sem linha: a política do banco não deixou gravar.
    if (!data || data.length === 0) { setErro(mensagemDoErroDoParcelamento({ code: "42501" })); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo="Parcelamento no cartão" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Salvar" onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div role="radiogroup" aria-label="Até quantas vezes" className="space-y-1.5">
          {ESCOLHAS_DE_PARCELAS.map(n => {
            const marcada = escolha === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={marcada}
                disabled={salvando}
                onClick={() => setEscolha(n)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[0.8125rem] text-[#282525] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50 ${marcada ? "border-[#1C0E33]" : "border-black/[.1] hover:border-black/25"}`}
              >
                <span>{rotuloDaEscolha(n)}</span>
                {marcada ? <Check size={14} aria-hidden="true" /> : n === 1 ? <span className="text-[0.6875rem] text-black/40">padrão</span> : null}
              </button>
            );
          })}
        </div>
        <p className="text-[0.75rem] text-black/55">{AVISO_DO_PARCELAMENTO}</p>
      </div>
    </TopSheet>
  );
}
