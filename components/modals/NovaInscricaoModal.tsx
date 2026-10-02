"use client";
import { useState, useEffect, useId, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Building2, FolderOpen, Layers, Plus,
  CalendarDays, Save, Circle, Users, UserRound, Tag, ArrowDown, Minus, ArrowUp,
} from "lucide-react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StatusEdital, PotencialFechamento } from "@/lib/supabase/types";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { useLeiOptions } from "@/hooks/useLeiOptions";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";
import { NovoProjetoModal } from "@/components/modals/NovoProjetoModal";
import { cotaTemDisponibilidade, formatCotaValor, valorForaDaFaixa } from "@/lib/cotas";
import { useModalDismiss } from "@/hooks/useModalDismiss";

const CRIAR_NOVA_COTA = "__criar_nova_cota__";

type EmpresaCRM = { id: string; nome: string };
type Projeto    = { id: string; nome: string };
type CotaOption = {
  id: string;
  nome: string;
  valor: number;
  valor_maximo: number | null;
  modelo: "nivel" | "produto";
  produto_nome: string | null;
  contrapartidas: string[];
  status: "disponivel" | "reservada" | "vendida";
  unidades: number;
  unidades_ilimitadas: boolean;
  unidades_vendidas: number;
};

export type EditDataInscricao = {
  id: string;
  empresa_crm_id: string | null;
  empresa_crm_nome: string | null;
  projeto_id: string | null;
  projeto_nome: string | null;
  cota_id?: string | null;
  titulo: string | null;
  lei?: string | null;
  valor: number | null;
  status: StatusEdital;
  data_abertura: string | null;
  data_fechamento: string | null;
  data_resultado: string | null;
  potencial_fechamento?: PotencialFechamento | null;
  responsavel_tipo?: "agencia" | "membro" | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
};

const POTENCIAL_OPTIONS: { value: PotencialFechamento; label: string; color: string; Icon: LucideIcon }[] = [
  { value: "baixo", label: "Baixo", color: "#777777", Icon: ArrowDown },
  { value: "medio", label: "Médio", color: "#B07A14", Icon: Minus },
  { value: "alto", label: "Alto", color: "#D94E4E", Icon: ArrowUp },
];

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">{label}</label>
      <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
        <CalendarDays size={13} className="text-black/35 flex-shrink-0" />
        <input
          type="date"
          value={value}
          onChange={event => onChange(event.target.value)}
          className="flex-1 text-[0.8125rem] outline-none bg-transparent text-black min-w-0"
        />
      </div>
    </div>
  );
}

