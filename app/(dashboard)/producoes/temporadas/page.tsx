"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { diaEMes } from "@/lib/producao/agenda";
import { ROTULO_DO_FORMATO, tipoDeProducao, type FormatoTemporada, type TipoProducao } from "@/lib/producao/vocabulario";
import { ListContent, ListEmptyState, ListPageHeader, ListSummary, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { NovaTemporadaSheet } from "@/components/producao/NovaTemporadaSheet";

type Linha = { id: string; titulo: string; tipo: string; formato: string; lado: string; datas: number; primeira: string | null; ultima: string | null };

const rotuloDoTipo = (tipo: string) => tipoDeProducao(tipo as TipoProducao).rotulo;

export default function TemporadasPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [criando, setCriando] = useState(false);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [temp, dat] = await Promise.all([
        producao.from("producao_temporadas").select("id, titulo, tipo, formato, lado").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        producao.from("producao_datas").select("temporada_id, data, data_fim").eq("organization_id", organizationId).limit(2000),
      ]);
      if (!ativo) return;
      if (temp.error || dat.error) { setErro(true); setCarregando(false); return; }
      setErro(false);
      setLinhas((temp.data ?? []).map(item => {
        const dela = (dat.data ?? []).filter(d => d.temporada_id === item.id);
        const dias = dela.flatMap(d => [d.data, d.data_fim ?? d.data]).sort();
        return { ...item, datas: dela.length, primeira: dias[0] ?? null, ultima: dias.at(-1) ?? null };
      }));
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader secao="producao"
        eyebrow="Produção"
        title="Temporadas"
        summary={!carregando && linhas.length > 0 && <ListSummary strong={linhas.length}>{linhas.length === 1 ? "temporada" : "temporadas"}</ListSummary>}
        actions={podeEditar && linhas.length > 0 && <PrimaryListAction onClick={() => setCriando(true)}><Plus size={13} aria-hidden="true" /> Nova temporada</PrimaryListAction>}
      />
      <ListContent>
        {erro ? (
          <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>Não foi possível carregar as temporadas. Atualize a página.</p>
        ) : carregando ? (
          <p className="py-12 text-center text-[0.75rem] text-black/40" aria-busy="true">Carregando…</p>
        ) : linhas.length === 0 ? (
          <ListTableSurface>
            <ListEmptyState
              icon={CalendarRange}
              title="Nenhuma temporada ainda"
              description="Crie a primeira temporada para organizar as datas."
              action={podeEditar ? <PrimaryListAction onClick={() => setCriando(true)}><Plus size={13} aria-hidden="true" /> Nova temporada</PrimaryListAction> : undefined}
            />
          </ListTableSurface>
        ) : (
          <ListTableSurface>
            <ul className="divide-y divide-black/[.06]">
              {linhas.map(item => (
                <li key={item.id}>
                  <Link href={`/producoes/temporadas/${item.id}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{item.titulo}</p>
                      <p className="truncate text-[0.6875rem] text-black/45">{[rotuloDoTipo(item.tipo), ROTULO_DO_FORMATO[item.formato as FormatoTemporada] ?? item.formato, item.lado === "circula" ? "Viaja" : "Recebe"].join(" · ")}</p>
                    </div>
                    <p className="shrink-0 text-right text-[0.6875rem] tabular-nums text-black/45">
                      {item.datas === 0 ? "Sem datas" : `${item.datas} ${item.datas === 1 ? "data" : "datas"}`}
                      {item.primeira && item.ultima ? <span className="block">{item.primeira === item.ultima ? diaEMes(item.primeira) : `${diaEMes(item.primeira)} a ${diaEMes(item.ultima)}`}</span> : null}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </ListTableSurface>
        )}
      </ListContent>
      {criando && organizationId && <NovaTemporadaSheet organizationId={organizationId} onClose={() => setCriando(false)} onCreated={() => setVersao(atual => atual + 1)} />}
    </div>
  );
}
