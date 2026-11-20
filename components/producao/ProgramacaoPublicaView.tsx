import { CalendarPlus } from "lucide-react";
import type { ProgramacaoPublica } from "@/lib/producao/programacao-publica";
import { MarcaDaSessao } from "@/components/producao/MarcaDaSessao";
import { BotaoImprimir } from "@/components/producao/BotaoImprimir";
import { consultaDoFiltro, filtrarProgramacao, salasDaProgramacao, type FiltroDaProgramacao } from "@/lib/producao/programacao-vistas";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-12-05" → "sábado, 5 de dezembro" (sem depender do fuso de quem lê). */
export function diaPorExtenso(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
  return `${DIAS[semana]}, ${d} de ${MESES[mes - 1]}`;
}

const diaCurto = (dia: string) => {
  const [, mes, d] = dia.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
};

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] font-medium text-black/65 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

function Filtro({ rotulo, itens }: { rotulo: string; itens: { texto: string; href: string; ativo: boolean }[] }) {
  return (
    <nav aria-label={rotulo} className="flex flex-wrap items-center gap-1.5">
      {itens.map(item => (
        <a key={item.texto} href={item.href} aria-current={item.ativo ? "true" : undefined}
          className={`inline-flex h-8 items-center rounded border px-3 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${item.ativo ? "border-[#282525] bg-[#282525] font-medium text-white" : "border-black/[.12] bg-white text-black/60 hover:bg-black/[.04]"}`}>
          {item.texto}
        </a>
      ))}
    </nav>
  );
}

/**
 * A programação pública: um bloco por dia, com a hora, o título e a sala de cada sessão. Serve à página e à versão para embutir. Na página (com o código do
 * link), há o filtro por sala e por dia, o calendário para baixar e o botão de imprimir; na versão para embutir, só a lista.
 */
export function ProgramacaoPublicaView({ programacao, embutida, codigo, filtro = {} }: { programacao: ProgramacaoPublica; embutida: boolean; codigo?: string; filtro?: FiltroDaProgramacao }) {
  const comControles = !embutida && Boolean(codigo) && programacao.dias.length > 0;
  const dias = filtrarProgramacao(programacao.dias, filtro);
  const salas = salasDaProgramacao(programacao.dias);
  const base = `/programacao/${codigo}`;
  const sala = filtro.sala?.trim() ?? "";
  const dia = filtro.dia?.trim() ?? "";
  return (
    <main className={embutida ? "bg-white px-4 py-5" : "min-h-screen bg-[#FAFAF9] px-4 py-8 sm:py-12 print:bg-white print:py-0"}>
      <div className="mx-auto w-full max-w-[40rem]">
        {!embutida && programacao.organizacao && <p className="text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{programacao.organizacao}</p>}
        <h1 className={`${embutida ? "text-[1.25rem]" : "mt-1 text-[1.5rem]"} font-semibold tracking-[-.02em] text-[#282525]`}>{programacao.titulo}</h1>
        {programacao.titulo !== programacao.espaco && <p className="mt-0.5 text-[0.8125rem] text-black/55">{programacao.espaco}</p>}

        {comControles && (
          <div className="mt-5 space-y-3 print:hidden">
            {programacao.dias.length > 1 && (
              <Filtro rotulo="Dia" itens={[{ texto: "Todos os dias", href: `${base}${consultaDoFiltro({ sala })}`, ativo: dia === "" }, ...programacao.dias.map(item => ({ texto: diaCurto(item.dia), href: `${base}${consultaDoFiltro({ sala, dia: item.dia })}`, ativo: dia === item.dia }))]} />
            )}
            {salas.length > 1 && (
              <Filtro rotulo="Sala" itens={[{ texto: "Todas as salas", href: `${base}${consultaDoFiltro({ dia })}`, ativo: sala === "" }, ...salas.map(nome => ({ texto: nome, href: `${base}${consultaDoFiltro({ sala: nome, dia })}`, ativo: sala === nome }))]} />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/api/programacao/${codigo}/calendario${consultaDoFiltro({ sala, dia })}`} className={BOTAO}><CalendarPlus size={13} aria-hidden="true" /> Adicionar ao calendário</a>
              <BotaoImprimir className={BOTAO} />
            </div>
          </div>
        )}

        {programacao.dias.length === 0 ? (
          <p className="mt-6 rounded border bg-white px-4 py-6 text-center text-[0.875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma sessão marcada por enquanto. Volte em breve.</p>
        ) : dias.length === 0 ? (
          <p className="mt-6 rounded border bg-white px-4 py-6 text-center text-[0.875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma sessão com este filtro.</p>
        ) : (
          <div className="mt-6 space-y-5">
            {dias.map(item => (
              <section key={item.dia} aria-label={diaPorExtenso(item.dia)} className="print:break-inside-avoid">
                <h2 className="mb-2 text-[0.75rem] font-medium uppercase tracking-[.08em] text-black/50">{diaPorExtenso(item.dia)}</h2>
                <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  {item.sessoes.map((sessao, indice) => (
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
