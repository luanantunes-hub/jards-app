import type { ProgramacaoPublica } from "@/lib/producao/programacao-publica";
import { MarcaDaSessao } from "@/components/producao/MarcaDaSessao";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-12-05" → "sábado, 5 de dezembro" (sem depender do fuso de quem lê). */
export function diaPorExtenso(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
  return `${DIAS[semana]}, ${d} de ${MESES[mes - 1]}`;
}

/** A programação pública: um bloco por dia, com a hora, o título e a sala de cada sessão. Serve à página e à versão para embutir. */
export function ProgramacaoPublicaView({ programacao, embutida }: { programacao: ProgramacaoPublica; embutida: boolean }) {
  return (
    <main className={embutida ? "bg-white px-4 py-5" : "min-h-screen bg-[#FAFAF9] px-4 py-8 sm:py-12"}>
      <div className="mx-auto w-full max-w-[40rem]">
        {!embutida && programacao.organizacao && <p className="text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{programacao.organizacao}</p>}
        <h1 className={`${embutida ? "text-[1.25rem]" : "mt-1 text-[1.5rem]"} font-semibold tracking-[-.02em] text-[#282525]`}>{programacao.titulo}</h1>
        {programacao.titulo !== programacao.espaco && <p className="mt-0.5 text-[0.8125rem] text-black/55">{programacao.espaco}</p>}

        {programacao.dias.length === 0 ? (
          <p className="mt-6 rounded border bg-white px-4 py-6 text-center text-[0.875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma sessão marcada por enquanto. Volte em breve.</p>
        ) : (
          <div className="mt-6 space-y-5">
            {programacao.dias.map(dia => (
              <section key={dia.dia} aria-label={diaPorExtenso(dia.dia)}>
                <h2 className="mb-2 text-[0.75rem] font-medium uppercase tracking-[.08em] text-black/50">{diaPorExtenso(dia.dia)}</h2>
                <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  {dia.sessoes.map((sessao, indice) => (
                    <li key={`${sessao.inicio}-${sessao.sala}-${indice}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-3">
                      <span className="w-28 shrink-0 text-[0.9375rem] font-medium tabular-nums text-[#282525]">{sessao.inicio} às {sessao.fim}</span>
                      <span className="min-w-0 flex-1 basis-40 text-[0.9375rem] text-[#282525]">{sessao.titulo}{sessao.marca && <MarcaDaSessao marca={sessao.marca} />}</span>
                      <span className="text-[0.8125rem] text-black/50">{sessao.sala}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
