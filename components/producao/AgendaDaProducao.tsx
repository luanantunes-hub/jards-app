"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarRange, List, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import type { EstadoDoEquipamento, SituacaoDaLicenca, TipoDeLicenca } from "@/lib/producao/estados";
import { avisosDeEquipamentosParaHoje, avisosDeLicencasParaHoje, type AvisoDeHoje } from "@/lib/producao/hoje";
import { agruparPorMes, diaDaSemana, diaEMes, filtrarDatas, opcaoVencida, pendenciasDeHoje, proximasDatas, type FiltrosDaAgenda, ROTULO_DA_SITUACAO_DA_DATA, ROTULO_DO_TIPO_DE_DATA, type DataDaAgenda } from "@/lib/producao/agenda";
import { ListContent, ListEmptyState, ListPageHeader, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { EntityViewSwitcher, usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { Select } from "@/components/ui/Select";
import { CalendarioDaAgenda } from "@/components/producao/CalendarioDaAgenda";
import { NovaDataSheet } from "@/components/producao/NovaDataSheet";
import { NovaTemporadaSheet } from "@/components/producao/NovaTemporadaSheet";

type Temporada = { id: string; titulo: string };

type Visao = "lista" | "mes" | "semana";
const VISOES = ["lista", "mes", "semana"] as const;
const OPCOES_DE_VISAO = [
  { value: "lista", label: "Lista", icon: List },
  { value: "mes", label: "Mês", icon: CalendarDays },
  { value: "semana", label: "Semana", icon: CalendarRange },
] as const;

const SEM_FILTROS: FiltrosDaAgenda = { temporada: "todas", situacao: "todas", espaco: "todos", sala: "todas" };

/** A agenda: as datas da produção por mês, e o cadastro de temporadas e de datas. */
export function AgendaDaProducao() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [temporadas, setTemporadas] = useState<Temporada[]>([]);
  const [espacos, setEspacos] = useState<{ id: string; nome: string }[]>([]);
  const [salas, setSalas] = useState<{ id: string; espaco_id: string; nome: string }[]>([]);
  const [datas, setDatas] = useState<DataDaAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [folha, setFolha] = useState<"temporada" | "data" | null>(null);
  const [visao, trocarVisao] = usePersistedViewMode<Visao>("jards-producao-agenda-visao", VISOES, "lista");
  const [filtros, setFiltros] = useState<FiltrosDaAgenda>(SEM_FILTROS);

  // Quem edita: administrador e colaborador; o leitor só vê. O banco confere de novo.
  const podeEditar = papel !== null && papelNaProducao(papel) !== "leitor" && papelNaProducao(papel) !== null;
  const hoje = new Date().toISOString().slice(0, 10);

  // Mudar a versão relê a agenda (depois de criar uma temporada ou datas).
  const [versao, setVersao] = useState(0);
  // O que as licenças e os equipamentos pedem (PD4.9 e PD3.2), lido à parte: se falhar, o resto da agenda segue.
  const [licencasDeHoje, setLicencasDeHoje] = useState<{ id: string; data_id: string; tipo: TipoDeLicenca; situacao: SituacaoDaLicenca; prazo_dias: number | null; validade: string | null }[]>([]);
  const [equipamentosDeHoje, setEquipamentosDeHoje] = useState<{ id: string; nome: string; estado: EstadoDoEquipamento; espaco_id: string }[]>([]);
  const [manutencoesDeHoje, setManutencoesDeHoje] = useState<{ id: string; equipamento_id: string; descricao: string; prevista_para: string; feita_em: string | null }[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [temp, dat, esp, sal] = await Promise.all([
        producao.from("producao_temporadas").select("id, titulo").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        producao
          .from("producao_datas")
          .select("id, data, data_fim, tipo, situacao, opcao_ordem, opcao_ate, temporada_id, uf, espaco_id, sala_id, temporada:producao_temporadas!temporada_id(titulo)")
          .eq("organization_id", organizationId)
          .order("data", { ascending: true })
          .limit(500),
        producao.from("producao_espacos").select("id, nome").eq("organization_id", organizationId).order("nome"),
        producao.from("producao_salas").select("id, espaco_id, nome").eq("organization_id", organizationId).order("nome"),
      ]);
      if (!ativo) return;
      if (temp.error || dat.error) { setErro(true); setCarregando(false); return; }
      setErro(false);
      setTemporadas(temp.data ?? []);
      setEspacos(esp.data ?? []);
      setSalas(sal.data ?? []);
      setDatas((dat.data ?? []).map(linha => ({
        id: linha.id, data: linha.data, data_fim: linha.data_fim, tipo: linha.tipo, situacao: linha.situacao,
        opcao_ordem: linha.opcao_ordem, opcao_ate: linha.opcao_ate, temporada_id: linha.temporada_id,
        temporada_titulo: linha.temporada?.titulo ?? null, obra_titulo: null, municipio: null, uf: linha.uf,
        espaco_id: linha.espaco_id, sala_id: linha.sala_id,
      })));
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [lic, equ, man] = await Promise.all([
        producao.from("producao_licencas").select("id, data_id, tipo, situacao, prazo_dias, validade").eq("organization_id", organizationId).in("situacao", ["a_pedir", "pedida", "negada", "concedida"]),
        producao.from("producao_equipamentos").select("id, nome, estado, espaco_id").eq("organization_id", organizationId).neq("estado", "baixado"),
        producao.from("producao_manutencoes").select("id, equipamento_id, descricao, prevista_para, feita_em").eq("organization_id", organizationId).is("feita_em", null),
      ]);
      if (!ativo) return;
      setLicencasDeHoje(lic.data ?? []);
      setEquipamentosDeHoje(equ.data ?? []);
      setManutencoesDeHoje(man.data ?? []);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const avisos = useMemo<AvisoDeHoje[]>(() => [
    ...avisosDeLicencasParaHoje(licencasDeHoje, datas, hoje),
    ...avisosDeEquipamentosParaHoje(equipamentosDeHoje, manutencoesDeHoje, hoje),
  ], [licencasDeHoje, equipamentosDeHoje, manutencoesDeHoje, datas, hoje]);
  const filtradas = useMemo(() => filtrarDatas(datas, filtros), [datas, filtros]);
  const meses = useMemo(() => agruparPorMes(filtradas), [filtradas]);
  const pendencias = useMemo(() => pendenciasDeHoje(datas, hoje), [datas, hoje]);
  const proximas = useMemo(() => proximasDatas(datas, hoje, 3), [datas, hoje]);
  const comFiltro = filtros.temporada !== "todas" || filtros.situacao !== "todas" || filtros.espaco !== "todos" || filtros.sala !== "todas";
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
        summary={!carregando && datas.length > 0 && <ListSummary strong={filtradas.length}>{filtradas.length === 1 ? "data" : "datas"}</ListSummary>}
        actions={<>{datas.length > 0 && <EntityViewSwitcher value={visao} onChange={trocarVisao} options={OPCOES_DE_VISAO} ariaLabel="Visão da agenda" />}{acoes}</>}
      />
      {datas.length > 0 && (
        <ListToolbar>
          {temporadas.length > 1 && (
            <Select block={false} aria-label="Filtrar por temporada" value={filtros.temporada} onChange={event => setFiltros(atual => ({ ...atual, temporada: event.target.value }))} className="h-9 shrink-0 pl-3 pr-8 text-black/60">
              <option value="todas">Todas as temporadas</option>
              {temporadas.map(item => <option key={item.id} value={item.id}>{item.titulo}</option>)}
            </Select>
          )}
          {espacos.length > 0 && (
            <Select block={false} aria-label="Filtrar por espaço" value={filtros.espaco ?? "todos"} onChange={event => setFiltros(atual => ({ ...atual, espaco: event.target.value, sala: "todas" }))} className="h-9 shrink-0 pl-3 pr-8 text-black/60">
              <option value="todos">Todos os espaços</option>
              {espacos.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </Select>
          )}
          {filtros.espaco && filtros.espaco !== "todos" && salas.some(sala => sala.espaco_id === filtros.espaco) && (
            <Select block={false} aria-label="Filtrar por sala" value={filtros.sala ?? "todas"} onChange={event => setFiltros(atual => ({ ...atual, sala: event.target.value }))} className="h-9 shrink-0 pl-3 pr-8 text-black/60">
              <option value="todas">Todas as salas</option>
              {salas.filter(sala => sala.espaco_id === filtros.espaco).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </Select>
          )}
          <Select block={false} aria-label="Filtrar por situação" value={filtros.situacao} onChange={event => setFiltros(atual => ({ ...atual, situacao: event.target.value as FiltrosDaAgenda["situacao"] }))} className="h-9 shrink-0 pl-3 pr-8 text-black/60">
            <option value="todas">Todas as situações</option>
            {(Object.keys(ROTULO_DA_SITUACAO_DA_DATA) as (keyof typeof ROTULO_DA_SITUACAO_DA_DATA)[]).map(situacao => <option key={situacao} value={situacao}>{ROTULO_DA_SITUACAO_DA_DATA[situacao]}</option>)}
          </Select>
          {comFiltro && <button type="button" onClick={() => setFiltros(SEM_FILTROS)} className="h-9 shrink-0 rounded px-2.5 text-[0.75rem] font-medium text-black/50 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Limpar filtros</button>}
        </ListToolbar>
      )}
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
              description={temporadas.length === 0 ? "Crie a primeira temporada para organizar as datas." : "Crie a primeira data: apresentação, ensaio, montagem ou viagem."}
              action={podeEditar ? <PrimaryListAction onClick={() => setFolha(temporadas.length === 0 ? "temporada" : "data")}><Plus size={13} aria-hidden="true" /> {temporadas.length === 0 ? "Nova temporada" : "Nova data"}</PrimaryListAction> : undefined}
            />
          </ListTableSurface>
        ) : (
          <div className="space-y-6">
            {(pendencias.length > 0 || proximas.length > 0 || avisos.length > 0) && (
              <section aria-labelledby="hoje-titulo" className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <h2 id="hoje-titulo" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Hoje</h2>
                <ul className="space-y-1.5">
                  {pendencias.map(({ tipo, data: item }) => (
                    <li key={`p-${item.id}`} className="flex items-baseline gap-2 text-[0.75rem]">
                      <span className="shrink-0 font-medium text-[#B23B3B]">{tipo === "opcao_vencida" ? "Opção vencida" : "Opção vencendo"}</span>
                      <span className="min-w-0 truncate text-black/60">{ROTULO_DO_TIPO_DE_DATA[item.tipo]} de {diaEMes(item.data)}{item.temporada_titulo ? ` · ${item.temporada_titulo}` : ""}</span>
                    </li>
                  ))}
                  {avisos.map(aviso => (
                    <li key={aviso.chave} className="flex items-baseline gap-2 text-[0.75rem]">
                      <span className="shrink-0 font-medium text-[#B07A14]">{aviso.rotulo}</span>
                      <Link href={aviso.href} className="min-w-0 truncate text-black/60 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{aviso.texto}</Link>
                    </li>
                  ))}
                  {proximas.map(item => (
                    <li key={`n-${item.id}`} className="flex items-baseline gap-2 text-[0.75rem]">
                      <span className="shrink-0 tabular-nums font-medium text-[#282525]">{item.data === hoje ? "Hoje" : diaEMes(item.data)}</span>
                      <span className="min-w-0 truncate text-black/60">{ROTULO_DO_TIPO_DE_DATA[item.tipo]}{item.temporada_titulo ? ` · ${item.temporada_titulo}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {filtradas.length === 0 ? (
              <ListTableSurface>
                <ListEmptyState icon={CalendarDays} title="Nenhuma data com esses filtros" filtered onClearFilters={() => setFiltros(SEM_FILTROS)} />
              </ListTableSurface>
            ) : visao !== "lista" ? (
              <CalendarioDaAgenda datas={filtradas} modo={visao} hoje={hoje} />
            ) : meses.map(mes => (
              <section key={mes.chave} aria-labelledby={`mes-${mes.chave}`}>
                <h2 id={`mes-${mes.chave}`} className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{mes.rotulo}</h2>
                <ListTableSurface>
                  <ul className="divide-y divide-black/[.06]">
                    {mes.datas.map(item => (
                      <li key={item.id}><Link href={`/producoes/datas/${item.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
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
                      </Link></li>
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
