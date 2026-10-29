"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { agruparPorMes, diaDaSemana, diaEMes, opcaoVencida, ROTULO_DA_SITUACAO_DA_DATA, ROTULO_DO_TIPO_DE_DATA, type DataDaAgenda } from "@/lib/producao/agenda";
import { ListContent, ListEmptyState, ListPageHeader, ListSummary, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { NovaDataSheet } from "@/components/producao/NovaDataSheet";
import { NovaTemporadaSheet } from "@/components/producao/NovaTemporadaSheet";

type Temporada = { id: string; titulo: string };

/** A agenda: as datas da produção por mês, e o cadastro de temporadas e de datas. */
export function AgendaDaProducao() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [temporadas, setTemporadas] = useState<Temporada[]>([]);
  const [datas, setDatas] = useState<DataDaAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [folha, setFolha] = useState<"temporada" | "data" | null>(null);

  // Quem edita: administrador e colaborador; o leitor só vê. O banco confere de novo.
  const podeEditar = papel !== null && papelNaProducao(papel) !== "leitor" && papelNaProducao(papel) !== null;
  const hoje = new Date().toISOString().slice(0, 10);

  // Mudar a versão relê a agenda (depois de criar uma temporada ou datas).
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [temp, dat] = await Promise.all([
        producao.from("producao_temporadas").select("id, titulo").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        producao
          .from("producao_datas")
          .select("id, data, data_fim, tipo, situacao, opcao_ordem, opcao_ate, temporada_id, uf, temporada:producao_temporadas!temporada_id(titulo)")
          .eq("organization_id", organizationId)
          .order("data", { ascending: true })
          .limit(500),
      ]);
      if (!ativo) return;
      if (temp.error || dat.error) { setErro(true); setCarregando(false); return; }
      setErro(false);
      setTemporadas(temp.data ?? []);
      setDatas((dat.data ?? []).map(linha => ({
        id: linha.id, data: linha.data, data_fim: linha.data_fim, tipo: linha.tipo, situacao: linha.situacao,
        opcao_ordem: linha.opcao_ordem, opcao_ate: linha.opcao_ate, temporada_id: linha.temporada_id,
        temporada_titulo: linha.temporada?.titulo ?? null, obra_titulo: null, municipio: null, uf: linha.uf,
      })));
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const meses = useMemo(() => agruparPorMes(datas), [datas]);
  // Sem nada ainda, o botão está no estado vazio: não repete no cabeçalho.
  const acoes = podeEditar && temporadas.length > 0 && (
    <>
      <PrimaryListAction onClick={() => setFolha("temporada")}>Nova temporada</PrimaryListAction>
      {temporadas.length > 0 && <PrimaryListAction onClick={() => setFolha("data")}><Plus size={13} aria-hidden="true" /> Nova data</PrimaryListAction>}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader
        eyebrow="Produção"
        title="Agenda"
        summary={!carregando && datas.length > 0 && <ListSummary strong={datas.length}>{datas.length === 1 ? "data" : "datas"}</ListSummary>}
        actions={acoes}
      />
      <ListContent>
        {erro ? (
          <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>Não foi possível carregar a agenda. Atualize a página.</p>
        ) : carregando ? (
          <p className="py-12 text-center text-[0.75rem] text-black/40" aria-busy="true">Carregando…</p>
        ) : temporadas.length === 0 || datas.length === 0 ? (
          <ListTableSurface>
            <ListEmptyState
              icon={CalendarDays}
              title={temporadas.length === 0 ? "Nenhuma temporada ainda" : "Nenhuma data ainda"}
              description={temporadas.length === 0 ? "Comece criando a temporada: é nela que ficam as datas." : "Crie a primeira data da temporada: apresentação, ensaio, montagem ou viagem."}
              action={podeEditar ? <PrimaryListAction onClick={() => setFolha(temporadas.length === 0 ? "temporada" : "data")}><Plus size={13} aria-hidden="true" /> {temporadas.length === 0 ? "Nova temporada" : "Nova data"}</PrimaryListAction> : undefined}
            />
          </ListTableSurface>
        ) : (
          <div className="space-y-6">
            {meses.map(mes => (
              <section key={mes.chave} aria-labelledby={`mes-${mes.chave}`}>
                <h2 id={`mes-${mes.chave}`} className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{mes.rotulo}</h2>
                <ListTableSurface>
                  <ul className="divide-y divide-black/[.06]">
                    {mes.datas.map(item => (
                      <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="w-14 shrink-0 text-[0.75rem] tabular-nums text-black/55">
                          <p className="font-semibold text-[#282525]">{diaEMes(item.data)}</p>
                          <p className="text-[0.625rem] uppercase tracking-[.08em] text-black/45">{diaDaSemana(item.data)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{ROTULO_DO_TIPO_DE_DATA[item.tipo]}</p>
                          <p className="truncate text-[0.6875rem] text-black/45">{[item.temporada_titulo, item.uf].filter(Boolean).join(" · ")}</p>
                        </div>
                        <span
                          className="shrink-0 rounded border bg-white px-2 py-1 text-[0.625rem] font-medium"
                          style={opcaoVencida(item, hoje)
                            ? { borderColor: "#B23B3B47", color: "#B23B3B" }
                            : item.situacao === "confirmada" || item.situacao === "realizada"
                              ? { borderColor: "#2E893247", color: "#2E8932" }
                              : item.situacao === "cancelada"
                                ? { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.45)" }
                                : { borderColor: "#B07A1447", color: "#B07A14" }}
                        >
                          {opcaoVencida(item, hoje) ? "Opção vencida" : item.situacao === "opcao" && item.opcao_ordem ? `${item.opcao_ordem}ª opção` : ROTULO_DA_SITUACAO_DA_DATA[item.situacao]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ListTableSurface>
              </section>
            ))}
          </div>
        )}
      </ListContent>

      {folha === "temporada" && organizationId && (
        <NovaTemporadaSheet organizationId={organizationId} onClose={() => setFolha(null)} onCreated={() => setVersao(atual => atual + 1)} />
      )}
      {folha === "data" && organizationId && (
        <NovaDataSheet organizationId={organizationId} temporadas={temporadas} onClose={() => setFolha(null)} onCreated={() => setVersao(atual => atual + 1)} />
      )}
    </div>
  );
}
