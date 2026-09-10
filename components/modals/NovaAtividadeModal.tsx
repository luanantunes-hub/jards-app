"use client";
import { useState, useEffect, useRef } from "react";
import {
  X, Plus, Mail, Phone, Users, Calendar, MoreHorizontal,
  ChevronDown, Check, CalendarDays, CheckSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { PrioridadeSelect } from "@/components/ui/PrioridadeSelect";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { NovoProspectModal } from "@/components/modals/NovoProspectModal";
import { NovoProjetoModal } from "@/components/modals/NovoProjetoModal";
import { NovoProponenteModal } from "@/components/modals/NovoProponenteModal";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import type { Prioridade, TipoAtividade } from "@/lib/supabase/types";

const VINCULO_CREATE_LABEL: Partial<Record<VinculoTipo, string>> = {
  captacao:   "Criar nova captação",
  inscricao:  "Criar nova inscrição",
  empresa:    "Criar nova empresa",
  projeto:    "Criar novo projeto",
  proponente: "Criar novo proponente",
  contato:    "Criar novo contato",
};

const TIPO_OPTIONS: { key: TipoAtividade; label: string; Icon: React.ElementType; color: string }[] = [
  { key: "reuniao",  label: "Reunião",  Icon: Users,          color: "#7259B5" },
  { key: "email",    label: "E-mail",   Icon: Mail,           color: "#2D72B0" },
  { key: "telefone", label: "Telefone", Icon: Phone,          color: "#1A8B7A" },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinIcon,   color: "#2D72B0" },
  { key: "evento",   label: "Evento",   Icon: Calendar,       color: "#B07A14" },
  { key: "tarefa",   label: "Tarefa",   Icon: CheckSquare,    color: "#7259B5" },
  { key: "outro",    label: "Outro",    Icon: MoreHorizontal, color: "rgba(13,13,13,.40)" },
];

type Opcao = { id: string; label: string; sublabel?: string };
type VinculoTipo = "captacao" | "empresa" | "projeto" | "agencia" | "proponente" | "contato" | "inscricao" | "entrega";
type TipoPersonalizado = { id: string; nome: string; icone: TipoAtividade; cor: string };

function vinculoOpcao(id: string, d: { titulo?: string | null; projeto?: string | null; empresa?: string | null }): Opcao {
  const partes = [d.titulo, d.projeto, d.empresa].filter((x): x is string => !!x);
  const label = partes[0] ?? "Sem título";
  const sublabel = partes.length > 1 ? partes.slice(1).join(" · ") : undefined;
  return { id, label, sublabel };
}

const VINCULO_OPTIONS: { key: VinculoTipo; label: string; color: string }[] = [
  { key: "captacao",   label: "Captação",   color: "#7259B5" },
  { key: "inscricao",  label: "Inscrição",  color: "#2D72B0" },
  { key: "empresa",    label: "Empresa",    color: "#1A8B7A" },
  { key: "projeto",    label: "Projeto",    color: "#B07A14" },
  { key: "agencia",    label: "Agência",    color: "#D94E4E" },
  { key: "proponente", label: "Proponente", color: "#8A5E3B" },
  { key: "contato",    label: "Contato",    color: "#C04F82" },
  { key: "entrega",    label: "Entrega",    color: "#2E8932" },
];

