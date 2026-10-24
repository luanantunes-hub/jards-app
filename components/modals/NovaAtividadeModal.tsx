"use client";
import { useState, useEffect, useId, useRef } from "react";
import {
  X, Plus, Mail, Phone, Users, Calendar, MoreHorizontal, ChevronDown, CalendarDays, CheckSquare, Clock, Save,
  UserRound, BriefcaseBusiness, FilePenLine, Building2, FolderOpen, Handshake, Landmark, ContactRound, PackageCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { PrioridadeSelect } from "@/components/ui/PrioridadeSelect";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { NovoProspectModal } from "@/components/modals/NovoProspectModal";
import { NovoProjetoModal } from "@/components/modals/NovoProjetoModal";
import { NovoProponenteModal } from "@/components/modals/NovoProponenteModal";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import type { Prioridade, TipoAtividade } from "@/lib/supabase/types";
import { useModalDismiss } from "@/hooks/useModalDismiss";

const CRIAR_VINCULO = "__criar_vinculo__";

const VINCULO_CREATE_LABEL: Partial<Record<VinculoTipo, string>> = {
  captacao:   "Criar nova negociação",
  inscricao:  "Criar nova inscrição",
  empresa:    "Criar nova empresa",
  projeto:    "Criar novo projeto",
  proponente: "Criar novo proponente",
  contato:    "Criar novo contato",
};

/** Tipos que o banco aceita em atividades.tipo (check atividades_tipo_check). "Tarefa" não está na lista: só serve de ícone. */
const TIPOS_DA_ATIVIDADE: { key: TipoAtividade; label: string; Icon: React.ElementType; color: string }[] = [
  { key: "reuniao",  label: "Reunião",  Icon: Users,          color: "#7259B5" },
  { key: "email",    label: "E-mail",   Icon: Mail,           color: "#2D72B0" },
  { key: "telefone", label: "Telefone", Icon: Phone,          color: "#1A8B7A" },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinIcon,   color: "#2D72B0" },
  { key: "evento",   label: "Evento",   Icon: Calendar,       color: "#B07A14" },
  { key: "outro",    label: "Outro",    Icon: MoreHorizontal, color: "rgba(13,13,13,.40)" },
];

/** Ícones à escolha ao criar um tipo personalizado. */
const ICONES_DE_TIPO: { key: TipoAtividade; Icon: React.ElementType }[] = [
  ...TIPOS_DA_ATIVIDADE.slice(0, 5),
  { key: "tarefa", Icon: CheckSquare },
  TIPOS_DA_ATIVIDADE[5],
];

const ICONE_DO_TIPO: Record<string, React.ElementType> = Object.fromEntries(ICONES_DE_TIPO.map(({ key, Icon }) => [key, Icon]));

const SELECT_CAPTACAO = "id, titulo, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_id(nome)";

type Opcao = { id: string; label: string; sublabel?: string };
type VinculoTipo = "captacao" | "empresa" | "projeto" | "agencia" | "proponente" | "contato" | "inscricao" | "entrega";
type TipoPersonalizado = { id: string; nome: string; icone: TipoAtividade; cor: string };

type Relacionado = { nome?: string | null } | null;
type LinhaCaptacao = { id: string; titulo: string | null; projeto: Relacionado; empresa_crm: Relacionado; empresa: Relacionado };
type LinhaInscricao = { id: string; projeto: Relacionado; empresa_crm: Relacionado; empresa: Relacionado };
type LinhaNome = { id: string; nome: string | null };
type LinhaAgencia = { id: string; nome: string; agencia: string | null };
type LinhaContato = { id: string; nome: string | null; email: string | null };
type LinhaEntrega = { id: string; titulo: string | null; conta: { nome?: string | null; empresa_crm?: Relacionado } | null; projeto: Relacionado };
type LinhaMembro = { user_id: string; full_name: string | null };

