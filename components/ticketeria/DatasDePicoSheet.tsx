"use client";

import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import type { CamposDaDataDePico, DataDePico } from "@/lib/ticketeria/modelo-controles";

// A folha "Adicionar uma data sua" da aba Modelo: as datas de pico da loja (a festa da cidade, a semana do teatro) que o modelo soma ao calendário nacional. Só desenho: os dados e as ações
// chegam por props.

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function DatasDePicoSheet({ datas, valores, erro, salvando, onMudar, onClose, onAdicionar, onApagar }: {
  datas: DataDePico[]; valores: CamposDaDataDePico; erro?: string | null; salvando?: boolean;
  onMudar?: (campo: keyof CamposDaDataDePico, valor: string) => void; onClose: () => void; onAdicionar?: () => void; onApagar?: (id: string) => void;
}) {
  return (
    <TopSheet titulo="Datas de pico" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={!!salvando} rotulo="Adicionar data" onSalvar={() => onAdicionar?.()} />}>
      <div className="space-y-4">
        <p className="max-w-xl text-[0.75rem] leading-relaxed text-black/50">O modelo já conhece Carnaval, Dia das Mães, Black Friday, Natal e os outros feriados. Acrescente aqui o que só a sua loja tem: a festa da cidade, a semana do teatro. A semana dessa data conta como semana de pico.</p>
        {erro && <Aviso texto={erro} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor="dp-dia">Dia</label><input id="dp-dia" type="date" className={CAMPO} value={valores.dia} onChange={e => onMudar?.("dia", e.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="dp-nome">Nome</label><input id="dp-nome" className={CAMPO} value={valores.nome} onChange={e => onMudar?.("nome", e.target.value)} placeholder="Festa da cidade" maxLength={60} disabled={salvando} /></div>
        </div>
        {datas.length > 0 && (
          <div>
            <span className={ROTULO}>As suas datas</span>
            <ul className="divide-y divide-black/[.08] rounded-xl border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              {datas.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.8125rem] text-[#282525]">
                  <span><span className="tabular-nums text-black/50">{dataBr(d.dia)}</span> · {d.nome}</span>
                  <button type="button" onClick={() => onApagar?.(d.id)} disabled={salvando} className="rounded-xl text-[0.75rem] text-black/40 underline-offset-2 hover:text-black/60 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Remover</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </TopSheet>
  );
}
