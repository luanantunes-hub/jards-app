"use client";

import { useEffect, useState } from "react";
import { DIAS_DEPOIS, fraseDoEfeito, fraseDoPico, type PicoSemExplicacao } from "@/lib/ticketeria/imprensa";
import type { ImprensaDaLoja } from "@/lib/ticketeria/imprensa-servidor";

// A imprensa na aba Ações e gasto (lib/ticketeria/imprensa.ts): o aviso de venda que subiu sem anúncio a mais ("saiu algo na imprensa?") e cada crítica ou matéria com o que as vendas
// mostraram, mais o peso de cada veículo na casa. Os dados vêm de GET /api/ticketeria/lojas/{id}/imprensa (só quem edita a Ticketeria).

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";

/** A imprensa da loja; null enquanto carrega ou quando não dá para ler (a aba segue sem ela). */
export function useImprensa(lojaId: string | null, versao = 0): ImprensaDaLoja | null {
  const [dados, setDados] = useState<{ chave: string; imprensa: ImprensaDaLoja } | null>(null);
  const chave = `${lojaId}|${versao}`;
  useEffect(() => {
    if (!lojaId) return;
    let ativo = true;
    void fetch(`/api/ticketeria/lojas/${lojaId}/imprensa`)
      .then(r => (r.ok ? (r.json() as Promise<ImprensaDaLoja>) : null))
      .then(i => { if (ativo && i) setDados({ chave, imprensa: i }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [lojaId, chave]);
  return dados?.chave === chave ? dados.imprensa : null;
}

/** As vendas subiram sem anúncio a mais: saiu algo na imprensa? */
export function PicoSemExplicacaoAviso({ pico, onRegistrar, onDescartar }: { pico: PicoSemExplicacao; onRegistrar: () => void; onDescartar: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-[0.875rem] text-[#282525]">As vendas subiram sem anúncio a mais</p>
        <p className="mt-1 text-[0.78rem] leading-relaxed text-black/55">{fraseDoPico(pico)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button type="button" onClick={onDescartar} className="text-[0.78rem] text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Não foi imprensa</button>
        <button type="button" onClick={onRegistrar} className="inline-flex h-10 items-center rounded-xl bg-[#7259B5] px-4 text-[0.78rem] font-normal text-white transition hover:bg-[#634CA3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Sim, registrar</button>
      </div>
    </div>
  );
}

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** As críticas e matérias marcadas, com o que as vendas mostraram em cada uma, e o peso de cada veículo na casa. Nada aparece sem marcação. */
export function ImprensaDaLojaView({ imprensa, onAbrir }: { imprensa: ImprensaDaLoja; onAbrir?: (id: string) => void }) {
  if (imprensa.marcacoes.length === 0) return null;
  const medidos = imprensa.veiculos.filter(v => v.media !== null);
  return (
    <section aria-labelledby="imprensa-da-loja" className="space-y-2">
      <h3 id="imprensa-da-loja" className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Imprensa</h3>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[40rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Veículo e assunto</th><th className={CABECALHO}>Saiu em</th><th className={CABECALHO}>Evento</th><th className={CABECALHO}>O que as vendas mostraram</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {imprensa.marcacoes.map(m => (
              <tr key={m.id} className={onAbrir ? "cursor-pointer hover:bg-black/[.02]" : undefined} onClick={onAbrir ? () => onAbrir(m.id) : undefined}>
                <td className={CELULA}>{m.veiculo}{m.assunto && <span className="text-black/45"> · {m.assunto}</span>}</td>
                <td className={`${CELULA} tabular-nums`}>{diaMes(m.dia)}</td>
                <td className={CELULA}>{m.evento ?? <span className="text-black/45">Da casa toda</span>}</td>
                <td className="px-4 py-3">
                  {m.efeito.tipo === "efeito"
                    ? <span className="inline-flex rounded-xl border px-2.5 py-0.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{fraseDoEfeito(m.efeito)}</span>
                    : <span className="text-[0.75rem] text-black/45">{fraseDoEfeito(m.efeito)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-4xl text-[0.75rem] leading-relaxed text-black/45">
        O efeito de cada marcação vem das vendas daquele evento: os {DIAS_DEPOIS} dias depois de sair, comparados com o que ele vinha vendendo, sem a mudança de anúncio.
        {medidos.length > 0 && <> Por veículo, na sua casa: {medidos.map((v, i) => <span key={v.veiculo}>{i > 0 && "; "}<span className="text-[#282525]">{v.veiculo}</span>, {v.vezes === 1 ? "1 vez" : `${v.vezes} vezes`}, {v.media && v.media > 0 ? `em média cerca de ${v.media} a mais` : "sem diferença nas vendas"}</span>)}.</>}
        {" "}Nada aqui vem de uma lista de veículos importantes: o peso é o que o seu público mostrou.
      </p>
    </section>
  );
}