const TYPE_COLORS = ["#7259B5", "#2D72B0", "#1A8B7A", "#B07A14", "#B07A14", "rgba(13,13,13,.40)"];

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function NovaAtividadeModal({
  onClose,
  onSaved,
  prefill,
}: {
  onClose: () => void;
  onSaved: () => void;
  prefill?: {
    captacao_id?: string;
    empresa_crm_id?: string;
    projeto_id?: string;
    contato_id?: string;
    edital_user_id?: string;
    responsavel_id?: string;
    compromisso_id?: string;
    date?: string;
  };
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();

  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  // Form
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoAtividade>("reuniao");
  const [tipoCustomId, setTipoCustomId] = useState<string | null>(null);
  const [vinculoTipo, setVinculoTipo] = useState<VinculoTipo>(() => {
    if (prefill?.compromisso_id) return "entrega";
    if (prefill?.captacao_id)    return "captacao";
    if (prefill?.edital_user_id) return "inscricao";
    if (prefill?.empresa_crm_id) return "empresa";
    if (prefill?.projeto_id)     return "projeto";
    if (prefill?.contato_id)     return "contato";
    return "captacao";
  });
  const [vinculoId, setVinculoId] = useState<string | null>(
    prefill?.compromisso_id ?? prefill?.captacao_id ?? prefill?.edital_user_id ?? prefill?.empresa_crm_id ?? prefill?.projeto_id ?? prefill?.contato_id ?? null,
  );
  const [responsavelId, setResponsavelId] = useState<string | null>(prefill?.responsavel_id ?? null);
  const [dataInicio, setDataInicio] = useState(prefill?.date ?? todayInputValue());
  const [dataPrevista, setDataPrevista] = useState(prefill?.date ?? todayInputValue());
  const [nota, setNota] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [resultado, setResultado] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade | null>(null);
  // Reuniões e eventos nascem sincronizados; os demais tipos são opt-in.
  const [calendarSyncRequested, setCalendarSyncRequested] = useState(true);

  // Dropdowns data
  const [captacoes, setCaptacoes] = useState<Opcao[]>([]);
  const [empresas, setEmpresas] = useState<Opcao[]>([]);
  const [projetos, setProjetos] = useState<Opcao[]>([]);
  const [agencias, setAgencias] = useState<Opcao[]>([]);
  const [proponentes, setProponentes] = useState<Opcao[]>([]);
  const [inscricoes, setInscricoes] = useState<Opcao[]>([]);
  const [contatos, setContatos] = useState<Opcao[]>([]);
  const [entregas, setEntregas] = useState<Opcao[]>([]);
  const [membros, setMembros] = useState<Opcao[]>([]);
  const [tiposPersonalizados, setTiposPersonalizados] = useState<TipoPersonalizado[]>([]);
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState("");
  const [novoTipoIcone, setNovoTipoIcone] = useState<TipoAtividade>("outro");
  const [novaTipoCor, setNovaTipoCor] = useState(TYPE_COLORS[0]);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, supabase]);

  async function loadData() {
      if (!organizationId) return;

      const [
        { data: caps }, { data: insc }, { data: emps }, { data: projs }, { data: capsAgencias },
        { data: props }, { data: cons }, { data: deliveryRows }, { data: customTypes }, { data: orgMembers },
      ] = await Promise.all([
        supabase
          .from("captacoes")
          .select("id, titulo, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_id(nome)")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("editais_user")
          .select("id, titulo, edital:editais!edital_pub_id(titulo), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_pub_id(nome), projeto:projetos_crm!projeto_id(nome)")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("empresas_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
        supabase.from("projetos_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
        (supabase as any).from("captadores").select("id, nome, agencia").eq("organization_id", organizationId).or("ativo.eq.true,ativo.is.null").order("nome").limit(100),
        (supabase as any).from("proponentes").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
        supabase
          .from("contatos")
          .select("id, nome, email")
          .eq("organization_id", organizationId)
          .order("nome")
          .limit(100),
        (supabase as any)
          .from("compromissos_cliente")
          .select("id,titulo,conta:contas_patrocinio!conta_patrocinio_id(nome,empresa_crm:empresas_crm!empresa_crm_id(nome)),projeto:projetos_crm!projeto_id(nome)")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(100),
        (supabase as any).from("atividade_tipos").select("id, nome, icone, cor").eq("organization_id", organizationId).order("nome"),
        (supabase as any).rpc("get_organization_members", { org_id: organizationId }),
      ]);

      if (caps) {
        setCaptacoes(caps.map((c: any) => vinculoOpcao(c.id, {
          titulo: c.titulo,
          projeto: c.projeto?.nome,
          empresa: c.empresa_crm?.nome ?? c.empresa?.nome,
        })));
      }
      if (insc) {
        setInscricoes((insc as any[]).map(i => vinculoOpcao(i.id, {
          titulo: i.edital?.titulo ?? i.titulo,
          projeto: i.projeto?.nome,
          empresa: i.empresa_crm?.nome ?? i.empresa?.nome,
        })));
      }
      if (emps) setEmpresas((emps as any[]).map(e => ({ id: e.id, label: e.nome ?? "Sem nome" })));
      if (projs) setProjetos((projs as any[]).map(p => ({ id: p.id, label: p.nome ?? "Sem nome" })));
      if (capsAgencias) setAgencias((capsAgencias as any[]).map(a => ({ id: a.id, label: a.agencia || a.nome, sublabel: a.agencia ? a.nome : undefined })));
      if (props) setProponentes((props as any[]).map(p => ({ id: p.id, label: p.nome ?? "Sem nome" })));
      if (customTypes) setTiposPersonalizados(customTypes as TipoPersonalizado[]);
      if (deliveryRows) setEntregas((deliveryRows as any[]).map(item => ({
        id: item.id,
        label: item.titulo || "Entrega sem título",
        sublabel: [item.conta?.nome || item.conta?.empresa_crm?.nome, item.projeto?.nome].filter(Boolean).join(" · ") || undefined,
      })));

      if (cons) {
        setContatos(cons.map((c: any) => ({
          id: c.id,
          label: c.nome ?? "Sem nome",
          sublabel: c.email ?? undefined,
        })));
      }

      if (orgMembers) {
        setMembros(
          (orgMembers as any[])
            .filter((m: any) => m.full_name)
            .map((m: any) => ({ id: m.user_id, label: m.full_name }))
        );
      }
  }

  async function handleVinculoCreated(id?: string) {
    await loadData();
    if (id) setVinculoId(id);
    setShowCreateModal(false);
  }

  const vinculoOptions = ({
    captacao: captacoes, inscricao: inscricoes, empresa: empresas, projeto: projetos,
    agencia: agencias, proponente: proponentes, contato: contatos, entrega: entregas,
  } as Record<VinculoTipo, Opcao[]>)[vinculoTipo];

  async function criarTipoPersonalizado() {
    const nomeLimpo = novoTipoNome.trim();
    if (!nomeLimpo || !organizationId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any).from("atividade_tipos")
      .insert({ organization_id: organizationId, nome: nomeLimpo, icone: novoTipoIcone, cor: novaTipoCor, created_by: user?.id ?? null })
      .select("id, nome, icone, cor").single();
    if (error) { setErro((error as Error).message); return; }
    const custom = data as TipoPersonalizado;
    setTiposPersonalizados(prev => [...prev, custom].sort((a, b) => a.nome.localeCompare(b.nome)));
    setTipo("outro");
    setTipoCustomId(custom.id);
    setNovoTipoNome("");
    setCriandoTipo(false);
  }

  async function handleSave() {
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    if (!dataInicio || !dataPrevista) { setErro("Informe as datas de início e prazo"); return; }
    if (dataInicio > dataPrevista) { setErro("O prazo não pode ser anterior à data de início"); return; }
    setSaving(true);
    setErro(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setErro("Sessão expirada. Entre novamente para criar a atividade.");
      return;
    }

    const payload = {
      account_id: user.id,
      nome: nome.trim(),
      tipo,
      tipo_custom_id: tipoCustomId,
      captacao_id:    vinculoTipo === "captacao"  ? vinculoId : prefill?.captacao_id ?? null,
      edital_user_id: vinculoTipo === "inscricao" ? vinculoId : prefill?.edital_user_id ?? null,
      empresa_crm_id: vinculoTipo === "empresa"   ? vinculoId : prefill?.empresa_crm_id ?? null,
      projeto_id:     vinculoTipo === "projeto"   ? vinculoId : prefill?.projeto_id ?? null,
      captador_id:    vinculoTipo === "agencia"   ? vinculoId : null,
      proponente_id:  vinculoTipo === "proponente" ? vinculoId : null,
      contato_id:     vinculoTipo === "contato"   ? vinculoId : prefill?.contato_id ?? null,
      compromisso_id: vinculoTipo === "entrega"   ? vinculoId : prefill?.compromisso_id ?? null,
      responsavel_id: responsavelId,
      prioridade,
      data_inicio: dataInicio,
      data_prevista: dataPrevista || null,
      hora_inicio: horaInicio || null,
      hora_fim: horaFim || null,
      resultado: resultado.trim() || null,
      nota: nota.trim() || null,
      calendar_sync_requested: calendarSyncRequested,
      feita: false,
      organization_id: organizationId,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("atividades").insert(payload);

    setSaving(false);
    if (error) { setErro((error as Error).message); return; }
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center"
      style={{ background: visible ? "rgba(0,0,0,.35)" : "rgba(0,0,0,0)", transition: "background 260ms ease" }}
      onClick={onClose}
    >
      {/* Panel — grudado no topo */}
      <div
        className="bg-white overflow-hidden rounded-b flex flex-col w-full max-w-[720px]"
        style={{
          borderBottom: "1px solid rgba(13,13,13,.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,.10)",
          borderLeft: "1px solid rgba(13,13,13,.06)",
          borderRight: "1px solid rgba(13,13,13,.06)",
          transform: visible ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 260ms cubic-bezier(.32,.72,0,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-black/5 flex items-center justify-center">
              <Plus size={14} className="text-black/50" />
            </div>
            <h2 className="text-[14px] font-bold text-black">Nova atividade</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/6 transition">
            <X size={14} className="text-black/40" />
          </button>
        </div>

        {/* Body — 2 colunas */}
        <div className="px-8 pt-5 pb-4">
          {erro && (
            <div className="text-[12px] font-semibold text-[#D94E4E] bg-[#D94E4E]/8 rounded px-3 py-2 mb-4">
              {erro}
            </div>
          )}

          {/* Nome — full width */}
          <div className="mb-4">
            <label className="text-[11px] font-semibold text-black mb-1 block">Nome da atividade</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Ligação de follow-up, Reunião de alinhamento..."
              className="w-full border rounded px-3 py-2 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
              autoFocus
            />
          </div>

          {/* Grid 2 colunas */}
          <div className="grid grid-cols-2 gap-6">
            {/* Coluna esquerda: Tipo / Vínculo / Responsável */}
            <div className="space-y-4">
              {/* Tipo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-black">Tipo</label>
                  <button type="button" onClick={() => setCriandoTipo(v => !v)}
                    className="text-[10px] font-semibold text-[#7259B5] hover:text-[#604EA3] transition">
                    {criandoTipo ? "Cancelar" : "+ Criar tipo"}
                  </button>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {TIPO_OPTIONS.map(t => {
                    const active = tipo === t.key && !tipoCustomId;
                    return (
                      <button key={t.key}
                        onClick={() => { setTipo(t.key); setTipoCustomId(null); if (t.key === "reuniao" || t.key === "evento") setCalendarSyncRequested(true); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded border transition"
                        style={{ borderColor: active ? t.color : "rgba(13,13,13,.12)", background: "white", color: active ? t.color : "rgba(13,13,13,.45)" }}>
                        <t.Icon size={11} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {tiposPersonalizados.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-2">
                    {tiposPersonalizados.map(t => {
                      const Icon = TIPO_OPTIONS.find(o => o.key === t.icone)?.Icon ?? MoreHorizontal;
                      const active = tipoCustomId === t.id;
                      return (
                        <button key={t.id} onClick={() => { setTipo("outro"); setTipoCustomId(t.id); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded border transition"
                          style={{ borderColor: active ? t.cor : "rgba(13,13,13,.12)", background: "white", color: active ? t.cor : "rgba(13,13,13,.45)" }}>
                          <Icon size={11} /> {t.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
                {criandoTipo && (
                  <div className="mt-2 border rounded p-3 space-y-2" style={{ borderColor: "rgba(114,89,181,.25)", background: "rgba(114,89,181,.025)" }}>
                    <input value={novoTipoNome} onChange={e => setNovoTipoNome(e.target.value)} placeholder="Ex: Visita técnica"
                      className="w-full border rounded px-2.5 py-1.5 text-[12px] outline-none focus:border-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.15)" }} />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {TIPO_OPTIONS.map(option => {
                        const Icon = option.Icon;
                        return <button key={option.key} type="button" onClick={() => setNovoTipoIcone(option.key)}
                          className="w-6 h-6 flex items-center justify-center rounded border transition"
                          style={{ borderColor: novoTipoIcone === option.key ? "#7259B5" : "rgba(13,13,13,.12)", color: novoTipoIcone === option.key ? "#7259B5" : "rgba(13,13,13,.4)" }}><Icon size={11} /></button>;
                      })}
                      <span className="w-px h-4 bg-black/10 mx-0.5" />
                      {TYPE_COLORS.map(color => <button key={color} type="button" onClick={() => setNovaTipoCor(color)}
                        className="w-4 h-4 rounded-full border-2" style={{ background: color, borderColor: novaTipoCor === color ? "#0D0D0D" : "transparent" }} />)}
                    </div>
                    <button type="button" disabled={!novoTipoNome.trim()} onClick={criarTipoPersonalizado}
                      className="px-2.5 py-1 text-[11px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] disabled:opacity-40">Salvar tipo</button>
                  </div>
                )}
              </div>

              {/* Vínculo */}
              <div>
                <label className="text-[11px] font-semibold text-black mb-1.5 block">
                  Vinculada a
                </label>
                <div className="flex items-center gap-1 flex-wrap mb-1.5">
                  {VINCULO_OPTIONS.map(option => {
                    const active = vinculoTipo === option.key;
                    return (
                    <button key={option.key} type="button" onClick={() => { setVinculoTipo(option.key); setVinculoId(null); }}
                      className="px-2 py-0.5 text-[10px] font-semibold rounded border transition"
                      style={{ borderColor: active ? option.color : "rgba(13,13,13,.1)", background: "white", color: active ? option.color : "rgba(13,13,13,.45)" }}>
                      {option.label}
                    </button>
                    );
                  })}
                </div>
                <Dropdown
                  value={vinculoId}
                  options={vinculoOptions}
                  placeholder={`Selecionar ${VINCULO_OPTIONS.find(o => o.key === vinculoTipo)?.label.toLowerCase()}...`}
                  onChange={setVinculoId}
                  open={openDropdown === "vinculo"}
                  onToggle={() => setOpenDropdown(openDropdown === "vinculo" ? null : "vinculo")}
                  onClose={() => setOpenDropdown(null)}
                  createLabel={VINCULO_CREATE_LABEL[vinculoTipo]}
                  onCreateClick={VINCULO_CREATE_LABEL[vinculoTipo] ? () => { setOpenDropdown(null); setShowCreateModal(true); } : undefined}
                />
              </div>

              {/* Responsável */}
              <div>
                <label className="text-[11px] font-semibold text-black mb-1.5 block">Responsável</label>
                <Dropdown
                  value={responsavelId}
                  options={membros}
                  placeholder="Quem vai executar..."
                  onChange={setResponsavelId}
                  open={openDropdown === "responsavel"}
                  onToggle={() => setOpenDropdown(openDropdown === "responsavel" ? null : "responsavel")}
                  onClose={() => setOpenDropdown(null)}
                />
              </div>

              {/* Prioridade */}
              <div>
                <label className="text-[11px] font-semibold text-black mb-1.5 block">Prioridade</label>
                <PrioridadeSelect value={prioridade} onChange={setPrioridade} />
              </div>
            </div>

            {/* Coluna direita: Datas / Horários / Sync / Resultado / Nota */}
            <div className="space-y-4">
              {/* Cronograma */}
              <div>
                <label className="text-[11px] font-semibold text-black mb-1.5 block">Cronograma</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-black/40 mb-1 block">Início</label>
                    <input type="date" value={dataInicio} max={dataPrevista || undefined}
                      onChange={e => { const next = e.target.value; setDataInicio(next); if (dataPrevista && next > dataPrevista) setDataPrevista(next); }}
                      className="w-full border rounded px-2.5 py-2 text-[12px] text-black outline-none focus:border-[#7259B5] transition"
                      style={{ borderColor: "rgba(13,13,13,.15)" }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-black/40 mb-1 block">Prazo</label>
                    <input type="date" value={dataPrevista} min={dataInicio || undefined}
                      onChange={e => setDataPrevista(e.target.value)}
                      className="w-full border rounded px-2.5 py-2 text-[12px] text-black outline-none focus:border-[#7259B5] transition"
                      style={{ borderColor: "rgba(13,13,13,.15)" }} />
                  </div>
                </div>
              </div>

              {/* Horário */}
              <div>
                <label className="text-[11px] font-semibold text-black mb-1.5 block">
                  Horário
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-black/40 mb-1 block">Início</label>
                    <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                      className="w-full border rounded px-2.5 py-2 text-[12px] text-black outline-none focus:border-[#7259B5] transition"
                      style={{ borderColor: "rgba(13,13,13,.15)" }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-black/40 mb-1 block">Fim</label>
                    <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)}
                      className="w-full border rounded px-2.5 py-2 text-[12px] text-black outline-none focus:border-[#7259B5] transition"
                      style={{ borderColor: "rgba(13,13,13,.15)" }} />
                  </div>
                </div>
              </div>

              {/* Calendar sync */}
              <label className="flex items-center gap-2.5 border rounded px-3 py-2 cursor-pointer hover:border-[#7259B5]/35 transition"
                style={{ borderColor: calendarSyncRequested ? "rgba(114,89,181,.5)" : "rgba(13,13,13,.12)", background: "white" }}>
                <input type="checkbox" checked={calendarSyncRequested} onChange={e => setCalendarSyncRequested(e.target.checked)} className="accent-[#7259B5]" />
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-black">
                  <CalendarDays size={12} className="text-[#7259B5]" /> Sincronizar com calendário
                </span>
              </label>

              {/* Resultado */}
              <div>
                <label className="text-[11px] font-semibold text-black mb-1 block">
                  Resultado
                </label>
                <textarea value={resultado} onChange={e => setResultado(e.target.value)}
                  placeholder="O que aconteceu? Qual foi o desfecho?"
                  rows={2}
                  className="w-full border rounded px-2.5 py-2 text-[12px] text-black outline-none focus:border-[#7259B5] transition resize-none"
                  style={{ borderColor: "rgba(13,13,13,.15)" }} />
              </div>

              {/* Nota */}
              <div>
                <label className="text-[11px] font-semibold text-black mb-1 block">
                  Nota
                </label>
                <textarea value={nota} onChange={e => setNota(e.target.value)}
                  placeholder="Detalhes relevantes..."
                  rows={2}
                  className="w-full border rounded px-2.5 py-2 text-[12px] text-black outline-none focus:border-[#7259B5] transition resize-none"
                  style={{ borderColor: "rgba(13,13,13,.15)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-3.5 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button onClick={onClose} className="text-xs font-semibold text-black/35 hover:text-black/55 transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !nome.trim()}
            className="rounded border border-[#2E8932] bg-[#2E8932] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#26772B] disabled:opacity-40">
            {saving ? "Salvando..." : "Criar atividade"}
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div className="flex-1" style={{ background: "rgba(0,0,0,.18)" }} />

      {showCreateModal && vinculoTipo === "captacao" && (
        <NovaCaptacaoModal onClose={() => setShowCreateModal(false)} onSaved={handleVinculoCreated} />
      )}
      {showCreateModal && vinculoTipo === "inscricao" && (
        <NovaInscricaoModal onClose={() => setShowCreateModal(false)} onSaved={handleVinculoCreated} />
      )}
      {showCreateModal && vinculoTipo === "empresa" && (
        <NovoProspectModal onClose={() => setShowCreateModal(false)} onSaved={handleVinculoCreated} />
      )}
      {showCreateModal && vinculoTipo === "projeto" && (
        <NovoProjetoModal onClose={() => setShowCreateModal(false)} onSaved={handleVinculoCreated} />
      )}
      {showCreateModal && vinculoTipo === "proponente" && (
        <NovoProponenteModal onClose={() => setShowCreateModal(false)} onSaved={handleVinculoCreated} />
      )}
      {showCreateModal && vinculoTipo === "contato" && (
        <NovoContatoModal onClose={() => setShowCreateModal(false)} onSaved={handleVinculoCreated} />
      )}
    </div>
  );
}

// ─── Dropdown reutilizável ───────────────────────────────────────────────────
function Dropdown({
  value,
  options,
  placeholder,
  onChange,
  open,
  onToggle,
  onClose,
  createLabel,
  onCreateClick,
}: {
  value: string | null;
  options: Opcao[];
  placeholder: string;
  onChange: (id: string | null) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  createLabel?: string;
  onCreateClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  const selected = options.find(o => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between border rounded px-3 py-2.5 text-[13px] text-left transition hover:border-[#7259B5]/40"
        style={{
          borderColor: open ? "#7259B5" : "rgba(13,13,13,.15)",
          color: selected ? "#0D0D0D" : "rgba(13,13,13,.35)",
        }}
      >
        <span className="truncate">
          {selected ? (
            <span>
              {selected.label}
              {selected.sublabel && <span className="text-black/30"> · {selected.sublabel}</span>}
            </span>
          ) : placeholder}
        </span>
        <ChevronDown size={14} className={`text-black/30 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto" style={{ borderColor: "rgba(13,13,13,.1)" }}>
          {value && (
            <button
              onClick={() => { onChange(null); onClose(); }}
              className="w-full text-left px-3 py-2 text-[12px] text-[#D94E4E] hover:bg-[#D94E4E]/5 transition border-b"
              style={{ borderColor: "rgba(13,13,13,.06)" }}
            >
              Limpar seleção
            </button>
          )}
          {options.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-black/30 text-center">Nenhum item encontrado</p>
          ) : (
            options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); onClose(); }}
                className="w-full text-left px-3 py-2 hover:bg-black/[0.03] transition flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-black truncate">{opt.label}</p>
                  {opt.sublabel && (
                    <p className="text-[10px] text-black/30 truncate">{opt.sublabel}</p>
                  )}
                </div>
                {opt.id === value && <Check size={12} className="text-[#7259B5] flex-shrink-0" />}
              </button>
            ))
          )}
          {onCreateClick && createLabel && (
            <button
              onMouseDown={e => { e.preventDefault(); onCreateClick(); }}
              className="w-full flex items-center gap-1.5 text-left px-3 py-2 text-[12px] font-semibold text-[#7259B5] hover:bg-[#7259B5]/5 transition border-t"
              style={{ borderColor: "rgba(13,13,13,.06)" }}
            >
              <Plus size={12} /> {createLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LinkedinIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