export function NovaInscricaoModal({ onClose, onSaved, nomePreEmpresa, empresaPreId, empresaPubId, statusPre, potentialPre, tituloPre, leiPre, dataAberturaPre, dataFechamentoPre, editData, initialProjetoId, initialProjetoNome }: {
  onClose: () => void;
  onSaved: (id?: string) => void;
  nomePreEmpresa?: string;
  empresaPreId?: string;
  empresaPubId?: string;
  statusPre?: StatusEdital;
  potentialPre?: PotencialFechamento;
  tituloPre?: string;
  leiPre?: string;
  dataAberturaPre?: string;
  dataFechamentoPre?: string;
  editData?: EditDataInscricao;
  initialProjetoId?: string;
  initialProjetoNome?: string;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const { etiquetasInscricao } = useEtiquetas();
  const { options: leiOptions } = useLeiOptions();
  const etapas = etiquetasInscricao.map((etiqueta) => ({
    status: etiqueta.key as StatusEdital,
    Icon: ((Icons as any)[etiqueta.icone] as LucideIcon | undefined) ?? Circle,
    label: etiqueta.label,
    color: etiqueta.cor,
  }));
  const [empresas, setEmpresas]   = useState<EmpresaCRM[]>([]);
  const [projetos, setProjetos]   = useState<Projeto[]>([]);
  const [cotas, setCotas]         = useState<CotaOption[]>([]);
  const [loadingCotas, setLoadingCotas] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [erro, setErro]           = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  const [empresaId, setEmpresaId]         = useState(editData?.empresa_crm_id ?? empresaPreId ?? "");
  const [empresaSearch, setEmpresaSearch] = useState(editData?.empresa_crm_nome ?? nomePreEmpresa ?? "");
  const [empresaOpen, setEmpresaOpen]     = useState(false);
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const empresaBoxRef = useRef<HTMLDivElement>(null);
  const empresaMenuPos = usePortalPosition(empresaBoxRef, empresaOpen);
  const [titulo, setTitulo]               = useState(editData?.titulo ?? tituloPre ?? "");
  const [lei, setLei]                     = useState(editData?.lei ?? leiPre ?? "");
  const [projetoId, setProjetoId]         = useState(editData?.projeto_id ?? initialProjetoId ?? "");
  const [projetoSearch, setProjetoSearch] = useState(editData?.projeto_nome ?? initialProjetoNome ?? "");
  const [projetoOpen, setProjetoOpen]     = useState(false);
  const [criandoProjeto, setCriandoProjeto] = useState(false);
  const [showNovoProjeto, setShowNovoProjeto] = useState(false);
  const projetoBoxRef = useRef<HTMLDivElement>(null);
  const projetoMenuPos = usePortalPosition(projetoBoxRef, projetoOpen);
  const [cotaId, setCotaId]               = useState(editData?.cota_id ?? "");
  const [valorInput, setValorInput] = useState(editData?.valor != null ? editData.valor.toLocaleString("pt-BR", { useGrouping: false, minimumFractionDigits: 2 }) : "");
  const [status, setStatus]               = useState<StatusEdital>(editData?.status ?? statusPre ?? "interesse");
  const [potencialFechamento, setPotencialFechamento] = useState<PotencialFechamento>(editData?.potencial_fechamento ?? potentialPre ?? "medio");
  const [dataAbertura, setDataAbertura]   = useState(editData?.data_abertura ?? dataAberturaPre ?? "");
  const [dataFechamento, setDataFechamento] = useState(editData?.data_fechamento ?? dataFechamentoPre ?? "");
  const [dataResultado, setDataResultado] = useState(editData?.data_resultado ?? "");

  type ResponsavelOpcao = { id: string; label: string; sublabel?: string };
  const [agencias, setAgencias] = useState<ResponsavelOpcao[]>([]);
  const [membros, setMembros]   = useState<ResponsavelOpcao[]>([]);
  const [responsavelTipo, setResponsavelTipo] = useState<"agencia" | "membro" | null>(editData?.responsavel_tipo ?? null);
  const [responsavelId, setResponsavelId]     = useState<string>(editData?.responsavel_id ?? "");
  const [responsavelPesquisa, setResponsavelPesquisa] = useState(editData?.responsavel_nome ?? "");
  const [responsavelOpen, setResponsavelOpen] = useState(false);
  const [criandoAgencia, setCriandoAgencia] = useState(false);
  const responsavelBoxRef = useRef<HTMLDivElement>(null);
  const responsavelMenuPos = usePortalPosition(responsavelBoxRef, responsavelOpen);

  useEffect(() => {
    supabase.from("empresas_crm").select("id, nome").order("nome").limit(200)
      .then(({ data }) => setEmpresas(data ?? []));
    if (organizationId) {
      // Restrito à organização atual — projetos_crm não isola por RLS (só por dono),
      // então sem esse filtro apareciam projetos de outras organizações do mesmo usuário.
      supabase.from("projetos_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(100)
        .then(({ data }) => setProjetos(data ?? []));
      (supabase as any).from("captadores").select("id, nome, agencia").eq("organization_id", organizationId).or("ativo.eq.true,ativo.is.null").order("nome").limit(100)
        .then(({ data }: { data: { id: string; nome: string; agencia: string | null }[] | null }) =>
          setAgencias((data ?? []).map((a) => ({ id: a.id, label: a.agencia || a.nome, sublabel: a.agencia ? a.nome : undefined })))
        );
      (supabase as any).rpc("get_organization_members", { org_id: organizationId })
        .then(({ data }: { data: { user_id: string; full_name: string; email: string | null }[] | null }) =>
          setMembros((data ?? []).filter((m) => m.full_name).map((m) => ({ id: m.user_id, label: m.full_name, sublabel: m.email ?? undefined })))
        );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCotas = useCallback((projeto: string) => {
    setLoadingCotas(true);
    (supabase as any)
      .from("cotas_patrocinio")
      .select("id,nome,valor,valor_maximo,modelo,produto_nome,contrapartidas,status,unidades,unidades_ilimitadas,unidades_vendidas")
      .eq("projeto_id", projeto)
      .eq("organization_id", organizationId)
      .order("ordem")
      .then(({ data }: { data: CotaOption[] | null }) => {
        const next = data ?? [];
        setCotas(next);
        setCotaId(current => current && next.some(cota => cota.id === current) ? current : "");
        setLoadingCotas(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    if (!projetoId) {
      setCotas([]);
      setCotaId("");
      return;
    }
    fetchCotas(projetoId);
  }, [projetoId, fetchCotas]);

  // Ao voltar de criar uma cota numa aba nova (aberta a partir de "+ Criar nova cota"),
  // recarrega a lista pra que a cota recém-criada já apareça sem fechar o formulário atual.
  useEffect(() => {
    if (!projetoId) return;
    function onFocus() { fetchCotas(projetoId); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [projetoId, fetchCotas]);

  const cotaSelecionada = cotas.find(cota => cota.id === cotaId) ?? null;
  const responsavelBase = responsavelTipo === "agencia" ? agencias : membros;
  const responsavelFiltrados = responsavelBase.filter(r =>
    (r.label + (r.sublabel ?? "")).toLowerCase().includes(responsavelPesquisa.toLowerCase())
  );
  const hasExactMatchResponsavel = responsavelBase.some(r => r.label.toLowerCase() === responsavelPesquisa.trim().toLowerCase());
  function selecionarResponsavel(opcao: ResponsavelOpcao) {
    setResponsavelId(opcao.id);
    setResponsavelPesquisa(opcao.sublabel ? `${opcao.sublabel} · ${opcao.label}` : opcao.label);
    setResponsavelOpen(false);
  }
  function trocarResponsavelTipo(tipo: "agencia" | "membro") {
    setResponsavelTipo(tipo);
    setResponsavelId("");
    setResponsavelPesquisa("");
  }
  async function handleCriarAgencia(nomeAgencia: string) {
    if (!nomeAgencia.trim() || criandoAgencia || !organizationId) return;
    setCriandoAgencia(true);
    const { data } = await (supabase as any)
      .from("captadores")
      .insert({ organization_id: organizationId, nome: nomeAgencia.trim(), prioridade: "media", ativo: true })
      .select("id, nome, agencia").single();
    setCriandoAgencia(false);
    if (!data) return;
    const opcao: ResponsavelOpcao = { id: data.id, label: data.agencia || data.nome, sublabel: data.agencia ? data.nome : undefined };
    setAgencias(prev => [...prev, opcao].sort((a, b) => a.label.localeCompare(b.label)));
    selecionarResponsavel(opcao);
  }

  const empresasFiltradas = empresas.filter(e =>
    e.nome.toLowerCase().includes(empresaSearch.toLowerCase())
  );
  const hasExactMatch = empresas.some(e => e.nome.toLowerCase() === empresaSearch.trim().toLowerCase());

  const projetosFiltrados = projetos.filter(p =>
    p.nome.toLowerCase().includes(projetoSearch.toLowerCase())
  );
  const hasExactMatchProjeto = projetos.some(p => p.nome.toLowerCase() === projetoSearch.trim().toLowerCase());

  async function handleCriarProjeto(nome: string) {
    if (!nome.trim() || criandoProjeto) return;
    setCriandoProjeto(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from("projetos_crm")
      .insert({ nome: nome.trim(), account_id: user?.id, organization_id: organizationId })
      .select("id, nome")
      .single();
    setCriandoProjeto(false);
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível criar o projeto.");
      return;
    }
    setProjetos(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setProjetoId(data.id);
    setProjetoSearch(data.nome);
    setCotaId("");
    setProjetoOpen(false);
  }

  async function handleNovoProjetoCompletoSalvo(novoProjetoId?: string) {
    setShowNovoProjeto(false);
    if (!novoProjetoId) return;
    // Usa o id que o próprio modal de criação já devolve, em vez de "adivinhar"
    // o projeto mais recente da conta — duas criações quase simultâneas
    // (duas abas, duplo clique) podiam fazer a consulta por recência pegar o
    // projeto errado, além de não filtrar por organização.
    const { data } = await (supabase as any)
      .from("projetos_crm")
      .select("id, nome")
      .eq("id", novoProjetoId)
      .maybeSingle();
    if (!data) return;
    setProjetos(prev => prev.some(p => p.id === data.id) ? prev : [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setProjetoId(data.id);
    setProjetoSearch(data.nome);
    setCotaId("");
  }

  // Reaproveita uma empresa_crm já existente com esse nome (ex.: já criada por outro
  // caminho) em vez de duplicar, e só cria uma nova se realmente não houver uma.
  // Quando vinculada a uma empresa "Base" (empresaPubId), grava esse vínculo direto —
  // assim a próxima resolução automática já encontra sem depender de heurística.
  async function resolverOuCriarEmpresa(nome: string, userId: string): Promise<{ id: string; nome: string } | null> {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return null;
    const { data: existente } = await (supabase as any)
      .from("empresas_crm")
      .select("id, nome")
      .ilike("nome", nomeTrim)
      .limit(1)
      .maybeSingle();
    if (existente) return existente;
    const { data: criada } = await (supabase as any)
      .from("empresas_crm")
      .insert({ nome: nomeTrim, account_id: userId, organization_id: organizationId, empresa_pub_id: empresaPubId || null })
      .select("id, nome")
      .single();
    return criada ?? null;
  }

  async function handleCriarEmpresa(nome: string) {
    if (!nome.trim() || criandoEmpresa) return;
    setCriandoEmpresa(true);
    const { data: { user } } = await supabase.auth.getUser();
    const empresa = await resolverOuCriarEmpresa(nome, user?.id ?? "");
    setCriandoEmpresa(false);
    if (!empresa) return;
    setEmpresas(prev => prev.some(e => e.id === empresa.id) ? prev : [...prev, empresa].sort((a, b) => a.nome.localeCompare(b.nome)));
    setEmpresaId(empresa.id);
    setEmpresaSearch(empresa.nome);
    setEmpresaOpen(false);
  }

  async function handleSalvar() {
    setSaving(true);
    setErro(null);
    const valorNegociado = valorInput.trim() ? Number(valorInput.replace(/\./g, "").replace(",", ".")) : null;
    if (valorNegociado != null && (!Number.isFinite(valorNegociado) || valorNegociado < 0)) {
      setErro("Informe um valor de inscrição válido."); setSaving(false); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado"); setSaving(false); return; }

    // O campo Patrocinador pode chegar só com o nome preenchido (sugestão a partir do
    // edital/empresa de origem) sem um empresaId resolvido ainda — garante o vínculo
    // agora em vez de salvar a inscrição sem empresa.
    let empresaIdFinal = empresaId;
    if (!empresaIdFinal && empresaSearch.trim()) {
      const empresa = await resolverOuCriarEmpresa(empresaSearch, user.id);
      if (empresa) {
        empresaIdFinal = empresa.id;
        setEmpresaId(empresa.id);
      }
    }

    const payload = {
      empresa_crm_id:  empresaIdFinal || null,
      empresa_id:      empresaPubId   || null,
      projeto_id:      projetoId      || null,
      cota_id:         cotaId         || null,
      titulo:          titulo.trim()  || null,
      lei:             lei            || null,
      valor:           valorNegociado ?? cotaSelecionada?.valor ?? editData?.valor ?? null,
      status,
      potencial_fechamento: potencialFechamento,
      data_abertura:   dataAbertura   || null,
      data_fechamento: dataFechamento || null,
      data_resultado:  dataResultado  || null,
      responsavel_tipo: responsavelTipo,
      responsavel_id:  responsavelId || null,
      responsavel_nome: responsavelTipo && responsavelId
        ? (responsavelBase.find(r => r.id === responsavelId)?.label ?? responsavelPesquisa) || null
        : null,
    };

    const writePayload = { ...payload } as Record<string, unknown>;
    let error: { message: string } | null = null;
    let savedId: string | null = editData?.id ?? null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = editData?.id
        ? await (supabase as any).from("editais_user").update(writePayload).eq("id", editData.id).select("id").single()
        : await (supabase as any).from("editais_user").insert({ account_id: user.id, organization_id: organizationId, ...writePayload }).select("id").single();
      error = result.error;
      if (!error) { savedId = result.data?.id ?? savedId; break; }

      let removedLegacyField = false;
      if (/potencial_fechamento/i.test(error.message) && "potencial_fechamento" in writePayload) {
        delete writePayload.potencial_fechamento;
        removedLegacyField = true;
      }
      if (/\blei\b/i.test(error.message) && "lei" in writePayload) {
        delete writePayload.lei;
        removedLegacyField = true;
      }
      if (!removedLegacyField) break;
    }

    setSaving(false);
    if (error) { setErro(error.message); return; }
    onSaved(savedId ?? undefined);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-[calc(100%_-_24px)] flex-col overflow-hidden rounded-b bg-white"
        style={{ maxWidth: "61.25rem", maxHeight: "100vh", boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-7 pt-6 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-black/5 flex items-center justify-center">
              <FolderOpen size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="text-[0.9375rem] font-bold text-black">{editData ? "Editar inscrição" : "Nova inscrição"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/6 transition">
            <X size={15} className="text-black/40" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* Col 1 — dados */}
          <div className="min-w-0 shrink-0 space-y-4 p-6 md:flex-[0_0_56%] md:overflow-y-auto">
            {/* Patrocinador — combobox */}
            <div className="relative">
              <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Patrocinador</label>
              <div ref={empresaBoxRef} className="flex items-center border rounded px-3 py-2.5 gap-2 bg-white" style={{ borderColor: empresaOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                <Building2 size={13} className="text-black/35 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar ou criar empresa…"
                  value={empresaSearch}
                  onChange={e => { setEmpresaSearch(e.target.value); setEmpresaId(""); setEmpresaOpen(true); }}
                  onFocus={() => setEmpresaOpen(true)}
                  onBlur={() => setTimeout(() => setEmpresaOpen(false), 150)}
                  className="flex-1 text-[0.8125rem] outline-none bg-transparent text-black min-w-0"
                />
                {empresaSearch && (
                  <button
                    onMouseDown={e => { e.preventDefault(); setEmpresaSearch(""); setEmpresaId(""); }}
                    className="text-black/25 hover:text-black/50 transition flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {empresaOpen && (empresasFiltradas.length > 0 || (empresaSearch.trim() && !hasExactMatch)) && (
                <PortalMenu position={empresaMenuPos}>
                  {empresasFiltradas.map(e => (
                    <button
                      key={e.id}
                      onMouseDown={ev => { ev.preventDefault(); setEmpresaId(e.id); setEmpresaSearch(e.nome); setEmpresaOpen(false); }}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] text-black hover:bg-black/[0.04] transition"
                    >
                      {e.nome}
                    </button>
                  ))}
                  {empresaSearch.trim() && !hasExactMatch && (
                    <button
                      onMouseDown={ev => { ev.preventDefault(); handleCriarEmpresa(empresaSearch.trim()); }}
                      disabled={criandoEmpresa}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold text-[#7259B5] hover:bg-black/[0.04] transition border-t disabled:opacity-50"
                      style={{ borderColor: "rgba(13,13,13,.08)" }}
                    >
                      {criandoEmpresa ? "Criando…" : `+ Criar "${empresaSearch.trim()}"`}
                    </button>
                  )}
                </PortalMenu>
              )}
            </div>

            {/* Título do edital */}
            <div>
              <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Título do edital</label>
              <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <FolderOpen size={13} className="text-black/35 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Nome do edital / chamada pública"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  className="flex-1 text-[0.8125rem] outline-none bg-transparent text-black min-w-0"
                />
              </div>
            </div>

            {/* Tipo de patrocínio */}
            <div>
              <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Tipo de patrocínio</label>
              <CustomDropdown
                value={lei}
                onChange={setLei}
                placeholder="Selecionar lei"
                compact
                emphasized={false}
                className="[&>button]:w-full"
                icon={<Tag size={13} />}
                options={leiOptions.map(option => {
                  const Icon = ((Icons as unknown as Record<string, LucideIcon | undefined>)[option.iconName ?? ""])
                    ?? Tag;
                  return {
                    value: option.status,
                    label: option.label,
                    icon: <Icon size={13} strokeWidth={1.8} style={{ color: option.bg }} />,
                  };
                })}
              />
            </div>

            {/* Projeto — combobox */}
            <div className="relative">
              <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Projeto</label>
              <div ref={projetoBoxRef} className="flex items-center border rounded px-3 py-2.5 gap-2 bg-white" style={{ borderColor: projetoOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                <FolderOpen size={13} className="text-black/35 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar ou criar projeto…"
                  value={projetoSearch}
                  onChange={e => { setProjetoSearch(e.target.value); setProjetoId(""); setCotaId(""); setProjetoOpen(true); }}
                  onFocus={() => setProjetoOpen(true)}
                  onBlur={() => setTimeout(() => setProjetoOpen(false), 150)}
                  className="flex-1 text-[0.8125rem] outline-none bg-transparent text-black min-w-0"
                />
                {projetoSearch && (
                  <button
                    onMouseDown={e => { e.preventDefault(); setProjetoSearch(""); setProjetoId(""); setCotaId(""); }}
                    className="text-black/25 hover:text-black/50 transition flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {projetoOpen && (
                <PortalMenu position={projetoMenuPos}>
                  {projetosFiltrados.map(p => (
                    <button
                      key={p.id}
                      onMouseDown={ev => { ev.preventDefault(); setProjetoId(p.id); setProjetoSearch(p.nome); setCotaId(""); setProjetoOpen(false); }}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] text-black hover:bg-black/[0.04] transition"
                    >
                      {p.nome}
                    </button>
                  ))}
                  {projetoSearch.trim() && !hasExactMatchProjeto && (
                    <button
                      onMouseDown={ev => { ev.preventDefault(); handleCriarProjeto(projetoSearch.trim()); }}
                      disabled={criandoProjeto}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold text-[#7259B5] hover:bg-black/[0.04] transition border-t disabled:opacity-50"
                      style={{ borderColor: "rgba(13,13,13,.08)" }}
                    >
                      {criandoProjeto ? "Criando…" : `+ Criar "${projetoSearch.trim()}"`}
                    </button>
                  )}
                  <button
                    onMouseDown={ev => { ev.preventDefault(); setProjetoOpen(false); setShowNovoProjeto(true); }}
                    className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold text-black/55 hover:bg-black/[0.04] transition border-t flex items-center gap-1.5"
                    style={{ borderColor: "rgba(13,13,13,.08)" }}
                  >
                    <Plus size={12} /> Criar novo projeto…
                  </button>
                </PortalMenu>
              )}
            </div>

            {/* Cota — fonte do valor e das contrapartidas */}
            <div>
              <label className="mb-1.5 block text-[0.75rem] font-semibold text-black">Cota</label>
              <CustomDropdown
                value={cotaId}
                onChange={value => {
                  if (value === CRIAR_NOVA_COTA) {
                    window.open(`/projetos/${projetoId}?tab=proposta`, "_blank");
                    return;
                  }
                  setCotaId(value);
                  const selecionada = cotas.find(cota => cota.id === value);
                  if (selecionada) setValorInput(selecionada.valor.toLocaleString("pt-BR", { useGrouping: false, minimumFractionDigits: 2 }));
                }}
                placeholder={!projetoId ? "Selecione um projeto primeiro" : loadingCotas ? "Carregando cotas…" : cotas.length === 0 ? "Nenhuma cota neste projeto" : "Selecionar cota"}
                compact
                disabled={!projetoId || loadingCotas}
                className="[&>button]:w-full [&>button:disabled]:bg-white"
                icon={<Layers size={13} />}
                options={[
                  ...cotas.map(cota => ({
                    value: cota.id,
                    label: `${cota.nome}${cota.modelo === "produto" && cota.produto_nome ? ` · ${cota.produto_nome}` : ""} · ${formatCotaValor(cota)}`,
                    disabled: !cotaTemDisponibilidade(cota) && cota.id !== editData?.cota_id,
                  })),
                  { value: CRIAR_NOVA_COTA, label: "+ Criar nova cota…", icon: <Plus size={12} /> },
                ]}
              />
              {cotaSelecionada && (
                <div className="mt-2 rounded border border-black/[.07] bg-black/[.018] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[0.625rem] font-medium text-black/35">Referência da cota</span>
                    <span className="text-[0.75rem] font-semibold tabular-nums text-black/70">{formatCotaValor(cotaSelecionada)}</span>
                  </div>
                  <label className="mt-2 block text-[0.625rem] font-medium text-black/45">Valor desta inscrição (R$)</label>
                  <input inputMode="decimal" value={valorInput} onChange={event => setValorInput(event.target.value)}
                    className="mt-1 w-full rounded border border-black/15 bg-white px-2.5 py-2 text-[0.75rem] text-black outline-none focus:border-[#7259B5]" />
                  {valorForaDaFaixa(cotaSelecionada, valorInput.trim() ? Number(valorInput.replace(/\./g, "").replace(",", ".")) : null) &&
                    <p className="mt-1.5 text-[0.625rem] text-[#B07A14]">Fora da faixa sugerida; confira se outra cota é mais adequada.</p>}
                  <p className="mt-1.5 text-[0.625rem] leading-4 text-black/40">
                    {cotaSelecionada.contrapartidas.length > 0
                      ? `${cotaSelecionada.contrapartidas.length} contrapartida${cotaSelecionada.contrapartidas.length === 1 ? "" : "s"} serão transformadas em entregas se a inscrição for aprovada.`
                      : "Esta cota ainda não possui contrapartidas."}
                  </p>
                </div>
              )}
            </div>

            {/* Responsável — agência ou membro */}
            <div>
              <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Responsável</label>
              <div className="flex rounded overflow-hidden border mb-2" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                {(["agencia", "membro"] as const).map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => trocarResponsavelTipo(tipo)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[0.6875rem] font-semibold transition"
                    style={responsavelTipo === tipo
                      ? { background: "#0D0D0D", color: "#fff" }
                      : { background: "#fff", color: "rgba(13,13,13,.45)" }}
                  >
                    {tipo === "agencia" ? <Building2 size={12} /> : <Users size={12} />}
                    {tipo === "agencia" ? "Agência" : "Equipe"}
                  </button>
                ))}
              </div>
              {responsavelTipo && (
                <div className="relative">
                  <div ref={responsavelBoxRef} className="flex items-center border rounded px-3 py-2.5 gap-2 bg-white" style={{ borderColor: responsavelOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                    {responsavelTipo === "agencia"
                      ? <Building2 size={13} className="text-black/35 flex-shrink-0" />
                      : <UserRound size={13} className="text-black/35 flex-shrink-0" />}
                    <input
                      type="text"
                      placeholder={responsavelTipo === "agencia" ? "Buscar ou criar agência…" : "Buscar membro da equipe…"}
                      value={responsavelPesquisa}
                      onChange={e => { const v = e.target.value; setResponsavelPesquisa(v); setResponsavelId(""); setResponsavelOpen(v.trim().length > 0); }}
                      onFocus={() => { if (responsavelPesquisa.trim()) setResponsavelOpen(true); }}
                      onBlur={() => setTimeout(() => setResponsavelOpen(false), 150)}
                      className="flex-1 text-[0.8125rem] outline-none bg-transparent text-black min-w-0"
                    />
                    {responsavelPesquisa && (
                      <button
                        onMouseDown={e => { e.preventDefault(); setResponsavelPesquisa(""); setResponsavelId(""); }}
                        className="text-black/25 hover:text-black/50 transition flex-shrink-0"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {responsavelOpen && (responsavelFiltrados.length > 0 || (responsavelTipo === "agencia" && responsavelPesquisa.trim() && !hasExactMatchResponsavel)) && (
                    <PortalMenu position={responsavelMenuPos}>
                      {responsavelFiltrados.map(r => (
                        <button
                          key={r.id}
                          onMouseDown={ev => { ev.preventDefault(); selecionarResponsavel(r); }}
                          className="w-full text-left px-3 py-2 hover:bg-black/[0.04] transition"
                        >
                          <span className="block text-[0.8125rem] text-black">{r.label}</span>
                          {r.sublabel && <span className="block text-[0.625rem] text-black/35">{r.sublabel}</span>}
                        </button>
                      ))}
                      {responsavelTipo === "agencia" && responsavelPesquisa.trim() && !hasExactMatchResponsavel && (
                        <button
                          type="button"
                          onMouseDown={ev => { ev.preventDefault(); handleCriarAgencia(responsavelPesquisa.trim()); }}
                          disabled={criandoAgencia}
                          className="w-full border-t px-3 py-2 text-left text-[0.8125rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-50"
                          style={{ borderColor: "rgba(13,13,13,.08)" }}
                        >
                          {criandoAgencia ? "Criando…" : `+ Criar "${responsavelPesquisa.trim()}"`}
                        </button>
                      )}
                    </PortalMenu>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Divider */}
          <div className="h-px shrink-0 md:h-auto md:w-px" style={{ background: "rgba(13,13,13,.07)" }} />

          {/* Col 2 — decisão e cronograma */}
          <div className="min-w-0 shrink-0 space-y-5 p-6 md:flex-[0_0_44%] md:overflow-y-auto">
            <section>
              <p className="mb-4 text-[0.625rem] font-bold uppercase tracking-widest text-black/30">Definição comercial</p>
              <div>
                <label className="mb-2 block text-[0.75rem] font-semibold text-black">Etapa da inscrição</label>
                <div className="flex">
                  {(() => {
                    const currentIdx = etapas.findIndex(e => e.status === status);
                    const currentColor = etapas[currentIdx]?.color;
                    const isReprovado = status === "reprovado";
                    return etapas.map(({ status: s, Icon, label }, idx) => {
                      const isActive = isReprovado ? s === "reprovado" : idx <= currentIdx;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          title={label}
                          className={[
                            "relative flex h-9 w-9 items-center justify-center border-b border-t transition",
                            idx === 0 ? "rounded-l border-l" : "",
                            idx === etapas.length - 1 ? "rounded-r border-r" : "",
                            isActive ? "z-10" : "",
                          ].join(" ")}
                          style={isActive
                            ? { background: currentColor, color: "#fff", borderColor: currentColor }
                            : { background: "#fff", color: "rgba(13,13,13,.35)", borderColor: "rgba(13,13,13,.12)" }}
                        >
                          <Icon size={15} />
                        </button>
                      );
                    });
                  })()}
                </div>
                <p className="mt-1.5 text-[0.625rem] font-medium" style={{ color: etapas.find(e => e.status === status)?.color ?? "rgba(13,13,13,.3)" }}>
                  {etapas.find(e => e.status === status)?.label}
                </p>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-[0.75rem] font-semibold text-black">Potencial de fechamento</label>
                <div className="flex">
                  {POTENCIAL_OPTIONS.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPotencialFechamento(option.value)}
                      className={`relative flex flex-1 items-center justify-center gap-1.5 border bg-white px-2 py-2 text-[0.6875rem] font-semibold transition hover:z-10 hover:bg-black/[.025] ${index > 0 ? "-ml-px" : ""} ${index === 0 ? "rounded-l" : index === POTENCIAL_OPTIONS.length - 1 ? "rounded-r" : ""}`}
                      style={potencialFechamento === option.value
                        ? { color: option.color, borderColor: `${option.color}70` }
                        : { color: option.color, borderColor: "rgba(13,13,13,.10)" }}
                    >
                      <option.Icon size={12} strokeWidth={2.4} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="border-t border-black/[.07] pt-5">
              <p className="mb-4 text-[0.625rem] font-bold uppercase tracking-widest text-black/30">Cronograma de captação</p>
              <div className="space-y-4">
            <DateField label="Data de abertura"   value={dataAbertura}   onChange={setDataAbertura} />
            <DateField label="Data de fechamento" value={dataFechamento}  onChange={setDataFechamento} />
            <DateField label="Data do resultado"  value={dataResultado}   onChange={setDataResultado} />
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between px-7 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro && <p role="alert" className="text-xs text-[#D94E4E] font-medium">{erro}</p>}
          {!erro && <div />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-[0.75rem] font-semibold text-black/35 hover:text-black/55 transition">
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 text-[0.75rem] font-bold bg-[#2E8932] text-white rounded hover:bg-[#26752A] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={12} /> {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
      {showNovoProjeto && createPortal(
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div onClick={e => e.stopPropagation()}>
          <NovoProjetoModal
            onClose={() => setShowNovoProjeto(false)}
            onSaved={handleNovoProjetoCompletoSalvo}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
