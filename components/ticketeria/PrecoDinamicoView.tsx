import type { ReactNode } from "react";
import { quandoDaSessao } from "@/lib/ticketeria/eventos";
import { REGRA_PADRAO, textoDoFator } from "@/lib/ticketeria/preco-dinamico";
import type { FatorDaSessao, RegraDoEvento } from "@/lib/ticketeria/preco-dinamico-servidor";

// O cartão da adesão ao preço dinâmico (plano da Ticketeria, seção 11, P2b), sem busca de dados nem imports pesados: roda nos testes (tests/ticketeria-preco-dinamico-view.test.ts).

type RegraOuNada = RegraDoEvento | null;

export const pctDe = (bps: number) => String(Math.abs(bps) / 100).replace(".", ",");
export const horasDe = (min: number) => String(min / 60).replace(".", ",");


/** O cartão, sem busca de dados: o estado da adesão e o fator de cada sessão (roda nos testes). */
export function PrecoDinamicoView({ regra, fatores, sessoes, acao }: { regra: RegraOuNada; fatores: FatorDaSessao[]; sessoes: { id: string; inicio: string; fuso: string }[]; /** O botão de configurar, já pronto (fica fora daqui para o cartão rodar nos testes). */ acao?: ReactNode }) {
  const ativo = regra?.ativo === true;
  const r = regra ?? { ...REGRA_PADRAO, ativo: false, aceiteEm: null, aceiteVersao: null };
  return (
    <section aria-labelledby="preco-dinamico-do-evento" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="preco-dinamico-do-evento" className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Preço dinâmico</h2>
        {acao}
      </div>
      <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <p className="text-[0.8125rem] text-[#282525]">{ativo ? "Ligado" : "Desligado"}
          <span className="text-black/50"> · {ativo ? `o preço pode baixar até ${pctDe(r.pisoBps)}% e subir até ${pctDe(r.tetoBps)}%, ${pctDe(r.passoBps)}% por vez, no máximo a cada ${horasDe(r.intervaloMinutos)} h` : "cada sessão cobra o preço que você definiu no lote"}</span>
        </p>
        {ativo && r.aceiteEm && <p className="mt-0.5 text-[0.6875rem] text-black/45">Aceite de {new Date(r.aceiteEm).toLocaleDateString("pt-BR")}.</p>}
        {ativo && sessoes.length > 0 && (
          <ul className="mt-3 divide-y divide-black/[.06]">
            {sessoes.map(s => {
              const dosSetores = fatores.filter(x => x.sessaoId === s.id).sort((x, y) => x.setor.localeCompare(y.setor, "pt-BR"));
              return (
                <li key={s.id} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-[0.8125rem] text-[#282525]">{quandoDaSessao(s.inicio, s.fuso)}</span>
                    {dosSetores.length === 0 && <span className="text-[0.8125rem] tabular-nums text-[#282525]">{textoDoFator(10000)}</span>}
                  </div>
                  {dosSetores.map(f => (
                    <div key={f.setorId} className="mt-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 pl-3">
                        <span className="text-[0.75rem] text-black/60">{f.setor}</span>
                        <span className="text-[0.8125rem] tabular-nums text-[#282525]">{textoDoFator(f.fatorBps)}</span>
                      </div>
                      {f.motivo && <p className="pl-3 text-[0.6875rem] text-black/50">{f.motivo}</p>}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

