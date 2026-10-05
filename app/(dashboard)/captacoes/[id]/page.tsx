"use client";
import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Plus, RefreshCw, Mail, Phone,
  Users, Calendar, MoreHorizontal, FileText, ExternalLink,
  FolderOpen, Star, Clock, Send,
  X, Upload, Trash2,
  LayoutDashboard, MessagesSquare, RotateCw, Tag, Info, Layers,
  ChevronDown, ArrowUp, ArrowDown, Minus, Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirDocumento } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import type { Captacao, Atividade } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import { CotasReferenceTab } from "@/components/CotasReferenceTab";
import PrioBadge from "@/components/ui/PrioBadge";
import SharedStatusBadge from "@/components/ui/StatusBadge";
import { StatusDropdown } from "@/components/ui/StatusDropdown";
import { useLeiOptions } from "@/hooks/useLeiOptions";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { RenovarCicloModal } from "@/components/modals/RenovarCicloModal";
import { RelationshipWorkspace } from "@/components/relationship/RelationshipWorkspace";
import { ConcluirAtividadeModal } from "@/components/modals/ConcluirAtividadeModal";
import { useTaxonomiasComerciais } from "@/contexts/TaxonomiasComerciaisContext";
import { DetailHeaderAction, DetailPageContent, DetailSidebarCard, DetailTabs, DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { CommercialCycleHistory, type CommercialCycle } from "@/components/commercial/CommercialCycleHistory";
import { NotasDoRegistro } from "@/components/notas/NotasDoRegistro";
import { PropostaDaNegociacao } from "@/components/captacoes/PropostaDaNegociacao";
import { FecharNegocioSheet, useRecusarNegociacao } from "@/components/captacoes/FechamentoNegociacao";
import { CAMPOS_NOTA, buscarNotas, resumoNota, type NotaRegistro } from "@/lib/notas";

const RESULTADO_NEGATIVO = new Set(["recusado"]);

type Nota = NotaRegistro;

type Contato = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  linkedin_url: string | null;
  score: number;
};

type Documento = {
  id: string;
  nome: string;
  url: string;
  tipo: string | null;
  tamanho: number | null;
  created_at: string;
};

type PropostaDocumento = {
  id: string;
  titulo: string;
  valor_proposto: number | null;
  contrapartidas: string[];
  observacoes_comerciais: string | null;
  status: string;
  cota_id: string | null;
  created_at: string;
};

type Historico = {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
  user: { full_name: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  prospeccao:       { label: "Prospecção",   color: "rgba(13,13,13,.40)", bg: "rgba(13,13,13,.05)" },
  primeiro_contato: { label: "1º Contato",   color: "#2D72B0", bg: "#fff" },
  proposta_enviada: { label: "Proposta",     color: "#B07A14", bg: "#FFFBEB" },
  em_negociacao:    { label: "Negociação",   color: "#B07A14", bg: "#fff" },
  aprovado:         { label: "Aprovado",     color: "#2E8932", bg: "#F0FDF4" },
  recusado:         { label: "Recusado",     color: "#D94E4E", bg: "#FEF2F2" },
  renovacao:        { label: "Renovação",    color: "#1A8B7A", bg: "#fff" },
};

const PRIO_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  alta:  { label: "Alta",  color: "#D94E4E", Icon: ArrowUp },
  media: { label: "Média", color: "#B07A14", Icon: Minus },
  baixa: { label: "Baixa", color: "#888888", Icon: ArrowDown },
};

const CAMPO_LABELS: Record<string, string> = {
  status: "Status",
  prioridade: "Prioridade",
  valor_solicitado: "Valor solicitado",
  valor_aprovado: "Valor aprovado",
  meio_contato: "Meio de contato",
  proxima_prospeccao: "Próximo follow-up",
  data_previsao: "Data de previsão",
  empresa_crm_id: "Empresa",
  projeto_id: "Projeto",
  captador_id: "Captador",
  retorno: "Retorno",
};

const TIPO_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  telefone: Phone,
  linkedin: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  reuniao: Users,
  evento: Calendar,
  mudanca: RefreshCw,
  nota: FileText,
  outro: MoreHorizontal,
};

function formatCurrency(value: number | null): string {
  if (!value) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRelative(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD < 7) return `${diffD}d atrás`;
  return formatDate(dateStr);
}


function DocIcon({ tipo }: { tipo: string | null }) {
  if (tipo?.includes("pdf")) return <FileText size={14} className="text-[#D94E4E]/75 flex-shrink-0" />;
  if (tipo?.includes("image")) return <FileText size={14} className="text-blue-400 flex-shrink-0" />;
  if (tipo?.includes("spreadsheet") || tipo?.includes("excel") || tipo?.includes("xlsx"))
    return <FileText size={14} className="text-green-500 flex-shrink-0" />;
  if (tipo?.includes("word") || tipo?.includes("document"))
    return <FileText size={14} className="text-blue-500 flex-shrink-0" />;
  return <FileText size={14} className="text-black/25 flex-shrink-0" />;
}

function formatDocSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function TimelineEvent({ tipo, titulo, descricao, data, usuario }: {
  tipo: string;
  titulo: string;
  descricao?: string | null;
  data: string;
  usuario?: string | null;
}) {
  const Icon = TIPO_ICONS[tipo] || MoreHorizontal;
  const iconColor = tipo === "email" ? "#2D72B0"
    : tipo === "telefone" ? "#1A8B7A"
    : tipo === "linkedin" ? "#2D72B0"
    : tipo === "reuniao" ? "#7259B5"
    : tipo === "evento" ? "#B07A14"
    : tipo === "mudanca" ? "#7259B5"
    : tipo === "nota" ? "#D94E4E"
    : "rgba(13,13,13,.40)";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#fff", border: `1px solid ${iconColor}47`, color: iconColor }}
        >
          <Icon size={13} />
        </div>
        <div className="w-px flex-1 bg-black/8 my-1" />
      </div>
      <div className="flex-1 pb-5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[0.6875rem] font-semibold text-black/50">{formatDate(data)}</span>
          <span className="text-[0.625rem] text-black/25">{formatRelative(data)}</span>
        </div>
        <p className="text-[0.8125rem] font-medium text-[#0D0D0D]">{titulo}</p>
        {descricao && <p className="text-xs text-black/40 mt-0.5">{descricao}</p>}
        {usuario && <p className="text-[0.625rem] text-black/25 mt-1">{usuario}</p>}
      </div>
    </div>
  );
}