function vinculoOpcao(id: string, d: { titulo?: string | null; projeto?: string | null; empresa?: string | null }): Opcao {
  const partes = [d.titulo, d.projeto, d.empresa].filter((x): x is string => !!x);
  const label = partes[0] ?? "Sem título";
  const sublabel = partes.length > 1 ? partes.slice(1).join(" · ") : undefined;
  return { id, label, sublabel };
}

const VINCULO_OPTIONS: { key: VinculoTipo; label: string; Icon: React.ElementType }[] = [
  { key: "captacao",   label: "Negociação", Icon: BriefcaseBusiness },
  { key: "inscricao",  label: "Inscrição",  Icon: FilePenLine },
  { key: "empresa",    label: "Empresa",    Icon: Building2 },
  { key: "projeto",    label: "Projeto",    Icon: FolderOpen },
  { key: "agencia",    label: "Agência",    Icon: Handshake },
  { key: "proponente", label: "Proponente", Icon: Landmark },
  { key: "contato",    label: "Contato",    Icon: ContactRound },
  { key: "entrega",    label: "Entrega",    Icon: PackageCheck },
];

const TYPE_COLORS = ["#7259B5", "#2D72B0", "#1A8B7A", "#B07A14", "#B07A14", "rgba(13,13,13,.40)"];

/** Reuniões e eventos nascem sincronizados com o calendário; os demais tipos são opcionais (mesma regra da negociação). */
const sincronizaPorPadrao = (tipo: TipoAtividade, tipoPersonalizado: string | null) =>
  !tipoPersonalizado && (tipo === "reuniao" || tipo === "evento");

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 flex items-center text-[0.75rem] font-semibold text-[#282525]">{children}</p>;
}

