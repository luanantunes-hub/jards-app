"use client";
import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, AlignLeft, ArrowLeft, Check, ChevronDown, FolderOpen, Pencil, Plus, Calendar, BarChart2, TrendingUp, Users, FileText, Eye, ImageIcon, ImagePlus, FileSpreadsheet, BriefcaseBusiness, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { NovoProjetoModal } from "@/components/modals/NovoProjetoModal";
import { EditarObjetivoModal } from "@/components/modals/EditarObjetivoModal";
import { NovoResultadoModal, type EditDataResultado } from "@/components/modals/NovoResultadoModal";
import { CotasProjetoManager, type VendaPatrocinioComEmpresa } from "@/components/CotasProjetoManager";
import { PROJECT_ICON_COLORS, PROJECT_ICON_OPTIONS, ProjectIdentity } from "@/components/ui/ProjectIdentity";
import { AbrirProducaoBotao } from "@/components/producao/AbrirProducaoBotao";
import { podeAbrirProducao } from "@/lib/producao/abrir";
import { TextoRecolhivel } from "@/components/ui/TextoRecolhivel";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { BarraCaptacao, ICONE_CAPTACAO, Indicador, MARCA_CAPTACAO } from "@/components/ui/IndicadoresFinanceiros";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Proposta, CotaPatrocinio } from "@/lib/supabase/types";
import { PitchWorkspace } from "@/components/projects/PitchWorkspace";
import { ProjetoOrcamentoManager } from "@/components/projects/ProjetoOrcamentoManager";
import { sponsorshipTypeColor, sponsorshipTypeLabel } from "@/lib/projects/sponsorship";
import { DeliveriesPanel } from "@/components/customer-success/DeliveriesPanel";
import { ProjetoDocumentosManager } from "@/components/projects/ProjetoDocumentosManager";
import { TextosManager } from "@/components/projects/TextosManager";
import { PropostaOperacionalModal } from "@/components/projects/PropostaOperacionalModal";
import { TiposPatrocinioSheet } from "@/components/projects/TiposPatrocinioSheet";
import { NovaAtividadeModal } from "@/components/modals/NovaAtividadeModal";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { ProjetoSolicitacoes } from "@/components/proponentes/ProjetoSolicitacoes";
import { escalaUi } from "@/lib/escala-ui";

type Projeto = {
  id: string;
  account_id: string;
  organization_id: string;
  proponente_id: string | null;
  nome: string;
  descricao: string | null;
  valor_alvo: number | null;
  proponente_nome: string | null;
  proponente_cidade: string | null;
  proponente_estado: string | null;
  capa_url: string | null;
  capa_position_y: number | null;
  identidade_tipo: "padrao" | "icone" | "emoji" | "logo";
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  fase: "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";
  ponto_focal_id: string | null; mecanismo: string | null; tipos_patrocinio: string[]; data_inicio: string | null; data_fim: string | null;
  cidade: string | null; estado: string | null; abrangencia: string | null; areas_culturais: string[];
  valor_garantido: number; tags: string[]; visibilidade: "equipe" | "restrita"; status_operacional: "ativo" | "pausado" | "arquivado";
  ponto_focal: { full_name: string | null } | null;
  created_at: string;
};

type CaptacaoLinked = {
  id: string;
  titulo: string | null;
  status: string;
  valor_solicitado: number | null;
  empresa_crm: { nome: string } | null;
  empresa_crm_id: string | null;
  meio_contato: string | null;
  captador_id: string | null;
  captador_externo_id: string | null;
  supervisor_id: string | null;
  contato_empresa_id: string | null;
  proxima_prospeccao: string | null;
  data_previsao: string | null;
  potencial_fechamento: string | null;
};

type InscricaoLinked = {
  id: string;
  lei: string | null;
  status: string;
  data_submissao: string | null;
  empresa_crm_id: string | null;
  empresa_crm: { nome: string } | null;
  valor: number | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  data_resultado: string | null;
  potencial_fechamento: string | null;
  responsavel_tipo: string | null;
  responsavel_id: string | null;
  cota_id: string | null;
};

type Resultado = {
  id: string;
  valor_captado: number | null;
  valor_executado: number | null;
  publico_alcancado: number | null;
  eventos_realizados: number | null;
  retorno_midia_est: number | null;
  observacoes: string | null;
  data_resultado: string | null;
};

const STATUS_CAP: Record<string, { label: string; color: string }> = {
  prospeccao:       { label: "Prospecção",  color: "rgba(13,13,13,.40)" },
  primeiro_contato: { label: "1º Contato",  color: "#7259B5" },
  proposta_enviada: { label: "Proposta",    color: "#2D72B0" },
  em_negociacao:    { label: "Negociação",  color: "#B07A14" },
  aprovado:         { label: "Aprovado",    color: "#2E8932" },
  recusado:         { label: "Recusado",    color: "#D94E4E" },
  renovacao:        { label: "Renovação",   color: "#2D72B0" },
};

const STATUS_INSC: Record<string, { label: string; color: string }> = {
  rascunho:   { label: "Rascunho",   color: "rgba(13,13,13,.40)" },
  inscrito:   { label: "Inscrito",   color: "#2D72B0" },
  habilitado: { label: "Habilitado", color: "#2D72B0" },
  aprovado:   { label: "Aprovado",   color: "#2E8932" },
  reprovado:  { label: "Reprovado",  color: "#D94E4E" },
  aguardando: { label: "Aguardando", color: "#B07A14" },
};

const STATUS_PROPOSTA: Record<string, { label: string; color: string }> = {
  rascunho:    { label: "Em elaboração", color: "rgba(13,13,13,.40)" },
  enviada:     { label: "Legado",        color: "#2D72B0" },
  visualizada: { label: "Legado",        color: "#2D72B0" },
  aceita:      { label: "Validada",      color: "#2E8932" },
  recusada:    { label: "Descartada",    color: "#D94E4E" },
  expirada:    { label: "Expirada",    color: "rgba(13,13,13,.40)" },
  arquivada:   { label: "Arquivada",   color: "rgba(13,13,13,.40)" },
};

const fmtValor = formatarValorCurto;

function formatCurrencyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, "");
  const parts = cleaned.split(",");
  const intPart = parts[0].replace(/\D/g, "");
  if (!intPart && parts.length <= 1) return "";
  const decPart = parts.length > 1 ? parts[1].replace(/\D/g, "").slice(0, 2) : "";
  const intFormatted = intPart ? parseInt(intPart, 10).toLocaleString("pt-BR") : "";
  if (parts.length > 1) return intFormatted + "," + decPart;
  if (raw.endsWith(",")) return intFormatted + ",";
  return intFormatted;
}

function fmtInt(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR");
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}


type TabKey = "overview" | "captacao" | "orcamento" | "documentos" | "proposta" | "pitch" | "textos" | "proponente";
const TAB_KEYS: TabKey[] = ["overview", "captacao", "orcamento", "documentos", "proposta", "pitch", "textos", "proponente"];

