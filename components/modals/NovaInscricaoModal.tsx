"use client";
import { useState, useEffect, useId, useRef, useCallback } from "react";
import {
  X, Building2, FolderOpen, Layers, Plus, ChevronDown, TrendingUp,
  CalendarDays, Save, Circle, Users, UserRound, Tag,
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
import { cotaTemDisponibilidade, formatCotaValor, valorForaDaFaixa } from "@/lib/cotas";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useValorDefinidoPorProposta } from "@/hooks/useValorDefinidoPorProposta";
import { CampoValor } from "@/components/ui/CampoValor";
import { PotencialSegmentado } from "@/components/ui/PotencialSegmentado";
import { resolveCompanyDomain } from "@/components/CompanyLogo";
import { MENSAGEM_VALOR_INVALIDO, formatarValorBRL, lerValorBRL } from "@/lib/valor";
import { DESFECHOS_INSCRICAO, etapaInicial, etapasDoFormulario } from "@/lib/etapas";

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

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[0.75rem] font-semibold text-[#282525]">{children}</p>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Rotulo>{label}</Rotulo>
      <div className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.15)" }}>
        <CalendarDays size={13} className="flex-shrink-0 text-black/35" />
        <input
          type="date"
          value={value}
          aria-label={label}
          onChange={event => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-[#282525] outline-none"
        />
      </div>
    </div>
  );
}

