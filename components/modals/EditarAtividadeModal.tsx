"use client";
import { useState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import {
  X, Mail, Phone, Users, Calendar, MoreHorizontal, CheckSquare,
  ChevronDown, Check, CalendarDays, Trash2, Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { PrioridadeSelect } from "@/components/ui/PrioridadeSelect";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { NovoProspectModal } from "@/components/modals/NovoProspectModal";
import { NovoProjetoModal } from "@/components/modals/NovoProjetoModal";
import { NovoProponenteModal } from "@/components/modals/NovoProponenteModal";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import type { Prioridade, TipoAtividade } from "@/lib/supabase/types";
import { escalaUi } from "@/lib/escala-ui";

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
type VinculoTipo = "captacao" | "empresa" | "projeto" | "agencia" | "proponente" | "contato" | "inscricao";
type TipoPersonalizado = { id: string; nome: string; icone: TipoAtividade; cor: string };
/** A linha de qualquer um dos vínculos, como o banco devolve ao buscar um registro só. */
type LinhaVinculo = {
  id: string;
  titulo?: string | null;
  nome?: string | null;
  email?: string | null;
  projeto?: { nome?: string | null } | null;
  empresa_crm?: { nome?: string | null } | null;
  empresa?: { nome?: string | null } | null;
};

function vinculoOpcao(id: string, d: { titulo?: string | null; projeto?: string | null; empresa?: string | null }): Opcao {
  const partes = [d.titulo, d.projeto, d.empresa].filter((x): x is string => !!x);
  const label = partes[0] ?? "Sem título";
  const sublabel = partes.length > 1 ? partes.slice(1).join(" · ") : undefined;
  return { id, label, sublabel };
}

const VINCULO_OPTIONS: { key: VinculoTipo; label: string; color: string }[] = [
  { key: "captacao",   label: "Negociação", color: "#7259B5" },
  { key: "inscricao",  label: "Inscrição",  color: "#2D72B0" },
  { key: "empresa",    label: "Empresa",    color: "#1A8B7A" },
  { key: "projeto",    label: "Projeto",    color: "#B07A14" },
  { key: "agencia",    label: "Agência",    color: "#D94E4E" },
  { key: "proponente", label: "Proponente", color: "#8A5E3B" },
  { key: "contato",    label: "Contato",    color: "#C04F82" },
];

// Mesmos textos e mesmas folhas de "Nova atividade" (NovaAtividadeModal): agência não se cria por aqui.
const VINCULO_CREATE_LABEL: Partial<Record<VinculoTipo, string>> = {
  captacao:   "Criar nova negociação",
  inscricao:  "Criar nova inscrição",
  empresa:    "Criar nova empresa",
  projeto:    "Criar novo projeto",
  proponente: "Criar novo proponente",
  contato:    "Criar novo contato",
};

const SELECT_CAPTACAO = "id, titulo, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_id(nome)";
const SELECT_INSCRICAO = "id, empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_pub_id(nome), projeto:projetos_crm!projeto_id(nome)";

export function EditarAtividadeModal({
  atividadeId,
  onClose,
  onSaved,
  onDeleted,
}: {
  atividadeId: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const organizationId = useOrganizationId();

  const [loadingAtividade, setLoadingAtividade] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Form
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoAtividade>("reuniao");
  const [tipoCustomId, setTipoCustomId] = useState<string | null>(null);
  const [vinculoTipo, setVinculoTipo] = useState<VinculoTipo>("captacao");
  const [vinculoId, setVinculoId] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [resultado, setResultado] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade | null>(null);
  const [nota, setNota] = useState("");
  const [calendarSyncRequested, setCalendarSyncRequested] = useState(false);
  const [prestacaoId, setPrestacaoId] = useState<string | null>(null);

  // Dropdown data
  const [captacoes,          setCaptacoes]          = useState<Opcao[]>([]);
  const [inscricoes,         setInscricoes]         = useState<Opcao[]>([]);
  const [empresas,           setEmpresas]           = useState<Opcao[]>([]);
  const [projetos,           setProjetos]           = useState<Opcao[]>([]);
  const [agencias,           setAgencias]           = useState<Opcao[]>([]);
  const [proponentes,        setProponentes]        = useState<Opcao[]>([]);
  const [contatos,           setContatos]           = useState<Opcao[]>([]);
  const [membros,            setMembros]            = useState<Opcao[]>([]);
  const [tiposPersonalizados, setTiposPersonalizados] = useState<TipoPersonalizado[]>([]);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [criandoVinculo, setCriandoVinculo] = useState(false);
  const titleId = useId();
  useModalDismiss(onClose);

  // Listas dos menus (vínculos, responsável, tipos). Roda de novo depois de criar um registro aqui dentro,
  // sem mexer no que a pessoa já editou no formulário.
  async function carregarOpcoes() {
    if (!organizationId) return;
    const [
      { data: caps }, { data: insc }, { data: emps }, { data: projs },
      { data: capsAgencias }, { data: props }, { data: cons },
      { data: customTypes }, { data: orgMembers },
    ] = await Promise.all([
      supabase
        .from("captacoes")
        .select(SELECT_CAPTACAO)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any)
        .from("editais_user")
        .select(SELECT_INSCRICAO)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("empresas_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
      supabase.from("projetos_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
      (supabase as any).from("captadores").select("id, nome, agencia").eq("organization_id", organizationId).or("ativo.eq.true,ativo.is.null").order("nome").limit(100),
      (supabase as any).from("proponentes").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
      supabase.from("contatos").select("id, nome, email").eq("organization_id", organizationId).order("nome").limit(100),
      (supabase as any).from("atividade_tipos").select("id, nome, icone, cor").eq("organization_id", organizationId).order("nome"),
      (supabase as any).rpc("get_organization_members", { org_id: organizationId }),
    ]);

    if (caps) setCaptacoes(caps.map((c: any) => vinculoOpcao(c.id, { titulo: c.titulo, projeto: c.projeto?.nome, empresa: c.empresa_crm?.nome ?? c.empresa?.nome })));
    if (insc) setInscricoes((insc as any[]).map(i => vinculoOpcao(i.id, { projeto: i.projeto?.nome, empresa: i.empresa_crm?.nome ?? i.empresa?.nome })));
    if (emps) setEmpresas((emps as any[]).map(e => ({ id: e.id, label: e.nome ?? "Sem nome" })));
    if (projs) setProjetos((projs as any[]).map(p => ({ id: p.id, label: p.nome ?? "Sem nome" })));
    if (capsAgencias) setAgencias((capsAgencias as any[]).map(a => ({ id: a.id, label: a.agencia || a.nome, sublabel: a.agencia ? a.nome : undefined })));
    if (props) setProponentes((props as any[]).map(p => ({ id: p.id, label: p.nome ?? "Sem nome" })));
    if (cons) setContatos(cons.map((c: any) => ({ id: c.id, label: c.nome ?? "Sem nome", sublabel: c.email ?? undefined })));
    if (customTypes) setTiposPersonalizados(customTypes as TipoPersonalizado[]);

    if (orgMembers) {
      setMembros(
        (orgMembers as any[])
          .filter((m: any) => m.full_name)
          .map((m: any) => ({ id: m.user_id, label: m.full_name }))
      );
    }
  }

  async function carregarAtividade() {
    const [{ data: atv }, { data: origem }] = await Promise.all([
      (supabase as any).from("atividades").select(`
        id, nome, tipo, tipo_custom_id, data_inicio, data_prevista,
        hora_inicio, hora_fim, resultado, nota, calendar_sync_requested,
        prioridade, responsavel_id, captacao_id, empresa_crm_id, projeto_id,
        captador_id, proponente_id, contato_id, edital_user_id
      `).eq("id", atividadeId).single(),
      // Consulta à parte: sem a coluna (banco sem a P1.8), só não mostra o atalho.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_id ainda não está no tipo Database
      (supabase as any).from("atividades").select("prestacao_id").eq("id", atividadeId).maybeSingle(),
    ]);
    setPrestacaoId(origem?.prestacao_id ?? null);

    // Prefill form
    if (atv) {
      setNome(atv.nome ?? "");
      setTipo(atv.tipo ?? "reuniao");
      setTipoCustomId(atv.tipo_custom_id ?? null);
      setDataInicio(atv.data_inicio?.split("T")[0] ?? "");
      setDataPrevista(atv.data_prevista?.split("T")[0] ?? "");
      setHoraInicio(atv.hora_inicio ?? "");
      setHoraFim(atv.hora_fim ?? "");
      setResultado(atv.resultado ?? "");
      setPrioridade(atv.prioridade ?? null);
      setNota(atv.nota ?? "");
      setCalendarSyncRequested(atv.calendar_sync_requested ?? false);
      setResponsavelId(atv.responsavel_id ?? null);

      if      (atv.captacao_id)    { setVinculoTipo("captacao");   setVinculoId(atv.captacao_id); }
      else if (atv.edital_user_id) { setVinculoTipo("inscricao");  setVinculoId(atv.edital_user_id); }
      else if (atv.empresa_crm_id) { setVinculoTipo("empresa");    setVinculoId(atv.empresa_crm_id); }
      else if (atv.projeto_id)     { setVinculoTipo("projeto");    setVinculoId(atv.projeto_id); }
      else if (atv.captador_id)    { setVinculoTipo("agencia");    setVinculoId(atv.captador_id); }
      else if (atv.proponente_id)  { setVinculoTipo("proponente"); setVinculoId(atv.proponente_id); }
      else if (atv.contato_id)     { setVinculoTipo("contato");    setVinculoId(atv.contato_id); }
    }
  }

  // Load the activity + dropdown data
  useEffect(() => {
    async function load() {
      if (!organizationId) return;
      setLoadingAtividade(true);
      await Promise.all([carregarAtividade(), carregarOpcoes()]);
      setLoadingAtividade(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividadeId, organizationId]);

  // O registro recém-criado pode cair fora das primeiras 50/100 linhas das listas: busca à parte e põe no topo.
  async function garantirOpcao(tipoCriado: VinculoTipo, id: string) {
    const consulta: Partial<Record<VinculoTipo, {
      tabela: string;
      colunas: string;
      definir: React.Dispatch<React.SetStateAction<Opcao[]>>;
      converter: (linha: LinhaVinculo) => Opcao;
    }>> = {
      captacao:   { tabela: "captacoes",    colunas: SELECT_CAPTACAO,   definir: setCaptacoes,  converter: c => vinculoOpcao(c.id, { titulo: c.titulo, projeto: c.projeto?.nome, empresa: c.empresa_crm?.nome ?? c.empresa?.nome }) },
      inscricao:  { tabela: "editais_user", colunas: SELECT_INSCRICAO,  definir: setInscricoes, converter: i => vinculoOpcao(i.id, { projeto: i.projeto?.nome, empresa: i.empresa_crm?.nome ?? i.empresa?.nome }) },
      empresa:    { tabela: "empresas_crm", colunas: "id, nome",         definir: setEmpresas,   converter: e => ({ id: e.id, label: e.nome ?? "Sem nome" }) },
      projeto:    { tabela: "projetos_crm", colunas: "id, nome",         definir: setProjetos,   converter: p => ({ id: p.id, label: p.nome ?? "Sem nome" }) },
      proponente: { tabela: "proponentes",  colunas: "id, nome",         definir: setProponentes, converter: p => ({ id: p.id, label: p.nome ?? "Sem nome" }) },
      contato:    { tabela: "contatos",     colunas: "id, nome, email",  definir: setContatos,   converter: c => ({ id: c.id, label: c.nome ?? "Sem nome", sublabel: c.email ?? undefined }) },
    };
    const alvo = consulta[tipoCriado];
    if (!alvo) return;
    // A tabela depende do tipo do vínculo, então o cliente tipado do banco não serve aqui.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from(alvo.tabela).select(alvo.colunas).eq("id", id).maybeSingle();
    if (!data) return;
    const opcao = alvo.converter(data as LinhaVinculo);
    alvo.definir(atuais => (atuais.some(o => o.id === id) ? atuais : [opcao, ...atuais]));
  }

  // Criou o registro pelo menu do vínculo: atualiza as listas e já deixa a atividade ligada a ele.
  async function aoCriarVinculo(id?: string) {
    const tipoCriado = vinculoTipo;
    await carregarOpcoes();
    if (id) {
      await garantirOpcao(tipoCriado, id);
      setVinculoId(id);
    }
    setCriandoVinculo(false);
  }

  // NovoProponenteModal não fecha sozinho ao salvar (modo criação): continua montado para mostrar a tela de sucesso
  // com atalhos e só fecha quando a pessoa termina ali. Aqui só atualiza a lista e escolhe o proponente criado.
  async function aoCriarProponente(id: string) {
    await carregarOpcoes();
    await garantirOpcao("proponente", id);
    setVinculoId(id);
  }

  const vinculoOptions = ({
    captacao: captacoes, inscricao: inscricoes, empresa: empresas, projeto: projetos,
    agencia: agencias, proponente: proponentes, contato: contatos,
  } as Record<VinculoTipo, Opcao[]>)[vinculoTipo];

  async function handleSave() {
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    setSaving(true);
    setErro(null);

    const payload: Record<string, unknown> = {
      nome:            nome.trim(),
      tipo,
      tipo_custom_id:  tipoCustomId,
      captacao_id:     vinculoTipo === "captacao"   ? vinculoId : null,
      edital_user_id:  vinculoTipo === "inscricao"  ? vinculoId : null,
      empresa_crm_id:  vinculoTipo === "empresa"    ? vinculoId : null,
      projeto_id:      vinculoTipo === "projeto"    ? vinculoId : null,
      captador_id:     vinculoTipo === "agencia"    ? vinculoId : null,
      proponente_id:   vinculoTipo === "proponente" ? vinculoId : null,
      contato_id:      vinculoTipo === "contato"    ? vinculoId : null,
      responsavel_id:  responsavelId,
      prioridade,
      data_inicio:     dataInicio || null,
      data_prevista:   dataPrevista || null,
      hora_inicio:     horaInicio || null,
      hora_fim:        horaFim || null,
      resultado:       resultado.trim() || null,
      nota:            nota.trim() || null,
      calendar_sync_requested: calendarSyncRequested,
    };

    const { error } = await (supabase as any).from("atividades").update(payload).eq("id", atividadeId);
    setSaving(false);
    if (error) { setErro((error as Error).message); return; }
    onSaved();
    onClose();
  }

  function handleDelete() {
    confirmDelete({
      title: "Excluir esta atividade?",
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setDeleting(true);
        setErro(null);
        try {
          await excluirPorId(supabase, "atividades", atividadeId);
        } finally {
          setDeleting(false);
        }
        onDeleted?.();
        onClose();
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="flex-1 veu" />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="folha-vidro-direita h-full w-[40rem] max-w-[92vw] overflow-hidden flex flex-col"
        style={{ borderLeft: "1px solid rgba(13,13,13,.08)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id={titleId} className="text-[#282525] font-display text-[1.25rem] font-extrabold leading-[1.1] tracking-[-.04em] sm:text-[1.5rem]">Editar atividade</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/6 transition">
            <X size={14} className="text-black/40" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loadingAtividade ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[100, 60, 100, 80, 100, 100, 80, 100].map((w, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-20 bg-black/8 rounded animate-pulse" />
                  <div className="h-9 bg-black/5 rounded animate-pulse" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {erro && (
                <div role="alert" className="text-[0.75rem] font-semibold text-[#D94E4E] border border-[#D94E4E]/30 bg-white rounded px-3 py-2 mb-4">
                  {erro}
                </div>
              )}

              {/* Nome — full width */}
              <div className="mb-5">
                <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">Nome da atividade</label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Ligação de follow-up, Reunião de alinhamento..."
                  className="w-full border rounded px-3 py-2 text-[0.8125rem] text-[#282525] outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                  autoFocus
                />
              </div>

              {/* 2-column grid */}
              <div className="grid grid-cols-2 gap-x-6" style={{ gridTemplateRows: "auto" }}>

                {/* ── Coluna esquerda ── */}
                <div className="space-y-4">
                  {/* Tipo */}
                  <div>
                    <label className="text-[0.75rem] font-semibold text-[#282525] mb-2 block">Tipo</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* "Tarefa" não existe como tipo no banco (atividades_tipo_check): fica só como ícone de tipo personalizado. */}
                      {TIPO_OPTIONS.filter(t => t.key !== "tarefa").map(t => {
                        const active = tipo === t.key && !tipoCustomId;
                        return (
                          <button key={t.key} onClick={() => { setTipo(t.key); setTipoCustomId(null); }}
                            className="flex items-center gap-1 px-2.5 py-1 text-[0.6875rem] font-semibold rounded border transition"
                            style={{
                              borderColor: active ? t.color : "rgba(13,13,13,.12)",
                              background: "white",
                              color: active ? t.color : "rgba(13,13,13,.45)",
                            }}>
                            <t.Icon size={11} />{t.label}
                          </button>
                        );
                      })}
                    </div>
                    {tiposPersonalizados.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {tiposPersonalizados.map(t => {
                          const Icon = TIPO_OPTIONS.find(o => o.key === t.icone)?.Icon ?? MoreHorizontal;
                          const active = tipoCustomId === t.id;
                          return (
                            <button key={t.id} onClick={() => { setTipo("outro"); setTipoCustomId(t.id); }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[0.6875rem] font-semibold rounded border transition"
                              style={{ borderColor: active ? t.cor : "rgba(13,13,13,.12)", background: "white", color: active ? t.cor : "rgba(13,13,13,.45)" }}>
                              <Icon size={11} />{t.nome}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Vínculo */}
                  <div>
                    <label className="text-[0.75rem] font-semibold text-[#282525] mb-2 block">
                      Vínculo
                    </label>
                    {prestacaoId && (
                      <Link
                        href={`/prestacoes/${prestacaoId}`}
                        className="mb-2 inline-flex rounded text-[0.6875rem] font-medium text-[#684DB0] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                      >
                        Criada pelo prazo da prestação de contas · abrir a prestação
                      </Link>
                    )}
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {VINCULO_OPTIONS.map(option => {
                        const active = vinculoTipo === option.key;
                        return (
                        <button key={option.key} type="button" onClick={() => { setVinculoTipo(option.key); setVinculoId(null); }}
                          className="px-2 py-0.5 text-[0.625rem] font-semibold rounded border transition"
                          style={{ borderColor: active ? option.color : "rgba(13,13,13,.1)", background: "white", color: active ? option.color : "rgba(13,13,13,.45)" }}>
                          {option.label}
                        </button>
                        );
                      })}
                    </div>
                    <Dropdown
                      value={vinculoId}
                      options={vinculoOptions}
                      placeholder={`Selecionar ${VINCULO_OPTIONS.find(o => o.key === vinculoTipo)?.label.toLowerCase()}…`}
                      onChange={setVinculoId}
                      open={openDropdown === "vinculo"}
                      onToggle={() => setOpenDropdown(openDropdown === "vinculo" ? null : "vinculo")}
                      onClose={() => setOpenDropdown(null)}
                      acaoCriar={VINCULO_CREATE_LABEL[vinculoTipo] ? { label: VINCULO_CREATE_LABEL[vinculoTipo] as string, onClick: () => setCriandoVinculo(true) } : undefined}
                    />
                  </div>

                  {/* Responsável */}
                  <div>
                    <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">Responsável</label>
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
                    <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">Prioridade</label>
                    <PrioridadeSelect value={prioridade} onChange={setPrioridade} />
                  </div>
                </div>

                {/* ── Coluna direita ── */}
                <div className="space-y-4">
                  {/* Datas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">Início</label>
                      <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                        className="w-full border rounded px-2.5 py-2 text-[0.75rem] text-[#282525] outline-none focus:border-[#7259B5] transition"
                        style={{ borderColor: "rgba(13,13,13,.15)" }} />
                    </div>
                    <div>
                      <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">Prazo</label>
                      <input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)}
                        className="w-full border rounded px-2.5 py-2 text-[0.75rem] text-[#282525] outline-none focus:border-[#7259B5] transition"
                        style={{ borderColor: "rgba(13,13,13,.15)" }} />
                    </div>
                  </div>

                  {/* Horários */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">
                        Hora início <span className="text-black/30 font-normal">(opt.)</span>
                      </label>
                      <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                        className="w-full border rounded px-2.5 py-2 text-[0.75rem] text-[#282525] outline-none focus:border-[#7259B5] transition"
                        style={{ borderColor: "rgba(13,13,13,.15)" }} />
                    </div>
                    <div>
                      <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">
                        Hora fim <span className="text-black/30 font-normal">(opt.)</span>
                      </label>
                      <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)}
                        className="w-full border rounded px-2.5 py-2 text-[0.75rem] text-[#282525] outline-none focus:border-[#7259B5] transition"
                        style={{ borderColor: "rgba(13,13,13,.15)" }} />
                    </div>
                  </div>

                  {/* Sincronização */}
                  <label className="flex items-center gap-2.5 border rounded px-3 py-2.5 cursor-pointer hover:border-[#7259B5]/35 transition"
                    style={{ borderColor: calendarSyncRequested ? "rgba(114,89,181,.5)" : "rgba(13,13,13,.12)" }}>
                    <input type="checkbox" checked={calendarSyncRequested}
                      onChange={e => setCalendarSyncRequested(e.target.checked)}
                      className="accent-[#7259B5] flex-shrink-0" />
                    <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[#282525]">
                      <CalendarDays size={12} className="text-[#7259B5]" /> Sincronizar com calendário
                    </span>
                  </label>

                  {/* Resultado */}
                  <div>
                    <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">
                      Resultado
                    </label>
                    <textarea value={resultado} onChange={e => setResultado(e.target.value)}
                      placeholder="O que aconteceu? Qual foi o desfecho?"
                      rows={2}
                      className="w-full border rounded px-3 py-2 text-[0.75rem] text-[#282525] outline-none focus:border-[#7259B5] transition resize-none"
                      style={{ borderColor: "rgba(13,13,13,.15)" }} />
                  </div>

                  {/* Nota */}
                  <div>
                    <label className="text-[0.75rem] font-semibold text-[#282525] mb-1.5 block">
                      Nota
                    </label>
                    <textarea value={nota} onChange={e => setNota(e.target.value)}
                      placeholder="Detalhes relevantes..."
                      rows={2}
                      className="w-full border rounded px-3 py-2 text-[0.75rem] text-[#282525] outline-none focus:border-[#7259B5] transition resize-none"
                      style={{ borderColor: "rgba(13,13,13,.15)" }} />
                  </div>
                </div>

              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-6 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button
            onClick={handleDelete}
            disabled={deleting || loadingAtividade}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#D94E4E]/70 hover:text-[#D94E4E] hover:bg-black/[.04] rounded transition disabled:opacity-40"
          >
            <Trash2 size={12} />
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-black/40 rounded hover:bg-black/5 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loadingAtividade || !nome.trim()}
              className="rounded border border-[#2E8932] acao-salvar px-4 py-2 text-xs font-medium text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>

      {/* Folhas de criação do menu do vínculo: um clique nelas não pode chegar ao fundo, que fecharia a edição. */}
      {criandoVinculo && (
        <div onClick={e => e.stopPropagation()}>
          {vinculoTipo === "captacao" && <NovaCaptacaoModal onClose={() => setCriandoVinculo(false)} onSaved={aoCriarVinculo} />}
          {vinculoTipo === "inscricao" && <NovaInscricaoModal onClose={() => setCriandoVinculo(false)} onSaved={aoCriarVinculo} />}
          {vinculoTipo === "empresa" && <NovoProspectModal onClose={() => setCriandoVinculo(false)} onSaved={aoCriarVinculo} />}
          {vinculoTipo === "projeto" && <NovoProjetoModal onClose={() => setCriandoVinculo(false)} onSaved={aoCriarVinculo} />}
          {vinculoTipo === "proponente" && <NovoProponenteModal onClose={() => setCriandoVinculo(false)} onSaved={aoCriarProponente} />}
          {vinculoTipo === "contato" && <NovoContatoModal onClose={() => setCriandoVinculo(false)} onSaved={aoCriarVinculo} />}
        </div>
      )}
    </div>
  );
}

// ─── Dropdown reutilizável ───────────────────────────────────────────────────
function Dropdown({
  value, options, placeholder, onChange, open, onToggle, onClose, acaoCriar,
}: {
  value: string | null;
  options: Opcao[];
  placeholder: string;
  onChange: (id: string | null) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Atalho fixo no pé do menu (fora da rolagem) para criar um registro novo já ligado a esta atividade. */
  acaoCriar?: { label: string; onClick: () => void };
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Onde o campo estava quando o menu abriu: o menu é fixo na tela, então só faz sentido fechá-lo se o campo sair do lugar.
  const ancora = useRef<{ top: number; left: number } | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    // Fecha quando algo de fora rola e leva o campo junto (o menu ficaria solto). Rolagem que não move o campo — o fim da
    // lista "vazando" para fora, o rebote do Safari, outra lista qualquer — não pode fechar o menu enquanto se rola a lista.
    function handleScroll(e: Event) {
      if (ref.current?.contains(e.target as Node)) return;
      const agora = ref.current?.getBoundingClientRect();
      const antes = ancora.current;
      if (agora && antes && Math.abs(agora.top - antes.top) < 1 && Math.abs(agora.left - antes.left) < 1) return;
      onClose();
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, onClose]);

  function handleToggle() {
    const rect = ref.current?.getBoundingClientRect();
    if (!open && rect) {
      ancora.current = { top: rect.top, left: rect.left };
      const spaceBelow = window.innerHeight - rect.bottom - 4;
      // 192 = lista (max-h-48) e 36 = atalho de criar no pé do menu, quando existe.
      setMenuStyle(spaceBelow >= Math.min((192 + (acaoCriar ? 36 : 0)) * escalaUi(), rect.top - 4)
        ? { top: rect.bottom + 4, left: rect.left, width: rect.width }
        : { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
    }
    onToggle();
  }

  const selected = options.find(o => o.id === value);

  return (
    <div ref={ref} className="relative" onKeyDown={e => { if (open && e.key === "Escape") { e.preventDefault(); onClose(); } }}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between border rounded px-3 py-2.5 text-[0.8125rem] text-left transition hover:border-[#7259B5]/40"
        style={{ borderColor: open ? "#7259B5" : "rgba(13,13,13,.15)", color: selected ? "#282525" : "rgba(13,13,13,.35)" }}
      >
        <span className="truncate">
          {selected ? (
            <span>{selected.label}{selected.sublabel && <span className="text-black/30"> · {selected.sublabel}</span>}</span>
          ) : placeholder}
        </span>
        <ChevronDown size={14} className={`text-black/30 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="fixed z-[999] flex flex-col overflow-hidden bg-white rounded border elevacao-1" style={{ ...menuStyle }}>
          <div className="max-h-48 min-h-0 overflow-y-auto overscroll-contain">
            {value && (
              <button onClick={() => { onChange(null); onClose(); }}
                className="w-full text-left px-3 py-2 text-[0.75rem] text-[#D94E4E] hover:bg-black/[.04] transition border-b"
                style={{ borderColor: "rgba(13,13,13,.06)" }}>
                Limpar seleção
              </button>
            )}
            {options.length === 0 ? (
              <p className="px-3 py-3 text-[0.75rem] text-black/30 text-center">Nenhum item encontrado</p>
            ) : (
              options.map(opt => (
                <button key={opt.id} onClick={() => { onChange(opt.id); onClose(); }}
                  className="w-full text-left px-3 py-2 hover:bg-black/[0.03] transition flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[0.75rem] text-[#282525] truncate">{opt.label}</p>
                    {opt.sublabel && <p className="text-[0.625rem] text-black/30 truncate">{opt.sublabel}</p>}
                  </div>
                  {opt.id === value && <Check size={12} className="text-[#7259B5] flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
          {acaoCriar && (
            <button type="button" onClick={() => { onClose(); acaoCriar.onClick(); }}
              className="flex w-full flex-shrink-0 items-center gap-2 border-t px-3 py-2 text-left text-[0.75rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04]"
              style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <Plus size={12} className="flex-shrink-0" />
              <span className="truncate">{acaoCriar.label}</span>
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
