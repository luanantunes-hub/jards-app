"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Video } from "lucide-react";
import { ListEmptyState, ListSearch, ListTableSurface, LIST_HEADER_CELL } from "@/components/list/ListPagePrimitives";
import { AvatarDaPessoa } from "@/components/ui/AvatarDaPessoa";
import { caminhoDoDesenho } from "@/lib/conversas/avatar";
import { FilterButton } from "@/components/ui/FilterControls";
import {
  dataCurta, duracaoEmTexto, ESTADO_DA_REUNIAO, recortarReunioes, RECORTES_DAS_REUNIOES, reuniaoNaBusca, ROTULO_DA_PLATAFORMA,
  SITUACAO_DA_REUNIAO, type RecorteDasReunioes, type ReuniaoNaLista,
} from "@/lib/conversas/lista";

function quandoPorExtenso(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * A miniatura da reunião: sempre um tamanduá que conta o status (agendado, a caminho, gravada…), nunca um ícone
 * genérico. A duração aparece ao lado quando o assistente já gravou.
 */
function Miniatura({ reuniao }: { reuniao: ReuniaoNaLista }) {
  const duracao = duracaoEmTexto(reuniao.duracao_bot_s);
  return (
    <span aria-hidden="true" className="flex h-9 w-14 shrink-0 items-center justify-center gap-0.5 rounded bg-[#7259B5]/[.10]">
      <Image src={caminhoDoDesenho(ESTADO_DA_REUNIAO[reuniao.status])} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
      {duracao && <span className="text-[0.5625rem] font-medium tabular-nums text-[#5B4698]">{duracao}</span>}
    </span>
  );
}

/**
 * As reuniões da organização, como uma agenda: as que ainda vão acontecer à direita, a lista completa no meio
 * e os recortes à esquerda. Clicar abre a página da reunião, onde fica a transcrição.
 */
export function ListaDeReunioes({ reunioes, nomesDasEmpresas, onAgendar }: {
  reunioes: readonly ReuniaoNaLista[];
  nomesDasEmpresas: Record<string, string>;
  onAgendar: () => void;
}) {
  const [recorte, setRecorte] = useState<RecorteDasReunioes>("todas");
  const [busca, setBusca] = useState("");
  const agora = Date.now();

  const { visiveis, contagem } = useMemo(() => recortarReunioes(reunioes, recorte, agora), [reunioes, recorte, agora]);
  const achadas = useMemo(
    () => visiveis.filter(({ reuniao }) => reuniaoNaBusca(reuniao, busca, reuniao.empresa_crm_id ? nomesDasEmpresas[reuniao.empresa_crm_id] : undefined)),
    [visiveis, busca, nomesDasEmpresas],
  );
  const proximas = useMemo(() => recortarReunioes(reunioes, "proximas", agora).visiveis.slice(0, 4), [reunioes, agora]);

  if (reunioes.length === 0) {
    return (
      <ListEmptyState
        icon={Video}
        title="Nenhuma reunião ainda"
        description="Marque uma reunião e o Jards cria o evento na sua agenda com a sala do Meet ou do Teams, e convida quem você escolher."
        action={<button type="button" onClick={onAgendar} className="flex h-9 items-center gap-1.5 rounded px-3 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04]"><CalendarPlus size={13} aria-hidden="true" />Agendar reunião</button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 xl:flex-row">
      {/* Os recortes ficam à esquerda, como numa agenda: a lista ao lado muda conforme o que se escolhe. */}
      <nav aria-label="Recorte das reuniões" className="flex shrink-0 flex-wrap gap-2 xl:w-44 xl:flex-col">
        {RECORTES_DAS_REUNIOES.map(({ value, label }) => (
          <FilterButton key={value} active={recorte === value} onClick={() => setRecorte(value)} className="xl:w-full xl:justify-between">
            {label}<span className="tabular-nums text-black/30">{contagem[value]}</span>
          </FilterButton>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[0.75rem] text-black/40"><span className="font-semibold tabular-nums text-[#282525]">{achadas.length}</span> {achadas.length === 1 ? "reunião" : "reuniões"}</p>
          <ListSearch value={busca} onChange={setBusca} placeholder="Buscar reunião, empresa ou convidado" />
        </div>
        {achadas.length === 0 ? (
          <ListEmptyState icon={Video} title="Nenhuma reunião encontrada" filtered onClearFilters={() => { setRecorte("todas"); setBusca(""); }} />
        ) : (
          <ListTableSurface>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {["Reunião", "Quando", "Empresa", "Convidados", "Situação"].map((coluna) => (
                    <th key={coluna} className="px-4 py-2.5 text-left"><span className={LIST_HEADER_CELL}>{coluna}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {achadas.map(({ reuniao, quando }) => {
                  const situacao = SITUACAO_DA_REUNIAO[reuniao.status];
                  const empresa = reuniao.empresa_crm_id ? nomesDasEmpresas[reuniao.empresa_crm_id] ?? null : null;
                  const convidados = reuniao.participantes ?? [];
                  return (
                    <tr key={reuniao.id} className="border-b transition last:border-0 hover:bg-black/[.015]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                      <td className="px-4 py-3">
                        <Link href={`/reunioes/${reuniao.id}`} className="flex items-center gap-2.5 group">
                          <Miniatura reuniao={reuniao} />
                          <span className="min-w-0">
                            <span className="line-clamp-1 text-[0.8125rem] font-semibold text-[#282525] group-hover:text-[#7259B5]">{reuniao.titulo}</span>
                            <span className="mt-0.5 block text-[0.6875rem] text-black/35">{ROTULO_DA_PLATAFORMA[reuniao.plataforma]}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[0.75rem] tabular-nums text-black/55">{quandoPorExtenso(quando)}</td>
                      <td className="px-4 py-3 text-[0.75rem] text-black/55">{empresa ?? "—"}</td>
                      <td className="px-4 py-3">
                        {convidados.length === 0 ? <span className="text-[0.75rem] text-black/30">—</span> : (
                          <span className="flex items-center -space-x-1.5" title={convidados.join(", ")}>
                            {convidados.slice(0, 3).map((endereco) => (
                              <AvatarDaPessoa key={endereco} endereco={endereco} tamanho="pequeno" className="ring-2 ring-white" />
                            ))}
                            {convidados.length > 3 && <span className="pl-3 text-[0.6875rem] tabular-nums text-black/40">+{convidados.length - 3}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: `${situacao.cor}47`, color: situacao.cor }}>{situacao.rotulo}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ListTableSurface>
        )}
      </div>

      {/* O que vem a seguir, destacado: é o que se olha antes de marcar mais uma. */}
      <aside aria-label="Próximas reuniões" className="shrink-0 xl:w-60">
        <h3 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">Próximas reuniões</h3>
        {proximas.length === 0 ? (
          <div className="rounded border px-3.5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.75rem] leading-relaxed text-black/40">Nada marcado por enquanto. O que você agendar aparece aqui.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {proximas.map(({ reuniao, quando }) => (
              <li key={reuniao.id}>
                <Link href={`/reunioes/${reuniao.id}`} className="block rounded border bg-white px-3.5 py-3 transition hover:border-black/[.16]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <p className="line-clamp-2 text-[0.75rem] font-semibold leading-snug text-[#282525]">{reuniao.titulo}</p>
                  <p className="mt-1 text-[0.6875rem] tabular-nums text-black/40">{dataCurta(quando)} · {new Date(quando ?? 0).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
