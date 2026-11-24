"use client";

import { rotuloDoCanalDeGasto } from "@/lib/ticketeria/modelo";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { EventoEsgotado, EventoQuaseEsgotado } from "@/lib/ticketeria/esgotamento";

// Os avisos de esgotamento na aba Ações e gasto: o anúncio que continua gastando com o evento esgotado (pare no Meta e no Google: o Jards só lê) e o evento quase esgotado.
// Só desenho: os dados chegam por props (lib/ticketeria/esgotamento.ts).

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const diaEMes = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;

export function AvisosDeEsgotamento({ esgotados, quase }: { esgotados: EventoEsgotado[]; quase: EventoQuaseEsgotado[] }) {
  if (esgotados.length === 0 && quase.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {esgotados.map(e => (
        <div key={e.eventoId} role="alert" className="rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(178,59,59,.3)", background: "#FFF8F7" }}>
          <p className="text-[0.875rem] text-[#282525]">Anúncio rodando com o evento esgotado</p>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-black/60">
            {e.evento} esgotou {e.sessoes === 1 ? "a sessão" : `as ${e.sessoes} sessões`} em {diaEMes(e.esgotouEm)}. Desde então, as campanhas {e.sessoes === 1 ? "do evento" : `do ${e.evento}`} gastaram <span className="text-[#282525]">{formatarMoeda(e.totalDepois)}</span> ({Object.entries(e.gastoDepois).map(([c, v]) => `${rotuloDoCanalDeGasto(c)} ${formatarMoeda(v)}`).join(" · ")}){e.porDia > 0 ? `, cerca de ${formatarMoeda(e.porDia)} por dia` : ""}.
          </p>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-black/60">O Jards só lê os anúncios: pause essas campanhas no Meta e no Google. Se quiser manter o nome em evidência, mude a campanha para a próxima atração.</p>
        </div>
      ))}
      {quase.map(q => (
        <p key={q.eventoId} className="rounded-xl border px-4 py-2.5 text-[0.78rem] text-black/60" style={{ borderColor: "rgba(176,122,20,.3)", background: "#FFFBF2" }}>
          Fique de olho: <span className="text-[#282525]">{q.evento}</span> está com {Math.round(q.parteVendida * 100)}% vendido e {q.diasAteASessao <= 0 ? "a sessão é hoje" : q.diasAteASessao === 1 ? "falta 1 dia" : `faltam ${q.diasAteASessao} dias`}. Antes de pôr mais dinheiro em anúncio, veja quantos lugares restam.
        </p>
      ))}
      {esgotados.length > 0 && <p className="text-[0.6875rem] text-black/45">O gasto depois de esgotar vem das campanhas marcadas com o evento (aba Conexões). Campanha sem marcação não entra nesta conta.</p>}
    </div>
  );
}
