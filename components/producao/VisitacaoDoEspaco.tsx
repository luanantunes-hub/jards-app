"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Copy, Link2, Plus, TriangleAlert } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import type { SituacaoDoAgendamento } from "@/lib/producao/estados";
import {
  DIAS_DO_LINK_DE_VISITAS, lerAgendamento, lerHorario, mensagemDoErroDeVisita, mensagemDoLinkDeVisitas, ocupacaoDosHorarios, publicoPorDia, ROTULO_DA_SITUACAO_DO_AGENDAMENTO,
  type AgendamentoDeVisita, type HorarioDeVisita,
} from "@/lib/producao/visitas";

type LinkDeVisitas = { id: string; titulo: string | null; expira_em: string; revogado_em: string | null };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

const Erro = ({ texto }: { texto: string }) => <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;
const hora = (valor: string) => valor.slice(0, 5);

function HorarioSheet({ organizationId, espacoId, horario, onClose, onSalvou }: { organizationId: string; espacoId: string; horario: HorarioDeVisita | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [dia, setDia] = useState(horario?.dia ?? "");
  const [inicio, setInicio] = useState(horario ? hora(horario.inicio) : "");
  const [fim, setFim] = useState(horario ? hora(horario.fim) : "");
  const [capacidade, setCapacidade] = useState(horario ? String(horario.capacidade) : "");
  const [avulso, setAvulso] = useState(horario?.publico_avulso === null || horario === null ? "" : String(horario?.publico_avulso));
  const [notas, setNotas] = useState(horario?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerHorario({ dia, inicio, fim, capacidade, avulso, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = horario
      ? await producao.from("producao_visitas_horarios").update(leitura.valor).eq("id", horario.id)
      : await producao.from("producao_visitas_horarios").insert({ organization_id: organizationId, espaco_id: espacoId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeVisita(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!horario) return;
    confirmDelete({
      title: "Apagar horário de visita?",
      description: `O horário de ${diaEMes(horario.dia)}, ${hora(horario.inicio)} às ${hora(horario.fim)}, sai da lista com todos os agendamentos dele.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_visitas_horarios").delete().eq("id", horario.id);
        if (error) throw new Error("Não foi possível apagar o horário.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={horario ? "Editar horário" : "Novo horário de visita"}
      onClose={onClose}
      footer={fechar => (
        <>
          {horario && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : horario ? "Salvar" : "Criar horário"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div className="grid grid-cols-3 gap-3">
          <div><label className={ROTULO} htmlFor="vis-dia">Dia</label><input id="vis-dia" type="date" className={CAMPO} value={dia} onChange={event => setDia(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="vis-inicio">Começa</label><input id="vis-inicio" type="time" className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="vis-fim">Termina</label><input id="vis-fim" type="time" className={CAMPO} value={fim} onChange={event => setFim(event.target.value)} disabled={salvando} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="vis-cap">Capacidade (pessoas)</label><input id="vis-cap" inputMode="numeric" className={CAMPO} value={capacidade} onChange={event => setCapacidade(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="vis-avulso">Público avulso (opcional)</label><input id="vis-avulso" inputMode="numeric" className={CAMPO} value={avulso} onChange={event => setAvulso(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="Quem veio sem agendar" /></div>
        </div>
        <div><label className={ROTULO} htmlFor="vis-notas">Nota (opcional)</label><input id="vis-notas" className={CAMPO} value={notas} maxLength={300} onChange={event => setNotas(event.target.value)} disabled={salvando} placeholder="Por exemplo: visita guiada com mediador" /></div>
      </div>
    </TopSheet>
  );
}

function AgendamentoSheet({ organizationId, horario, agendamento, onClose, onSalvou }: { organizationId: string; horario: HorarioDeVisita; agendamento: AgendamentoDeVisita | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [grupo, setGrupo] = useState(agendamento?.grupo ?? "");
  const [responsavel, setResponsavel] = useState(agendamento?.responsavel ?? "");
  const [email, setEmail] = useState(agendamento?.email ?? "");
  const [telefone, setTelefone] = useState(agendamento?.telefone ?? "");
  const [pessoas, setPessoas] = useState(agendamento ? String(agendamento.pessoas) : "");
  const [presentes, setPresentes] = useState(agendamento?.presentes === null || agendamento === null ? "" : String(agendamento?.presentes));
  const [observacao, setObservacao] = useState(agendamento?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerAgendamento({ grupo, responsavel, email, telefone, pessoas, observacao });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    const vieram = presentes.trim() === "" ? null : Number(presentes);
    if (vieram !== null && (!Number.isInteger(vieram) || vieram < 0 || vieram > 5000)) { setErro("Quantos vieram é um número de 0 a 5.000."); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = agendamento
      ? await producao.from("producao_visitas_agendamentos").update({ ...leitura.valor, presentes: vieram }).eq("id", agendamento.id)
      : await producao.from("producao_visitas_agendamentos").insert({ organization_id: organizationId, horario_id: horario.id, ...leitura.valor, presentes: vieram, situacao: "confirmado" });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeVisita(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!agendamento) return;
    confirmDelete({
      title: "Apagar agendamento?",
      description: `${agendamento.grupo} sai deste horário. Se só desistiu, prefira marcar como cancelado.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_visitas_agendamentos").delete().eq("id", agendamento.id);
        if (error) throw new Error("Não foi possível apagar o agendamento.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={agendamento ? "Editar agendamento" : "Novo agendamento"}
      onClose={onClose}
      footer={fechar => (
        <>
          {agendamento && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : agendamento ? "Salvar" : "Agendar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <p className="text-[0.75rem] text-black/55">{diaEMes(horario.dia)}, {hora(horario.inicio)} às {hora(horario.fim)}. Capacidade de {horario.capacidade} pessoas.</p>
        <div><label className={ROTULO} htmlFor="ag-grupo">Escola ou grupo</label><input id="ag-grupo" className={CAMPO} value={grupo} maxLength={120} onChange={event => setGrupo(event.target.value)} disabled={salvando} /></div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div><label className={ROTULO} htmlFor="ag-resp">Responsável</label><input id="ag-resp" className={CAMPO} value={responsavel} maxLength={120} onChange={event => setResponsavel(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="ag-pessoas">Pessoas</label><input id="ag-pessoas" inputMode="numeric" className={CAMPO} value={pessoas} onChange={event => setPessoas(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="ag-email">E-mail</label><input id="ag-email" type="email" className={CAMPO} value={email} maxLength={200} onChange={event => setEmail(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="ag-tel">Telefone</label><input id="ag-tel" type="tel" className={CAMPO} value={telefone} maxLength={30} onChange={event => setTelefone(event.target.value)} disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor="ag-vieram">Quantos vieram (depois da visita)</label><input id="ag-vieram" inputMode="numeric" className={CAMPO} value={presentes} onChange={event => setPresentes(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="Ainda não digitado" /></div>
        <div><label className={ROTULO} htmlFor="ag-obs">Observação (opcional)</label><input id="ag-obs" className={CAMPO} value={observacao} maxLength={300} onChange={event => setObservacao(event.target.value)} disabled={salvando} /></div>
        <p className="text-[0.6875rem] text-black/45">Informe pelo menos um contato: e-mail ou telefone. Sem nomes de alunos, documentos ou dados de saúde.</p>
      </div>
    </TopSheet>
  );
}

function LinkSheet({ espacoId, espacoNome, ativo, onClose, onGerou }: { espacoId: string; espacoNome: string; ativo: LinkDeVisitas | null; onClose: () => void; onGerou: () => void }) {
  const [titulo, setTitulo] = useState(ativo?.titulo ?? "");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_visitas_gerar_link", { p_espaco: espacoId, p_dias: DIAS_DO_LINK_DE_VISITAS, p_titulo: titulo.trim() });
    setGerando(false);
    if (error || typeof data !== "string") { setErro(error?.code === "42501" ? "Você não pode criar links aqui." : "Não foi possível gerar o link. Tente de novo."); return; }
    setMensagem(mensagemDoLinkDeVisitas({ espaco: espacoNome, url: `${window.location.origin}/visita/${data}` }));
    onGerou();
  }

  async function copiar() {
    if (!mensagem) return;
    try { await navigator.clipboard.writeText(mensagem); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  return (
    <TopSheet
      titulo={ativo ? "Novo link de agendamento" : "Link de agendamento"}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={gerando} className={CANCELAR}>{mensagem ? "Fechar" : "Cancelar"}</button>
          {!mensagem && <button type="button" onClick={() => void gerar()} disabled={gerando} className={SALVAR}>{gerando ? "Gerando…" : "Gerar link"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {!mensagem ? (
          <>
            <div><label className={ROTULO} htmlFor="vis-titulo">Título da chamada (opcional)</label><input id="vis-titulo" className={CAMPO} value={titulo} maxLength={120} onChange={event => setTitulo(event.target.value)} disabled={gerando} placeholder="Agendar visita" /></div>
          </>
        ) : (
          <>
            <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>O link aparece só agora. Copie e divulgue antes de fechar; depois, para ter o endereço de novo, gere um link novo.</p>
            <p className="whitespace-pre-line break-words rounded border bg-black/[.03] px-3 py-2.5 text-[0.75rem] text-[#282525]" style={{ borderColor: "rgba(13,13,13,.1)" }}>{mensagem}</p>
            <button type="button" onClick={() => void copiar()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiada" : "Copiar mensagem"}</button>
          </>
        )}
      </div>
    </TopSheet>
  );
}

/** A visitação de um espaço (PD7.5): os horários com a ocupação, os agendamentos de escolas e grupos, o link público e o público por dia. */
export function VisitacaoDoEspaco({ organizationId, espacoId, espacoNome, podeEditar }: { organizationId: string; espacoId: string; espacoNome: string; podeEditar: boolean }) {
  const [horarios, setHorarios] = useState<HorarioDeVisita[] | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendamentoDeVisita[]>([]);
  const [link, setLink] = useState<LinkDeVisitas | null>(null);
  const [folhaHorario, setFolhaHorario] = useState<{ horario: HorarioDeVisita | null } | null>(null);
  const [folhaAgendamento, setFolhaAgendamento] = useState<{ horario: HorarioDeVisita; agendamento: AgendamentoDeVisita | null } | null>(null);
  const [linkAberto, setLinkAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const [hor, lnk] = await Promise.all([
        producao.from("producao_visitas_horarios").select("id, dia, inicio, fim, capacidade, publico_avulso, notas").eq("espaco_id", espacoId).gte("dia", desde).order("dia").order("inicio"),
        producao.from("producao_visitas_links").select("id, titulo, expira_em, revogado_em").eq("espaco_id", espacoId).maybeSingle(),
      ]);
      const ids = (hor.data ?? []).map(horario => horario.id);
      const ag = ids.length > 0
        ? await producao.from("producao_visitas_agendamentos").select("id, horario_id, grupo, responsavel, email, telefone, pessoas, situacao, presentes, observacao").in("horario_id", ids).order("created_at")
        : { data: [], error: null };
      if (!ativo) return;
      setHorarios(hor.data ?? []);
      setAgendamentos(ag.data ?? []);
      setLink(lnk.data ?? null);
      setErro(hor.error || ag.error || lnk.error ? "Não foi possível carregar a visitação. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [espacoId, versao]);

  const ocupacao = useMemo(() => ocupacaoDosHorarios(horarios ?? [], agendamentos), [horarios, agendamentos]);
  const publico = useMemo(() => publicoPorDia(horarios ?? [], agendamentos), [horarios, agendamentos]);
  const porHorario = useMemo(() => {
    const mapa = new Map<string, AgendamentoDeVisita[]>();
    for (const agendamento of agendamentos) mapa.set(agendamento.horario_id, [...(mapa.get(agendamento.horario_id) ?? []), agendamento]);
    return mapa;
  }, [agendamentos]);
  const recarregar = () => setVersao(atual => atual + 1);
  const linkAtivo = !!link && !link.revogado_em && new Date(link.expira_em).getTime() > agora;

  async function mudarSituacao(agendamento: AgendamentoDeVisita, situacao: SituacaoDoAgendamento) {
    setTrabalhando(agendamento.id);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_visitas_agendamentos").update({ situacao }).eq("id", agendamento.id);
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeVisita(error)); return; }
    recarregar();
  }

  async function encerrarLink() {
    if (!link) return;
    setTrabalhando("link");
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_visitas_links").update({ revogado_em: new Date().toISOString() }).eq("id", link.id);
    setTrabalhando(null);
    if (error) { setErro("Não foi possível encerrar os agendamentos. Tente de novo."); return; }
    recarregar();
  }

  if (horarios === null) return <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  return (
    <div className="space-y-6">
      {erro && <Erro texto={erro} />}

      <section aria-labelledby="horarios-visita">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="horarios-visita" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Horários de visita</h2>
          {podeEditar && (
            <span className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLinkAberto(true)} className={BOTAO}><Link2 size={13} aria-hidden="true" /> {link ? "Novo link de agendamento" : "Link de agendamento"}</button>
              <button type="button" onClick={() => setFolhaHorario({ horario: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Novo horário</button>
            </span>
          )}
        </div>
        {link && (
          <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-black/55">
            <span>{linkAtivo ? `Agendamentos abertos até ${new Date(link.expira_em).toLocaleDateString("pt-BR")}` : "Agendamentos encerrados"}</span>
            {podeEditar && linkAtivo && <button type="button" onClick={() => void encerrarLink()} disabled={trabalhando === "link"} className="text-[0.6875rem] font-medium text-black/55 underline underline-offset-2 hover:text-[#282525] disabled:opacity-50">Encerrar agendamentos</button>}
          </p>
        )}
        {horarios.length === 0 ? (
          <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhum horário de visita ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Crie os horários (dia, hora e capacidade) e divulgue o link: escolas e grupos pedem a visita e você confirma. O banco não deixa passar da capacidade.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {horarios.map(horario => {
              const ocup = ocupacao.get(horario.id);
              const lista = porHorario.get(horario.id) ?? [];
              return (
                <li key={horario.id} className="overflow-hidden rounded border bg-white" style={{ borderColor: ocup?.estado === "estourado" ? "#B07A1447" : "rgba(13,13,13,.08)" }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-[0.8125rem] font-medium text-[#282525]">{diaDaSemana(horario.dia)} {diaEMes(horario.dia)}, {hora(horario.inicio)} às {hora(horario.fim)}</p>
                      {horario.notas && <p className="truncate text-[0.6875rem] text-black/45">{horario.notas}</p>}
                    </div>
                    <p className="flex items-center gap-1 text-[0.75rem] tabular-nums text-black/65">
                      {ocup?.estado === "estourado" && <TriangleAlert size={12} aria-hidden="true" className="text-[#B07A14]" />}
                      {ocup?.usados ?? 0} de {horario.capacidade} pessoas{ocup?.estado === "cheio" ? " · cheio" : ocup?.estado === "estourado" ? ` · ${Math.abs(ocup.livres)} acima` : ocup ? ` · ${ocup.livres} livres` : ""}
                    </p>
                    {podeEditar && (
                      <span className="flex gap-1.5">
                        <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaAgendamento({ horario, agendamento: null })}>Agendar grupo</button>
                        <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaHorario({ horario })}>Editar</button>
                      </span>
                    )}
                  </div>
                  {lista.length > 0 && (
                    <ul className="divide-y divide-black/[.06] border-t border-black/[.06]">
                      {lista.map(agendamento => (
                        <li key={agendamento.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2">
                          <div className="min-w-0 flex-1 basis-48">
                            <p className={`truncate text-[0.8125rem] ${agendamento.situacao === "recusado" || agendamento.situacao === "cancelado" ? "text-black/40 line-through" : "text-[#282525]"}`}>{agendamento.grupo}</p>
                            <p className="truncate text-[0.6875rem] text-black/45">{[agendamento.responsavel, agendamento.email, agendamento.telefone].filter(Boolean).join(" · ")}</p>
                          </div>
                          <span className="w-20 text-[0.75rem] tabular-nums text-black/55">{agendamento.pessoas} {agendamento.pessoas === 1 ? "pessoa" : "pessoas"}</span>
                          <span className="w-24 text-[0.75rem] text-black/65">{ROTULO_DA_SITUACAO_DO_AGENDAMENTO[agendamento.situacao]}</span>
                          {podeEditar && (
                            <span className="flex gap-1.5">
                              {agendamento.situacao !== "confirmado" && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === agendamento.id} onClick={() => void mudarSituacao(agendamento, "confirmado")}>Confirmar</button>}
                              {(agendamento.situacao === "pedido") && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === agendamento.id} onClick={() => void mudarSituacao(agendamento, "recusado")}>Recusar</button>}
                              {agendamento.situacao === "confirmado" && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === agendamento.id} onClick={() => void mudarSituacao(agendamento, "cancelado")}>Cancelar</button>}
                              <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaAgendamento({ horario, agendamento })}>Editar</button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {publico.length > 0 && (
        <section aria-labelledby="publico-por-dia">
          <h2 id="publico-por-dia" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Público por dia</h2>
          <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-black/[.06]">
                  {["Dia", "Agendados", "Vieram (grupos)", "Avulso", "Total"].map((titulo, indice) => <th key={titulo} scope="col" className={`px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 ${indice > 0 ? "text-right" : ""}`}>{titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {publico.map(dia => (
                  <Fragment key={dia.dia}>
                    <tr className="border-b border-black/[.06] last:border-b-0">
                      <th scope="row" className="px-4 py-2 text-left text-[0.8125rem] font-medium text-[#282525]">{diaDaSemana(dia.dia)} {diaEMes(dia.dia)}</th>
                      {[dia.agendados, dia.vieram, dia.avulso, dia.total].map((valor, indice) => <td key={indice} className={`px-4 py-2 text-right text-[0.8125rem] tabular-nums ${valor === 0 ? "text-black/30" : indice === 3 ? "font-semibold text-[#282525]" : "text-[#282525]"}`}>{valor}</td>)}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {folhaHorario && <HorarioSheet organizationId={organizationId} espacoId={espacoId} horario={folhaHorario.horario} onClose={() => setFolhaHorario(null)} onSalvou={recarregar} />}
      {folhaAgendamento && <AgendamentoSheet organizationId={organizationId} horario={folhaAgendamento.horario} agendamento={folhaAgendamento.agendamento} onClose={() => setFolhaAgendamento(null)} onSalvou={recarregar} />}
      {linkAberto && <LinkSheet espacoId={espacoId} espacoNome={espacoNome} ativo={link} onClose={() => setLinkAberto(false)} onGerou={recarregar} />}
    </div>
  );
}