export default function ProjetoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { etiquetas, etiquetasInscricao } = useEtiquetas();
  const etiquetasCaptacao = Object.fromEntries(etiquetas.map(etiqueta => [etiqueta.key, etiqueta]));
  const etiquetasEdital = Object.fromEntries(etiquetasInscricao.map(etiqueta => [etiqueta.key, etiqueta]));

  const [projeto, setProjeto]         = useState<Projeto | null>(null);
  const [captacoes, setCaptacoes]     = useState<CaptacaoLinked[]>([]);
  const [inscricoes, setInscricoes]   = useState<InscricaoLinked[]>([]);
  const [resultados, setResultados]   = useState<Resultado[]>([]);
  const [propostas, setPropostas]     = useState<Proposta[]>([]);
  const [cotas, setCotas]             = useState<CotaPatrocinio[]>([]);
  const [vendasPatrocinio, setVendasPatrocinio] = useState<VendaPatrocinioComEmpresa[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [editingObjetivo, setEditingObjetivo] = useState(false);
  const [editingTipos, setEditingTipos] = useState(false);
  const [showNovaAtividade, setShowNovaAtividade] = useState(false);
  const [capaUrl, setCapaUrl]         = useState<string | null>(null);
  const [capaPositionY, setCapaPositionY]   = useState(50);
  const [repoMode, setRepoMode]             = useState(false);
  const [repoOrigY, setRepoOrigY]           = useState(50);
  const repoDragRef = useRef<{ startMouseY: number; startPosY: number } | null>(null);
  const [capaUploading, setCapaUploading] = useState(false);
  const capaInputRef                  = useRef<HTMLInputElement>(null);
  const [showResultado, setShowResultado]         = useState(false);
  const [editingResultado, setEditingResultado]   = useState<Resultado | null>(null);
  const tabParam = searchParams.get("tab");
  const [tab, setTab]                               = useState<TabKey>(
    TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "overview"
  );
  const [proximaAtividade, setProximaAtividade] = useState<{ id: string; nome: string; data_prevista: string | null } | null>(null);
  const [showPropostaModal, setShowPropostaModal] = useState(false);
  const [editingProposta, setEditingProposta] = useState<Proposta | null>(null);
  const [captacaoTab, setCaptacaoTab] = useState<"objetivo" | "negociacoes" | "inscricoes" | "entregas">("objetivo");
  const [propostaTab, setPropostaTab]  = useState<"cotas" | "propostas">("cotas");
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [fasePop, setFasePop] = useState<{ top: number; left: number } | null>(null);
  const [showNovaCaptacao, setShowNovaCaptacao] = useState(false);
  const [showNovaInscricao, setShowNovaInscricao] = useState(false);
  const [editingCaptacao, setEditingCaptacao] = useState<CaptacaoLinked | null>(null);
  const [editingInscricao, setEditingInscricao] = useState<InscricaoLinked | null>(null);
  const [orcamentoTotal, setOrcamentoTotal] = useState(0);
  const identityRef = useRef<HTMLDivElement>(null);
  const identityLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!identityOpen) return;
    const close = (event: MouseEvent) => { if (!identityRef.current?.contains(event.target as Node)) setIdentityOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [identityOpen]);

  async function fetchAll() {
    setLoading(true);
    const [
      { data: proj },
      { data: caps },
      { data: inscs },
      { data: ress },
      { data: props },
      { data: cot },
      { data: vendas },
      { data: nextActivity },
    ] = await Promise.all([
      (supabase as any).from("projetos_crm").select("*, ponto_focal:profiles!ponto_focal_id(full_name)").eq("id", id).single(),
      supabase
        .from("captacoes")
        .select("id, titulo, status, valor_solicitado, empresa_crm:empresas_crm!empresa_crm_id(nome), empresa_crm_id, meio_contato, captador_id, captador_externo_id, supervisor_id, contato_empresa_id, proxima_prospeccao, data_previsao, potencial_fechamento")
        .eq("projeto_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("editais_user")
        .select("id, status, data_submissao, lei, empresa_crm_id, empresa_crm:empresas_crm!empresa_crm_id(nome), valor, data_abertura, data_fechamento, data_resultado, potencial_fechamento, responsavel_tipo, responsavel_id, cota_id")
        .eq("projeto_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("resultados_projeto")
        .select("id, valor_captado, valor_executado, publico_alcancado, eventos_realizados, retorno_midia_est, observacoes, data_resultado")
        .eq("projeto_id", id)
        .order("data_resultado", { ascending: false }),
      supabase
        .from("propostas")
        .select("*")
        .eq("projeto_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("cotas_patrocinio")
        .select("*")
        .eq("projeto_id", id)
        .order("ordem"),
      supabase
        .from("vendas_patrocinio")
        .select("id,organization_id,projeto_id,proposta_id,captacao_id,cota_id,empresa_crm_id,empresa_id,quantidade,valor_vendido,vendida_em,created_by,created_at,empresa_crm:empresas_crm!empresa_crm_id(nome),empresa_pub:empresas!empresa_id(nome)")
        .eq("projeto_id", id)
        .order("vendida_em", { ascending: false }),
      (supabase as any).from("atividades").select("id, nome, data_prevista").eq("projeto_id", id).eq("feita", false).not("data_prevista", "is", null).order("data_prevista").limit(1).maybeSingle(),
    ]);

    if (proj) {
      const p = proj as Projeto;
      setProjeto(p);
      setCapaUrl(p.capa_url);
      const posY = p.capa_position_y ?? 50;
      setCapaPositionY(posY);
      setRepoOrigY(posY);
    }
    if (caps) setCaptacoes(caps as unknown as CaptacaoLinked[]);
    if (inscs) setInscricoes(inscs as unknown as InscricaoLinked[]);
    if (ress) setResultados(ress as Resultado[]);
    if (props) setPropostas(props as Proposta[]);
    if (cot) setCotas(cot as CotaPatrocinio[]);
    setVendasPatrocinio((vendas as VendaPatrocinioComEmpresa[] | null) ?? []);
    if (nextActivity) setProximaAtividade(nextActivity);
    setLoading(false);
  }

  async function handleCapaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projeto) return;
    setCapaUploading(true);
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const MAX_W = 1600;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        await (supabase as any).from("projetos_crm").update({ capa_url: dataUrl, capa_position_y: 50 }).eq("id", projeto.id);
        setCapaUrl(dataUrl);
        setCapaPositionY(50);
        setRepoOrigY(50);
      } finally {
        setCapaUploading(false);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); setCapaUploading(false); };
    img.src = objectUrl;
    e.target.value = "";
  }

  async function saveIdentity(tipo: Projeto["identidade_tipo"], valor: string | null, logoUrl: string | null = null, cor: string | null = null) {
    if (!projeto) return;
    setIdentitySaving(true);
    const { error } = await (supabase as any).from("projetos_crm").update({ identidade_tipo: tipo, identidade_valor: valor, identidade_logo_url: logoUrl, identidade_cor: cor }).eq("id", projeto.id);
    if (!error) {
      setProjeto(current => current ? { ...current, identidade_tipo: tipo, identidade_valor: valor, identidade_logo_url: logoUrl, identidade_cor: cor } : current);
      setIdentityOpen(false);
    } else {
      console.error("Erro ao salvar identidade:", error.message);
    }
    setIdentitySaving(false);
  }

  function handleIdentityLogo(file?: File) {
    if (!file || !projeto) return;
    setIdentitySaving(true);
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const size = Math.min(image.width, image.height);
      const sx = (image.width - size) / 2;
      const sy = (image.height - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setIdentitySaving(false); return; }
      ctx.drawImage(image, sx, sy, size, size, 0, 0, 512, 512);
      await saveIdentity("logo", null, canvas.toDataURL("image/webp", .88));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); setIdentitySaving(false); };
    image.src = objectUrl;
  }

  async function handleCapaRemove() {
    if (!projeto) return;
    const { error } = await (supabase as any).from("projetos_crm").update({ capa_url: null, capa_position_y: 50 }).eq("id", projeto.id);
    if (error) { console.error("Erro ao remover capa:", error.message); return; }
    setCapaUrl(null);
    setCapaPositionY(50);
    setRepoMode(false);
  }

  function handleRepoDragStart(e: React.MouseEvent) {
    e.preventDefault();
    repoDragRef.current = { startMouseY: e.clientY, startPosY: capaPositionY };
  }

  useEffect(() => {
    if (!repoMode) return;
    function onMove(e: MouseEvent) {
      if (!repoDragRef.current) return;
      const { startMouseY, startPosY } = repoDragRef.current;
      // arrastar para cima revela a parte de baixo da imagem (Y aumenta)
      const newY = Math.max(0, Math.min(100, startPosY + (startMouseY - e.clientY) * 0.35));
      setCapaPositionY(newY);
    }
    function onUp() { repoDragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [repoMode, capaPositionY]);

  async function handleSavePosition() {
    if (!projeto) return;
    await (supabase as any).from("projetos_crm").update({ capa_position_y: Math.round(capaPositionY) }).eq("id", projeto.id);
    setRepoOrigY(Math.round(capaPositionY));
    setRepoMode(false);
  }

  function handleCancelReposition() {
    setCapaPositionY(repoOrigY);
    setRepoMode(false);
  }

  useEffect(() => { fetchAll(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <DetailPageSkeleton />;

  if (!projeto) {
    return <DetailNotFound title="Projeto não encontrado" backHref="/projetos" backLabel="Projetos" />;
  }

  const captadoAprovado = captacoes
    .filter(c => c.status === "aprovado")
    .reduce((s, c) => s + (c.valor_solicitado ?? 0), 0);
  const captadoTotal = captacoes
    .filter(c => c.status !== "recusado")
    .reduce((s, c) => s + (c.valor_solicitado ?? 0), 0);
  const ultimoResultado = resultados[0] ?? null;
  const valorCaptadoDisplay = ultimoResultado?.valor_captado != null ? ultimoResultado.valor_captado : captadoAprovado;
  const FASES = [
    { value: "planejamento", label: "Planejamento", color: "#888888", Icon: Calendar },
    { value: "captacao",     label: "Captação",     color: "#7259B5", Icon: TrendingUp },
    { value: "execucao",     label: "Execução",     color: "#2D72B0", Icon: Zap },
    { value: "prestacao",    label: "Prestação",    color: "#B07A14", Icon: FileText },
    { value: "concluido",    label: "Concluído",    color: "#2E8932", Icon: Check },
  ] as const;
  const faseMeta = FASES.find(f => f.value === projeto.fase) ?? FASES[0];

  async function updateFase(novaFase: string) {
    if (!projeto) return;
    setFasePop(null);
    setProjeto(prev => prev ? { ...prev, fase: novaFase as Projeto["fase"] } : prev);
    await (supabase as any).from("projetos_crm").update({ fase: novaFase }).eq("id", projeto.id);
  }

  return (
    <div className="min-h-full">

      {/* Cover — só aparece quando há imagem */}
      {capaUrl && (
        <div className="mx-auto w-full max-w-pagina px-4 pt-4 sm:px-6 lg:px-10">
         <div
          className="group relative h-[5.5rem] flex-shrink-0 select-none overflow-hidden rounded border sm:h-[6.5rem]"
          style={{ borderColor: "rgba(13,13,13,.08)", cursor: repoMode ? "ns-resize" : "default" }}
          onMouseDown={repoMode ? handleRepoDragStart : undefined}
         >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capaUrl}
            alt="Capa do projeto"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ objectPosition: `center ${capaPositionY}%`, transition: repoMode ? "none" : "object-position .2s" }}
          />
          {!repoMode && <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-black/10" />}

          {/* Overlay de reposicionamento */}
          {repoMode && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,.22)", backdropFilter: "blur(0px)" }} />
          )}

          {/* Botões no canto inferior direito */}
          <div className={`absolute bottom-2 left-2 right-2 flex items-center justify-end gap-1.5 overflow-x-auto transition-opacity duration-200 ${repoMode ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"}`} onMouseDown={e => e.stopPropagation()}>
            <input ref={capaInputRef} type="file" accept="image/*" className="hidden" onChange={handleCapaUpload} />

            {repoMode ? (
              <>
                <button onClick={handleCancelReposition}
                  className="shrink-0 rounded px-3 py-1.5 text-[0.625rem] font-medium transition"
                  style={{ background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,.70)" }}>
                  Cancelar
                </button>
                <button onClick={handleSavePosition}
                  className="shrink-0 rounded px-3 py-1.5 text-[0.625rem] font-medium text-white transition hover:opacity-90"
                  style={{ background: "#2E8932" }}>
                  Salvar posição
                </button>
              </>
            ) : (
              <>
                <button onClick={handleCapaRemove}
                  className="flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-[0.625rem] font-medium transition"
                  style={{ background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,.60)" }}>
                  Remover capa
                </button>
                <button onClick={() => { setRepoMode(true); setRepoOrigY(capaPositionY); }}
                  className="flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-[0.625rem] font-medium transition"
                  style={{ background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,.75)" }}>
                  Reposicionar
                </button>
                <button onClick={() => capaInputRef.current?.click()} disabled={capaUploading}
                  className="flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-[0.625rem] font-medium transition"
                  style={{ background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)", color: capaUploading ? "rgba(255,255,255,.40)" : "rgba(255,255,255,.80)" }}>
                  <ImageIcon size={11} />
                  {capaUploading ? "Enviando…" : "Trocar capa"}
                </button>
              </>
            )}
          </div>
         </div>
        </div>
      )}

      {showNovaAtividade && projeto && (
        <NovaAtividadeModal
          onClose={() => setShowNovaAtividade(false)}
          onSaved={() => { setShowNovaAtividade(false); fetchAll(); }}
          prefill={{ projeto_id: projeto.id }}
        />
      )}

      {showNovaCaptacao && projeto && (
        <NovaCaptacaoModal
          onClose={() => setShowNovaCaptacao(false)}
          onSaved={() => { setShowNovaCaptacao(false); fetchAll(); }}
          initialProjetoId={projeto.id}
          initialProjetoNome={projeto.nome}
        />
      )}

      {editingCaptacao && projeto && (
        <NovaCaptacaoModal
          onClose={() => setEditingCaptacao(null)}
          onSaved={() => { setEditingCaptacao(null); fetchAll(); }}
          editData={{
            id: editingCaptacao.id,
            empresa_crm_id: editingCaptacao.empresa_crm_id,
            empresa_crm_nome: editingCaptacao.empresa_crm?.nome ?? null,
            projeto_id: projeto.id,
            projeto_nome: projeto.nome,
            valor_solicitado: editingCaptacao.valor_solicitado,
            meio_contato: editingCaptacao.meio_contato as any,
            status: editingCaptacao.status as any,
            captador_id: editingCaptacao.captador_id,
            captador_externo_id: editingCaptacao.captador_externo_id,
            supervisor_id: editingCaptacao.supervisor_id,
            contato_empresa_id: editingCaptacao.contato_empresa_id,
            proxima_prospeccao: editingCaptacao.proxima_prospeccao,
            data_previsao: editingCaptacao.data_previsao,
            potencial_fechamento: editingCaptacao.potencial_fechamento as any,
          }}
        />
      )}

      {showNovaInscricao && projeto && (
        <NovaInscricaoModal
          onClose={() => setShowNovaInscricao(false)}
          onSaved={() => { setShowNovaInscricao(false); fetchAll(); }}
          initialProjetoId={projeto.id}
          initialProjetoNome={projeto.nome}
        />
      )}

      {editingInscricao && projeto && (
        <NovaInscricaoModal
          onClose={() => setEditingInscricao(null)}
          onSaved={() => { setEditingInscricao(null); fetchAll(); }}
          editData={{
            id: editingInscricao.id,
            empresa_crm_id: editingInscricao.empresa_crm_id,
            empresa_crm_nome: editingInscricao.empresa_crm?.nome ?? null,
            projeto_id: projeto.id,
            projeto_nome: projeto.nome,
            cota_id: editingInscricao.cota_id,
            lei: editingInscricao.lei,
            valor: editingInscricao.valor,
            status: editingInscricao.status as any,
            data_abertura: editingInscricao.data_abertura,
            data_fechamento: editingInscricao.data_fechamento,
            data_resultado: editingInscricao.data_resultado,
            potencial_fechamento: editingInscricao.potencial_fechamento as any,
            responsavel_tipo: editingInscricao.responsavel_tipo as any,
            responsavel_id: editingInscricao.responsavel_id,
          }}
        />
      )}

      {editingTipos && projeto && (
        <TiposPatrocinioSheet
          projetoId={projeto.id}
          initialTypes={projeto.tipos_patrocinio ?? []}
          onClose={() => setEditingTipos(false)}
          onSaved={fetchAll}
        />
      )}

      {editing && (
        <NovoProjetoModal
          editData={{
            id:                projeto.id,
            nome:              projeto.nome,
            descricao:         projeto.descricao,
            valor_alvo:        projeto.valor_alvo,
            proponente_id:     projeto.proponente_id,
            proponente_nome:   projeto.proponente_nome,
            proponente_cidade: projeto.proponente_cidade,
            proponente_estado: projeto.proponente_estado,
            identidade_tipo: projeto.identidade_tipo,
            identidade_valor: projeto.identidade_valor,
            identidade_logo_url: projeto.identidade_logo_url,
            identidade_cor: projeto.identidade_cor,
            fase: projeto.fase, ponto_focal_id: projeto.ponto_focal_id, mecanismo: projeto.mecanismo,
            tipos_patrocinio: projeto.tipos_patrocinio,
            data_inicio: projeto.data_inicio, data_fim: projeto.data_fim, cidade: projeto.cidade, estado: projeto.estado,
            abrangencia: projeto.abrangencia, areas_culturais: projeto.areas_culturais, valor_garantido: projeto.valor_garantido,
            tags: projeto.tags, visibilidade: projeto.visibilidade,
          }}
          onClose={() => setEditing(false)}
          onSaved={fetchAll}
        />
      )}

      {editingObjetivo && (
        <EditarObjetivoModal
          projetoId={projeto.id}
          valorAtual={projeto.valor_alvo}
          onClose={() => setEditingObjetivo(false)}
          onSaved={fetchAll}
        />
      )}
      {(showResultado || editingResultado) && (
        <NovoResultadoModal
          projetoId={projeto.id}
          cotas={cotas}
          propostas={propostas}
          editData={editingResultado ? {
            id:                editingResultado.id,
            valor_captado:     editingResultado.valor_captado,
            valor_executado:   editingResultado.valor_executado,
            publico_alcancado: editingResultado.publico_alcancado,
            eventos_realizados: editingResultado.eventos_realizados,
            retorno_midia_est: editingResultado.retorno_midia_est,
            observacoes:       editingResultado.observacoes,
            data_resultado:    editingResultado.data_resultado,
          } : undefined}
          onClose={() => { setShowResultado(false); setEditingResultado(null); }}
          onSaved={fetchAll}
        />
      )}
      {showPropostaModal && (
        <PropostaOperacionalModal
          projetoId={projeto.id}
          projetoNome={projeto.nome}
          proposta={editingProposta}
          cotas={cotas}
          captacoes={captacoes.map(captacao => ({
            id: captacao.id,
            // Sem título, a negociação se identifica pela empresa.
            titulo: captacao.titulo || captacao.empresa_crm?.nome || "Negociação",
            complemento: captacao.titulo ? captacao.empresa_crm?.nome : null,
          }))}
          inscricoes={inscricoes.map(inscricao => ({
            id: inscricao.id,
            titulo: inscricao.empresa_crm?.nome || "Inscrição sem empresa",
            complemento: inscricao.lei,
          }))}
          onClose={() => { setShowPropostaModal(false); setEditingProposta(null); }}
          onSaved={() => { setShowPropostaModal(false); setEditingProposta(null); fetchAll(); }}
        />
      )}

      {/* Header */}
      <div className="border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
        {/* input compartilhado com a capa quando não há imagem */}
        {!capaUrl && <input ref={capaInputRef} type="file" accept="image/*" className="hidden" onChange={handleCapaUpload} />}

        <div className="mb-7 flex items-center justify-between">
          <Link href="/projetos" className="inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65">
            <ArrowLeft size={14} /> Projetos
          </Link>
          {!capaUrl && (
            <button onClick={() => capaInputRef.current?.click()} disabled={capaUploading}
              className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-black/35 transition hover:text-black/60">
              <ImageIcon size={12} />
              {capaUploading ? "Enviando…" : "Adicionar capa"}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div ref={identityRef} className="relative flex-shrink-0 sm:mt-0.5">
              <input ref={identityLogoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { handleIdentityLogo(event.target.files?.[0]); event.target.value = ""; }} />
              <button type="button" onClick={() => setIdentityOpen(open => !open)} aria-label="Alterar identidade do projeto" aria-expanded={identityOpen} className="group relative rounded outline-none ring-[#7259B5]/25 focus-visible:ring-2">
                <ProjectIdentity nome={projeto.nome} tipo={projeto.identidade_tipo} valor={projeto.identidade_valor} logoUrl={projeto.identidade_logo_url} cor={projeto.identidade_cor} size="md" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded border border-black/10 bg-white text-black/45 shadow-sm opacity-0 transition group-hover:opacity-100 group-hover:text-[#7259B5]"><Pencil size={8}/></span>
              </button>
              {identityOpen && <div className="absolute left-0 top-12 z-30 w-[17.875rem] rounded bg-white p-3 border elevacao-1">
                <div className="px-1 pb-3"><p className="text-[0.8125rem] font-semibold text-black/70">Identidade do projeto</p></div>
                <div className="grid grid-cols-4 gap-1.5">
                  {PROJECT_ICON_OPTIONS.map(({ key, label, Icon }) => {
                    const active = projeto.identidade_tipo === "icone" && projeto.identidade_valor === key;
                    return <button key={key} type="button" title={label} disabled={identitySaving} onClick={() => void saveIdentity("icone", key, null, projeto.identidade_cor ?? PROJECT_ICON_COLORS[0].cor)} className={`flex h-12 items-center justify-center rounded border bg-white transition hover:bg-black/[.04] disabled:opacity-40 ${active ? "border-[#7259B5]/45 text-[#7259B5]" : "border-black/[.08] text-black/40"}`}><Icon size={17}/></button>;
                  })}
                  <button type="button" title="Identidade padrão" disabled={identitySaving} onClick={() => void saveIdentity("padrao", null)} className={`flex h-12 items-center justify-center rounded border bg-white transition hover:bg-black/[.04] disabled:opacity-40 ${projeto.identidade_tipo === "padrao" ? "border-[#7259B5]/45 text-[#7259B5]" : "border-black/[.08] text-black/40"}`}><FolderOpen size={17}/></button>
                </div>
                {projeto.identidade_tipo === "icone" && (
                  <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <p className="px-1 pb-2 text-[0.625rem] font-semibold text-black/40">Cor do ícone</p>
                    <div className="grid grid-cols-8 gap-1.5">
                      {PROJECT_ICON_COLORS.map(({ key, label, cor }) => {
                        const active = (projeto.identidade_cor ?? PROJECT_ICON_COLORS[0].cor) === cor;
                        return <button key={key} type="button" title={label} disabled={identitySaving} onClick={() => void saveIdentity("icone", projeto.identidade_valor ?? PROJECT_ICON_OPTIONS[0].key, null, cor)} className={`flex h-7 items-center justify-center rounded border bg-white transition hover:scale-105 disabled:opacity-40 ${active ? "border-[#7259B5]/60 ring-1 ring-[#7259B5]/25" : "border-black/[.08]"}`}><span className="h-3.5 w-3.5 rounded-full" style={{ background: cor }} /></button>;
                      })}
                    </div>
                  </div>
                )}
                <button type="button" disabled={identitySaving} onClick={() => identityLogoInputRef.current?.click()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded border border-[#7259B5]/25 bg-white text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-40"><ImagePlus size={14}/>{identitySaving ? "Salvando…" : projeto.identidade_tipo === "logo" ? "Trocar logo" : "Usar logo"}</button>
              </div>}
            </div>
            <div className="min-w-0">
              {(projeto.status_operacional === "pausado" || projeto.status_operacional === "arquivado") && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {projeto.status_operacional === "pausado" && (
                    <span className="rounded border border-[#B07A14]/25 bg-white px-2 py-1 text-[0.625rem] font-medium text-[#B07A14]">Pausado</span>
                  )}
                  {projeto.status_operacional === "arquivado" && (
                    <span className="rounded border border-black/[.10] bg-white px-2 py-1 text-[0.625rem] font-medium text-black/40">Arquivado</span>
                  )}
                </div>
              )}
              <h1 className="max-w-4xl text-balance text-[2rem] font-semibold leading-[1.04] tracking-[-.045em] text-[#282525] sm:text-[2.375rem]">{projeto.nome}</h1>
              {projeto.proponente_nome && (
                <p className="mt-2 text-[0.875rem] text-black/50">
                  {projeto.proponente_nome}
                  {(projeto.proponente_cidade || projeto.proponente_estado) && (
                    <span className="text-black/25"> · {[projeto.proponente_cidade, projeto.proponente_estado].filter(Boolean).join(", ")}</span>
                  )}
                </p>
              )}
              {projeto.descricao?.trim() && (
                <TextoRecolhivel texto={projeto.descricao.trim()} className="mt-3 max-w-[42rem] text-[0.9375rem] leading-6 text-black/45" />
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <button
              onClick={() => setEditing(true)}
              className="flex h-11 items-center gap-2 rounded border bg-white px-4 text-[0.75rem] font-medium text-black/50 transition hover:bg-black/[.04] active:scale-[.98]"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            >
              <Pencil size={14} /> Editar
            </button>
            <AbrirProducaoBotao projetoId={projeto.id} projetoNome={projeto.nome} organizationId={projeto.organization_id} elegivel={podeAbrirProducao({ vendas: vendasPatrocinio.length, inscricoesAprovadas: inscricoes.filter(item => item.status === "aprovado").length })} />
          </div>
        </div>

        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white" style={{ borderColor: "rgba(13,13,13,.06)" }}>
       <nav aria-label="Seções do projeto" className="mx-auto flex max-w-pagina items-center gap-1.5 overflow-x-auto px-4 py-3 sm:px-6 lg:px-10">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} icon={<Eye size={12} />}>
          Visão geral
        </TabBtn>
        <TabBtn active={tab === "captacao"} onClick={() => setTab("captacao")} icon={<BarChart2 size={12} />}>
          Captação
        </TabBtn>
        <TabBtn active={tab === "proposta"} onClick={() => setTab("proposta")} icon={<BriefcaseBusiness size={12} />}>
          Cotas
          {(propostas.length + cotas.length) > 0 && (
            <span className="ml-1.5 w-4 h-4 rounded bg-black/[.06] text-black/55 text-[0.5625rem] font-bold flex items-center justify-center">
              {propostas.length + cotas.length}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "orcamento"} onClick={() => setTab("orcamento")} icon={<FileSpreadsheet size={12} />}>
          Orçamento
        </TabBtn>
        <TabBtn active={tab === "documentos"} onClick={() => setTab("documentos")} icon={<FileText size={12} />}>
          Documentos
        </TabBtn>
        <TabBtn active={tab === "pitch"} onClick={() => setTab("pitch")} icon={<TrendingUp size={12} />}>
          Pitch
        </TabBtn>
        <TabBtn active={tab === "textos"} onClick={() => setTab("textos")} icon={<AlignLeft size={12} />}>
          Textos
        </TabBtn>
        <TabBtn active={tab === "proponente"} onClick={() => setTab("proponente")} icon={<Users size={12} />}>
          Proponente
        </TabBtn>
       </nav>
      </div>

      {/* Content */}
      <div>
       <main className="mx-auto w-full max-w-pagina px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-10">
        {tab === "pitch" && <PitchWorkspace projectId={projeto.id} projectName={projeto.nome} />}
        {tab === "textos" && <TextosManager projetoId={projeto.id} />}
        {tab === "proponente" && <ProjetoSolicitacoes projetoId={projeto.id} isOrganizacao proponenteNome={projeto.proponente_nome || "o proponente"} />}
        {tab === "overview" && (() => {
          const faltante = Math.max(0, (projeto.valor_alvo ?? 0) - valorCaptadoDisplay - (projeto.valor_garantido ?? 0));
          const progress = projeto.valor_alvo ? Math.min(100, Math.round(((valorCaptadoDisplay + (projeto.valor_garantido ?? 0)) / projeto.valor_alvo) * 100)) : 0;
          const confirmado = valorCaptadoDisplay + (projeto.valor_garantido ?? 0);
          const negociacao = Math.max(0, captadoTotal - captadoAprovado);
          const alerts = [
            !projeto.ponto_focal_id ? "Defina um responsável pelo projeto" : null,
            projeto.status_operacional === "pausado" ? "O projeto está pausado" : null,
            faltante > 0 && captacoes.length === 0 ? "O objetivo ainda não possui fontes de captação" : null,
          ].filter(Boolean) as string[];
          return <div className="space-y-6">
            {/* Banner — próximo passo */}
            {proximaAtividade ? (
              <div className="flex items-center justify-between gap-4 rounded border px-5 py-4" style={{ background: "rgba(13,13,13,.018)", borderColor: "rgba(13,13,13,.08)" }}>
                <div>
                  <p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35 mb-1.5">Próximo passo</p>
                  <p className="text-[0.875rem] font-semibold text-black/75">{proximaAtividade.nome}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-black/35 flex items-center gap-1"><Calendar size={9} />{fmtDate(proximaAtividade.data_prevista)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setShowNovaAtividade(true)} className="flex items-center gap-1 rounded border border-black/[.15] bg-white px-3 py-1.5 text-[0.6875rem] font-medium text-black/60 transition hover:bg-black/[.04]"><Plus size={11} /> Nova</button>
                  <Link href="/atividades" className="text-[0.6875rem] font-medium text-black/40 transition hover:text-black/65">Ver todas →</Link>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded border px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.09)", borderStyle: "dashed" }}>
                <p className="text-[0.75rem] text-black/35">Nenhuma atividade futura programada para este projeto.</p>
                <button type="button" onClick={() => setShowNovaAtividade(true)} className="shrink-0 text-[0.6875rem] font-medium text-[#7259B5] transition hover:text-[#5a45a0]">Adicionar</button>
              </div>
            )}

            {/* Hero financeiro */}
            <div className="rounded border bg-white p-6 sm:p-7" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-[0.6875rem] font-medium text-black/40 mb-2">Captado do objetivo</p>
                  <p className="text-[3.25rem] font-semibold tracking-[-.045em] tabular-nums leading-none text-black/80">
                    {progress}<span className="text-[1.875rem] text-black/35 ml-1">%</span>
                  </p>
                  {projeto.valor_alvo && <p className="mt-2 text-[0.75rem] tabular-nums text-black/35" title={formatarValorCompleto(projeto.valor_alvo)}>de {fmtValor(projeto.valor_alvo)}</p>}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setFasePop(prev => prev ? null : { top: r.bottom + 6, left: Math.min(r.right - 272 * escalaUi(), window.innerWidth - 280 * escalaUi()) });
                    }}
                    className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-[0.6875rem] font-medium transition hover:opacity-80"
                    style={{ borderColor: faseMeta.color + "47", color: faseMeta.color, background: "white" }}
                  >
                    <faseMeta.Icon size={12} />{faseMeta.label}
                    <ChevronDown size={11} />
                  </button>
                  {fasePop && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setFasePop(null)} />
                      <div
                        className="fixed z-50 rounded bg-white p-2 border elevacao-1"
                        style={{ top: fasePop.top, left: fasePop.left, borderColor: "rgba(13,13,13,.09)", width: "17rem" }}
                      >
                        <div className="grid grid-cols-3 gap-1.5">
                          {FASES.map(f => {
                            const active = f.value === projeto.fase;
                            return (
                              <button
                                key={f.value}
                                type="button"
                                onClick={() => void updateFase(f.value)}
                                className={`relative flex flex-col items-center justify-center gap-2 rounded border bg-white py-3.5 transition hover:bg-black/[.04] ${active ? "" : "border-black/[.08]"}`}
                                style={active ? { borderColor: f.color, boxShadow: `inset 0 0 0 0.5px ${f.color}` } : undefined}
                              >
                                {active && (
                                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded" style={{ background: f.color }}>
                                    <Check size={9} className="text-white" strokeWidth={3} />
                                  </span>
                                )}
                                <f.Icon size={16} strokeWidth={1.8} style={{ color: f.color }} />
                                <span className="text-[0.5625rem] font-medium uppercase leading-none tracking-[.08em] text-black/60">{f.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <BarraCaptacao confirmado={confirmado} negociacao={negociacao} meta={projeto.valor_alvo} />
              <dl className="mt-6 grid grid-cols-3 gap-3 border-t pt-5 sm:gap-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <Indicador icone={ICONE_CAPTACAO.confirmado} rotulo="Confirmado" valor={confirmado} />
                <Indicador icone={ICONE_CAPTACAO.negociacao} rotulo="Em negociação" valor={negociacao} />
                {projeto.valor_alvo && faltante === 0 ? (
                  <Indicador icone={ICONE_CAPTACAO.falta} rotulo="Falta captar" valor={0} texto="Meta atingida" corTexto="#2E8932" />
                ) : (
                  <Indicador icone={ICONE_CAPTACAO.falta} rotulo="Falta captar" valor={projeto.valor_alvo ? faltante : null} />
                )}
              </dl>

              {/* Orçamento total calculado do orçamento */}
              {orcamentoTotal > 0 && (
                <dl className="mt-5 border-t pt-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <Indicador rotulo="Orçamento total do projeto" valor={orcamentoTotal} />
                </dl>
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded border bg-black/[.025] px-4 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[0.625rem] font-medium text-black/35">Negociações ativas</p>
                <p className="mt-1.5 text-[1.375rem] font-semibold text-black/70 tabular-nums">{captacoes.filter(item => !["aprovado","recusado"].includes(item.status)).length}</p>
              </div>
              <div className="rounded border bg-black/[.025] px-4 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[0.625rem] font-medium text-black/35">Inscrições em editais</p>
                <p className="mt-1.5 text-[1.375rem] font-semibold text-black/70 tabular-nums">{inscricoes.length}</p>
              </div>
              <div className="rounded border bg-black/[.025] px-4 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[0.625rem] font-medium text-black/35">Responsável</p>
                <p className="mt-1.5 text-[0.8125rem] font-semibold text-black/70 truncate">{projeto.ponto_focal?.full_name ?? "Não definido"}</p>
              </div>
            </div>

            {/* Tipos de patrocínio */}
            <section
              className="cursor-pointer rounded border bg-white p-5 transition hover:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25 sm:p-6"
              style={{ borderColor: "rgba(13,13,13,.08)" }}
              role="button"
              tabIndex={0}
              aria-label="Editar tipos de patrocínio"
              onClick={() => setEditingTipos(true)}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setEditingTipos(true); } }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.6875rem] font-medium text-black/40">Tipos de patrocínio</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(projeto.tipos_patrocinio ?? []).length > 0 ? projeto.tipos_patrocinio.map(tipo => (
                      <span
                        key={tipo}
                        className="rounded border bg-white px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wide"
                        style={{
                          borderColor: `${sponsorshipTypeColor(tipo)}47`,
                          color: sponsorshipTypeColor(tipo),
                        }}
                      >
                        {sponsorshipTypeLabel(tipo)}
                      </span>
                    )) : (
                      <span className="text-[0.8125rem] text-black/30">Não definido</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {alerts.length > 0 && (
              <section className="rounded border bg-white" style={{ borderColor: "rgba(176,122,20,.22)" }}>
                <div className="border-b px-5 py-3 text-[0.625rem] font-medium uppercase tracking-[.12em] text-[#B07A14]" style={{ borderColor: "rgba(176,122,20,.14)" }}>Pontos de atenção</div>
                {alerts.map(alert => (
                  <div key={alert} className="flex items-center gap-2 border-b px-5 py-3 text-[0.6875rem] text-black/50 last:border-b-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                    <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#B07A14]" />{alert}
                  </div>
                ))}
              </section>
            )}
          </div>;
        })()}
        {/* Tab: Captação */}
        {tab === "captacao" && (
          <div className="flex items-start gap-8">
            {/* Left nav */}
            <nav className="flex w-28 flex-shrink-0 flex-col gap-0.5">
              <SubTabBtn vertical active={captacaoTab === "objetivo"} onClick={() => setCaptacaoTab("objetivo")}>Objetivo</SubTabBtn>
              <SubTabBtn vertical active={captacaoTab === "negociacoes"} onClick={() => setCaptacaoTab("negociacoes")} count={captacoes.length}>Negociações</SubTabBtn>
              <SubTabBtn vertical active={captacaoTab === "inscricoes"} onClick={() => setCaptacaoTab("inscricoes")} count={inscricoes.length}>Inscrições</SubTabBtn>
              <SubTabBtn vertical active={captacaoTab === "entregas"} onClick={() => setCaptacaoTab("entregas")}>Entregas</SubTabBtn>
            </nav>
            <div className="flex-1 min-w-0">
            {captacaoTab === "objetivo" ? (
              <div className="space-y-6">
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40 flex items-center gap-1.5">
                      <TrendingUp size={12} /> Objetivo vs Realizado
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingObjetivo(true)}
                        className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] font-medium text-black/50 transition hover:bg-black/[.04] active:scale-[.98]"
                        style={{ borderColor: "rgba(13,13,13,.14)" }}
                      >
                        <Pencil size={12} /> Editar objetivo
                      </button>
                      {ultimoResultado && (
                        <button
                          type="button"
                          onClick={() => setEditingResultado(ultimoResultado)}
                          className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] font-medium text-black/50 transition hover:bg-black/[.04] active:scale-[.98]"
                          style={{ borderColor: "rgba(13,13,13,.14)" }}
                        >
                          <Pencil size={12} /> Atualizar último resultado
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowResultado(true)}
                        className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] font-medium text-black/50 transition hover:bg-black/[.04] active:scale-[.98]"
                        style={{ borderColor: "rgba(13,13,13,.14)" }}
                      >
                        <Plus size={12} /> Registrar resultado
                      </button>
                    </div>
                  </div>

                  {/* Objetivo e realizado */}
                  {(() => {
                    const meta = projeto.valor_alvo ?? 0;
                    const real = valorCaptadoDisplay + (projeto.valor_garantido ?? 0);
                    const neg = Math.max(0, captadoTotal - captadoAprovado);
                    const pct = (valor: number) => meta > 0 ? Math.min(100, (valor / meta) * 100) : 0;
                    const linhas = [
                      { rotulo: "Objetivo", Icone: ICONE_CAPTACAO.falta, valor: projeto.valor_alvo, largura: meta > 0 ? 100 : 0, cor: "bg-black/[.12]", pct: meta > 0 ? "100%" : "—" },
                      { rotulo: "Confirmado", Icone: ICONE_CAPTACAO.confirmado, valor: real, largura: pct(real), cor: MARCA_CAPTACAO.confirmado, pct: meta > 0 ? `${pct(real).toFixed(0)}%` : "—" },
                      { rotulo: "Em negociação", Icone: ICONE_CAPTACAO.negociacao, valor: neg, largura: pct(neg), cor: MARCA_CAPTACAO.negociacao, pct: meta > 0 ? `${pct(neg).toFixed(0)}%` : "—" },
                    ];
                    return (
                      <div className="divide-y divide-black/[.06] overflow-hidden rounded border border-black/[.08]">
                        {linhas.map(linha => (
                          <div key={linha.rotulo} className="flex items-center gap-5 px-5 py-4">
                            <p className="flex w-32 shrink-0 items-center gap-1.5 whitespace-nowrap text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
                              <linha.Icone size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />
                              {linha.rotulo}
                            </p>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                                <span title={formatarValorCompleto(linha.valor)} className={`text-[0.8125rem] font-semibold tabular-nums ${linha.valor ? "text-[#282525]" : "text-black/30"}`}>{fmtValor(linha.valor)}</span>
                                <span className="text-[0.6875rem] tabular-nums text-black/40">{linha.pct}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded bg-black/[.06]">
                                <div className={`h-full rounded transition-[width] duration-200 motion-reduce:transition-none ${linha.cor}`} style={{ width: `${linha.largura}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Resultado registrado */}
                  {ultimoResultado && (
                    <div className="mt-4 border rounded p-4 space-y-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/30">
                        Resultado · {ultimoResultado.data_resultado ? fmtDate(ultimoResultado.data_resultado) : "sem data"}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <MetricCard label="Captado" value={fmtValor(ultimoResultado.valor_captado)} title={formatarValorCompleto(ultimoResultado.valor_captado)} />
                        <MetricCard label="Executado" value={fmtValor(ultimoResultado.valor_executado)} title={formatarValorCompleto(ultimoResultado.valor_executado)} />
                        <MetricCard label="Ret. mídia" value={fmtValor(ultimoResultado.retorno_midia_est)} title={formatarValorCompleto(ultimoResultado.retorno_midia_est)} />
                        <MetricCard label="Público" value={fmtInt(ultimoResultado.publico_alcancado)} icon={<Users size={11} className="text-black/30" />} />
                        <MetricCard label="Eventos" value={fmtInt(ultimoResultado.eventos_realizados)} />
                        {ultimoResultado.valor_captado && ultimoResultado.valor_executado && ultimoResultado.valor_executado > 0 && (
                          <MetricCard label="ROI" value={`${((ultimoResultado.valor_captado / ultimoResultado.valor_executado) * 100).toFixed(0)}%`} />
                        )}
                      </div>
                      {ultimoResultado.observacoes && (
                        <p className="text-[0.75rem] text-black/45 leading-relaxed border-t pt-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                          {ultimoResultado.observacoes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Histórico de resultados anteriores */}
                  {resultados.length > 1 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/30 mb-2">Histórico de resultados</p>
                      {resultados.slice(1).map(r => (
                        <div
                          key={r.id}
                          className="border rounded px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-black/[0.02] transition"
                          style={{ borderColor: "rgba(13,13,13,.08)" }}
                          onClick={() => setEditingResultado(r)}
                        >
                          <span className="text-[0.75rem] text-black/45">{r.data_resultado ? fmtDate(r.data_resultado) : "Sem data"}</span>
                          <span className="text-[0.75rem] font-semibold tabular-nums text-black/60" title={r.valor_captado != null ? formatarValorCompleto(r.valor_captado) : undefined}>{fmtValor(r.valor_captado)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : captacaoTab === "negociacoes" ? (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Negociações</h2>
                  <button type="button" onClick={() => setShowNovaCaptacao(true)} className="flex items-center gap-1 rounded border border-black/[.18] bg-white px-3 py-1.5 text-[0.6875rem] font-medium text-black/70 transition hover:bg-black/[.04] active:scale-[.98]">
                    <Plus size={11} /> Nova negociação
                  </button>
                </div>
                {captacoes.length === 0 ? (
                  <div className="border rounded p-6 text-center" style={{ borderColor: "rgba(13,13,13,.10)", borderStyle: "dashed" }}>
                    <p className="text-[0.75rem] text-black/30">Adicione a primeira negociação para acompanhar o progresso da captação.</p>
                  </div>
                ) : (
                  <div className="border rounded overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    {captacoes.map((c, i) => {
                      const etiqueta = etiquetasCaptacao[c.status];
                      const st = etiqueta ? { label: etiqueta.label, color: etiqueta.cor, iconName: etiqueta.icone } : { ...(STATUS_CAP[c.status] ?? { label: c.status, color: "#888888" }), iconName: undefined };
                      const empresa = c.empresa_crm?.nome ?? "—";
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEditingCaptacao(c)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03] transition cursor-pointer"
                          style={{ borderBottom: i < captacoes.length - 1 ? "1px solid rgba(13,13,13,.06)" : "none" }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[0.8125rem] font-semibold text-[#282525] line-clamp-1">{c.titulo ?? empresa}</p>
                            <p className="text-[0.6875rem] text-black/35">{empresa}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <StatusBadge status={c.status} label={st.label} bg={st.color} iconName={st.iconName} size="sm" />
                            <span className="text-[0.75rem] font-semibold tabular-nums text-black/50" title={c.valor_solicitado != null ? formatarValorCompleto(c.valor_solicitado) : undefined}>{fmtValor(c.valor_solicitado)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : captacaoTab === "inscricoes" ? (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Inscrições</h2>
                  <button type="button" onClick={() => setShowNovaInscricao(true)} className="flex items-center gap-1 rounded border border-black/[.18] bg-white px-3 py-1.5 text-[0.6875rem] font-medium text-black/70 transition hover:bg-black/[.04] active:scale-[.98]">
                    <Plus size={11} /> Nova inscrição
                  </button>
                </div>
                {inscricoes.length === 0 ? (
                  <div className="border rounded p-5 text-center" style={{ borderColor: "rgba(13,13,13,.10)", borderStyle: "dashed" }}>
                    <p className="text-[0.75rem] text-black/30">Nenhum edital inscrito ainda.</p>
                  </div>
                ) : (
                  <div className="border rounded overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    {inscricoes.map((insc, i) => {
                      const etiqueta = etiquetasEdital[insc.status];
                      const st = etiqueta ? { label: etiqueta.label, color: etiqueta.cor, iconName: etiqueta.icone } : { ...(STATUS_INSC[insc.status] ?? { label: insc.status, color: "#888888" }), iconName: undefined };
                      return (
                        <button
                          key={insc.id}
                          type="button"
                          onClick={() => setEditingInscricao(insc)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03] transition cursor-pointer"
                          style={{ borderBottom: i < inscricoes.length - 1 ? "1px solid rgba(13,13,13,.06)" : "none" }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[0.8125rem] font-semibold text-[#282525] line-clamp-1">{insc.empresa_crm?.nome ?? "Inscrição sem empresa"}</p>
                            {insc.data_submissao && (
                              <p className="text-[0.6875rem] text-black/35 flex items-center gap-1">
                                <Calendar size={9} /> {fmtDate(insc.data_submissao)}
                              </p>
                            )}
                          </div>
                          <StatusBadge status={insc.status} label={st.label} bg={st.color} iconName={st.iconName} size="sm" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              <DeliveriesPanel organizationId={projeto.organization_id} accountId={projeto.account_id} projetoId={projeto.id} />
            )}
            </div>
          </div>
        )}

        {tab === "documentos" && (
          <ProjetoDocumentosManager
            projetoId={projeto.id}
            captacoes={captacoes.map(captacao => ({
              id: captacao.id,
              titulo: captacao.titulo || captacao.empresa_crm?.nome || "Negociação",
              empresaNome: captacao.titulo ? captacao.empresa_crm?.nome : null,
            }))}
            inscricoes={inscricoes.map(inscricao => ({
              id: inscricao.id,
              titulo: inscricao.empresa_crm?.nome || "Inscrição sem empresa",
              complemento: inscricao.lei,
            }))}
          />
        )}

        {/* Tab: Proposta */}
        {tab === "proposta" && (
          <div className="flex items-start gap-8">
            {/* Left nav */}
            <nav className="flex w-28 flex-shrink-0 flex-col gap-0.5">
              <SubTabBtn vertical active={propostaTab === "cotas"} onClick={() => setPropostaTab("cotas")} count={cotas.length}>Cotas</SubTabBtn>
              <SubTabBtn vertical active={propostaTab === "propostas"} onClick={() => setPropostaTab("propostas")} count={propostas.length}>Propostas</SubTabBtn>
            </nav>
            <div className="flex-1 min-w-0">
            {propostaTab === "cotas" ? (
              <CotasProjetoManager projetoId={projeto.id} cotas={cotas} vendas={vendasPatrocinio} onRefresh={fetchAll} hideTitle valorTotal={orcamentoTotal || undefined} />
            ) : (
              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                  <div>
                    <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Propostas por negociação</h2>
                  </div>
                  <button onClick={() => { setEditingProposta(null); setShowPropostaModal(true); }} className="inline-flex items-center justify-center gap-1.5 rounded border border-black/15 bg-white px-4 py-2 text-[0.75rem] font-semibold text-black/70 transition hover:bg-black/[.04] active:scale-[.98]"><Plus size={13} /> Nova versão</button>
                </div>

                {propostas.length === 0 ? (
                  <div className="rounded border px-6 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.10)", borderStyle: "dashed" }}>
                    <BriefcaseBusiness size={20} className="mx-auto text-black/15" />
                    <p className="mt-3 text-[0.75rem] font-medium text-black/40">Nenhuma versão customizada registrada</p>
                    <p className="mt-1 text-[0.6875rem] text-black/30">Crie versões desta proposta adaptadas para cada patrocinador.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {propostas.map(proposta => {
                      const cota = cotas.find(item => item.id === proposta.cota_id);
                      const captacao = captacoes.find(item => item.id === proposta.captacao_id);
                      const inscricao = inscricoes.find(item => item.id === proposta.edital_user_id);
                      const statusMeta = STATUS_PROPOSTA[proposta.status] ?? { label: proposta.status, color: "rgba(13,13,13,.40)" };
                      return (
                        <button key={proposta.id} onClick={() => { setEditingProposta(proposta); setShowPropostaModal(true); }} className="rounded border border-black/[.08] bg-white p-5 text-left transition hover:bg-black/[.018] active:scale-[.995]">
                          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-[0.8125rem] font-semibold text-black/75">{proposta.titulo}</p><p className="mt-1 truncate text-[0.625rem] text-black/35">{captacao ? `Negociação · ${captacao.empresa_crm?.nome || captacao.titulo}` : inscricao ? `Inscrição · ${inscricao.empresa_crm?.nome || "sem empresa"}` : "Sem vínculo definido"}</p></div><span className="shrink-0 rounded px-2 py-1 text-[0.5625rem] font-semibold" style={{ color: statusMeta.color, background: "#fff", border: `1px solid ${statusMeta.color}47` }}>{statusMeta.label}</span></div>
                          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-black/[.06] pt-4"><MiniInfo label="Cota-base" value={cota?.nome ?? "Sem cota"} /><MiniInfo label="Valor" value={formatarValorCompleto(proposta.valor_proposto)} inteiro /><MiniInfo label="Contrapartidas" value={String(proposta.contrapartidas?.length ?? 0)} /></div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            </div>
          </div>
        )}

        {/* Tab: Cotas */}
        {tab === "orcamento" && (
          <ProjetoOrcamentoManager
            projetoId={projeto.id}
            cotas={cotas}
            valorTotal={orcamentoTotal || undefined}
            onTotalChange={setOrcamentoTotal}
          />
        )}
       </main>
      </div>
    </div>
  );
}


function MiniInfo({ label, value, inteiro = false }: { label: string; value: string; inteiro?: boolean }) {
  return <div className="min-w-0"><p className="text-[0.625rem] font-medium text-black/35">{label}</p><p title={value} className={`mt-1.5 text-[0.8125rem] font-medium text-black/65 ${inteiro ? "break-words" : "truncate"}`}>{value}</p></div>;
}

function MetricCard({ label, value, title, icon }: { label: string; value: string; title?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded px-3 py-2.5" style={{ background: "rgba(13,13,13,.03)" }}>
      <p className="mb-1 flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
        {icon}{label}
      </p>
      <p title={value === "—" ? undefined : title} className={`text-[0.9375rem] font-semibold tabular-nums ${value === "—" ? "text-black/30" : "text-[#282525]"}`}>{value}</p>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 shrink-0 items-center gap-2 rounded border bg-white px-4 text-[0.75rem] font-medium transition active:scale-[.98] ${
        active
          ? "border-[#7259B5]/40 text-[#7259B5]"
          : "border-transparent text-black/40 hover:bg-black/[.04] hover:text-black/60"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SubTabBtn({ active, onClick, children, count, vertical = false }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count?: number; vertical?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 text-[0.75rem] font-medium transition ${
        vertical
          ? `w-full border-l-2 pl-3 py-1.5 ${active ? "border-black/55 text-black/75" : "border-transparent text-black/35 hover:text-black/55"}`
          : `pb-2.5 border-b-2 ${active ? "border-black/60 text-black/75" : "border-transparent text-black/35 hover:text-black/55"}`
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`text-[0.625rem] font-bold tabular-nums ${active ? "text-black/50" : "text-black/25"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