function DateField({ label, value, onChange, min, max }: {
  label: string; value: string; onChange: (value: string) => void; min?: string; max?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.15)" }}>
        <CalendarDays size={13} className="flex-shrink-0 text-black/35" />
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          aria-label={label}
          onChange={event => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-[#282525] outline-none"
        />
      </div>
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.15)" }}>
      <Clock size={13} className="flex-shrink-0 text-black/35" />
      <input
        type="time"
        value={value}
        aria-label={label}
        onChange={event => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-[#282525] outline-none"
      />
    </div>
  );
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
    conta_patrocinio_id?: string;
    date?: string;
  };
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();

  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  // Form
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoAtividade>("reuniao");
  const [tipoCustomId, setTipoCustomId] = useState<string | null>(null);
  // Prioriza o vínculo mais específico primeiro — mesma convenção usada em
  // entityLabel() (app/(dashboard)/atividades/page.tsx): contato/captação são
  // mais específicos que empresa, que fica por último. Com a ordem antiga,
  // abrir "Nova atividade" a partir da página de um contato nascia com
  // "Vinculada a: Empresa" em vez de "Contato", que é a entidade na tela.
  const [vinculoTipo, setVinculoTipo] = useState<VinculoTipo>(() => {
    if (prefill?.compromisso_id) return "entrega";
    if (prefill?.contato_id)     return "contato";
    if (prefill?.captacao_id)    return "captacao";
    if (prefill?.projeto_id)     return "projeto";
    if (prefill?.edital_user_id) return "inscricao";
    if (prefill?.empresa_crm_id) return "empresa";
    return "captacao";
  });
  const [vinculoId, setVinculoId] = useState<string | null>(
    prefill?.compromisso_id ?? prefill?.contato_id ?? prefill?.captacao_id ?? prefill?.projeto_id ?? prefill?.edital_user_id ?? prefill?.empresa_crm_id ?? null,
  );
  const [responsavelId, setResponsavelId] = useState<string | null>(prefill?.responsavel_id ?? null);
  // O prazo é o dia da atividade. O início acompanha o prazo até alguém mudá-lo em "Mais detalhes".
  const [dataInicio, setDataInicio] = useState(prefill?.date ?? todayInputValue());
  const [dataPrevista, setDataPrevista] = useState(prefill?.date ?? todayInputValue());
  const [inicioEditado, setInicioEditado] = useState(false);
  const [nota, setNota] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [resultado, setResultado] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade | null>(null);
  // A reunião (tipo inicial) nasce sincronizada; a escolha de quem mexer na caixa vale mais que o tipo.
  const [calendarSyncRequested, setCalendarSyncRequested] = useState(true);
  const sincronizacaoEditada = useRef(false);
  const responsavelEditado = useRef(false);
  // "Mais detalhes" já abre quando há algo preenchido lá dentro.
  const [maisDetalhes, setMaisDetalhes] = useState(() => Boolean(prefill?.responsavel_id));

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

  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, supabase]);

  async function loadData() {
    if (!organizationId) return;

    // A tipagem gerada do banco não cobre estas consultas (relações embutidas e tabelas novas): as linhas chegam soltas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const banco = supabase as any;
    const [
      { data: caps }, { data: insc }, { data: emps }, { data: projs }, { data: capsAgencias },
      { data: props }, { data: cons }, { data: deliveryRows }, { data: customTypes }, { data: orgMembers },
      { data: { user } },
    ] = await Promise.all([
      banco
        .from("captacoes")
        .select(SELECT_CAPTACAO)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
      banco
        .from("editais_user")
        .select("id, empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_pub_id(nome), projeto:projetos_crm!projeto_id(nome)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
      banco.from("empresas_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
      banco.from("projetos_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
      banco.from("captadores").select("id, nome, agencia").eq("organization_id", organizationId).or("ativo.eq.true,ativo.is.null").order("nome").limit(100),
      banco.from("proponentes").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100),
      banco.from("contatos").select("id, nome, email").eq("organization_id", organizationId).order("nome").limit(100),
      banco
        .from("compromissos_cliente")
        .select("id,titulo,conta:contas_patrocinio!conta_patrocinio_id(nome,empresa_crm:empresas_crm!empresa_crm_id(nome)),projeto:projetos_crm!projeto_id(nome)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      banco.from("atividade_tipos").select("id, nome, icone, cor").eq("organization_id", organizationId).order("nome"),
      banco.rpc("get_organization_members", { org_id: organizationId }),
      supabase.auth.getUser(),
    ]);

    if (caps) {
      const linhasCaptacao = caps as LinhaCaptacao[];
      // A negociação da tela de origem sempre aparece na lista, mesmo fora das 50 mais novas.
      const aberta = prefill?.captacao_id;
      if (aberta && !linhasCaptacao.some(c => c.id === aberta)) {
        const { data: atual } = await banco.from("captacoes").select(SELECT_CAPTACAO).eq("id", aberta).maybeSingle();
        if (atual) linhasCaptacao.unshift(atual as LinhaCaptacao);
      }
      setCaptacoes(linhasCaptacao.map(c => vinculoOpcao(c.id, {
        titulo: c.titulo,
        projeto: c.projeto?.nome,
        empresa: c.empresa_crm?.nome ?? c.empresa?.nome,
      })));
    }
    if (insc) {
      setInscricoes((insc as LinhaInscricao[]).map(i => vinculoOpcao(i.id, {
        projeto: i.projeto?.nome,
        empresa: i.empresa_crm?.nome ?? i.empresa?.nome,
      })));
    }
    if (emps) setEmpresas((emps as LinhaNome[]).map(e => ({ id: e.id, label: e.nome ?? "Sem nome" })));
    if (projs) setProjetos((projs as LinhaNome[]).map(p => ({ id: p.id, label: p.nome ?? "Sem nome" })));
    if (capsAgencias) setAgencias((capsAgencias as LinhaAgencia[]).map(a => ({ id: a.id, label: a.agencia || a.nome, sublabel: a.agencia ? a.nome : undefined })));
    if (props) setProponentes((props as LinhaNome[]).map(p => ({ id: p.id, label: p.nome ?? "Sem nome" })));
    if (customTypes) setTiposPersonalizados(customTypes as TipoPersonalizado[]);
    if (deliveryRows) setEntregas((deliveryRows as LinhaEntrega[]).map(item => ({
      id: item.id,
      label: item.titulo || "Entrega sem título",
      sublabel: [item.conta?.nome || item.conta?.empresa_crm?.nome, item.projeto?.nome].filter(Boolean).join(" · ") || undefined,
    })));
    if (cons) {
      setContatos((cons as LinhaContato[]).map(c => ({
        id: c.id,
        label: c.nome ?? "Sem nome",
        sublabel: c.email ?? undefined,
      })));
    }
    if (orgMembers) {
      const equipe = (orgMembers as LinhaMembro[])
        .filter(m => m.full_name)
        .map(m => ({ id: m.user_id, label: m.full_name as string }));
      setMembros(equipe);
      // Quem cria a atividade é o responsável, até alguém escolher outra pessoa.
      if (!responsavelEditado.current && user && equipe.some(m => m.id === user.id)) {
        setResponsavelId(atual => atual ?? user.id);
      }
    }
  }

  async function handleVinculoCreated(id?: string) {
    await loadData();
    if (id) setVinculoId(id);
    setShowCreateModal(false);
  }

  // NovoProponenteModal não fecha sozinho ao salvar (modo criação) — ele
  // continua montado pra mostrar uma tela de sucesso com atalhos ("Adicionar
  // contato", "Criar primeiro projeto"), e só chama onClose quando o usuário
  // realmente termina ali. Fechar aqui como os outros vínculos cortava essa
  // tela antes de aparecer.
  async function handleProponenteCreated(id?: string) {
    await loadData();
    if (id) setVinculoId(id);
  }

  const vinculoOptions = ({
    captacao: captacoes, inscricao: inscricoes, empresa: empresas, projeto: projetos,
    agencia: agencias, proponente: proponentes, contato: contatos, entrega: entregas,
  } as Record<VinculoTipo, Opcao[]>)[vinculoTipo];
  const vinculoAtual = VINCULO_OPTIONS.find(option => option.key === vinculoTipo) ?? VINCULO_OPTIONS[0];
  const temEquipe = membros.length > 1;

  function escolherTipo(chave: TipoAtividade, personalizado: string | null) {
    setTipo(chave);
    setTipoCustomId(personalizado);
    if (!sincronizacaoEditada.current) setCalendarSyncRequested(sincronizaPorPadrao(chave, personalizado));
  }

  function aoEscolherTipo(valor: string) {
    if (valor.startsWith("custom:")) escolherTipo("outro", valor.slice("custom:".length));
    else escolherTipo(valor as TipoAtividade, null);
  }

  async function criarTipoPersonalizado() {
    const nomeLimpo = novoTipoNome.trim();
    if (!nomeLimpo || !organizationId) return;
    const { data: { user } } = await supabase.auth.getUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("atividade_tipos")
      .insert({ organization_id: organizationId, nome: nomeLimpo, icone: novoTipoIcone, cor: novaTipoCor, created_by: user?.id ?? null })
      .select("id, nome, icone, cor").single();
    if (error) { setErro((error as Error).message); return; }
    const custom = data as TipoPersonalizado;
    setTiposPersonalizados(prev => [...prev, custom].sort((a, b) => a.nome.localeCompare(b.nome)));
    escolherTipo("outro", custom.id);
    setNovoTipoNome("");
    setCriandoTipo(false);
  }

  function aoMudarPrazo(proximo: string) {
    setDataPrevista(proximo);
    if (!inicioEditado) setDataInicio(proximo);
  }

  function aoMudarInicio(proximo: string) {
    setInicioEditado(true);
    setDataInicio(proximo);
    if (dataPrevista && proximo > dataPrevista) setDataPrevista(proximo);
  }

  async function handleSave() {
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    if (!dataInicio || !dataPrevista) { setErro("Informe o prazo da atividade"); return; }
    if (dataInicio > dataPrevista) {
      setErro("O prazo não pode ser anterior à data de início");
      setMaisDetalhes(true);
      return;
    }
    setSaving(true);
    setErro(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setErro("Sessão expirada. Entre novamente para criar a atividade.");
      return;
    }

    // Aberta na página de uma negociação, a atividade também fica na empresa e no projeto dela (como sempre ficou):
    // é o que a faz aparecer na linha do tempo da empresa. Só vale enquanto o vínculo for essa negociação.
    const daNegociacaoAberta = vinculoTipo === "captacao" && !!vinculoId && vinculoId === prefill?.captacao_id;

    const payload = {
      account_id: user.id,
      nome: nome.trim(),
      tipo,
      tipo_custom_id: tipoCustomId,
      // Só grava o FK que corresponde ao vínculo escolhido — cair de volta no
      // prefill pros outros campos deixava FKs de fontes diferentes (contexto
      // herdado da tela de origem + escolha atual do usuário) coexistindo sem
      // relação entre si, já que nenhuma constraint no banco valida que eles
      // sejam consistentes entre si.
      captacao_id:    vinculoTipo === "captacao"   ? vinculoId : null,
      edital_user_id: vinculoTipo === "inscricao"  ? vinculoId : null,
      empresa_crm_id: vinculoTipo === "empresa"    ? vinculoId : daNegociacaoAberta ? prefill?.empresa_crm_id ?? null : null,
      projeto_id:     vinculoTipo === "projeto"    ? vinculoId : daNegociacaoAberta ? prefill?.projeto_id ?? null : null,
      captador_id:    vinculoTipo === "agencia"    ? vinculoId : null,
      proponente_id:  vinculoTipo === "proponente" ? vinculoId : null,
      contato_id:     vinculoTipo === "contato"    ? vinculoId : null,
      compromisso_id: vinculoTipo === "entrega"    ? vinculoId : null,
      // Preenchido só quando a atividade é de fato sobre a entrega (mesmo
      // par que fn_customer_success_automations já usa) — sem isso, o
      // indicador de "dias sem atividade" do Customer Success nunca via
      // atividades de entrega logadas manualmente por aqui.
      conta_patrocinio_id: vinculoTipo === "entrega" ? prefill?.conta_patrocinio_id ?? null : null,
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

  const tipoAtual = tipoCustomId ? tiposPersonalizados.find(t => t.id === tipoCustomId) : null;
  const TipoIcon = ICONE_DO_TIPO[tipoAtual?.icone ?? tipo] ?? MoreHorizontal;
  const tipoCor = tipoAtual?.cor ?? TIPOS_DA_ATIVIDADE.find(t => t.key === tipo)?.color;
  const campoTexto = "w-full rounded border border-black/15 bg-white px-3 py-2.5 text-[#282525] outline-none transition focus:border-black/35";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center transition-colors duration-[260ms] motion-reduce:transition-none"
      style={{ background: visible ? "rgba(0,0,0,.45)" : "rgba(0,0,0,0)" }}
      onClick={onClose}
    >
      {/* Panel — grudado no topo */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[96dvh] w-full max-w-[47.5rem] flex-col overflow-hidden rounded-b bg-white transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,.12)",
          borderBottom: "1px solid rgba(13,13,13,.08)",
          borderLeft: "1px solid rgba(13,13,13,.06)",
          borderRight: "1px solid rgba(13,13,13,.06)",
          transform: visible ? "none" : "translateY(-100%)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-black/5">
              <CalendarDays size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="min-w-0 text-[0.9375rem] font-bold text-[#282525]">Nova atividade</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded transition hover:bg-black/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Nome da atividade</FieldLabel>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Ligação de follow-up, Reunião de alinhamento..."
                aria-label="Nome da atividade"
                className={`${campoTexto} text-[0.8125rem]`}
                autoFocus
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[0.75rem] font-semibold text-[#282525]">Tipo</p>
                {!criandoTipo && (
                  <button type="button" onClick={() => setCriandoTipo(true)} title="Criar um tipo de atividade"
                    className="-my-1 flex items-center gap-1 rounded px-1 py-0.5 text-[0.625rem] font-semibold text-[#7259B5] transition hover:opacity-70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    <Plus size={10} /> Novo
                  </button>
                )}
              </div>
              <CustomDropdown
                value={tipoCustomId ? `custom:${tipoCustomId}` : tipo}
                onChange={aoEscolherTipo}
                className="[&>button]:w-full"
                compact
                icon={<TipoIcon size={13} style={{ color: tipoCor }} />}
                options={[
                  ...TIPOS_DA_ATIVIDADE.map(t => ({ value: t.key, label: t.label, icon: <t.Icon size={13} style={{ color: t.color }} /> })),
                  ...tiposPersonalizados.map(t => {
                    const Icon = ICONE_DO_TIPO[t.icone] ?? MoreHorizontal;
                    return { value: `custom:${t.id}`, label: t.nome, icon: <Icon size={13} style={{ color: t.cor }} /> };
                  }),
                ]}
              />
            </div>

            <DateField label="Prazo" value={dataPrevista} min={inicioEditado ? dataInicio || undefined : undefined} onChange={aoMudarPrazo} />

            {criandoTipo && (
              <div className="rounded border p-3 sm:col-span-2" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={novoTipoNome} onChange={e => setNovoTipoNome(e.target.value)} placeholder="Nome do tipo, ex: Visita técnica"
                    aria-label="Nome do novo tipo"
                    className="min-w-[12rem] flex-1 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition focus:border-black/35"
                    style={{ borderColor: "rgba(13,13,13,.15)" }} />
                  <button type="button" disabled={!novoTipoNome.trim()} onClick={criarTipoPersonalizado}
                    className="rounded border border-[#7259B5]/25 bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-40">
                    Salvar tipo
                  </button>
                  <button type="button" onClick={() => setCriandoTipo(false)}
                    className="px-2 py-2 text-[0.6875rem] font-semibold text-black/35 transition hover:text-black/55">
                    Cancelar
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {ICONES_DE_TIPO.map(({ key, Icon }) => (
                    <button key={key} type="button" aria-label={`Ícone ${key}`} aria-pressed={novoTipoIcone === key} onClick={() => setNovoTipoIcone(key)}
                      className="flex h-7 w-7 items-center justify-center rounded border transition"
                      style={{ borderColor: novoTipoIcone === key ? "#7259B5" : "rgba(13,13,13,.12)", color: novoTipoIcone === key ? "#7259B5" : "rgba(13,13,13,.4)" }}>
                      <Icon size={12} />
                    </button>
                  ))}
                  <span className="mx-0.5 h-4 w-px bg-black/10" />
                  {TYPE_COLORS.map((color, indice) => (
                    <button key={`${color}-${indice}`} type="button" aria-label={`Cor ${indice + 1}`} aria-pressed={novaTipoCor === color} onClick={() => setNovaTipoCor(color)}
                      className="h-4 w-4 rounded-full border-2" style={{ background: color, borderColor: novaTipoCor === color ? "#282525" : "transparent" }} />
                  ))}
                </div>
              </div>
            )}

            <div className="sm:col-span-2">
              <FieldLabel>Vinculada a</FieldLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <CustomDropdown
                  value={vinculoTipo}
                  onChange={valor => { setVinculoTipo(valor as VinculoTipo); setVinculoId(null); }}
                  className="[&>button]:w-full"
                  compact
                  icon={<vinculoAtual.Icon size={13} />}
                  options={VINCULO_OPTIONS.map(option => ({ value: option.key, label: option.label, icon: <option.Icon size={13} /> }))}
                />
                <CustomDropdown
                  value={vinculoId ?? ""}
                  onChange={valor => {
                    if (valor === CRIAR_VINCULO) { setShowCreateModal(true); return; }
                    setVinculoId(valor || null);
                  }}
                  className="[&>button]:w-full"
                  compact
                  emphasized={false}
                  placeholder={`Selecionar ${vinculoAtual.label.toLowerCase()}…`}
                  options={[
                    { value: "", label: "Nenhum" },
                    ...vinculoOptions.map(opcao => ({ value: opcao.id, label: opcao.sublabel ? `${opcao.label} · ${opcao.sublabel}` : opcao.label })),
                    ...(VINCULO_CREATE_LABEL[vinculoTipo] ? [{ value: CRIAR_VINCULO, label: VINCULO_CREATE_LABEL[vinculoTipo] as string, icon: <Plus size={12} /> }] : []),
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes}
              className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-black/55 transition hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              <ChevronDown size={13} aria-hidden="true" className={`transition-transform duration-200 motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
              Mais detalhes
            </button>
            {maisDetalhes && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Prioridade</FieldLabel>
                  <PrioridadeSelect value={prioridade} onChange={setPrioridade} />
                </div>

                {temEquipe && (
                  <div>
                    <FieldLabel>Responsável</FieldLabel>
                    <CustomDropdown
                      value={responsavelId ?? ""}
                      onChange={valor => { responsavelEditado.current = true; setResponsavelId(valor || null); }}
                      className="[&>button]:w-full"
                      compact
                      icon={<UserRound size={13} />}
                      placeholder="Sem responsável"
                      options={[{ value: "", label: "Sem responsável" }, ...membros.map(membro => ({ value: membro.id, label: membro.label }))]}
                    />
                  </div>
                )}

                <DateField label="Início" value={dataInicio} max={dataPrevista || undefined} onChange={aoMudarInicio} />

                <div className={temEquipe ? "" : "sm:col-span-2"}>
                  <FieldLabel>Horário</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <TimeField label="Hora de início" value={horaInicio} onChange={setHoraInicio} />
                    <TimeField label="Hora de fim" value={horaFim} onChange={setHoraFim} />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 rounded border bg-white px-3 py-2.5 transition hover:border-[#7259B5]/35 sm:col-span-2"
                  style={{ borderColor: calendarSyncRequested ? "rgba(114,89,181,.5)" : "rgba(13,13,13,.15)" }}>
                  <input type="checkbox" checked={calendarSyncRequested}
                    onChange={e => { sincronizacaoEditada.current = true; setCalendarSyncRequested(e.target.checked); }}
                    className="accent-[#7259B5]" />
                  <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#282525]">
                    <CalendarDays size={13} className="text-[#7259B5]" /> Sincronizar com calendário
                  </span>
                </label>

                <div className="sm:col-span-2">
                  <FieldLabel>Resultado</FieldLabel>
                  <textarea value={resultado} onChange={e => setResultado(e.target.value)}
                    placeholder="O que aconteceu? Qual foi o desfecho?"
                    aria-label="Resultado"
                    rows={2}
                    className={`${campoTexto} resize-none text-[0.75rem]`} />
                </div>

                <div className="sm:col-span-2">
                  <FieldLabel>Nota</FieldLabel>
                  <textarea value={nota} onChange={e => setNota(e.target.value)}
                    placeholder="Detalhes relevantes..."
                    aria-label="Nota"
                    rows={2}
                    className={`${campoTexto} resize-none text-[0.75rem]`} />
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5 sm:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
            <button type="button" onClick={handleSave} disabled={saving || !nome.trim()}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.75rem] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={12} /> {saving ? "Salvando…" : "Criar atividade"}
            </button>
          </div>
        </footer>
      </div>

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
        <NovoProponenteModal onClose={() => setShowCreateModal(false)} onSaved={handleProponenteCreated} />
      )}
      {showCreateModal && vinculoTipo === "contato" && (
        <NovoContatoModal onClose={() => setShowCreateModal(false)} onSaved={handleVinculoCreated} />
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
