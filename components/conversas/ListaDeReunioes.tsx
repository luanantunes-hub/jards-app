"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Video } from "lucide-react";
import { ListEmptyState, ListTableSurface, LIST_HEADER_CELL } from "@/components/list/ListPagePrimitives";
import { FilterButton } from "@/components/ui/FilterControls";
import { recortarReunioes, RECORTES_DAS_REUNIOES, ROTULO_DA_PLATAFORMA, SITUACAO_DA_REUNIAO, type RecorteDasReunioes, type ReuniaoNaLista } from "@/lib/conversas/lista";

function quandoPorExtenso(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * As reuniões da organização: as que ainda vão acontecer e as que já foram gravadas, com empresa e convidados.
 * Clicar abre a página da reunião, onde fica a transcrição.
 */
export function ListaDeReunioes({ reunioes, nomesDasEmpresas, onAgendar }: {
  reunioes: readonly ReuniaoNaLista[];
  nomesDasEmpresas: Record<string, string>;
  onAgendar: () => void;
}) {
  const [recorte, setRecorte] = useState<RecorteDasReunioes>("todas");
  const agora = Date.now();

  const { visiveis, contagem } = useMemo(() => recortarReunioes(reunioes, recorte, agora), [reunioes, recorte, agora]);

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
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {RECORTES_DAS_REUNIOES.map(({ value, label }) => (
          <FilterButton key={value} active={recorte === value} onClick={() => setRecorte(value)}>
            {label}<span className="tabular-nums text-black/30">{contagem[value]}</span>
          </FilterButton>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <ListEmptyState icon={Video} title="Nenhuma reunião neste recorte" filtered onClearFilters={() => setRecorte("todas")} />
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
              {visiveis.map(({ reuniao, quando }) => {
                const situacao = SITUACAO_DA_REUNIAO[reuniao.status];
                return (
                  <tr key={reuniao.id} className="border-b transition last:border-0 hover:bg-black/[.015]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                    <td className="px-4 py-3">
                      <Link href={`/reunioes/${reuniao.id}`} className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[#282525] hover:text-[#7259B5]">
                        <Video size={12} aria-hidden="true" className="shrink-0 text-black/25" />
                        <span className="line-clamp-1">{reuniao.titulo}</span>
                      </Link>
                      <span className="mt-0.5 block text-[0.6875rem] text-black/35">{ROTULO_DA_PLATAFORMA[reuniao.plataforma]}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[0.75rem] tabular-nums text-black/55">{quandoPorExtenso(quando)}</td>
                    <td className="px-4 py-3 text-[0.75rem] text-black/55">{reuniao.empresa_crm_id ? nomesDasEmpresas[reuniao.empresa_crm_id] ?? "—" : "—"}</td>
                    <td className="px-4 py-3 text-[0.75rem] tabular-nums text-black/55">{reuniao.participantes?.length ?? 0}</td>
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
    </>
  );
}