export function NovaInscricaoModal({ onClose, onSaved, nomePreEmpresa, empresaPreId, empresaPubId, sitePreEmpresa, statusPre, potentialPre, leiPre, dataAberturaPre, dataFechamentoPre, editData, initialProjetoId, initialProjetoNome }: {
  onClose: () => void;
  onSaved: (id?: string) => void;
  nomePreEmpresa?: string;
  empresaPreId?: string;
  empresaPubId?: string;
  /** Site da empresa-base: gravado junto com a empresa do CRM (dá o logo), sem campo na tela. */
  sitePreEmpresa?: string;
  statusPre?: StatusEdital;
  potentialPre?: PotencialFechamento;
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
  const [lei, setLei]                     = useState(editData?.lei ?? leiPre ?? "");
  const [projetoId, setProjetoId]         = useState(editData?.projeto_id ?? initialProjetoId ?? "");
  const [projetoSearch, setProjetoSearch] = useState(editData?.projeto_nome ?? initialProjetoNome ?? "");
  const [projetoOpen, setProjetoOpen]     = useState(false);
  const [criandoProjeto, setCriandoProjeto] = useState(false);
  const projetoBoxRef = useRef<HTMLDivElement>(null);
  const projetoMenuPos = usePortalPosition(projetoBoxRef, projetoOpen);
  const [cotaId, setCotaId]               = useState(editData?.cota_id ?? "");
  const [valorTexto, setValorTexto] = useState(() => formatarValorBRL(editData?.valor));
  const valorLido = lerValorBRL(valorTexto);
  // Com proposta ativa o valor vem dela e só muda negociando a proposta.
  const valorDaProposta = useValorDefinidoPorProposta("editais_user", editData?.id);
  // Desfechos (aprovado, reprovado, cancelado) não entram no cadastro.
  const etapasForm = etapasDoFormulario(etapas, DESFECHOS_INSCRICAO, editData?.status);
  const [status, setStatus]               = useState<StatusEdital>(() => editData?.status ?? ((etapaInicial(etapas, DESFECHOS_INSCRICAO, statusPre) || "interesse") as StatusEdital));
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
  // "Mais detalhes" já abre quando há algo preenchido lá dentro.
  const [maisDetalhes, setMaisDetalhes] = useState(() => Boolean(
    potentialPre || dataAberturaPre
    || editData?.data_abertura || editData?.data_resultado || editData?.responsavel_tipo
    || (editData?.potencial_fechamento && editData.potencial_fechamento !== "medio"),
  ));

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
      Promise.all([
        supabase.auth.getUser(),
        // A tipagem manual do Supabase não tem esta RPC.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc("get_organization_members", { org_id: organizationId }),
      ]).then(([{ data: { user } }, { data }]: [{ data: { user: { id: string } | null } }, { data: { user_id: string; full_name: string; email: string | null }[] | null }]) => {
        const lista = (data ?? []).filter((m) => m.full_name).map((m) => ({ id: m.user_id, label: m.full_name, sublabel: m.email ?? undefined }));
        setMembros(lista);
        // Quem cria a inscrição é o responsável, até alguém escolher outra pessoa.
        const eu = !editData && user ? lista.find(m => m.id === user.id) : undefined;
        if (eu) {
          setResponsavelTipo(current => current ?? "membro");
          setResponsavelId(current => current || eu.id);
          setResponsavelPesquisa(current => current || eu.label);
        }
      });
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
  // Responsável só aparece quando há equipe: mais de uma pessoa ou agências.
  const temEquipe = membros.length > 1 || agencias.length > 0 || Boolean(editData?.responsavel_tipo);
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
    const siteDaBase = (sitePreEmpresa ?? "").trim();
    const { data: criada } = await (supabase as any)
      .from("empresas_crm")
      .insert({
        nome: nomeTrim, account_id: userId, organization_id: organizationId, empresa_pub_id: empresaPubId || null,
        ...(empresaPubId && siteDaBase ? { site: siteDaBase, domain_key: resolveCompanyDomain(siteDaBase) } : {}),
      })
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
    if (!valorDaProposta && !valorLido.valido) {
      setErro(MENSAGEM_VALOR_INVALIDO); setSaving(false); return;
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
      lei:             lei            || null,
      valor:           valorDaProposta ? editData?.valor ?? null : valorLido.valor,
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
      className="fixed inset-0 z-50 flex flex-col items-center veu"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="folha-vidro flex w-full max-w-[47.5rem] flex-col overflow-hidden"
        style={{ maxHeight: "100vh", boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-black/5">
              <FolderOpen size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="min-w-0 text-[#282525] font-display text-[1.25rem] font-extrabold leading-[1.1] tracking-[-.04em] sm:text-[1.5rem]">{editData ? "Editar inscrição" : "Nova inscrição"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded transition hover:bg-black/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <Rotulo>Patrocinador</Rotulo>
              <div ref={empresaBoxRef} className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: empresaOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                <Building2 size={13} className="flex-shrink-0 text-black/35" />
                <input
                  type="text"
                  placeholder="Buscar ou criar…"
                  aria-label="Patrocinador"
                  value={empresaSearch}
                  onChange={e => { setEmpresaSearch(e.target.value); setEmpresaId(""); setEmpresaOpen(true); }}
                  onFocus={() => setEmpresaOpen(true)}
                  onBlur={() => setTimeout(() => setEmpresaOpen(false), 150)}
                  className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-[#282525] outline-none"
                />
                {empresaSearch && (
                  <button type="button" aria-label="Limpar patrocinador"
                    onMouseDown={e => { e.preventDefault(); setEmpresaSearch(""); setEmpresaId(""); }}
                    className="flex-shrink-0 text-black/25 transition hover:text-black/50">
                    <X size={12} />
                  </button>
                )}
              </div>
              {empresaOpen && (empresasFiltradas.length > 0 || (empresaSearch.trim() && !hasExactMatch)) && (
                <PortalMenu position={empresaMenuPos}>
                  {empresasFiltradas.map(e => (
                    <button key={e.id} type="button"
                      onMouseDown={ev => { ev.preventDefault(); setEmpresaId(e.id); setEmpresaSearch(e.nome); setEmpresaOpen(false); }}
                      className="w-full px-3 py-2 text-left text-[0.8125rem] text-[#282525] transition hover:bg-black/[0.04]">
                      {e.nome}
                    </button>
                  ))}
                  {empresaSearch.trim() && !hasExactMatch && (
                    <button type="button"
                      onMouseDown={ev => { ev.preventDefault(); handleCriarEmpresa(empresaSearch.trim()); }}
                      disabled={criandoEmpresa}
                      className="w-full border-t px-3 py-2 text-left text-[0.8125rem] font-semibold text-[#7259B5] transition hover:bg-black/[0.04] disabled:opacity-50"
                      style={{ borderColor: "rgba(13,13,13,.08)" }}>
                      {criandoEmpresa ? "Criando…" : `Criar "${empresaSearch.trim()}"`}
                    </button>
                  )}
                </PortalMenu>
              )}
            </div>

            <div>
              <Rotulo>Tipo de patrocínio</Rotulo>
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

            <div className="relative">
              <Rotulo>Projeto</Rotulo>
              <div ref={projetoBoxRef} className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: projetoOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                <FolderOpen size={13} className="flex-shrink-0 text-black/35" />
                <input
                  type="text"
                  placeholder="Buscar ou criar…"
                  aria-label="Projeto"
                  value={projetoSearch}
                  onChange={e => { setProjetoSearch(e.target.value); setProjetoId(""); setCotaId(""); setProjetoOpen(true); }}
                  onFocus={() => setProjetoOpen(true)}
                  onBlur={() => setTimeout(() => setProjetoOpen(false), 150)}
                  className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-[#282525] outline-none"
                />
                {projetoSearch && (
                  <button type="button" aria-label="Limpar projeto"
                    onMouseDown={e => { e.preventDefault(); setProjetoSearch(""); setProjetoId(""); setCotaId(""); }}
                    className="flex-shrink-0 text-black/25 transition hover:text-black/50">
                    <X size={12} />
                  </button>
                )}
              </div>
              {projetoOpen && (projetosFiltrados.length > 0 || (projetoSearch.trim() && !hasExactMatchProjeto)) && (
                <PortalMenu position={projetoMenuPos}>
                  {projetosFiltrados.map(p => (
                    <button key={p.id} type="button"
                      onMouseDown={ev => { ev.preventDefault(); setProjetoId(p.id); setProjetoSearch(p.nome); setCotaId(""); setProjetoOpen(false); }}
                      className="w-full px-3 py-2 text-left text-[0.8125rem] text-[#282525] transition hover:bg-black/[0.04]">
                      {p.nome}
                    </button>
                  ))}
                  {projetoSearch.trim() && !hasExactMatchProjeto && (
                    <button type="button"
                      onMouseDown={ev => { ev.preventDefault(); handleCriarProjeto(projetoSearch.trim()); }}
                      disabled={criandoProjeto}
                      className="w-full border-t px-3 py-2 text-left text-[0.8125rem] font-semibold text-[#7259B5] transition hover:bg-black/[0.04] disabled:opacity-50"
                      style={{ borderColor: "rgba(13,13,13,.08)" }}>
                      {criandoProjeto ? "Criando…" : `Criar "${projetoSearch.trim()}"`}
                    </button>
                  )}
                </PortalMenu>
              )}
            </div>

            <div>
              <Rotulo>Cota <span className="ml-1 font-normal text-black/35">(opcional)</span></Rotulo>
              <CustomDropdown
                value={cotaId}
                onChange={value => {
                  if (value === CRIAR_NOVA_COTA) {
                    window.open(`/projetos/${projetoId}?tab=proposta`, "_blank");
                    return;
                  }
                  setCotaId(value);
                  const selecionada = cotas.find(cota => cota.id === value);
                  if (selecionada && !valorDaProposta) setValorTexto(formatarValorBRL(selecionada.valor));
                }}
                placeholder={!projetoId ? "Selecione um projeto primeiro" : loadingCotas ? "Carregando cotas…" : cotas.length === 0 ? "Nenhuma cota neste projeto" : "Sem cota"}
                compact
                disabled={!projetoId || loadingCotas}
                className="[&>button]:w-full"
                icon={<Layers size={13} />}
                options={[
                  ...(cotas.length > 0 ? [{ value: "", label: "Sem cota" }] : []),
                  ...cotas.map(cota => ({
                    value: cota.id,
                    label: `${cota.nome}${cota.modelo === "produto" && cota.produto_nome ? ` · ${cota.produto_nome}` : ""} · ${formatCotaValor(cota)}`,
                    disabled: !cotaTemDisponibilidade(cota) && cota.id !== editData?.cota_id,
                  })),
                  { value: CRIAR_NOVA_COTA, label: "Criar nova cota…", icon: <Plus size={12} /> },
                ]}
              />
            </div>

            <div>
              <Rotulo>Valor</Rotulo>
              <CampoValor value={valorTexto} onChange={setValorTexto} invalido={!valorDaProposta && !valorLido.valido} ariaLabel="Valor" disabled={valorDaProposta} />
              {!valorDaProposta && !valorLido.valido
                ? <p role="alert" className="mt-1 text-[0.6875rem] text-[#B23A3A]">{MENSAGEM_VALOR_INVALIDO}</p>
                : cotaSelecionada && valorForaDaFaixa(cotaSelecionada, valorLido.valor) && <p className="mt-1 text-[0.6875rem] text-[#B07A14]">Fora da faixa da cota.</p>}
            </div>

            <div>
              <Rotulo>Etapa</Rotulo>
              <CustomDropdown value={status} onChange={value => setStatus(value as StatusEdital)}
                className="[&>button]:w-full" compact icon={<TrendingUp size={13} />}
                options={etapasForm.map(({ status: value, label, Icon }) => ({ value, label, icon: <Icon size={13} /> }))} />
            </div>

            <DateField label="Data de fechamento" value={dataFechamento} onChange={setDataFechamento} />
          </div>

          <div className="mt-5 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes}
              className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-black/55 transition hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              <ChevronDown size={13} aria-hidden="true" className={`transition-transform duration-200 motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
              Mais detalhes
            </button>
            {maisDetalhes && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Rotulo>Potencial de fechamento</Rotulo>
                  <PotencialSegmentado value={potencialFechamento} onChange={setPotencialFechamento} />
                </div>

                <DateField label="Data de abertura" value={dataAbertura} onChange={setDataAbertura} />
                <DateField label="Data do resultado" value={dataResultado} onChange={setDataResultado} />

                {temEquipe && (
                  <div className="sm:col-span-2">
                    <Rotulo>Responsável</Rotulo>
                    {(agencias.length > 0 || responsavelTipo === "agencia") && (
                      <div className="mb-2 flex w-fit overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                        {(["membro", "agencia"] as const).map(tipo => (
                          <button
                            key={tipo}
                            type="button"
                            aria-pressed={responsavelTipo === tipo}
                            onClick={() => trocarResponsavelTipo(tipo)}
                            className="flex items-center gap-1.5 border-r px-3 py-1.5 text-[0.625rem] font-semibold last:border-r-0"
                            style={responsavelTipo === tipo
                              ? { background: "#1C0E33", color: "#fff", borderColor: "#1C0E33" }
                              : { background: "#fff", color: "rgba(13,13,13,.45)", borderColor: "rgba(13,13,13,.12)" }}
                          >
                            {tipo === "agencia" ? <Building2 size={12} /> : <Users size={12} />}
                            {tipo === "agencia" ? "Agência" : "Equipe"}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <div ref={responsavelBoxRef} className="flex items-center gap-2 rounded border bg-white px-3 py-2.5" style={{ borderColor: responsavelOpen ? "rgba(13,13,13,.35)" : "rgba(13,13,13,.15)" }}>
                        {responsavelTipo === "agencia"
                          ? <Building2 size={13} className="flex-shrink-0 text-black/35" />
                          : <UserRound size={13} className="flex-shrink-0 text-black/35" />}
                        <input
                          type="text"
                          aria-label="Responsável"
                          placeholder={responsavelTipo === "agencia" ? "Buscar ou criar agência…" : "Buscar pessoa da equipe…"}
                          value={responsavelPesquisa}
                          onChange={e => { const v = e.target.value; if (!responsavelTipo) setResponsavelTipo("membro"); setResponsavelPesquisa(v); setResponsavelId(""); setResponsavelOpen(v.trim().length > 0); }}
                          onFocus={() => { if (responsavelPesquisa.trim()) setResponsavelOpen(true); }}
                          onBlur={() => setTimeout(() => setResponsavelOpen(false), 150)}
                          className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-[#282525] outline-none"
                        />
                        {responsavelPesquisa && (
                          <button type="button" aria-label="Limpar responsável"
                            onMouseDown={e => { e.preventDefault(); setResponsavelPesquisa(""); setResponsavelId(""); }}
                            className="flex-shrink-0 text-black/25 transition hover:text-black/50">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      {responsavelOpen && (responsavelFiltrados.length > 0 || (responsavelTipo === "agencia" && responsavelPesquisa.trim() && !hasExactMatchResponsavel)) && (
                        <PortalMenu position={responsavelMenuPos}>
                          {responsavelFiltrados.map(r => (
                            <button key={r.id} type="button"
                              onMouseDown={ev => { ev.preventDefault(); selecionarResponsavel(r); }}
                              className="w-full px-3 py-2 text-left transition hover:bg-black/[0.04]">
                              <span className="block text-[0.8125rem] text-[#282525]">{r.label}</span>
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
                              {criandoAgencia ? "Criando…" : `Criar "${responsavelPesquisa.trim()}"`}
                            </button>
                          )}
                        </PortalMenu>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <footer className="folha-rodape rounded-b-[var(--raio-folha)] flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5 sm:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={saving}
              className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2.5 text-[0.75rem] font-bold text-white transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={12} /> {saving ? "Salvando…" : editData ? "Salvar" : "Criar inscrição"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
