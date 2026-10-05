"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, Clock, Mail, MessageCircleQuestion, Pencil, Plus, RefreshCw, RotateCcw, Save, StickyNote, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useTaxonomiasComerciais } from "@/contexts/TaxonomiasComerciaisContext";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { Select } from "@/components/ui/Select";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { NotasRelacionais } from "@/components/relationship/NotasRelacionais";

type Contact = { id: string; nome: string; cargo: string | null };
type Member = { id: string; nome: string };
type Interaction = { id: string; tipo: string; canal: string | null; direcao: "entrada" | "saida" | null; assunto: string; resumo: string | null; resultado: string | null; ocorreu_em: string; email_id: string | null; contato: { nome: string } | null };
type Followup = {
  id: string; titulo: string; motivo: string | null; canal: string; previsto_para: string;
  status: "pendente" | "concluido" | "cancelado"; tentativa: number; workflow: string | null;
  contato_id: string | null; responsavel_id: string | null; concluido_em: string | null; resultado: string | null;
  contato: { nome: string } | null; responsavel: { full_name: string | null } | null;
};
type Question = { id: string; tipo: string; titulo: string; resposta: string | null; status: string; contato: { nome: string } | null };
type FormKind = "interacao" | "followup" | "duvida";
type FollowupFilter = "pendentes" | "concluidos" | "cancelados" | "todos";

type Props = {
  organizationId: string | null; accountId: string | null; empresaCrmId: string | null;
  captacaoId?: string | null; contaPatrocinioId?: string | null; proponenteId?: string | null;
  contacts: Contact[]; mode?: "commercial" | "customer_success";
};

type WorkflowDef = {
  id: string; label: string;
  interactionChannel: string; interactionResult: string; interactionSummary: string;
  followupTitle: string; followupChannel: string; followupDays: number;
};

const WORKFLOWS: WorkflowDef[] = [
  { id: "sem_resposta", label: "Sem resposta", interactionChannel: "telefone", interactionResult: "sem_resposta", interactionSummary: "Tentativa de contato sem retorno", followupTitle: "Tentar novo contato", followupChannel: "telefone", followupDays: 2 },
  { id: "negociacao_esfriando", label: "Negociação esfriando", interactionChannel: "email", interactionResult: "adiado", interactionSummary: "Negociação sem avanço recente", followupTitle: "Reaquecer negociação", followupChannel: "email", followupDays: 3 },
  { id: "novo_contato", label: "Novo ponto de contato", interactionChannel: "linkedin", interactionResult: "respondeu", interactionSummary: "Identificado novo contato na empresa", followupTitle: "Abordar novo contato", followupChannel: "email", followupDays: 1 },
  { id: "pos_reuniao", label: "Pós-reunião", interactionChannel: "videoconferencia", interactionResult: "avancou", interactionSummary: "Reunião realizada", followupTitle: "Enviar recap e próximos passos", followupChannel: "email", followupDays: 1 },
  { id: "retomar_futuramente", label: "Retomar futuramente", interactionChannel: "email", interactionResult: "adiado", interactionSummary: "Contato pausado por decisão do prospect ou da equipe", followupTitle: "Retomar contato", followupChannel: "email", followupDays: 30 },
];
const CUSTOMER_SUCCESS_WORKFLOWS: WorkflowDef[] = [
  { id: "revisao_parceria", label: "Revisar a parceria", interactionChannel: "videoconferencia", interactionResult: "avancou", interactionSummary: "Início de revisão periódica da parceria", followupTitle: "Concluir revisão da parceria", followupChannel: "videoconferencia", followupDays: 7 },
  { id: "entrega_em_risco", label: "Entrega em risco", interactionChannel: "email", interactionResult: "adiado", interactionSummary: "Entrega identificada como em risco", followupTitle: "Verificar status da entrega em risco", followupChannel: "telefone", followupDays: 1 },
  { id: "mapear_stakeholders", label: "Mapear stakeholders", interactionChannel: "linkedin", interactionResult: "respondeu", interactionSummary: "Mapeamento de stakeholders iniciado", followupTitle: "Completar mapeamento de stakeholders", followupChannel: "email", followupDays: 5 },
  { id: "preparar_renovacao", label: "Preparar renovação", interactionChannel: "email", interactionResult: "avancou", interactionSummary: "Preparação para renovação iniciada", followupTitle: "Enviar proposta de renovação", followupChannel: "email", followupDays: 14 },
  { id: "oportunidade_expansao", label: "Explorar expansão", interactionChannel: "email", interactionResult: "avancou", interactionSummary: "Oportunidade de expansão identificada", followupTitle: "Apresentar proposta de expansão", followupChannel: "videoconferencia", followupDays: 7 },
];

