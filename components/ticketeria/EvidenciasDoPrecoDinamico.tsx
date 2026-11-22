import { EVIDENCIAS, GRUPOS_DE_EVIDENCIA, textoDaExposicao, type TipoDeEvidencia } from "@/lib/ticketeria/preco-dinamico-evidencias";
import type { RegraDinamica } from "@/lib/ticketeria/preco-dinamico";

// O bloco neutro da folha de adesão ao preço dinâmico: o que a faixa escolhida expõe e o que a literatura registra (ganho, riscos e o que a literatura associa a menos risco). Sem recomendação e sem
// explicação longa; cada item traz a fonte. Sem estado nem imports pesados: roda nos testes (tests/ticketeria-evidencias-preco-dinamico.test.ts).

const ORDEM: TipoDeEvidencia[] = ["ganho", "risco", "mitigacao"];

export function EvidenciasDoPrecoDinamico({ faixa }: { faixa: Pick<RegraDinamica, "pisoBps" | "tetoBps" | "passoBps" | "intervaloMinutos"> | null }) {
  return (
    <div className="space-y-3 rounded-xl border border-black/[.08] px-4 py-3">
      {faixa && <p className="text-[0.75rem] text-[#282525]">{textoDaExposicao(faixa)}</p>}
      <p className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">O que a literatura registra</p>
      {ORDEM.map(tipo => {
        const itens = EVIDENCIAS.filter(e => e.tipo === tipo);
        if (itens.length === 0) return null;
        return (
          <div key={tipo}>
            <p className="mb-1 text-[0.75rem] font-normal text-[#282525]">{GRUPOS_DE_EVIDENCIA[tipo]}</p>
            <ul className="list-disc space-y-1 pl-4 text-[0.75rem] text-black/60">
              {itens.map(e => (
                <li key={e.texto}>
                  {e.texto}{" "}
                  <span className="text-black/45">
                    {e.fontes.map((f, i) => <span key={f.url}>{i > 0 && "; "}<a href={f.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black/70">{f.nome}</a></span>)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