export default function CaptacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const { options: leiOptions, create: createLei } = useLeiOptions();
  const { etiquetas } = useEtiquetas();
  const STATUS_META: Record<string, { label: string; cor: string; icone: string }> = Object.fromEntries(etiquetas.map(e => [e.key, e]));
  const { origens, canais, resultados } = useTaxonomiasComerciais();
  const taxonomyLabel = (items: {chave:string;label:string}[], value: string | null | undefined) => items.find(item=>item.chave===value)?.label ?? value?.replaceAll("_"," ") ?? "—";
  const [sidebarStatusMenu, setSidebarStatusMenu] = useState<{ top: number; left: number } | null>(null);
  const [leiMenuPos, setLeiMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [prioMenuPos, setPrioMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [captacao, setCaptacao] = useState<Captacao & {
    empresa_pub: { nome: string; logo_url: string | null; site: string | null; cidade: string | null; estado: string | null; setor: string | null } | null;
    empresa_crm: { nome: string; domain_key: string | null; site: string | null } | null;
    projeto: { nome: string; valor_alvo: number | null; proponente_nome: string | null; descricao: string | null; proponente_cidade: string | null; proponente_estado: string | null; identidade_tipo: "padrao" | "icone" | "emoji" | "logo" | null; identidade_valor: string | null; identidade_logo_url: string | null; identidade_cor: string | null } | null;
    captador: { full_name: string; email: string } | null;
  } | null>(null);
  const [atividades, setAtividades] = useState<(Atividade & { contato: { nome: string } | null })[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [fechandoPeloStatus, setFechandoPeloStatus] = useState(false);
  const recusar = useRecusarNegociacao();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [propostas, setPropostas] = useState<PropostaDocumento[]>([]);
  const [historico, setHistorico] = useState<(Historico & { user: { full_name: string } | null })[]>([]);
  const [interacoes, setInteracoes] = useState<{ id: string; tipo: string; canal: string | null; assunto: string; resumo: string | null; resultado: string | null; ocorreu_em: string; contato: { nome: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewAtividade, setShowNewAtividade] = useState(false);
  const [newAtividadeNome, setNewAtividadeNome] = useState("");
  const [newAtividadeTipo, setNewAtividadeTipo] = useState<string>("reuniao");
  const [newAtividadeNota, setNewAtividadeNota] = useState("");
  const [newAtividadeData, setNewAtividadeData] = useState("");
  const [salvandoAtividade, setSalvandoAtividade] = useState(false);
  const [atividadeConcluir, setAtividadeConcluir] = useState<(Atividade & { contato: { nome: string } | null }) | null>(null);
  const [uploadandoDoc, setUploadandoDoc] = useState(false);
  const [documentoErro, setDocumentoErro] = useState<string | null>(null);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [proximoCiclo, setProximoCiclo] = useState<{ id: string; ciclo_ano: number } | null>(null);
  const [ciclos, setCiclos] = useState<CommercialCycle[]>([]);
  const [activeTab, setActiveTab] = useState<"visao-geral" | "cotas" | "relacionamento">("visao-geral");

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: cap, error: capErr } = await supabase
      .from("captacoes")
      .select("*")
      .eq("id", id)
      .single();

    const capData = cap as any;
    if (capErr || !capData) {
      console.error("Erro ao buscar captação:", capErr);
      setLoading(false);
      return;
    }

    // Buscar dados relacionados em paralelo
    const empPubPromise = capData.empresa_id
      ? supabase.from("empresas").select("nome, logo_url, site, cidade, estado, setor").eq("id", capData.empresa_id).single()
      : Promise.resolve({ data: null });

    const empCrmPromise = capData.empresa_crm_id
      ? supabase.from("empresas_crm").select("nome, domain_key, site").eq("id", capData.empresa_crm_id).single()
      : Promise.resolve({ data: null });

    const projetoPromise = capData.projeto_id
      ? supabase.from("projetos_crm").select("nome, valor_alvo, proponente_nome, descricao, proponente_cidade, proponente_estado, identidade_tipo, identidade_valor, identidade_logo_url, identidade_cor").eq("id", capData.projeto_id).single()
      : Promise.resolve({ data: null });

    const captadorPromise = capData.captador_id
      ? supabase.from("profiles").select("full_name, email").eq("id", capData.captador_id).single()
      : Promise.resolve({ data: null });

    const supervisorPromise = capData.supervisor_id
      ? supabase.from("profiles").select("full_name, email").eq("id", capData.supervisor_id).single()
      : Promise.resolve({ data: null });

    const captadorExtPromise = capData.captador_externo_id
      ? (supabase as any).from("captadores").select("nome, agencia").eq("id", capData.captador_externo_id).single()
      : Promise.resolve({ data: null });

    const [empPubRes, empCrmRes, projetoRes, captadorRes, supervisorRes, captadorExtRes, atvRes, notRes, docRes, histRes, interacoesRes, propostasRes, proximoCicloRes, ciclosRes] = await Promise.all([
      empPubPromise,
      empCrmPromise,
      projetoPromise,
      captadorPromise,
      supervisorPromise,
      captadorExtPromise,
      supabase
        .from("atividades")
        .select(`
          id, nome, tipo, prioridade, data_prevista, data_realizada, feita, nota, created_at, captacao_id,
          contato:contatos!contato_id(nome)
        `)
        .eq("captacao_id", id)
        .order("data_prevista", { ascending: true }),
      supabase
        .from("notas")
        .select(CAMPOS_NOTA)
        .eq("captacao_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("documentos")
        .select("id, nome, url, tipo, tamanho, created_at")
        .or(capData.projeto_id ? `captacao_id.eq.${id},projeto_id.eq.${capData.projeto_id}` : `captacao_id.eq.${id}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("historico_captações" as any)
        .select("id, campo, valor_anterior, valor_novo, created_at, user:profiles!user_id(full_name)")
        .eq("captacao_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("crm_interacoes")
        .select("id,tipo,canal,assunto,resumo,resultado,ocorreu_em,contato:contatos(nome)")
        .eq("captacao_id", id)
        .order("ocorreu_em", { ascending: false }),
      (supabase as any)
        .from("propostas")
        .select("id,titulo,valor_proposto,contrapartidas,observacoes_comerciais,status,cota_id,created_at")
        .eq("captacao_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("captacoes")
        .select("id, ciclo_ano")
        .eq("ciclo_anterior_id", id)
        .maybeSingle(),
      (supabase as any)
        .from("ciclos_comerciais")
        .select("id,ciclo_ano,proximo_ciclo_ano,status_final,resultado,nota,valor_solicitado,valor_aprovado,potencial_fechamento,encerrado_em,retomada_programada_em,reaberto_em,cancelado_em,estado")
        .eq("captacao_id", id)
        .order("encerrado_em", { ascending: false }),
    ]);

    const responsavelData = supervisorRes.data ?? captadorRes.data;
    setCaptacao({
      ...capData,
      empresa_pub: empPubRes.data,
      empresa_crm: empCrmRes.data,
      projeto: projetoRes.data,
      captador: captadorRes.data,
      responsavel: responsavelData,
      captador_externo: captadorExtRes.data,
    } as any);
    setAtividades((atvRes.data as any) ?? []);
    setNotas((notRes.data as any) ?? []);
    setDocumentos((docRes.data as any) ?? []);
    setHistorico((histRes.data as any) ?? []);
    setInteracoes((interacoesRes.data as any) ?? []);
    setPropostas((propostasRes.data as PropostaDocumento[] | null) ?? []);
    setProximoCiclo((proximoCicloRes.data as { id: string; ciclo_ano: number } | null) ?? null);
    setCiclos((ciclosRes.data as CommercialCycle[] | null) ?? []);

    if (capData?.empresa_crm_id) {
      const { data: cts } = await supabase
        .from("contatos")
        .select("id, nome, cargo, email, telefone, linkedin_url, score")
        .eq("empresa_crm_id", capData.empresa_crm_id)
        .order("score", { ascending: false });
      setContatos((cts as any) ?? []);
    }

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "relacionamento") setActiveTab("relacionamento");
  }, []);

  async function recarregarNotas() {
    try { setNotas(await buscarNotas(supabase, { coluna: "captacao_id", id })); } catch { /* a lista anterior continua na tela */ }
  }

  async function handleSalvarAtividade() {
    if (!newAtividadeNome.trim()) return;
    setSalvandoAtividade(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSalvandoAtividade(false);
      return;
    }

    const { error } = await (supabase as any).from("atividades").insert({
      account_id: user.id,
      nome: newAtividadeNome.trim(),
      tipo: newAtividadeTipo,
      nota: newAtividadeNota.trim() || null,
      data_prevista: newAtividadeData || null,
      captacao_id: id,
      empresa_crm_id: captacao?.empresa_crm_id || null,
      projeto_id: captacao?.projeto_id || null,
      feita: false,
      calendar_sync_requested: ["reuniao", "evento"].includes(newAtividadeTipo),
    } as any);

    if (!error) {
      setNewAtividadeNome("");
      setNewAtividadeTipo("reuniao");
      setNewAtividadeNota("");
      setNewAtividadeData("");
      setShowNewAtividade(false);
      await fetchData();
    }
    setSalvandoAtividade(false);
  }

  async function handleToggleAtividade(atividadeId: string, feita: boolean) {
    if (!feita) {
      const atividade = atividades.find(item => item.id === atividadeId);
      if (atividade) { setAtividadeConcluir(atividade); return; }
    }
    await (supabase as any).rpc("fn_set_atividade_concluida", {
      p_atividade_id: atividadeId, p_feita: false, p_data_realizada: null,
    });
    await fetchData();
  }

  async function handleUploadDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length || !captacao) return;
    setUploadandoDoc(true);
    setDocumentoErro(null);

    const { data: { user } } = await supabase.auth.getUser();
    let organizationId = captacao.organization_id;
    if (!organizationId) {
      const { data: orgIds } = await supabase.rpc("auth_org_ids");
      organizationId = (orgIds as unknown as string[] | null)?.[0] ?? null;
    }

    if (!user || !organizationId) {
      setDocumentoErro("Não foi possível identificar seu usuário ou organização.");
      setUploadandoDoc(false);
      e.target.value = "";
      return;
    }

    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${organizationId}/${captacao.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) {
        setDocumentoErro(uploadError.message);
        continue;
      }

      const { error: metadataError } = await (supabase.from("documentos") as any).insert({
          account_id: user.id,
          organization_id: organizationId,
          captacao_id: captacao.id,
          nome: file.name,
          tipo: file.type,
          tamanho: file.size,
          url: filePath,
      });

      if (metadataError) {
        await supabase.storage.from("documentos").remove([filePath]);
        setDocumentoErro(metadataError.message);
      }
    }

    setUploadandoDoc(false);
    e.target.value = "";
    await fetchData();
  }

  function handleExcluirDocumento(docId: string, storagePath: string, nome: string) {
    confirmDelete({
      title: `Excluir o documento “${nome}”?`,
      description: "O arquivo deixa de estar disponível para toda a equipe.",
      onConfirm: async () => {
        setDocumentoErro(null);
        await excluirDocumento(supabase, { id: docId, url: storagePath });
        await fetchData();
      },
    });
  }

  async function handleStatusChange(newStatus: string) {
    if (!captacao || captacao.status === newStatus) {
      return;
    }
    // Desfecho tem fluxo próprio: aprovar pede o valor fechado; recusar, confirmação.
    if (newStatus === "aprovado") { setFechandoPeloStatus(true); return; }
    if (newStatus === "recusado") { recusar(captacao.id, fetchData); return; }
    await (supabase.from("captacoes") as any)
      .update({ status: newStatus })
      .eq("id", captacao.id);
    await fetchData();
  }

  async function handleLeiChange(novaLei: string | null) {
    if (!captacao) return;
    setLeiMenuPos(null);
    await (supabase.from("captacoes") as any)
      .update({ lei: novaLei })
      .eq("id", captacao.id);
    await fetchData();
  }

  async function handlePrioridadeChange(novaPrioridade: string | null) {
    if (!captacao) return;
    setPrioMenuPos(null);
    await (supabase.from("captacoes") as any)
      .update({ prioridade: novaPrioridade })
      .eq("id", captacao.id);
    await fetchData();
  }

  if (loading) return <DetailPageSkeleton />;

  if (!captacao) {
    return <DetailNotFound title="Negociação não encontrada" description="Ela pode ter sido removida ou você não tem acesso a ela." backHref="/captacoes" backLabel="Negociações" />;
  }

  const atvsPendentes = atividades.filter(a => !a.feita);

  const timelineEvents = [
    ...interacoes.map(interacao => ({
      tipo: "interacao",
      atividade_tipo: interacao.canal ?? interacao.tipo,
      titulo: interacao.assunto,
      descricao: [taxonomyLabel(resultados, interacao.resultado), interacao.resumo].filter(value=>value&&value!=="—").join(" · ") || null,
      data: interacao.ocorreu_em,
      usuario: interacao.contato?.nome ?? null,
      created_at: interacao.ocorreu_em,
    })),
    ...atividades.map(a => ({
      tipo: "atividade",
      atividade_tipo: a.tipo || "outro",
      titulo: a.nome,
      descricao: a.nota,
      data: a.data_realizada || a.data_prevista || a.created_at,
      usuario: null,
      created_at: a.data_realizada || a.data_prevista || a.created_at,
    })),
    ...notas.map(n => ({
      tipo: "nota",
      atividade_tipo: "nota",
      titulo: n.titulo || resumoNota(n.conteudo),
      descricao: n.titulo ? resumoNota(n.conteudo) : null,
      data: n.created_at,
      usuario: null,
      created_at: n.created_at,
    })),
    ...historico.map(h => ({
      tipo: "mudanca",
      atividade_tipo: "mudanca",
      titulo: `${CAMPO_LABELS[h.campo] || h.campo} alterado`,
      descricao: h.valor_anterior && h.valor_novo
        ? `${STATUS_META[h.valor_anterior]?.label ?? STATUS_CONFIG[h.valor_anterior]?.label ?? h.valor_anterior} → ${STATUS_META[h.valor_novo]?.label ?? STATUS_CONFIG[h.valor_novo]?.label ?? h.valor_novo}`
        : h.valor_novo || "—",
      data: h.created_at,
      usuario: h.user?.full_name || null,
      created_at: h.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}><div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
        <Link
          href="/captacoes"
          className="mb-7 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65"
        >
          <ArrowLeft size={13} /> Negociações
        </Link>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo
              nome={captacao.empresa_pub?.nome || captacao.empresa_crm?.nome || "?"}
              domain={captacao.empresa_crm?.domain_key}
              site={captacao.empresa_pub?.site ?? captacao.empresa_crm?.site}
              logo_url={captacao.empresa_pub?.logo_url || null}
              size={56}
            />
            <div className="min-w-0">
              <h1 className="max-w-4xl text-[2rem] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[2.375rem]">
                {captacao.titulo || captacao.projeto?.nome || "Sem título"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.875rem] text-black/45">
                {captacao.empresa_crm?.nome && !captacao.empresa_pub?.nome ? (
                  <Link href={`/empresas-crm/${captacao.empresa_crm_id}`} className="text-sm text-black/50 hover:text-[#7259B5] transition">
                    {captacao.empresa_crm.nome}
                  </Link>
                ) : (
                  <span className="text-sm text-black/50">
                    {captacao.empresa_pub?.nome || captacao.empresa_crm?.nome || "Sem empresa"}
                  </span>
                )}
                {captacao.titulo && captacao.projeto?.nome && (
                  <>
                    <span className="text-black/20">·</span>
                    <Link href={`/projetos/${captacao.projeto_id}`} className="inline-flex items-center gap-1 text-sm text-black/50 hover:text-[#7259B5] transition">
                      <FolderOpen size={12} className="text-black/30" />
                      {captacao.projeto.nome}
                    </Link>
                  </>
                )}
                {captacao.ciclo_ano && (
                  <>
                    <span className="text-black/20">·</span>
                    <span className="rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium text-black/40" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                      Ciclo {captacao.ciclo_ano}
                    </span>
                  </>
                )}
                {captacao.ciclo_anterior_id && (
                  <Link href={`/captacoes/${captacao.ciclo_anterior_id}`} className="text-[0.625rem] font-medium text-black/35 transition hover:text-[#7259B5]">
                    Ver ciclo anterior
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <PropostaDaNegociacao
              captacao={captacao}
              empresaNome={captacao.empresa_pub?.nome || captacao.empresa_crm?.nome || "Empresa"}
              projetoNome={captacao.projeto?.nome ?? null}
              propostas={propostas}
              onChanged={fetchData}
            />
            {proximoCiclo ? (
              <DetailHeaderAction label={`Ver ciclo ${proximoCiclo.ciclo_ano}`} icon={RotateCw} onClick={() => router.push(`/captacoes/${proximoCiclo.id}`)} />
            ) : RESULTADO_NEGATIVO.has(captacao.status) ? (
              <DetailHeaderAction
                label={captacao.retomada_programada_em
                  ? `Retomada em ${formatDate(captacao.retomada_programada_em)}`
                  : `Abrir novo ciclo em ${(captacao.ciclo_ano ?? new Date(captacao.created_at).getFullYear()) + 1}`}
                icon={RotateCw}
                onClick={() => setShowRenovarModal(true)}
                tone="black"
              />
            ) : null}
            <button
              onClick={() => setShowEditModal(true)}
              className="flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04]"
            >
              <Pencil size={12} /> Editar
            </button>
            <button
              onClick={() => setShowNewAtividade(!showNewAtividade)}
              className={`flex h-11 items-center gap-2 rounded border px-4 text-[0.75rem] font-medium transition ${
                showNewAtividade
                  ? "bg-white border-[#7259B5]/25 text-[#7259B5]"
                  : "bg-white border-black/[.12] text-black/55 hover:bg-black/[.04]"
              }`}
            >
              {showNewAtividade ? <X size={12} /> : <Plus size={12} />}
              {showNewAtividade ? "Cancelar" : "Atividade"}
            </button>
          </div>
        </div>
      </div></header>

      {/* Stats Bar */}
      <div className="border-b bg-white" style={{ borderColor: "rgba(13,13,13,.06)" }}><div className="mx-auto grid max-w-pagina grid-cols-2 gap-5 px-4 py-5 sm:grid-cols-3 sm:px-6 lg:px-10">
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-0.5">Prioridade</p>
            <button
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setPrioMenuPos(prioMenuPos ? null : { top: rect.bottom + 4, left: rect.left });
              }}
              className="inline-flex items-center gap-1.5 rounded border bg-white px-2 py-0.5 text-[0.6875rem] font-semibold transition hover:opacity-80"
              style={{
                borderColor: captacao.prioridade ? (PRIO_META[captacao.prioridade]?.color ?? "rgba(13,13,13,.25)") + "47" : "transparent",
                color: PRIO_META[captacao.prioridade ?? ""]?.color ?? "rgba(13,13,13,.25)",
              }}
            >
              {captacao.prioridade ? (
                (() => { const It = PRIO_META[captacao.prioridade]; return <><It.Icon size={11} strokeWidth={2.5} />{It.label}</>; })()
              ) : (
                <><Minus size={11} className="rotate-90" />Sem prioridade</>
              )}
              <ChevronDown size={10} />
            </button>
          </div>
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-0.5">Tipo de patrocínio</p>
            <button
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setLeiMenuPos(leiMenuPos ? null : { top: rect.bottom + 4, left: rect.left });
              }}
              className="rounded border bg-white px-2 py-0.5 text-[0.6875rem] font-semibold capitalize transition hover:opacity-80"
              style={{
                borderColor: captacao.lei ? (leiOptions.find(l => l.status === captacao.lei)?.bg ?? "rgba(13,13,13,.4)") + "47" : "transparent",
                color: leiOptions.find(l => l.status === captacao.lei)?.bg ?? "rgba(13,13,13,.6)",
              }}
            >
              {leiOptions.find(l => l.status === captacao.lei)?.label ?? captacao.lei ?? "—"}
            </button>
          </div>
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-0.5">Agência de captação</p>
            {(captacao as any).captador_externo ? (
              <div>
                <p className="text-[0.8125rem] font-medium text-[#0D0D0D]">{(captacao as any).captador_externo.nome}</p>
                {(captacao as any).captador_externo.agencia && (
                  <p className="text-[0.6875rem] text-black/40">{(captacao as any).captador_externo.agencia}</p>
                )}
              </div>
            ) : (
              <span className="text-[0.8125rem] text-black/40">—</span>
            )}
          </div>
        </div></div>

      {/* Abas da negociação */}
      <DetailTabs
        ariaLabel="Seções da negociação"
        activeTab={activeTab}
        onChange={value => setActiveTab(value as "visao-geral" | "cotas" | "relacionamento")}
        tabs={[
          { id: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
          ...(captacao.projeto_id ? [{ id: "cotas", label: "Cotas", icon: Layers }] : []),
          { id: "relacionamento", label: "Relacionamento", icon: MessagesSquare },
        ]}
      />

      {/* Content */}
      <DetailPageContent>
        {activeTab === "relacionamento" ? (
          captacao.organization_id ? (
            <RelationshipWorkspace
              organizationId={captacao.organization_id}
              accountId={captacao.account_id}
              empresaCrmId={captacao.empresa_crm_id}
              captacaoId={captacao.id}
              contacts={contatos.map(({ id, nome, cargo }) => ({ id, nome, cargo }))}
            />
          ) : (
            <div className="rounded border bg-white px-5 py-12 text-center text-sm text-black/35" style={{ borderColor: "rgba(13,13,13,.08)" }}>Esta negociação precisa estar associada a uma organização para usar o relacionamento.</div>
          )
        ) : activeTab === "cotas" ? (
          <CotasReferenceTab
            projetoId={captacao.projeto_id}
            projetoNome={captacao.projeto?.nome}
            empresaNome={captacao.empresa_pub?.nome || captacao.empresa_crm?.nome || "negociação"}
            organizationId={captacao.organization_id}
            parentField="captacao_id"
            parentId={captacao.id}
            captacaoId={captacao.id}
            onPropostaCriada={() => void fetchData()}
          />
        ) : (
        <div className="flex w-full flex-col gap-6 xl:flex-row">
          {/* Main Column */}
          <div className="flex-1 space-y-6">
            {/* Projeto */}
            {captacao.projeto && (
              <section>
                <div className="mb-3">
                  <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Projeto</h2>
                </div>
                <Link
                  href={captacao.projeto_id ? `/projetos/${captacao.projeto_id}` : "#"}
                  className={`block rounded border bg-white p-5 transition ${captacao.projeto_id ? "hover:border-[#7259B5]/30 hover:bg-black/[.04]" : "pointer-events-none"}`}
                  style={{ borderColor: "rgba(13,13,13,.08)" }}
                >
                  <div className="flex items-center gap-3">
                    <ProjectIdentity
                      nome={captacao.projeto.nome}
                      tipo={captacao.projeto.identidade_tipo}
                      valor={captacao.projeto.identidade_valor}
                      logoUrl={captacao.projeto.identidade_logo_url}
                      cor={captacao.projeto.identidade_cor}
                      size="md"
                    />
                    <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-[#0D0D0D]">{captacao.projeto.nome}</p>
                  </div>
                  {captacao.projeto.descricao && (
                    <p className="mt-3 text-[0.75rem] leading-relaxed text-black/45">{captacao.projeto.descricao}</p>
                  )}
                  {(captacao.projeto.proponente_nome || captacao.projeto.valor_alvo) && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.6875rem] text-black/50">
                      {captacao.projeto.proponente_nome && (
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={11} className="text-black/30" />
                          {captacao.projeto.proponente_nome}
                          {captacao.projeto.proponente_cidade && captacao.projeto.proponente_estado ? ` · ${captacao.projeto.proponente_cidade}, ${captacao.projeto.proponente_estado}` : ""}
                        </span>
                      )}
                      {captacao.projeto.valor_alvo && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#7259B5]">
                          <Star size={11} className="text-[#7259B5]/60" />
                          {formatCurrency(captacao.projeto.valor_alvo)} de meta
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </section>
            )}

            {/* Timeline */}
            <CommercialCycleHistory cycles={ciclos} />

            {/* Timeline */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Histórico</h2>
                <span className="text-[0.6875rem] text-black/25 font-medium">{timelineEvents.length} eventos</span>
              </div>

              {/* Formulário inline de nova atividade */}
              {showNewAtividade && (
                <div className="bg-white rounded border p-4 mb-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-[#7259B5] flex items-center justify-center">
                      <Plus size={13} className="text-white" />
                    </div>
                    <span className="text-[0.8125rem] font-medium text-[#0D0D0D]">Nova atividade</span>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newAtividadeNome}
                      onChange={e => setNewAtividadeNome(e.target.value)}
                      placeholder="Nome da atividade..."
                      className="w-full px-3 py-2 text-[0.8125rem] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 focus:border-[#7259B5] transition"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                    />

                    <div className="flex gap-2">
                      {[
                        { value: "reuniao", label: "Reunião", Icon: Users },
                        { value: "email", label: "E-mail", Icon: Mail },
                        { value: "telefone", label: "Telefone", Icon: Phone },
                        { value: "linkedin", label: "LinkedIn", Icon: () => (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                          </svg>
                        )},
                        { value: "outro", label: "Outro", Icon: MoreHorizontal },
                      ].map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setNewAtividadeTipo(value)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem] font-medium rounded border transition ${
                            newAtividadeTipo === value
                              ? "bg-white text-[#7259B5] border-[#7259B5]/25"
                              : "bg-white text-black/50 border-black/10 hover:border-black/20"
                          }`}
                        >
                          <Icon size={11} />
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newAtividadeData}
                        onChange={e => setNewAtividadeData(e.target.value)}
                        className="flex-1 px-3 py-2 text-[0.75rem] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition"
                        style={{ borderColor: "rgba(13,13,13,.12)" }}
                      />
                    </div>

                    <textarea
                      value={newAtividadeNota}
                      onChange={e => setNewAtividadeNota(e.target.value)}
                      placeholder="Nota"
                      rows={2}
                      className="w-full px-3 py-2 text-[0.75rem] border rounded resize-none focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowNewAtividade(false)}
                        className="px-3 py-1.5 text-[0.6875rem] font-medium text-black/40 hover:text-black/60 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSalvarAtividade}
                        disabled={!newAtividadeNome.trim() || salvandoAtividade}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-[0.6875rem] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
                      >
                        {salvandoAtividade ? (
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send size={11} />
                        )}
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {timelineEvents.length === 0 && !showNewAtividade ? (
                <div className="bg-white rounded border p-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <Clock size={24} className="mx-auto text-black/15 mb-3" />
                  <p className="text-sm text-black/35">Nenhum evento registrado</p>
                  <p className="text-xs text-black/20 mt-1">Adicione uma atividade ou nota para começar</p>
                </div>
              ) : (
                <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {timelineEvents.map((evt, i) => (
                    <TimelineEvent
                      key={i}
                      tipo={evt.atividade_tipo}
                      titulo={evt.titulo}
                      descricao={evt.descricao}
                      data={evt.data}
                      usuario={evt.usuario}
                    />
                  ))}
                </div>
              )}
            </section>

            <NotasDoRegistro
              escopo={{ coluna: "captacao_id", id }}
              organizationId={captacao.organization_id}
              notas={notas}
              onChanged={recarregarNotas}
              contexto={captacao.empresa_pub?.nome || captacao.empresa_crm?.nome || undefined}
            />

            {/* Atividades Pendentes */}
            {atvsPendentes.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Próximas Atividades</h2>
                  <span className="text-[0.6875rem] text-black/25 font-medium">{atvsPendentes.length}</span>
                </div>
                <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {atvsPendentes.map(atv => {
                    const Icon = TIPO_ICONS[atv.tipo || "outro"] || MoreHorizontal;
                    return (
                      <div key={atv.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 group" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                        <button
                          onClick={() => handleToggleAtividade(atv.id, atv.feita)}
                          className="w-5 h-5 rounded border-2 border-black/15 hover:border-[#7259B5] hover:bg-black/[.04] flex-shrink-0 transition flex items-center justify-center"
                        />
                        <Icon size={13} className="text-black/30 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.8125rem] font-medium text-[#0D0D0D] truncate">{atv.nome}</p>
                          {atv.contato && (
                            <p className="text-[0.6875rem] text-black/35">{atv.contato.nome}</p>
                          )}
                        </div>
                        {atv.data_prevista && (
                          <span className="text-[0.6875rem] text-black/35 flex-shrink-0">{formatDate(atv.data_prevista)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {propostas.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Adaptação comercial</h2>
                  {captacao.projeto_id && <Link href={`/projetos/${captacao.projeto_id}`} className="text-[0.625rem] font-semibold text-[#7259B5] hover:underline">Abrir no projeto</Link>}
                </div>
                <div className="space-y-2">
                  {propostas.map(proposta => (
                    <div key={proposta.id} className="rounded border border-black/[.08] bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div><p className="text-[0.8125rem] font-semibold text-black/75">{proposta.titulo}</p><p className="mt-1 text-[0.625rem] text-black/30">{proposta.contrapartidas.length} contrapartida{proposta.contrapartidas.length === 1 ? "" : "s"} · {formatDate(proposta.created_at)}</p></div>
                        <span className="text-[0.8125rem] font-semibold text-black/65">{proposta.valor_proposto == null ? "—" : proposta.valor_proposto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </div>
                      {proposta.observacoes_comerciais && <p className="mt-3 border-t border-black/[.06] pt-3 text-[0.6875rem] leading-5 text-black/40">{proposta.observacoes_comerciais}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Documentos */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Documentos</h2>
                <label className="inline-flex items-center gap-1 rounded border border-black/15 bg-white px-2 py-1 text-[0.6875rem] font-semibold text-black/70 hover:bg-black/[.04] transition cursor-pointer">
                  <Upload size={11} /> Adicionar
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.zip,.rar"
                    multiple
                    onChange={handleUploadDocumento}
                    disabled={uploadandoDoc}
                  />
                </label>
              </div>

              {uploadandoDoc && (
                <div className="bg-white border border-[#7259B5]/20 rounded p-3 mb-3 flex items-center gap-3">
                  <RefreshCw size={14} className="text-[#7259B5] animate-spin" />
                  <span className="text-[0.75rem] text-[#7259B5] font-medium">Enviando arquivo…</span>
                </div>
              )}

              {documentoErro && (
                <div className="mb-3 rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#B23A3A]">
                  {documentoErro}
                </div>
              )}

              {documentos.length === 0 && !uploadandoDoc ? (
                <div className="bg-white rounded border p-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <FileText size={20} className="mx-auto text-black/15 mb-2" />
                  <p className="text-xs text-black/30">Nenhum documento anexado</p>
                  <p className="text-[0.625rem] text-black/20 mt-1">PDF, Word, Excel, imagens, ZIP</p>
                </div>
              ) : documentos.length > 0 ? (
                <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {documentos.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-black/[0.02] transition group" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                      <DocIcon tipo={doc.tipo} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-medium truncate">{doc.nome}</p>
                        <p className="text-[0.625rem] text-black/25">{formatDocSize(doc.tamanho)} · {formatDate(doc.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition">
                        <button
                          onClick={async () => {
                            const { data } = await supabase.storage.from("documentos").createSignedUrl(doc.url, 3600);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
                          className="p-1.5 rounded hover:bg-black/[.04] text-black/25 hover:text-[#7259B5] transition"
                        >
                          <ExternalLink size={12} />
                        </button>
                        <button
                          onClick={() => handleExcluirDocumento(doc.id, doc.url, doc.nome)}
                          className="p-1.5 rounded hover:bg-black/[.04] text-black/25 hover:text-[#D94E4E] transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          {/* Sidebar */}
          <div className="w-full shrink-0 space-y-4 xl:w-[20rem]">
            {/* Status */}
            <DetailSidebarCard title="Status" icon={Tag}>
              <button
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setSidebarStatusMenu(
                    sidebarStatusMenu ? null : { top: rect.bottom + 4, left: rect.left }
                  );
                }}
                className="block"
              >
                <SharedStatusBadge status={captacao.status} withChevron label={STATUS_META[captacao.status]?.label} bg={STATUS_META[captacao.status]?.cor} iconName={STATUS_META[captacao.status]?.icone} />
              </button>
              {sidebarStatusMenu && (
                <StatusDropdown
                  options={etiquetas.map(e => ({ status: e.key, label: e.label, bg: e.cor, iconName: e.icone }))}
                  current={captacao.status}
                  position={sidebarStatusMenu}
                  onSelect={(s) => {
                    handleStatusChange(s);
                    setSidebarStatusMenu(null);
                  }}
                  onClose={() => setSidebarStatusMenu(null)}
                />
              )}
            </DetailSidebarCard>

            {/* Detalhes */}
            <DetailSidebarCard title="Detalhes" icon={Info}>
              <div className="space-y-3">
                <div>
                  <p className="text-[0.625rem] text-black/35 mb-0.5">Próximo follow-up</p>
                  <p className="text-[0.8125rem] font-medium">{formatDate(captacao.proxima_prospeccao)}</p>
                </div>
                <div>
                  <p className="text-[0.625rem] text-black/35 mb-0.5">Previsão</p>
                  <p className="text-[0.8125rem] font-medium">{formatDate(captacao.data_previsao)}</p>
                </div>
                <div>
                  <p className="text-[0.625rem] text-black/35 mb-0.5">Criado em</p>
                  <p className="text-[0.8125rem] font-medium">{formatDate(captacao.created_at)}</p>
                </div>
                <div>
                  <p className="text-[0.625rem] text-black/35 mb-0.5">Origem da oportunidade</p>
                  <p className="text-[0.8125rem] font-medium">{taxonomyLabel(origens, captacao.origem_oportunidade)}</p>
                </div>
                <div>
                  <p className="text-[0.625rem] text-black/35 mb-0.5">Canal planejado</p>
                  <p className="text-[0.8125rem] font-medium">{captacao.canal_planejado ? taxonomyLabel(canais, captacao.canal_planejado) : captacao.meio_contato || "Definir depois"}</p>
                </div>
                <div>
                  <p className="text-[0.625rem] text-black/35 mb-0.5">Contatos realizados</p>
                  <p className="text-[0.8125rem] font-medium">{interacoes.length}</p>
                </div>
              </div>
            </DetailSidebarCard>

            {/* Contatos */}
            {contatos.length > 0 && (
              <DetailSidebarCard title="Contatos" icon={Users} count={contatos.length}>
                <div className="space-y-2">
                  {contatos.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center gap-3 py-1.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gradient-to-br from-white via-black/[.035] to-black/[.10] text-[0.9375rem] font-semibold text-black/45">
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.75rem] font-semibold text-black/75">{c.nome}</p>
                        <p className="truncate text-[0.625rem] text-black/45">{c.cargo || "Cargo não informado"}</p>
                      </div>
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-black/25 hover:text-[#7259B5]" aria-label={`Enviar e-mail para ${c.nome}`}>
                          <Mail size={13} />
                        </a>
                      )}
                    </div>
                  ))}
                  {contatos.length > 5 && (
                    <p className="text-[0.6875rem] text-black/30 text-center pt-1">+{contatos.length - 5} outros contatos</p>
                  )}
                </div>
              </DetailSidebarCard>
            )}
          </div>
        </div>
        )}
      </DetailPageContent>

      {/* Edit Modal */}
      {atividadeConcluir && (
        <ConcluirAtividadeModal
          atividade={{ id: atividadeConcluir.id, nome: atividadeConcluir.nome, tipo: atividadeConcluir.tipo, captacao_id: atividadeConcluir.captacao_id }}
          onClose={() => setAtividadeConcluir(null)}
          onCompleted={() => { setAtividadeConcluir(null); void fetchData(); }}
        />
      )}
      {fechandoPeloStatus && (
        <FecharNegocioSheet
          captacao={captacao}
          empresaNome={captacao.empresa_pub?.nome || captacao.empresa_crm?.nome || "Empresa"}
          propostaAceitaId={propostas.find(p => p.status === "aceita")?.id ?? null}
          onClose={() => setFechandoPeloStatus(false)}
          onChanged={fetchData}
        />
      )}
      {showEditModal && (
        <NovaCaptacaoModal
          editData={{
            id: captacao.id,
            empresa_crm_id: captacao.empresa_crm_id,
            empresa_crm_nome: captacao.empresa_crm?.nome ?? null,
            projeto_id: captacao.projeto_id,
            projeto_nome: captacao.projeto?.nome ?? null,
            valor_solicitado: captacao.valor_solicitado,
            meio_contato: captacao.meio_contato,
            origem_oportunidade: captacao.origem_oportunidade,
            canal_planejado: captacao.canal_planejado,
            status: captacao.status,
            captador_id: captacao.captador_id,
            captador_externo_id: (captacao as any).captador_externo_id ?? null,
            supervisor_id: (captacao as any).supervisor_id ?? null,
            contato_empresa_id: (captacao as any).contato_empresa_id ?? null,
            proxima_prospeccao: captacao.proxima_prospeccao,
            data_previsao: captacao.data_previsao,
            potencial_fechamento: captacao.potencial_fechamento ?? "medio",
          }}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); fetchData(); }}
        />
      )}
      {leiMenuPos && (
        <StatusDropdown
          title="Tipo de patrocínio"
          options={leiOptions}
          current={captacao.lei ?? ""}
          position={leiMenuPos}
          onSelect={s => handleLeiChange(s || null)}
          onCreate={createLei}
          onClose={() => setLeiMenuPos(null)}
        />
      )}
      {prioMenuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPrioMenuPos(null)} />
          <div
            className="fixed z-50 overflow-hidden rounded-lg border bg-white shadow-xl"
            style={{ top: prioMenuPos.top, left: prioMenuPos.left, borderColor: "rgba(13,13,13,.10)", minWidth: "11.25rem" }}
          >
            {(["sem", "alta", "media", "baixa"] as const).map(p => {
              const isActive = (p === "sem" ? null : p) === captacao.prioridade;
              const it = p === "sem" ? null : PRIO_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePrioridadeChange(p === "sem" ? null : p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[0.75rem] transition hover:bg-black/[.03]"
                >
                  <span className="inline-flex items-center gap-1.5 text-black">
                    {it ? (
                      <span className="flex h-3 w-3 items-center justify-center rounded text-white" style={{ background: it.color }}>
                        <it.Icon size={8} strokeWidth={2.5} />
                      </span>
                    ) : (
                      <span className="h-3 w-3 flex-shrink-0 rounded-full border" style={{ borderColor: "rgba(13,13,13,.25)" }} />
                    )}
                    <span className={it ? "" : "text-black/60"}>{it?.label ?? "Sem prioridade"}</span>
                  </span>
                  {isActive && <Check size={12} className="text-[#7259B5] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
      {showRenovarModal && (
        <RenovarCicloModal
          tipo="captacao"
          id={id}
          anoNovo={(captacao.ciclo_ano ?? new Date(captacao.created_at).getFullYear()) + 1}
          resultadoNegativo={RESULTADO_NEGATIVO.has(captacao.status)}
          dataRetomadaInicial={captacao.retomada_programada_em}
          notaInicial={ciclos.find(ciclo => ciclo.estado === "programado")?.nota}
          resultadoLabel="Recusado"
          onClose={() => setShowRenovarModal(false)}
          onRenovado={() => { setShowRenovarModal(false); void fetchData(); }}
        />
      )}
    </div>
  );
}