function interactionType(channel: string) {
  if (channel === "whatsapp") return "mensagem";
  if (channel === "videoconferencia" || channel === "presencial") return "reuniao";
  return channel;
}
function dateLabel(value: string) { return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function RelationshipWorkspace({ organizationId: organizationIdProp, accountId, empresaCrmId, captacaoId = null, contaPatrocinioId = null, proponenteId = null, contacts, mode = "commercial" }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const sessionOrganizationId = useOrganizationId();
  const organizationId = organizationIdProp ?? sessionOrganizationId;
  const { canais, resultados } = useTaxonomiasComerciais();
  const [section, setSection] = useState<"interacoes" | "followups" | "duvidas" | "notas">("followups");
  const [notaFormOpen, setNotaFormOpen] = useState(false);
  const [filter, setFilter] = useState<FollowupFilter>("pendentes");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [detail, setDetail] = useState("");
  const [contactId, setContactId] = useState(""); const [responsibleId, setResponsibleId] = useState(accountId ?? "");
  const [channel, setChannel] = useState("email"); const [date, setDate] = useState("");
  const [workflow, setWorkflow] = useState(""); const [result, setResult] = useState("");
  const [finishing, setFinishing] = useState<Followup | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowDef | null>(null);
  const emailSyncStarted = useRef(false);

  const channelLabel = (value: string) => canais.find(item => item.chave === value)?.label ?? value.replaceAll("_", " ");
  const resultLabel = (value: string) => resultados.find(item => item.chave === value)?.label ?? value.replaceAll("_", " ");
  const activeChannels = canais.filter(item => item.ativo || item.chave === channel);
  const activeResults = resultados.filter(item => item.ativo || item.chave === result);

  const load = useCallback(async () => {
    setLoading(true);
    const scope = (table: string, columns: string) => {
      let query = (supabase as any).from(table).select(columns);
      if (captacaoId) query = query.eq("captacao_id", captacaoId);
      else if (contaPatrocinioId) query = query.eq("conta_patrocinio_id", contaPatrocinioId);
      else if (empresaCrmId) query = query.eq("empresa_crm_id", empresaCrmId);
      else if (proponenteId) query = query.eq("proponente_id", proponenteId);
      return query;
    };
    const [i, f, q, memberResult] = await Promise.all([
      scope("crm_interacoes", "id,tipo,canal,direcao,assunto,resumo,resultado,ocorreu_em,email_id,contato:contatos(nome)").order("ocorreu_em", { ascending: false }),
      scope("crm_followups", "id,titulo,motivo,canal,previsto_para,status,tentativa,workflow,contato_id,responsavel_id,concluido_em,resultado,contato:contatos(nome),responsavel:profiles!responsavel_id(full_name)").order("previsto_para"),
      scope("crm_duvidas", "id,tipo,titulo,resposta,status,contato:contatos(nome)").order("created_at", { ascending: false }),
      fetchOrganizationMembers(organizationId)
        .then(data => ({ data, error: null as Error | null }))
        .catch(error => ({ data: [], error: error instanceof Error ? error : new Error("Falha ao carregar equipe") })),
    ]);
    const firstError = i.error ?? f.error ?? q.error ?? memberResult.error;
    setError(firstError?.message ?? null); setInteractions(i.data ?? []); setFollowups(f.data ?? []); setQuestions(q.data ?? []);
    setMembers(memberResult.data.filter(item => item.papel !== "captador").map(item => ({ id: item.user_id, nome: item.full_name || item.email || "Membro da equipe" })));
    setLoading(false);
  }, [captacaoId, contaPatrocinioId, empresaCrmId, organizationId, proponenteId, supabase]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (emailSyncStarted.current) return;
    emailSyncStarted.current = true;
    void fetch("/api/email/sync", { method: "POST" })
      .then(async response => {
        if (!response.ok) return;
        const result = await response.json() as { synced?: number };
        if ((result.synced ?? 0) > 0) await load();
      })
      .catch(() => undefined);
  }, [load]);

  function resetForm() {
    setForm(null); setEditingId(null); setTitle(""); setDetail(""); setContactId(""); setResponsibleId(accountId ?? "");
    setChannel("email"); setDate(""); setWorkflow(""); setResult(""); setError(null);
  }
  function editFollowup(item: Followup) {
    setForm("followup"); setEditingId(item.id); setTitle(item.titulo); setDetail(item.motivo ?? "");
    setContactId(item.contato_id ?? ""); setResponsibleId(item.responsavel_id ?? accountId ?? "");
    setChannel(item.canal); setDate(localDateTime(item.previsto_para)); setWorkflow(item.workflow ?? ""); setError(null);
  }

  async function save() {
    if (!form || !title.trim()) return;
    setSaving(true); setError(null);
    const common = { organization_id: organizationId, account_id: accountId, empresa_crm_id: empresaCrmId, proponente_id: proponenteId, contato_id: contactId || null, captacao_id: captacaoId, conta_patrocinio_id: contaPatrocinioId };
    let operation;
    if (form === "interacao") {
      operation = await (supabase as any).from("crm_interacoes").insert({ ...common, tipo: interactionType(channel), canal: channel, tipo_interacao: channel === "telefone" ? "ligacao" : channel === "videoconferencia" || channel === "presencial" ? "reuniao" : "mensagem", direcao: "saida", assunto: title.trim(), resumo: detail.trim() || null, resultado: result || null, ocorreu_em: date ? new Date(date).toISOString() : new Date().toISOString() });
    } else if (form === "followup") {
      const payload = { ...common, titulo: title.trim(), motivo: detail.trim() || null, canal: interactionType(channel), previsto_para: date ? new Date(date).toISOString() : new Date(Date.now() + 86_400_000).toISOString(), workflow: workflow || null, responsavel_id: responsibleId || null };
      operation = editingId ? await (supabase as any).from("crm_followups").update(payload).eq("id", editingId) : await (supabase as any).from("crm_followups").insert(payload);
    } else {
      operation = await (supabase as any).from("crm_duvidas").insert({ ...common, tipo: channel === "objecao" ? "objecao" : "duvida", titulo: title.trim(), resposta: detail.trim() || null, status: detail.trim() ? "respondida" : "aberta" });
    }
    setSaving(false);
    if (operation.error) { setError(operation.error.message); return; }
    resetForm(); await load();
  }

  function handleWorkflowClick(def: WorkflowDef) {
    if (contacts.length >= 2) { setPendingWorkflow(def); return; }
    void runWorkflow(def, contacts.length === 1 ? contacts[0].id : null);
  }

  async function runWorkflow(def: WorkflowDef, contactIdForWorkflow: string | null) {
    setRunningWorkflow(def.id); setError(null);
    const common = { organization_id: organizationId, account_id: accountId, empresa_crm_id: empresaCrmId, proponente_id: proponenteId, contato_id: contactIdForWorkflow, captacao_id: captacaoId, conta_patrocinio_id: contaPatrocinioId };
    const now = new Date().toISOString();

    const interactionOp = await (supabase as any).from("crm_interacoes").insert({
      ...common, tipo: interactionType(def.interactionChannel), canal: def.interactionChannel,
      tipo_interacao: def.interactionChannel === "telefone" ? "ligacao" : def.interactionChannel === "videoconferencia" || def.interactionChannel === "presencial" ? "reuniao" : "mensagem",
      direcao: "saida", assunto: def.label, resumo: def.interactionSummary, resultado: def.interactionResult, ocorreu_em: now,
    });
    if (interactionOp.error) { setError(interactionOp.error.message); setRunningWorkflow(null); return; }

    const followupOp = await (supabase as any).from("crm_followups").insert({
      ...common, titulo: def.followupTitle, motivo: def.interactionSummary, canal: interactionType(def.followupChannel),
      previsto_para: new Date(Date.now() + def.followupDays * 86_400_000).toISOString(), workflow: def.id, responsavel_id: accountId,
    });

    setRunningWorkflow(null);
    if (followupOp.error) { setError(followupOp.error.message); return; }
    setSection("followups"); setFilter("pendentes"); await load();
  }

  async function updateStatus(item: Followup, status: "pendente" | "cancelado") {
    setSaving(true); setError(null);
    const { error: updateError } = await (supabase as any).from("crm_followups").update({ status, concluido_em: status === "pendente" ? null : item.concluido_em }).eq("id", item.id);
    setSaving(false); if (updateError) { setError(updateError.message); return; } await load();
  }

  async function finish(payload: { canal: string; resultado: string; resumo: string; ocorreuEm: string; nextTitle: string; nextDate: string }) {
    if (!finishing) return;
    setSaving(true); setError(null);
    const { error: rpcError } = await (supabase as any).rpc("fn_concluir_followup_com_interacao_v2", {
      p_followup_id: finishing.id, p_canal: payload.canal, p_resultado: payload.resultado,
      p_resumo: payload.resumo || null, p_ocorreu_em: new Date(payload.ocorreuEm).toISOString(),
      p_proximo_titulo: payload.nextTitle.trim() || null,
      p_proximo_previsto_para: payload.nextTitle.trim() && payload.nextDate ? new Date(payload.nextDate).toISOString() : null,
    });
    setSaving(false); if (rpcError) { setError(rpcError.message); return; } setFinishing(null); await load();
  }

  const pending = followups.filter(item => item.status === "pendente");
  const visible = followups.filter(item => filter === "todos" || (filter === "pendentes" && item.status === "pendente") || (filter === "concluidos" && item.status === "concluido") || (filter === "cancelados" && item.status === "cancelado"));
  const overdue = pending.filter(item => new Date(item.previsto_para).getTime() < Date.now()).length;
  const lastInteraction = interactions[0]?.ocorreu_em;
  const coldDays = lastInteraction ? Math.floor((Date.now() - new Date(lastInteraction).getTime()) / 86_400_000) : null;
  const workflows = mode === "customer_success" ? CUSTOMER_SUCCESS_WORKFLOWS : WORKFLOWS;

  return <div className="space-y-5">
    <div className="grid gap-px overflow-hidden rounded border bg-black/[.06] sm:grid-cols-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <Metric label="Próximas ações" value={String(pending.length)} tone="#7259B5" /><Metric label="Atrasadas" value={String(overdue)} tone={overdue ? "#D94E4E" : "#2E8932"} /><Metric label="Última interação" value={coldDays === null ? "Sem histórico" : coldDays === 0 ? "Hoje" : `${coldDays} dias`} tone={coldDays !== null && coldDays >= 14 ? "#B07A14" : "#1A8B7A"} />
    </div>

    <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <header className="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}><div><p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/30">{mode === "customer_success" ? "Governança da parceria" : "Memória relacional"}</p><h2 className="mt-1 text-[1rem] font-bold text-black">Relacionamento</h2></div><div className="flex flex-wrap gap-2">{section === "interacoes" && <Action onClick={() => setForm("interacao")} label="Registrar interação" />}{section === "duvidas" && <Action onClick={() => setForm("duvida")} label="Dúvida ou objeção" />}{section === "followups" && <Action onClick={() => setForm("followup")} label="Novo follow-up" primary />}{section === "notas" && <Action onClick={() => setNotaFormOpen(true)} label="Nova nota" />}</div></header>
      <nav className="flex gap-5 border-b px-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>{([['followups','Próximas ações',Clock],['interacoes','Interações',RefreshCw],['duvidas','Dúvidas e objeções',MessageCircleQuestion],['notas','Notas',StickyNote]] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setSection(id)} className="relative flex h-11 items-center gap-1.5 text-[0.75rem] font-medium" style={{ color: section === id ? "#7259B5" : "rgba(13,13,13,.4)" }}><Icon size={12}/>{label}{section === id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#7259B5]"/>}</button>)}</nav>
      {section === "followups" && <div className="flex flex-wrap gap-1.5 border-b px-5 py-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>{([['pendentes','Pendentes'],['concluidos','Concluídos'],['cancelados','Cancelados'],['todos','Todos']] as const).map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`rounded border px-2.5 py-1 text-[0.625rem] font-medium bg-white transition ${filter === id ? "border-[#7259B5]/40 text-[#7259B5]" : "border-transparent text-black/40 hover:bg-black/[.04]"}`}>{label}</button>)}</div>}

      {form && <EntryForm kind={form} editing={Boolean(editingId)} title={title} detail={detail} contactId={contactId} responsibleId={responsibleId} channel={channel} date={date} result={result} contacts={contacts} members={members} channels={activeChannels} results={activeResults} saving={saving} error={error} onTitle={setTitle} onDetail={setDetail} onContact={setContactId} onResponsible={setResponsibleId} onChannel={setChannel} onDate={setDate} onResult={setResult} onCancel={resetForm} onSave={save}/>} 
      {finishing && <FollowupCompletion followup={finishing} saving={saving} error={error} channels={canais} results={resultados} onCancel={() => { setFinishing(null); setError(null); }} onSave={finish} />}
      {error && !form && !finishing && <p className="m-5 rounded border border-[#D94E4E]/20 px-3 py-2 text-xs text-[#D94E4E]">{error}</p>}
      {section === "notas" ? <NotasRelacionais empresaCrmId={empresaCrmId} proponenteId={proponenteId} showNew={notaFormOpen} setShowNew={setNotaFormOpen} /> : (
        <div className="divide-y divide-black/[.06]">
          {loading ? <p className="px-5 py-12 text-center text-xs text-black/30">Carregando…</p> : section === "followups" ? visible.map(item => <FollowupRow key={item.id} item={item} channelLabel={channelLabel} saving={saving} onFinish={() => setFinishing(item)} onEdit={() => editFollowup(item)} onCancel={() => void updateStatus(item, "cancelado")} onReopen={() => void updateStatus(item, "pendente")} />) : section === "interacoes" ? interactions.map(item => <div key={item.id} className="px-5 py-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2">{item.email_id && <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-black/[.04] text-[#2D72B0]" title="Sincronizado do e-mail"><Mail size={10}/></span>}<p className="truncate text-[0.8125rem] font-semibold text-black">{item.assunto}</p></div></div><span className="flex-shrink-0 text-[0.6875rem] text-black/30">{dateLabel(item.ocorreu_em)}</span></div>{item.resumo && <p className="mt-2 whitespace-pre-line text-[0.75rem] leading-relaxed text-black/50">{item.resumo}</p>}<p className="mt-1 text-[0.625rem] text-black/30">{item.contato?.nome ?? "Empresa"} · {channelLabel(item.canal ?? item.tipo)}{item.direcao ? ` · ${item.direcao === "entrada" ? "Recebido" : "Enviado"}` : ""}{item.resultado ? ` · ${resultLabel(item.resultado)}` : ""}</p></div>) : questions.map(item => <div key={item.id} className="px-5 py-4"><div className="flex items-center gap-2"><span className="rounded border px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase" style={{ color: item.tipo === "objecao" ? "#D94E4E" : "#2D72B0", borderColor: item.tipo === "objecao" ? "#D94E4E40" : "#2D72B040" }}>{item.tipo}</span><p className="text-[0.8125rem] font-semibold text-black">{item.titulo}</p></div>{item.resposta && <p className="mt-2 text-[0.75rem] text-black/50">{item.resposta}</p>}</div>)}
          {!loading && ((section === "followups" && !visible.length) || (section === "interacoes" && !interactions.length) || (section === "duvidas" && !questions.length)) && <div className="px-5 py-14 text-center"><p className="text-sm font-medium text-black/30">Nada registrado aqui ainda</p></div>}
        </div>
      )}
    </div>
    <div className="rounded border bg-white p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/30">Workflows sugeridos</p>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {workflows.map(def => (
          <button
            key={def.id}
            disabled={runningWorkflow !== null}
            onClick={() => handleWorkflowClick(def)}
            className="rounded border bg-white p-3 text-left transition hover:bg-black/[.04] disabled:opacity-40"
            style={{ borderColor: "rgba(13,13,13,.09)" }}
          >
            <p className="text-[0.75rem] font-semibold text-black">{runningWorkflow === def.id ? "Criando…" : def.label}</p>
          </button>
        ))}
      </div>
    </div>
    {pendingWorkflow && (
      <WorkflowContactPicker
        def={pendingWorkflow}
        contacts={contacts}
        saving={runningWorkflow !== null}
        onCancel={() => setPendingWorkflow(null)}
        onConfirm={contactIdChosen => { const def = pendingWorkflow; setPendingWorkflow(null); void runWorkflow(def, contactIdChosen); }}
      />
    )}
  </div>;
}

function FollowupRow({ item, channelLabel, saving, onFinish, onEdit, onCancel, onReopen }: { item: Followup; channelLabel: (value: string) => string; saving: boolean; onFinish: () => void; onEdit: () => void; onCancel: () => void; onReopen: () => void }) {
  const pending = item.status === "pendente";
  return <div className="flex items-center gap-3 px-5 py-4">{pending ? <button disabled={saving} onClick={onFinish} title="Concluir" className="flex h-6 w-6 items-center justify-center rounded border border-black/12 text-black/20 hover:border-[#2E8932] hover:text-[#2E8932]"><Check size={12}/></button> : <span className={`flex h-6 w-6 items-center justify-center rounded ${item.status === "concluido" ? "bg-black/[.04] text-[#2E8932]" : "bg-black/[.04] text-black/25"}`}>{item.status === "concluido" ? <Check size={12}/> : <X size={12}/>}</span>}<div className="min-w-0 flex-1"><p className={`text-[0.8125rem] font-semibold ${pending ? "text-black" : "text-black/40"}`}>{item.titulo}</p><p className="mt-0.5 text-[0.6875rem] text-black/35">{item.contato?.nome ?? "Sem contato definido"} · {channelLabel(item.canal)} · {item.responsavel?.full_name ?? "Sem responsável"} · tentativa {item.tentativa}</p>{item.resultado && <p className="mt-0.5 text-[0.625rem] text-black/30">Resultado: {item.resultado.replaceAll("_", " ")}</p>}</div><span className="hidden text-[0.6875rem] font-medium sm:block" style={{ color: pending && new Date(item.previsto_para).getTime() < Date.now() ? "#D94E4E" : "rgba(13,13,13,.4)" }}>{dateLabel(item.previsto_para)}</span><div className="flex items-center gap-1">{pending ? <><button onClick={onEdit} title="Editar" className="rounded p-1.5 text-black/25 hover:bg-black/[.04] hover:text-black/55"><Pencil size={12}/></button><button onClick={onCancel} title="Cancelar" className="rounded p-1.5 text-black/25 hover:bg-black/[.04] hover:text-[#D94E4E]"><X size={13}/></button></> : <button onClick={onReopen} title="Reabrir" className="rounded p-1.5 text-black/25 hover:bg-black/[.04] hover:text-[#7259B5]"><RotateCcw size={12}/></button>}</div></div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className="flex min-h-28 flex-col justify-center bg-white px-5 py-4"><p className="text-[0.625rem] font-medium text-black/30">{label}</p><p className="mt-2 text-[1.125rem] font-semibold tracking-[-.02em]" style={{ color: tone }}>{value}</p></div>; }
function Action({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) { return <button onClick={onClick} className="rounded border bg-white px-3 py-2 text-[0.75rem] font-medium transition hover:bg-black/[.04]" style={{ color: primary ? "#7259B5" : "rgba(13,13,13,.6)", borderColor: primary ? "#7259B540" : "rgba(13,13,13,.1)" }}><Plus size={11} className="mr-1.5 inline"/>{label}</button>; }

type Taxonomy = { chave: string; label: string; ativo: boolean };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-black/30 mb-1.5">{children}</p>;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 flex items-center text-[0.75rem] font-semibold text-black">{children}</label>;
}

const fieldClass = "w-full rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-black outline-none transition focus:border-black/30";
const fieldStyle = { borderColor: "rgba(13,13,13,.15)" } as const;

function WorkflowContactPicker({ def, contacts, saving, onCancel, onConfirm }: { def: WorkflowDef; contacts: Contact[]; saving: boolean; onCancel: () => void; onConfirm: (contactId: string | null) => void }) {
  const [contactId, setContactId] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ background: "rgba(0,0,0,.45)" }} onClick={onCancel}>
      <div
        className="flex w-full max-w-[30rem] flex-col overflow-hidden rounded-b bg-white"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5"><CalendarClock size={16} className="text-black/50" /></div>
            <h2 className="text-[0.9375rem] font-bold text-black">{def.label}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="px-5 py-5">
          <SectionLabel>Vincular contato</SectionLabel>
          <p className="mb-3 text-[0.75rem] leading-relaxed text-black/45">Essa empresa tem mais de um contato. Quem esse workflow deve referenciar?</p>
          <div>
            <FieldLabel>Contato</FieldLabel>
            <CustomDropdown
              value={contactId}
              onChange={setContactId}
              placeholder="Sem contato específico"
              className="[&>button]:w-full [&>button]:border-black/[.15] [&>button]:py-2.5"
              options={contacts.map(c => ({ value: c.id, label: c.cargo ? `${c.nome} · ${c.cargo}` : c.nome }))}
            />
          </div>
        </main>

        <footer className="flex items-center justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button onClick={onCancel} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
          <button disabled={saving} onClick={() => onConfirm(contactId || null)} className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.75rem] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-60">
            <Save size={12} /> {saving ? "Criando…" : "Confirmar"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function EntryForm(props: { kind: FormKind; editing: boolean; title:string; detail:string; contactId:string; responsibleId:string; channel:string; date:string; result:string; contacts:Contact[]; members:Member[]; channels:Taxonomy[]; results:Taxonomy[]; saving:boolean; error:string|null; onTitle:(v:string)=>void; onDetail:(v:string)=>void; onContact:(v:string)=>void; onResponsible:(v:string)=>void; onChannel:(v:string)=>void; onDate:(v:string)=>void; onResult:(v:string)=>void; onCancel:()=>void; onSave:()=>void }) {
  const isQuestion = props.kind === "duvida";
  const titleText = props.editing ? "Editar follow-up" : props.kind === "followup" ? "Novo follow-up" : props.kind === "interacao" ? "Registrar interação" : "Nova dúvida ou objeção";
  const Icon = props.kind === "followup" ? CalendarClock : props.kind === "interacao" ? RefreshCw : MessageCircleQuestion;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ background: "rgba(0,0,0,.45)" }} onClick={props.onCancel}>
      <div
        className="flex w-full max-w-[30rem] flex-col overflow-hidden rounded-b bg-white"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5"><Icon size={16} className="text-black/50" /></div>
            <h2 className="text-[0.9375rem] font-bold text-black">{titleText}</h2>
          </div>
          <button type="button" onClick={props.onCancel} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="px-5 py-5">
          <SectionLabel>{isQuestion ? "Dúvida ou objeção" : props.kind === "followup" ? "Follow-up" : "Interação"}</SectionLabel>

          <div className="mb-4">
            <FieldLabel>{isQuestion ? "Qual é a dúvida ou objeção? *" : "Assunto *"}</FieldLabel>
            <input value={props.title} onChange={e=>props.onTitle(e.target.value)} placeholder={isQuestion ? "Ex: Preço acima do orçamento" : "Ex: Follow-up de proposta"} className={fieldClass} style={fieldStyle}/>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Contato</FieldLabel>
              <CustomDropdown
                value={props.contactId}
                onChange={props.onContact}
                placeholder="Sem contato específico"
                className="[&>button]:w-full [&>button]:border-black/[.15] [&>button]:py-2.5"
                options={props.contacts.map(c => ({ value: c.id, label: c.cargo ? `${c.nome} · ${c.cargo}` : c.nome }))}
              />
            </div>
            <div>
              <FieldLabel>{isQuestion ? "Tipo" : "Canal"}</FieldLabel>
              {isQuestion ? (
                <CustomDropdown value={props.channel} onChange={props.onChannel} className="[&>button]:w-full [&>button]:border-black/[.15] [&>button]:py-2.5" options={[{ value: "duvida", label: "Dúvida" }, { value: "objecao", label: "Objeção" }]} />
              ) : (
                <CustomDropdown value={props.channel} onChange={props.onChannel} className="[&>button]:w-full [&>button]:border-black/[.15] [&>button]:py-2.5" options={props.channels.map(c => ({ value: c.chave, label: c.label }))} />
              )}
            </div>
          </div>

          {props.kind !== "duvida" && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Data e hora</FieldLabel>
                <input type="datetime-local" value={props.date} onChange={e=>props.onDate(e.target.value)} className={fieldClass} style={fieldStyle}/>
              </div>
              {props.kind === "followup" && (
                <div>
                  <FieldLabel>Responsável</FieldLabel>
                  <CustomDropdown
                    value={props.responsibleId}
                    onChange={props.onResponsible}
                    placeholder="Sem responsável"
                    className="[&>button]:w-full [&>button]:border-black/[.15] [&>button]:py-2.5"
                    options={props.members.map(member => ({ value: member.id, label: member.nome }))}
                  />
                </div>
              )}
              {props.kind === "interacao" && (
                <div>
                  <FieldLabel>Resultado</FieldLabel>
                  <CustomDropdown
                    value={props.result}
                    onChange={props.onResult}
                    placeholder="Resultado"
                    className="[&>button]:w-full [&>button]:border-black/[.15] [&>button]:py-2.5"
                    options={props.results.map(item => ({ value: item.chave, label: item.label }))}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <FieldLabel>{isQuestion ? "Resposta preparada" : "Contexto, motivo ou resumo"}</FieldLabel>
            <textarea value={props.detail} onChange={e=>props.onDetail(e.target.value)} rows={3} placeholder={isQuestion ? "Resposta já preparada para o contato" : "O que aconteceu ou o que precisa acontecer"} className={`${fieldClass} resize-none`} style={fieldStyle}/>
          </div>
        </main>

        <footer className="flex items-center justify-between gap-4 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {props.error ? <p className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{props.error}</p> : <div />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button onClick={props.onCancel} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
            <button disabled={!props.title.trim()||props.saving} onClick={props.onSave} className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.75rem] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-60">
              <Save size={12} /> {props.saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FollowupCompletion({ followup, saving, error, channels, results, onCancel, onSave }: { followup: Followup; saving: boolean; error: string | null; channels: Taxonomy[]; results: Taxonomy[]; onCancel: () => void; onSave: (payload: { canal: string; resultado: string; resumo: string; ocorreuEm: string; nextTitle: string; nextDate: string }) => void }) {
  const [canal, setCanal] = useState(followup.canal === "reuniao" ? "videoconferencia" : followup.canal); const [resultado, setResultado] = useState(""); const [resumo, setResumo] = useState(""); const [ocorreuEm, setOcorreuEm] = useState(() => localDateTime(new Date().toISOString())); const [scheduleNext, setScheduleNext] = useState(false); const [nextTitle, setNextTitle] = useState(""); const [nextDate, setNextDate] = useState("");
  return <div className="border-b bg-white px-5 py-4" style={{borderColor:"rgba(13,13,13,.07)"}}><div className="mb-3 flex items-center justify-between"><div><p className="text-[0.75rem] font-bold text-black/65">Concluir follow-up</p><p className="text-[0.625rem] text-black/35">{followup.titulo}</p></div><button onClick={onCancel} className="text-black/30 hover:text-black/55"><X size={14}/></button></div><div className="grid gap-3 md:grid-cols-2"><Select value={canal} onChange={e=>setCanal(e.target.value)} className="rounded border bg-white px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.12)"}}>{channels.filter(item=>item.ativo||item.chave===canal).map(c=><option key={c.chave} value={c.chave}>{c.label}</option>)}</Select><Select value={resultado} onChange={e=>setResultado(e.target.value)} className="rounded border bg-white px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.12)"}}><option value="">Resultado *</option>{results.filter(item=>item.ativo||item.chave===resultado).map(item=><option key={item.chave} value={item.chave}>{item.label}</option>)}</Select><input type="datetime-local" value={ocorreuEm} onChange={e=>setOcorreuEm(e.target.value)} className="rounded border bg-white px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.12)"}}/><input value={resumo} onChange={e=>setResumo(e.target.value)} placeholder="Resumo do contato" className="rounded border bg-white px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.12)"}}/></div><label className="mt-3 flex cursor-pointer items-center gap-2 text-[0.6875rem] font-medium text-black/55"><input type="checkbox" checked={scheduleNext} onChange={e=>setScheduleNext(e.target.checked)} className="accent-[#7259B5]"/><CalendarClock size={12}/>Agendar próximo follow-up</label>{scheduleNext && <div className="mt-3 grid gap-3 md:grid-cols-2"><input value={nextTitle} onChange={e=>setNextTitle(e.target.value)} placeholder="Próximo passo" className="rounded border bg-white px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.12)"}}/><input type="datetime-local" value={nextDate} onChange={e=>setNextDate(e.target.value)} className="rounded border bg-white px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.12)"}}/></div>}{error && <p className="mt-2 text-[0.6875rem] text-[#D94E4E]">{error}</p>}<div className="mt-3 flex justify-end gap-3"><button onClick={onCancel} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button disabled={!resultado||saving||(scheduleNext&&(!nextTitle.trim()||!nextDate))} onClick={()=>onSave({canal,resultado,resumo,ocorreuEm,nextTitle:scheduleNext?nextTitle:"",nextDate:scheduleNext?nextDate:""})} className="rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white disabled:opacity-40">{saving?"Salvando…":"Concluir e registrar"}</button></div></div>;
}
