"use client";
import { useState, useEffect, useId, useRef } from "react";
import {
  X, Building2, FolderOpen,
  Users, CalendarDays, Save, Lightbulb, Briefcase,
  MessageSquare, TrendingUp, Check, Ban, Plus, UserPlus,
  Contact, UserRoundCog, Circle, ArrowDown, Minus, ArrowUp, Layers, ChevronDown,
} from "lucide-react";
import * as Icons from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import type {
  StatusCaptacao, MeioContato, PotencialFechamento, CanalContato,
  OrigemOportunidade, ResultadoInteracao, CotaPatrocinio,
} from "@/lib/supabase/types";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";
import { useTaxonomiasComerciais } from "@/contexts/TaxonomiasComerciaisContext";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { contatoSalvoCorrespondente, rotuloContato, semContatosJaSalvos, type ContatoSugerido } from "@/lib/contatos-sugeridos";
import { CampoValor } from "@/components/ui/CampoValor";
import { cotaTemDisponibilidade, formatCotaValor } from "@/lib/cotas";
import { MENSAGEM_VALOR_INVALIDO, formatarValorBRL, lerValorBRL } from "@/lib/valor";
import { DESFECHOS_NEGOCIACAO, etapaInicial, etapasDoFormulario } from "@/lib/etapas";

type EmpresaCRM   = { id: string; nome: string };
type Projeto      = { id: string; nome: string };
type ContatoItem  = { id: string; nome: string; cargo: string | null; email: string | null; responsavel_id?: string | null };
type CaptadorExt  = { id: string; nome: string; agencia: string | null };

const CRIAR_NOVA_COTA = "__criar_nova_cota__";

const ETAPAS: { status: StatusCaptacao; Icon: React.ElementType; label: string; color: string }[] = [
  { status: "prospeccao",       Icon: Lightbulb,    label: "Prospecção", color: "rgba(13,13,13,.40)" },
  { status: "primeiro_contato", Icon: MessageSquare, label: "1º Contato", color: "#2D72B0" },
  { status: "proposta_enviada", Icon: Briefcase,     label: "Proposta",   color: "#B07A14" },
  { status: "em_negociacao",    Icon: TrendingUp,    label: "Negociação", color: "#B07A14" },
  { status: "aprovado",         Icon: Check,         label: "Aprovado",   color: "#2E8932" },
  { status: "recusado",         Icon: Ban,           label: "Recusado",   color: "#D94E4E" },
];

function legacyCanal(meio: MeioContato | null | undefined): CanalContato | null {
  if (!meio || meio === "indicacao") return null;
  if (meio === "reuniao") return "videoconferencia";
  return meio;
}

function legacyMeio(canal: CanalContato | null): MeioContato | null {
  if (!canal) return null;
  if (canal === "videoconferencia" || canal === "presencial") return "reuniao";
  if (canal === "whatsapp") return "outro";
  if (canal === "email" || canal === "telefone" || canal === "linkedin" || canal === "outro") return canal;
  return "outro";
}

const EXCLUSAO_LABELS: Record<string, string> = {
  exclusividade_empresa: "Exclusividade por Empresa",
  exclusividade_projeto: "Exclusividade por Projeto",
  time_lock: "Time Lock",
  relacao_pessoal: "Relação Pessoal",
};

export type EditDataCaptacao = {
  id: string;
  empresa_crm_id: string | null;
  empresa_crm_nome: string | null;
  projeto_id: string | null;
  projeto_nome: string | null;
  valor_solicitado: number | null;
  meio_contato: MeioContato | null;
  origem_oportunidade?: OrigemOportunidade | null;
  canal_planejado?: CanalContato | null;
  status: StatusCaptacao;
  captador_id: string | null;
  captador_externo_id: string | null;
  supervisor_id: string | null;
  contato_empresa_id: string | null;
  proxima_prospeccao: string | null;
  data_previsao: string | null;
  potencial_fechamento?: PotencialFechamento | null;
};

const POTENCIAL_OPTIONS: { value: PotencialFechamento; label: string; color: string; Icon: React.ElementType }[] = [
  { value: "baixo", label: "Baixo", color: "#777777", Icon: ArrowDown },
  { value: "medio", label: "Médio", color: "#B07A14", Icon: Minus },
  { value: "alto", label: "Alto", color: "#D94E4E", Icon: ArrowUp },
];

type MembroOption = { user_id: string; nome: string; email: string; papel: string };
/* ─── Rótulos (fora do modal: componentes não são recriados a cada render) ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-black/30 mb-1.5">{children}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 flex items-center text-[0.75rem] font-semibold text-black">{children}</label>;
}

/* ─── Mini-form inline para novo contato ─────────────────────────── */
function NovoContatoInline({
  empresaCrmId,
  organizationId,
  onCreated,
  onCancel,
}: {
  empresaCrmId: string;
  organizationId: string | null;
  onCreated: (c: ContatoItem) => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [nome, setNome]   = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro]   = useState<string | null>(null);

  async function handleSave() {
    if (!nome.trim()) return;
    setSaving(true); setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from("contatos")
      .insert({ nome: nome.trim(), cargo: cargo.trim() || null, email: email.trim() || null, empresa_crm_id: empresaCrmId, account_id: user?.id, organization_id: organizationId })
      .select("id, nome, cargo, email")
      .single();
    setSaving(false);
    if (error) { setErro("Erro ao salvar contato."); return; }
    if (data) onCreated(data as ContatoItem);
  }

  return (
    <div className="border rounded p-3 space-y-2 bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.10)" }}>
      <input
        autoFocus
        value={nome}
        onChange={e => setNome(e.target.value)}
        placeholder="Nome *"
        className="w-full text-[0.75rem] border rounded px-2.5 py-1.5 bg-white outline-none focus:ring-1 focus:ring-black/20"
        style={{ borderColor: "rgba(13,13,13,.15)" }}
      />
      <input
        value={cargo}
        onChange={e => setCargo(e.target.value)}
        placeholder="Cargo"
        className="w-full text-[0.75rem] border rounded px-2.5 py-1.5 bg-white outline-none focus:ring-1 focus:ring-black/20"
        style={{ borderColor: "rgba(13,13,13,.15)" }}
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="E-mail"
        type="email"
        className="w-full text-[0.75rem] border rounded px-2.5 py-1.5 bg-white outline-none focus:ring-1 focus:ring-black/20"
        style={{ borderColor: "rgba(13,13,13,.15)" }}
      />
      {erro && <p role="alert" className="text-[0.6875rem] text-[#D94E4E]">{erro}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !nome.trim()}
          className="flex-1 py-1.5 rounded text-[0.6875rem] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 hover:bg-black/[.04] transition disabled:opacity-40"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-[0.6875rem] text-black/35 hover:text-black/55 transition">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ─── Modal principal ─────────────────────────────────────────────── */
