"use client";

import { useId, useState } from "react";
import { Check, Copy, Printer, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { minutaEmTexto, type Minuta } from "@/lib/prestacao/alteracoes";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtSinal = (v: number) => (v > 0 ? `+${fmt(v)}` : fmt(v));

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

/** Página de impressão da minuta, aberta numa janela própria. */
function imprimir(minuta: Minuta) {
  const janela = window.open("", "_blank", "noopener=no,width=820,height=900");
  if (!janela) return;
  const linhas = minuta.linhas.map(l =>
    `<tr><td>${escapar(l.item)}</td><td class="n">${fmt(l.de)}</td><td class="n">${fmt(l.para)}</td><td class="n">${fmtSinal(l.diferenca)}</td></tr>`).join("");
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(minuta.titulo)}</title>
<style>
body{font-family:Georgia,serif;color:#111;margin:2.5rem;line-height:1.5;font-size:12pt}
h1{font-size:14pt;margin:0 0 .25rem}p{margin:.6rem 0}h2{font-size:11pt;margin:1.2rem 0 .3rem;text-transform:uppercase;letter-spacing:.06em}
table{width:100%;border-collapse:collapse;font-size:10.5pt;margin-top:.4rem}th,td{border-bottom:1px solid #ccc;padding:.35rem .4rem;text-align:left}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
</style></head><body>
<h1>${escapar(minuta.titulo)}</h1><p>Ao ${escapar(minuta.destinatario)}</p>
<p>${escapar(minuta.abertura)}</p>
<h2>Justificativa</h2><p>${escapar(minuta.justificativa).replace(/\n/g, "<br>")}</p>
<h2>Itens</h2><table><thead><tr><th>Item</th><th class="n">Vigente</th><th class="n">Proposto</th><th class="n">Diferença</th></tr></thead><tbody>${linhas}</tbody></table>
<p>Valor total do projeto: de ${fmt(minuta.totais.antes)} para ${fmt(minuta.totais.depois)} (${fmtSinal(minuta.totais.diferenca)}).</p>
<p style="margin-top:2.5rem">${escapar(minuta.fecho)}</p>
</body></html>`);
  janela.document.close();
  janela.focus();
  janela.print();
}

/**
 * Minuta do pedido ao órgão, montada do cálculo salvo na alteração. A pessoa
 * revisa, copia para o sistema oficial (no Salic, a readequação) ou imprime.
 */
export function MinutaAlteracao({ minuta, onClose }: { minuta: Minuta; onClose: () => void }) {
  const titleId = useId();
  useModalDismiss(onClose);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(minutaEmTexto(minuta));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-[44rem] flex-col overflow-hidden rounded bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div>
            <h2 id={titleId} className="text-[0.875rem] font-semibold text-[#0D0D0D]">Minuta do pedido</h2>
            <p className="text-[0.6875rem] text-black/40">Texto-base para revisar e levar ao sistema oficial.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1.5 text-black/35 transition hover:bg-black/5 hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={15} />
          </button>
        </div>

        <article className="flex-1 space-y-3 overflow-y-auto px-6 py-5 text-[0.8125rem] leading-6 text-black/80">
          <div>
            <h3 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">{minuta.titulo}</h3>
            <p className="text-black/55">Ao {minuta.destinatario}</p>
          </div>
          <p>{minuta.abertura}</p>
          <div>
            <h4 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Justificativa</h4>
            <p className="whitespace-pre-line">{minuta.justificativa}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-[0.75rem]">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  {["Item", "Vigente", "Proposto", "Diferença"].map((titulo, i) => (
                    <th key={titulo} scope="col" className={`py-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40 ${i ? "text-right" : "text-left"}`}>{titulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {minuta.linhas.map((linha, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                    <td className="py-1.5 pr-3">{linha.item}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(linha.de)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(linha.para)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtSinal(linha.diferenca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Valor total do projeto: de {fmt(minuta.totais.antes)} para {fmt(minuta.totais.depois)} ({fmtSinal(minuta.totais.diferenca)}).</p>
          <p className="pt-2 text-black/60">{minuta.fecho}</p>
        </article>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={() => imprimir(minuta)} className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.14)" }}>
            <Printer size={13} aria-hidden /> Imprimir
          </button>
          <button type="button" onClick={copiar} className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-semibold text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98]">
            {copiado ? <><Check size={13} aria-hidden /> Copiado</> : <><Copy size={13} aria-hidden /> Copiar texto</>}
          </button>
        </div>
      </div>
    </div>
  );
}