export function NovaCaptacaoModal({ onClose, onSaved, empresaPreId, nomePreEmpresa, empresaPubId, contatosSugeridos, statusPre, potentialPre, editData, initialProjetoId, initialProjetoNome }: {
  onClose: () => void;
  onSaved: (id?: string) => void;
  empresaPreId?: string;
  nomePreEmpresa?: string;
  empresaPubId?: string;
  /** Responsáveis do patrocinador já liberados para a pessoa (página do patrocinador). */
  contatosSugeridos?: ContatoSugerido[];
  statusPre?: StatusCaptacao;
  potentialPre?: PotencialFechamento;
  editData?: EditDataCaptacao;
  initialProjetoId?: string;
  initialProjetoNome?: string;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const { origens, canais, resultados } = useTaxonomiasComerciais();
  const { etiquetas } = useEtiquetas();
  const IconOf = (name?: string) => ((Icons as unknown as Record<string, React.ElementType | undefined>)[name ?? ""] ?? Circle);
  const etapas = etiquetas.length
    ? etiquetas.map(e => ({ status: e.key as StatusCaptacao, Icon: IconOf(e.icone), label: e.label, color: e.cor }))
    : ETAPAS;

  const [empresas, setEmpresas]     = useState<EmpresaCRM[]>([]);
  const [projetos, setProjetos]     = useState<Projeto[]>([]);
  const [membros, setMembros]       = useState<MembroOption[]>([]);
  const [captadoresExt, setCaptadoresExt] = useState<CaptadorExt[]>([]);
  const [saving, setSaving]         = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);
  // Desfechos (aprovar, recusar) têm fluxo próprio e não entram no cadastro.
  const etapasForm = etapasDoFormulario(etapas, DESFECHOS_NEGOCIACAO, editData?.status);
  // "Mais detalhes" já abre quando há algo preenchido lá dentro.
  const [maisDetalhes, setMaisDetalhes] = useState(() => Boolean(
    potentialPre
    || editData?.data_previsao
    || editData?.supervisor_id
    || editData?.captador_externo_id
    || (editData?.potencial_fechamento && editData.potencial_fechamento !== "medio"),
  ));
  const [blindagem, setBlindagem]   = useState<{ captadorNome: string } | null>(null);
  const [exclusividade, setExclusividade] = useState<{ tipo: string; captadorNome: string; dataFim: string | null; diasSemAvanco: number | null } | null>(null);

  // Campos
  const [empresaId, setEmpresaId]         = useState(editData?.empresa_crm_id ?? empresaPreId ?? "");
  const [empresaSearch, setEmpresaSearch] = useState(editData?.empresa_crm_nome ?? nomePreEmpresa ?? "");
  const [empresaOpen, setEmpresaOpen]     = useState(false);
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const empresaBoxRef = useRef<HTMLDivElement>(null);
  const empresaMenuPos = usePortalPosition(empresaBoxRef, empresaOpen);
  const [projetoId, setProjetoId]         = useState(editData?.projeto_id ?? initialProjetoId ?? "");
  const [projetoSearch, setProjetoSearch] = useState(editData?.projeto_nome ?? initialProjetoNome ?? "");
  const [projetoOpen, setProjetoOpen]     = useState(false);
  const [criandoProjeto, setCriandoProjeto] = useState(false);
  const projetoBoxRef = useRef<HTMLDivElement>(null);
  const projetoMenuPos = usePortalPosition(projetoBoxRef, projetoOpen);

  // Captador
  const [captacaoTipo, setCaptacaoTipo]           = useState<"interna" | "externa">(editData?.captador_externo_id ? "externa" : "interna");
  const [captadorId, setCaptadorId]               = useState<string | null>(editData?.captador_id ?? null);
  const [captadorExternoId, setCaptadorExternoId] = useState<string | null>(editData?.captador_externo_id ?? null);
  const [supervisorId, setSupervisorId]           = useState<string | null>(editData?.supervisor_id ?? null);

  // Contato empresa
  const [contatoEmpresaId, setContatoEmpresaId]   = useState<string | null>(editData?.contato_empresa_id ?? null);
  const [contatosEmpresa, setContatosEmpresa]     = useState<ContatoItem[]>([]);
  const [showNovoContato, setShowNovoContato]     = useState(false);
  // Responsável do patrocinador escolhido; vira contato salvo só ao salvar a negociação.
  // O principal (primeiro da lista do patrocinador) já vem escolhido.
  const [contatoSugeridoChave, setContatoSugeridoChave] = useState<string | null>(() => editData ? null : contatosSugeridos?.[0]?.chave ?? null);
  // empresas_crm que corresponde ao patrocinador aberto (empresa_pub_id), quando existe.
  const [empresaDoPatrocinadorId, setEmpresaDoPatrocinadorId] = useState<string | null>(empresaPreId ?? null);
  const empresaTocada = useRef(false);

  const [origem, setOrigem] = useState<OrigemOportunidade | null>(
    editData?.origem_oportunidade ?? (editData?.meio_contato === "indicacao" ? "indicacao" : null),
  );
  const [canalPlanejado, setCanalPlanejado] = useState<CanalContato | null>(
    editData?.canal_planejado ?? legacyCanal(editData?.meio_contato),
  );
  const [status, setStatus]   = useState<StatusCaptacao>(() => editData?.status ?? etapaInicial(etapas, DESFECHOS_NEGOCIACAO, statusPre) as StatusCaptacao);
  const [potencialFechamento, setPotencialFechamento] = useState<PotencialFechamento>(editData?.potencial_fechamento ?? potentialPre ?? "medio");
  const [proximoFollowup, setProximoFollowup] = useState(editData?.proxima_prospeccao ?? "");
  const [previsao, setPrevisao]               = useState(editData?.data_previsao ?? "");
  // Valor da negociação digitado direto aqui; a proposta continua opcional.
  const [valorTexto, setValorTexto]           = useState(() => formatarValorBRL(editData?.valor_solicitado));
  const valorLido = lerValorBRL(valorTexto);
  // Cota (opcional) → Proposta: o valor da negociação é a proposta simplificada.
  const [cotas, setCotas] = useState<CotaPatrocinio[]>([]);
  const [cotasDoProjeto, setCotasDoProjeto] = useState<string | null>(null);
  const [recargaCotas, setRecargaCotas] = useState(0);
  const [cotaId, setCotaId] = useState("");
  const [propostaAtiva, setPropostaAtiva] = useState<{ status: string; cota_id: string | null } | null>(null);
  const propostaAceita = propostaAtiva?.status === "aceita";
  // Só as cotas do projeto escolhido agora (a lista anterior some ao trocar de projeto).
  const cotasVisiveis = projetoId && cotasDoProjeto === projetoId ? cotas : [];
  const carregandoCotas = Boolean(projetoId) && cotasDoProjeto !== projetoId;
  // "Contato realizado" fica recolhido: só quem já falou com a empresa abre.
  const [registrarContato, setRegistrarContato] = useState(false);
  const [canalRealizado, setCanalRealizado] = useState<CanalContato | null>(null);
  const [resultadoContato, setResultadoContato] = useState<ResultadoInteracao | null>(null);
  const [dataContato, setDataContato] = useState(() => new Date().toISOString().slice(0, 16));
  const [resumoContato, setResumoContato] = useState("");
  const origensAtivas = origens.filter(item => item.ativo || item.chave === origem);
  const canaisAtivos = canais.filter(item => item.ativo || item.chave === canalPlanejado || item.chave === canalRealizado);
  const resultadosAtivos = resultados.filter(item => item.ativo || item.chave === resultadoContato);
  const supervisores = membros.filter(membro => membro.papel !== "captador");
  // Responsável e supervisor só aparecem quando há equipe: mais de uma pessoa
  // ou captadores externos (quase todas as organizações têm uma pessoa só).
  const temEquipe = membros.length > 1 || captadoresExt.length > 0 || Boolean(editData?.supervisor_id || editData?.captador_externo_id);
  const mostrarTipoResponsavel = captadoresExt.length > 0 || captacaoTipo === "externa";

  useEffect(() => {
    if (organizationId) {
      // Restrito à organização atual — projetos_crm isola só por dono (account_id)
      // via RLS, não por organização, então sem esse filtro apareciam projetos de
      // outras organizações do mesmo usuário (mesmo caso já corrigido em
      // NovaInscricaoModal). empresas_crm filtrado pelo mesmo padrão por defesa.
      (supabase as any).from("empresas_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(200)
        .then(({ data }: any) => setEmpresas(data ?? []));
      (supabase as any).from("projetos_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100)
        .then(({ data }: any) => setProjetos(data ?? []));

      fetchOrganizationMembers(organizationId)
        .then(data => setMembros(data.map(m => ({
          user_id: m.user_id,
          nome: m.full_name || m.email?.split("@")[0] || m.user_id.slice(0, 8),
          email: m.email ?? "",
          papel: m.papel || "colaborador",
        }))))
        .catch(error => setErro(error instanceof Error ? error.message : "Falha ao carregar equipe"));

      (supabase as any)
        .from("captadores")
        .select("id, nome, agencia")
        .eq("organization_id", organizationId)
        .eq("ativo", true)
        .order("nome")
        .then(({ data }: any) => setCaptadoresExt(data ?? []));
    }

    // Quem cria a negociação é o responsável, até alguém escolher outra pessoa.
    if (!editData) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCaptadorId(current => current ?? user.id);
      });
    }

    const preEmpresa = editData?.empresa_crm_id ?? empresaPreId;
    if (preEmpresa) loadContatosEmpresa(preEmpresa, { doPatrocinador: !editData && Boolean(empresaPubId) });
    else if (empresaPubId && organizationId) {
      // Aberto pela página do patrocinador: usa a empresa que já está no CRM.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("empresas_crm").select("id, nome")
        .eq("organization_id", organizationId).eq("empresa_pub_id", empresaPubId)
        .order("created_at", { ascending: true }).limit(1).maybeSingle()
        .then(({ data }: { data: EmpresaCRM | null }) => {
          if (empresaTocada.current || !data) return;
          setEmpresaDoPatrocinadorId(data.id);
          setEmpresaId(data.id);
          setEmpresaSearch(data.nome);
          checkBlindagem(data.id);
          checkExclusividade(data.id, projetoId);
          loadContatosEmpresa(data.id, { doPatrocinador: true });
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    if (!editData?.id) return;
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("propostas").select("status, cota_id, created_at")
      .eq("captacao_id", editData.id).not("status", "in", "(recusada,expirada,arquivada)")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: { status: string; cota_id: string | null }[] | null }) => {
        if (!ativo || !data?.length) return;
        const ativa = data.find(p => p.status === "aceita") ?? data[0];
        setPropostaAtiva(ativa);
        setCotaId(ativa.cota_id ?? "");
      });
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData?.id]);

  useEffect(() => {
    if (!projetoId) return;
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("cotas_patrocinio")
      .select("id,nome,valor,valor_maximo,modelo,produto_nome,status,unidades,unidades_ilimitadas,unidades_vendidas,contrapartidas,ordem")
      .eq("projeto_id", projetoId).order("ordem")
      .then(({ data }: { data: CotaPatrocinio[] | null }) => {
        if (!ativo) return;
        setCotas(data ?? []);
        setCotasDoProjeto(projetoId);
        // Trocar de projeto descarta a cota do projeto anterior.
        setCotaId(current => current && !(data ?? []).some(cota => cota.id === current) ? "" : current);
      });
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId, recargaCotas]);

  // Cota criada em outra aba ("+ Criar nova cota…"): ao voltar, a lista se atualiza.
  useEffect(() => {
    const aoVoltar = () => setRecargaCotas(n => n + 1);
    window.addEventListener("focus", aoVoltar);
    return () => window.removeEventListener("focus", aoVoltar);
  }, []);

  async function checkBlindagem(eId: string, responsavelId: string | null = captadorId) {
    if (!responsavelId || !eId) { setBlindagem(null); return; }
    const { data } = await (supabase as any)
      .from("captacoes").select("captador_id")
      .eq("empresa_crm_id", eId).not("status", "in", '("aprovado","recusado")')
      .neq("captador_id", responsavelId).not("captador_id", "is", null).limit(1).single();
    const d = data as { captador_id: string } | null;
    if (d?.captador_id) {
      const m = membros.find(m => m.user_id === d.captador_id);
      setBlindagem({ captadorNome: m?.nome ?? "outro captador" });
    } else setBlindagem(null);
  }

  // atribuicoes.captador_user_id referencia captadores(id), não auth.users(id)
  // (ver migration 20260913000003_fix_captador_user_id_fk.sql). Resolve o id
  // comparável no espaço de captadores antes de checar contra a exclusividade:
  // "externa" já grava um captadores.id direto; "interna" grava o auth.users.id
  // do membro, então precisa achar a linha de captadores vinculada a ele (pode
  // não existir — nem todo membro interno tem um captador associado).
  async function resolverCaptadorIdParaExclusividade(
    overrideCaptadorId?: string | null,
    overrideCaptadorExternoId?: string | null,
    overrideCaptacaoTipo?: "interna" | "externa",
  ): Promise<string | null> {
    const tipo = overrideCaptacaoTipo ?? captacaoTipo;
    if (tipo === "externa") {
      return (overrideCaptadorExternoId !== undefined ? overrideCaptadorExternoId : captadorExternoId) || null;
    }
    const uid = overrideCaptadorId !== undefined ? overrideCaptadorId : captadorId;
    if (!uid) return null;
    const { data } = await (supabase as any).from("captadores").select("id").eq("user_id", uid).maybeSingle();
    return data?.id ?? null;
  }

  async function checkExclusividade(
    eId: string,
    pId?: string | null,
    overrideCaptadorId?: string | null,
    overrideCaptadorExternoId?: string | null,
    overrideCaptacaoTipo?: "interna" | "externa",
  ) {
    if (!eId) { setExclusividade(null); return; }
    const { data } = await (supabase as any).rpc("verificar_exclusividade", { p_empresa_crm_id: eId, p_projeto_id: pId || null });
    if (data && data.length > 0) {
      const exc = data[0];
      const meuCaptadorId = await resolverCaptadorIdParaExclusividade(overrideCaptadorId, overrideCaptadorExternoId, overrideCaptacaoTipo);
      if (exc.captador_user_id !== meuCaptadorId) {
        const nome = captadoresExt.find(c => c.id === exc.captador_user_id)?.nome ?? "outro captador";
        setExclusividade({ tipo: exc.tipo, captadorNome: nome, dataFim: exc.data_fim, diasSemAvanco: exc.dias_sem_avanco });
      } else setExclusividade(null);
    } else setExclusividade(null);
  }

  async function loadContatosEmpresa(empresaCrmId: string, { doPatrocinador = false }: { doPatrocinador?: boolean } = {}) {
    if (!empresaCrmId) { setContatosEmpresa([]); setContatoEmpresaId(null); return; }
    const { data } = await (supabase as any)
      .from("contatos").select("id, nome, cargo, email, responsavel_id")
      .eq("empresa_crm_id", empresaCrmId).order("nome");
    const result: ContatoItem[] = data ?? [];
    setContatosEmpresa(result);
    // O contato selecionado pode ser de outra empresa (campo dependente trocando
    // de pai) — mantém só se ainda existir na lista desta empresa.
    setContatoEmpresaId(current => current && result.some(c => c.id === current) ? current : null);
    const sugeridos = doPatrocinador ? semContatosJaSalvos(contatosSugeridos ?? [], result) : [];
    const principal = doPatrocinador ? contatosSugeridos?.[0] : undefined;
    const principalSalvo = principal ? contatoSalvoCorrespondente(principal, result) : null;
    if (principalSalvo) {
      // O responsável principal já está nos contatos: usa o contato salvo.
      setContatoSugeridoChave(current => current === principal?.chave ? null : current);
      setContatoEmpresaId(current => current ?? principalSalvo.id);
    }
    if (result.length === 0 && sugeridos.length === 0) setShowNovoContato(true);
  }

  const empresasFiltradas   = empresas.filter(e => e.nome.toLowerCase().includes(empresaSearch.toLowerCase()));
  const hasExactMatch       = empresas.some(e => e.nome.toLowerCase() === empresaSearch.trim().toLowerCase());
  const projetosFiltrados   = projetos.filter(p => p.nome.toLowerCase().includes(projetoSearch.toLowerCase()));
  const hasExactMatchProjeto = projetos.some(p => p.nome.toLowerCase() === projetoSearch.trim().toLowerCase());

  const nomePatrocinador = (nomePreEmpresa ?? "").trim();
  const empresaEhDoPatrocinador = Boolean(empresaPubId) && (empresaId
    ? empresaId === empresaDoPatrocinadorId
    : nomePatrocinador !== "" && empresaSearch.trim() === nomePatrocinador);
  const sugeridosDisponiveis = empresaEhDoPatrocinador ? semContatosJaSalvos(contatosSugeridos ?? [], contatosEmpresa) : [];
  const contatoSugerido = sugeridosDisponiveis.find(contato => contato.chave === contatoSugeridoChave) ?? null;

  async function handleCriarProjeto(nome: string) {
    if (!nome.trim() || criandoProjeto) return;
    setCriandoProjeto(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await (supabase as any)
      .from("projetos_crm").insert({ nome: nome.trim(), account_id: user?.id, organization_id: organizationId })
      .select("id, nome").single();
    setCriandoProjeto(false);
    if (!data) return;
    setProjetos(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setProjetoId(data.id); setProjetoSearch(data.nome); setProjetoOpen(false);
  }

  async function handleCriarEmpresa(nome: string) {
    if (!nome.trim() || criandoEmpresa) return;
    setCriandoEmpresa(true);
    const { data: { user } } = await supabase.auth.getUser();
    const doPatrocinador = Boolean(empresaPubId) && nome.trim() === nomePatrocinador;
    const { data } = await (supabase as any)
      .from("empresas_crm").insert({ nome: nome.trim(), account_id: user?.id, organization_id: organizationId, ...(doPatrocinador ? { empresa_pub_id: empresaPubId } : {}) })
      .select("id, nome").single();
    setCriandoEmpresa(false);
    if (!data) return;
    setEmpresas(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    if (doPatrocinador) setEmpresaDoPatrocinadorId(data.id);
    setEmpresaId(data.id); setEmpresaSearch(data.nome); setEmpresaOpen(false);
    loadContatosEmpresa(data.id, { doPatrocinador });
  }

  async function handleSalvar() {
    setSaving(true); setErro(null);
    if (exclusividade) {
      setErro(`Esta empresa possui ${EXCLUSAO_LABELS[exclusividade.tipo] || exclusividade.tipo} ativa com ${exclusividade.captadorNome}.`);
      setSaving(false); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado"); setSaving(false); return; }

    if (!propostaAceita && !valorLido.valido) {
      setErro(MENSAGEM_VALOR_INVALIDO);
      setSaving(false); return;
    }

    if (canalRealizado && !resultadoContato) {
      setErro("Informe o resultado do contato realizado.");
      setSaving(false); return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Patrocinador ainda fora do CRM: entra agora, ligado à base (empresa_pub_id).
    let empresaFinal = empresaId;
    if (!empresaFinal && empresaEhDoPatrocinador && empresaPubId) {
      const existente = await sb.from("empresas_crm").select("id")
        .eq("organization_id", organizationId).eq("empresa_pub_id", empresaPubId).limit(1).maybeSingle();
      const criada = existente.data?.id ? null : await sb.from("empresas_crm")
        .insert({ nome: nomePatrocinador, account_id: user.id, organization_id: organizationId, empresa_pub_id: empresaPubId })
        .select("id").single();
      empresaFinal = existente.data?.id ?? criada?.data?.id ?? "";
      if (!empresaFinal) { setErro("Não foi possível adicionar o patrocinador ao seu CRM. Tente novamente."); setSaving(false); return; }
      // Se algo falhar adiante, uma nova tentativa reaproveita a empresa.
      setEmpresaDoPatrocinadorId(empresaFinal);
      setEmpresaId(empresaFinal);
    }

    // Responsável do patrocinador escolhido: vira contato salvo da empresa.
    let contatoFinal = contatoEmpresaId;
    if (!contatoFinal && contatoSugerido && empresaFinal) {
      const novo = await sb.from("contatos").insert({
        nome: contatoSugerido.nome,
        cargo: contatoSugerido.cargo,
        email: contatoSugerido.email,
        telefone: contatoSugerido.telefone,
        linkedin_url: contatoSugerido.linkedin_url,
        responsavel_id: contatoSugerido.responsavel_id,
        empresa_crm_id: empresaFinal,
        account_id: user.id,
        organization_id: organizationId,
        origem: "jards",
      }).select("id").single();
      if (novo.error || !novo.data?.id) { setErro("Não foi possível salvar o contato escolhido. Tente de novo ou escolha outro."); setSaving(false); return; }
      contatoFinal = novo.data.id;
      // Já é um contato salvo: uma nova tentativa não o duplica.
      const salvo: ContatoItem = { id: novo.data.id, nome: contatoSugerido.nome, cargo: contatoSugerido.cargo, email: contatoSugerido.email, responsavel_id: contatoSugerido.responsavel_id };
      setContatosEmpresa(current => [...current, salvo].sort((a, b) => a.nome.localeCompare(b.nome)));
      setContatoSugeridoChave(null);
      setContatoEmpresaId(novo.data.id);
    }

    const payload = {
      empresa_crm_id:      empresaFinal || null,
      empresa_id:          empresaPubId || null,
      projeto_id:          projetoId || null,
      // Campo legado mantido durante a transição entre versões do banco.
      meio_contato:        legacyMeio(null),
      status,
      potencial_fechamento: potencialFechamento,
      captador_id:         captacaoTipo === "interna" ? captadorId : null,
      captador_externo_id: captacaoTipo === "externa" ? captadorExternoId : null,
      supervisor_id:       supervisorId,
      contato_empresa_id:  contatoFinal,
      // Mantido como espelho pelo trigger de crm_followups.
      proxima_prospeccao:  null,
      data_previsao:       previsao || null,
    };

    let captacaoId = editData?.id ?? null;
    let createdNow = false;
    let result = editData?.id
      ? await sb.from("captacoes").update(payload).eq("id", editData.id).select("id").single()
      : await sb.from("captacoes").insert({ account_id: user.id, organization_id: organizationId, ...payload }).select("id").single();
    let { error } = result;
    if (!error && result.data?.id) {
      captacaoId = result.data.id;
      createdNow = !editData?.id;
    }

    // A migration pode ainda não ter chegado a um ambiente de desenvolvimento.
    // Nesse caso, preservamos a criação/edição e o campo assume Médio ao migrar.
    if (error && /potencial_fechamento/i.test(error.message)) {
      const legacyPayload = { ...payload } as Record<string, unknown>;
      delete legacyPayload.potencial_fechamento;
      result = editData?.id
        ? await sb.from("captacoes").update(legacyPayload).eq("id", editData.id).select("id").single()
        : await sb.from("captacoes").insert({ account_id: user.id, organization_id: organizationId, ...legacyPayload }).select("id").single();
      error = result.error;
      if (!error && result.data?.id) {
        captacaoId = result.data.id;
        createdNow = !editData?.id;
      }
    }

    // Valor e cota vão para a proposta simplificada (ou direto, sem projeto).
    const cotaFinal = projetoId ? cotaId : "";
    const mudouValor = editData?.id ? valorLido.valor !== (editData.valor_solicitado ?? null) : valorLido.valor != null;
    const mudouCota = cotaFinal !== (propostaAtiva?.cota_id ?? "");
    if (!error && captacaoId && !propostaAceita && (mudouValor || mudouCota)) {
      const proposta = await sb.rpc("fn_salvar_proposta_simplificada", {
        p_captacao_id: captacaoId, p_valor: valorLido.valor, p_cota_id: cotaFinal || null, p_alterar_cota: true,
      });
      if (proposta.error) {
        // Evita deixar uma negociação recém-criada sem o valor que a pessoa digitou.
        if (createdNow) await sb.from("captacoes").delete().eq("id", captacaoId);
        error = { message: proposta.error.message || "Não foi possível salvar o valor da proposta." };
      }
    }

    if (!error && captacaoId && canalRealizado && resultadoContato) {
      const legacyTipo = canalRealizado === "whatsapp" ? "mensagem"
        : canalRealizado === "videoconferencia" || canalRealizado === "presencial" ? "reuniao"
        : canalRealizado;
      const interaction = await sb.from("crm_interacoes").insert({
        organization_id: organizationId,
        account_id: user.id,
        empresa_crm_id: empresaFinal || null,
        contato_id: contatoFinal,
        captacao_id: captacaoId,
        tipo: legacyTipo,
        canal: canalRealizado,
        tipo_interacao: canalRealizado === "telefone" ? "ligacao"
          : canalRealizado === "videoconferencia" || canalRealizado === "presencial" ? "reuniao" : "mensagem",
        direcao: "saida",
        assunto: "Primeiro contato",
        resumo: resumoContato.trim() || null,
        resultado: resultadoContato,
        ocorreu_em: dataContato ? new Date(dataContato).toISOString() : new Date().toISOString(),
        created_by: user.id,
      });
      if (interaction.error) {
        // Evita deixar uma negociação recém-criada pela metade.
        if (createdNow) await sb.from("captacoes").delete().eq("id", captacaoId);
        error = interaction.error;
      }
    }

    if (!error && captacaoId) {
      const existing = await sb.from("crm_followups")
        .select("id")
        .eq("captacao_id", captacaoId)
        .eq("status", "pendente")
        .order("previsto_para", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing.error) {
        error = existing.error;
      } else if (proximoFollowup) {
        const followupPayload = {
          organization_id: organizationId,
          account_id: user.id,
          empresa_crm_id: empresaFinal || null,
          contato_id: contatoFinal,
          captacao_id: captacaoId,
          canal: canalPlanejado || "email",
          previsto_para: new Date(`${proximoFollowup}T12:00:00`).toISOString(),
          responsavel_id: supervisorId || user.id,
        };
        const followupResult = existing.data?.id
          ? await sb.from("crm_followups").update(followupPayload).eq("id", existing.data.id)
          : await sb.from("crm_followups").insert({ ...followupPayload, titulo: "Próximo contato" });
        if (followupResult.error) error = followupResult.error;
      } else if (existing.data?.id) {
        const cancelResult = await sb.from("crm_followups").update({ status: "cancelado" }).eq("id", existing.data.id);
        if (cancelResult.error) error = cancelResult.error;
      }
    }

    setSaving(false);
    if (error) { setErro((error as Error).message); return; }
    onSaved(captacaoId ?? undefined); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center"
      style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex w-full max-w-[47.5rem] flex-col overflow-hidden rounded-b bg-white"
        style={{ maxHeight: "100vh", boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }} onClick={e => e.stopPropagation()}>

        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-black/5">
              <Building2 size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="min-w-0 text-[0.9375rem] font-bold text-black">{editData ? "Editar negociação" : "Nova negociação"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded transition hover:bg-black/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <FieldLabel>Patrocinador</FieldLabel>
              <div ref={empresaBoxRef} className="flex items-center gap-2 rounded border bg-white px-3 py-2.5"
                style={{ borderColor: empresaOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                <Building2 size={13} className="flex-shrink-0 text-black/35" />
                <input type="text" placeholder="Buscar ou criar…" value={empresaSearch} aria-label="Patrocinador"
                  onChange={e => { setEmpresaSearch(e.target.value); setEmpresaId(""); setEmpresaOpen(true); setContatoEmpresaId(null); setContatoSugeridoChave(null); empresaTocada.current = true; setContatosEmpresa([]); setShowNovoContato(false); setExclusividade(null); setBlindagem(null); }}
                  onFocus={() => setEmpresaOpen(true)} onBlur={() => setTimeout(() => setEmpresaOpen(false), 150)}
                  className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-black outline-none" />
                {empresaSearch && <button type="button" aria-label="Limpar patrocinador" onMouseDown={e => { e.preventDefault(); setEmpresaSearch(""); setEmpresaId(""); setContatoEmpresaId(null); setContatoSugeridoChave(null); empresaTocada.current = true; setContatosEmpresa([]); setShowNovoContato(false); setExclusividade(null); setBlindagem(null); }} className="text-black/25 transition hover:text-black/50"><X size={12} /></button>}
              </div>
              {empresaOpen && (empresasFiltradas.length > 0 || (empresaSearch.trim() && !hasExactMatch)) && (
                <PortalMenu position={empresaMenuPos}>
                  {empresasFiltradas.map(empresa => (
                    <button key={empresa.id} type="button" onMouseDown={event => {
                      event.preventDefault(); setEmpresaId(empresa.id); setEmpresaSearch(empresa.nome); setEmpresaOpen(false);
                      setContatoSugeridoChave(null); empresaTocada.current = true;
                      checkBlindagem(empresa.id); checkExclusividade(empresa.id, projetoId); loadContatosEmpresa(empresa.id, { doPatrocinador: empresa.id === empresaDoPatrocinadorId });
                    }} className="w-full px-3 py-2 text-left text-[0.8125rem] text-black transition hover:bg-black/[.04]">
                      {empresa.nome}
                    </button>
                  ))}
                  {empresaSearch.trim() && !hasExactMatch && (
                    <button type="button" onMouseDown={event => { event.preventDefault(); handleCriarEmpresa(empresaSearch.trim()); }} disabled={criandoEmpresa}
                      className="w-full border-t px-3 py-2 text-left text-[0.8125rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-50"
                      style={{ borderColor: "rgba(13,13,13,.08)" }}>
                      {criandoEmpresa ? "Criando…" : `Criar "${empresaSearch.trim()}"`}
                    </button>
                  )}
                </PortalMenu>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <FieldLabel>Contato</FieldLabel>
                {!showNovoContato && (
                  <button
                    type="button"
                    onClick={() => { if (empresaId) setShowNovoContato(true); }}
                    disabled={!empresaId}
                    title={empresaId ? "Cadastrar novo contato" : "Selecione um patrocinador primeiro"}
                    className="-mt-1.5 flex items-center gap-1 rounded px-1 py-0.5 text-[0.625rem] font-semibold text-[#7259B5] transition hover:opacity-70 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <UserPlus size={10} /> Novo
                  </button>
                )}
              </div>
              {showNovoContato && empresaId ? (
                <NovoContatoInline empresaCrmId={empresaId} organizationId={organizationId}
                  onCreated={contato => {
                    setContatosEmpresa(current => [...current, contato].sort((a, b) => a.nome.localeCompare(b.nome)));
                    setContatoEmpresaId(contato.id); setShowNovoContato(false);
                  }} onCancel={() => setShowNovoContato(false)} />
              ) : (
                <CustomDropdown
                  value={contatoEmpresaId ?? (contatoSugerido ? `sugerido:${contatoSugerido.chave}` : "")}
                  onChange={value => {
                    if (value.startsWith("sugerido:")) { setContatoEmpresaId(null); setContatoSugeridoChave(value.slice("sugerido:".length)); }
                    else { setContatoSugeridoChave(null); setContatoEmpresaId(value || null); }
                  }}
                  className="[&>button]:w-full" compact icon={<Contact size={13} />}
                  placeholder={empresaId || sugeridosDisponiveis.length > 0 ? "Nenhum contato" : "Selecione um patrocinador primeiro"}
                  options={[
                    { value: "", label: "Nenhum" },
                    ...contatosEmpresa.map(contato => ({ value: contato.id, label: rotuloContato({ nome: contato.nome, cargo: contato.cargo }) })),
                    ...sugeridosDisponiveis.map(contato => ({ value: `sugerido:${contato.chave}`, label: rotuloContato(contato), icon: <Building2 size={12} className="text-[#7259B5]" aria-hidden="true" /> })),
                  ]} />
              )}
            </div>

            {(blindagem || exclusividade) && (
              <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                {blindagem && <p className="rounded border border-[#B07A14]/30 bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#9A6710]">Empresa já prospectada por {blindagem.captadorNome}.</p>}
                {exclusividade && <p role="alert" className="rounded border border-[#D94E4E]/30 bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#B83E3E]">{EXCLUSAO_LABELS[exclusividade.tipo] || exclusividade.tipo} ativa com {exclusividade.captadorNome}.</p>}
              </div>
            )}

            <div className="relative">
              <FieldLabel>Projeto</FieldLabel>
              <div ref={projetoBoxRef} className="flex items-center gap-2 rounded border bg-white px-3 py-2.5"
                style={{ borderColor: projetoOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                <FolderOpen size={13} className="flex-shrink-0 text-black/35" />
                <input type="text" placeholder="Buscar ou criar…" value={projetoSearch} aria-label="Projeto"
                  onChange={e => { setProjetoSearch(e.target.value); setProjetoId(""); setProjetoOpen(true); }}
                  onFocus={() => setProjetoOpen(true)} onBlur={() => setTimeout(() => setProjetoOpen(false), 150)}
                  className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-black outline-none" />
                {projetoSearch && <button type="button" aria-label="Limpar projeto" onMouseDown={e => { e.preventDefault(); setProjetoSearch(""); setProjetoId(""); }} className="text-black/25 transition hover:text-black/50"><X size={12} /></button>}
              </div>
              {projetoOpen && (projetosFiltrados.length > 0 || (projetoSearch.trim() && !hasExactMatchProjeto)) && (
                <PortalMenu position={projetoMenuPos}>
                  {projetosFiltrados.map(projeto => (
                    <button key={projeto.id} type="button" onMouseDown={event => {
                      event.preventDefault(); setProjetoId(projeto.id); setProjetoSearch(projeto.nome); setProjetoOpen(false);
                      if (empresaId) checkExclusividade(empresaId, projeto.id);
                    }}
                      className="w-full px-3 py-2 text-left text-[0.8125rem] text-black transition hover:bg-black/[.04]">
                      {projeto.nome}
                    </button>
                  ))}
                  {projetoSearch.trim() && !hasExactMatchProjeto && (
                    <button type="button" onMouseDown={event => { event.preventDefault(); handleCriarProjeto(projetoSearch.trim()); }} disabled={criandoProjeto}
                      className="w-full border-t px-3 py-2 text-left text-[0.8125rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-50"
                      style={{ borderColor: "rgba(13,13,13,.08)" }}>
                      {criandoProjeto ? "Criando…" : `Criar "${projetoSearch.trim()}"`}
                    </button>
                  )}
                </PortalMenu>
              )}
            </div>

            <div>
              <FieldLabel>Cota <span className="ml-1 font-normal text-black/35">(opcional)</span></FieldLabel>
              <CustomDropdown value={cotaId} disabled={!projetoId || propostaAceita || carregandoCotas}
                onChange={value => {
                  if (value === CRIAR_NOVA_COTA) {
                    window.open(`/projetos/${projetoId}?tab=proposta`, "_blank");
                    return;
                  }
                  setCotaId(value);
                  const cota = cotasVisiveis.find(item => item.id === value);
                  if (cota) setValorTexto(formatarValorBRL(cota.valor));
                }}
                className="[&>button]:w-full" compact icon={<Layers size={13} />}
                placeholder={!projetoId ? "Selecione um projeto primeiro" : carregandoCotas ? "Carregando cotas…" : cotasVisiveis.length === 0 ? "Nenhuma cota neste projeto" : "Sem cota"}
                options={[
                  ...(cotasVisiveis.length > 0 ? [{ value: "", label: "Sem cota" }] : []),
                  ...cotasVisiveis.map(cota => ({
                    value: cota.id,
                    label: `${cota.nome}${cota.modelo === "produto" && cota.produto_nome ? ` · ${cota.produto_nome}` : ""} · ${formatCotaValor(cota)}`,
                    disabled: !cotaTemDisponibilidade(cota) && cota.id !== propostaAtiva?.cota_id,
                  })),
                  { value: CRIAR_NOVA_COTA, label: "Criar nova cota…", icon: <Plus size={12} /> },
                ]} />
            </div>

            <div>
              <FieldLabel>Valor</FieldLabel>
              <CampoValor value={valorTexto} onChange={texto => { setValorTexto(texto); setErro(null); }} invalido={!propostaAceita && !valorLido.valido} ariaLabel="Valor" disabled={propostaAceita} />
              {!propostaAceita && !valorLido.valido && <p role="alert" className="mt-1 text-[0.6875rem] text-[#B23A3A]">{MENSAGEM_VALOR_INVALIDO}</p>}
            </div>

            <div>
              <FieldLabel>Etapa</FieldLabel>
              <CustomDropdown value={status} onChange={value => setStatus(value as StatusCaptacao)}
                className="[&>button]:w-full" compact icon={<TrendingUp size={13} />}
                options={etapasForm.map(({ status: value, label, Icon }) => ({ value, label, icon: <Icon size={13} /> }))} />
            </div>

            <div>
              <FieldLabel>Próximo contato</FieldLabel>
              <div className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <CalendarDays size={13} className="flex-shrink-0 text-black/35" />
                <input type="date" value={proximoFollowup} onChange={e => setProximoFollowup(e.target.value)} aria-label="Próximo contato"
                  className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-black outline-none" />
              </div>
            </div>
          </div>

          <div className="mt-5 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes}
              className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-black/55 transition hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              <ChevronDown size={13} aria-hidden="true" className={`transition-transform duration-200 motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
              Mais detalhes
            </button>
            {maisDetalhes && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel>Potencial de fechamento</FieldLabel>
                  <div className="flex" role="radiogroup" aria-label="Potencial de fechamento">
                    {POTENCIAL_OPTIONS.map((option, index) => (
                      <button key={option.value} type="button" role="radio" aria-checked={potencialFechamento === option.value} onClick={() => setPotencialFechamento(option.value)}
                        className={`relative flex flex-1 items-center justify-center gap-1.5 border bg-white px-2 py-2 text-[0.6875rem] font-semibold transition hover:z-10 hover:bg-black/[.04] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[#7259B5] ${index > 0 ? "-ml-px" : ""} ${index === 0 ? "rounded-l" : index === POTENCIAL_OPTIONS.length - 1 ? "rounded-r" : ""}`}
                        style={potencialFechamento === option.value
                          ? { color: option.color, borderColor: `${option.color}70` }
                          : { color: option.color, borderColor: "rgba(13,13,13,.10)" }}>
                        <option.Icon size={12} strokeWidth={2.5}/>{option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Previsão de fechamento</FieldLabel>
                  <div className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                    <CalendarDays size={13} className="flex-shrink-0 text-black/35" />
                    <input type="date" value={previsao} onChange={e => setPrevisao(e.target.value)} aria-label="Previsão de fechamento"
                      className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-black outline-none" />
                  </div>
                </div>

                {temEquipe && (
                  <div>
                    <FieldLabel>Supervisor</FieldLabel>
                    <CustomDropdown value={supervisorId ?? ""} onChange={value => setSupervisorId(value || null)}
                      className="[&>button]:w-full" compact icon={<UserRoundCog size={13} />}
                      placeholder="Sem supervisor"
                      options={[{ value: "", label: "Sem supervisor" }, ...supervisores.map(membro => ({ value: membro.user_id, label: membro.nome }))]} />
                  </div>
                )}

                {temEquipe && (
                  <div className="sm:col-span-2">
                    <FieldLabel>Responsável pela captação</FieldLabel>
                    {mostrarTipoResponsavel && (
                      <div className="mb-2 flex w-fit overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                        {(["interna", "externa"] as const).map(tipo => (
                          <button key={tipo} type="button" aria-pressed={captacaoTipo === tipo} onClick={() => {
                            setCaptacaoTipo(tipo);
                            if (empresaId) checkExclusividade(empresaId, projetoId, undefined, undefined, tipo);
                          }}
                            className="border-r px-3 py-1.5 text-[0.625rem] font-semibold last:border-r-0"
                            style={captacaoTipo === tipo
                              ? { background: "#0D0D0D", color: "white", borderColor: "#0D0D0D" }
                              : { background: "white", color: "rgba(13,13,13,.45)", borderColor: "rgba(13,13,13,.12)" }}>
                            {tipo === "interna" ? "Equipe interna" : "Captador externo"}
                          </button>
                        ))}
                      </div>
                    )}
                    {captacaoTipo === "interna" ? (
                      <CustomDropdown value={captadorId ?? ""} onChange={value => {
                        const nextCaptadorId = value || null;
                        setCaptadorId(nextCaptadorId);
                        if (!nextCaptadorId) setBlindagem(null);
                        else if (empresaId) {
                          checkBlindagem(empresaId, nextCaptadorId);
                          checkExclusividade(empresaId, projetoId, nextCaptadorId);
                        }
                      }} className="[&>button]:w-full" compact icon={<Users size={13} />} placeholder="Não atribuído"
                        options={[{ value: "", label: "Não atribuído" }, ...membros.map(membro => ({ value: membro.user_id, label: membro.nome }))]} />
                    ) : (
                      <CustomDropdown value={captadorExternoId ?? ""} onChange={value => {
                        const nextExternoId = value || null;
                        setCaptadorExternoId(nextExternoId);
                        if (empresaId) checkExclusividade(empresaId, projetoId, undefined, nextExternoId);
                      }}
                        className="[&>button]:w-full" compact icon={<Briefcase size={13} />} placeholder="Não atribuído"
                        options={[{ value: "", label: "Não atribuído" }, ...captadoresExt.map(captador => ({ value: captador.id, label: captador.agencia ? `${captador.nome} · ${captador.agencia}` : captador.nome }))]} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!editData && !registrarContato && (
            <div className="mt-5 border-t pt-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <button type="button" onClick={() => setRegistrarContato(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
                <Plus size={12} aria-hidden="true" /> Registrar um contato que já aconteceu
              </button>
            </div>
          )}

          {!editData && registrarContato && (
          <section className="mt-5 border-t pt-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <SectionLabel>Contato já realizado</SectionLabel>
              <button type="button" onClick={() => {
                setRegistrarContato(false); setCanalRealizado(null); setResultadoContato(null); setResumoContato("");
                setDataContato(new Date().toISOString().slice(0, 16));
              }} className="-mt-1.5 rounded px-1.5 py-1 text-[0.6875rem] text-black/40 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                Não registrar
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Canal utilizado</FieldLabel>
                <CustomDropdown value={canalRealizado ?? ""} onChange={value => setCanalRealizado((value || null) as CanalContato | null)}
                  className="[&>button]:w-full" compact placeholder="Nenhum" placement="top"
                  options={[{ value: "", label: "Nenhum" }, ...canaisAtivos.map(item => ({ value: item.chave, label: item.label }))]} />
              </div>
              <div>
                <FieldLabel>Resultado</FieldLabel>
                <CustomDropdown value={resultadoContato ?? ""} onChange={value => setResultadoContato((value || null) as ResultadoInteracao | null)}
                  className="[&>button]:w-full" compact placeholder="Nenhum" placement="top"
                  options={[{ value: "", label: "Nenhum" }, ...resultadosAtivos.map(item => ({ value: item.chave, label: item.label }))]} />
              </div>
              <div>
                <FieldLabel>Data e hora</FieldLabel>
                <input type="datetime-local" value={dataContato} onChange={e => setDataContato(e.target.value)}
                  className="w-full rounded border bg-white px-3 py-2.5 text-[0.75rem] outline-none" style={{ borderColor: "rgba(13,13,13,.15)" }} />
              </div>
              <div>
                <FieldLabel>Resumo</FieldLabel>
                <input value={resumoContato} onChange={e => setResumoContato(e.target.value)} placeholder="O que aconteceu?"
                  className="w-full rounded border bg-white px-3 py-2.5 text-[0.75rem] outline-none" style={{ borderColor: "rgba(13,13,13,.15)" }} />
              </div>
            </div>
          </section>
          )}
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5 sm:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={saving}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.75rem] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed">
              <Save size={12} /> {saving ? "Salvando…" : editData ? "Salvar" : "Criar negociação"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
