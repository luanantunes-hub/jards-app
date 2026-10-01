"use client";
import { useState, useEffect, useRef } from "react";
import {
  X, Save, Building2, Plus, FolderOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { NovoProponenteModal } from "@/components/modals/NovoProponenteModal";
import { PROJECT_ICON_COLORS, PROJECT_ICON_OPTIONS } from "@/components/ui/ProjectIdentity";
import { IdentityEditor } from "@/components/ui/IdentityEditor";
import { BRAZIL_STATES, SPONSORSHIP_TYPE_OPTIONS, sponsorshipTypeLabel } from "@/lib/projects/sponsorship";

export type EditDataProjeto = {
  id: string;
  nome: string;
  descricao: string | null;
  valor_alvo: number | null;
  proponente_id: string | null;
  proponente_nome: string | null;
  proponente_cidade: string | null;
  proponente_estado: string | null;
  identidade_tipo?: "padrao" | "icone" | "emoji" | "logo";
  identidade_valor?: string | null;
  identidade_logo_url?: string | null;
  identidade_cor?: string | null;
  fase?: "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";
  ponto_focal_id?: string | null;
  mecanismo?: string | null;
  tipos_patrocinio?: string[];
  data_inicio?: string | null;
  data_fim?: string | null;
  cidade?: string | null;
  estado?: string | null;
  abrangencia?: string | null;
  areas_culturais?: string[];
  valor_garantido?: number;
  tags?: string[];
  visibilidade?: "equipe" | "restrita";
  status_operacional?: "ativo" | "pausado" | "arquivado";
  status_comercial?: "estruturando" | "pronto" | "em_captacao" | "captado" | "encerrado" | null;
};

type ProponenteOption = { id: string; nome: string; cidade: string | null; estado: string | null };
type MemberOption = { id: string; full_name: string | null };

function formatDecimalBR(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }

  const sanitized = value.replace(/[^\d,]/g, "");
  const hasComma = sanitized.includes(",");
  const [integerPart = "", ...decimalParts] = sanitized.split(",");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const formattedInteger = normalizedInteger
    ? Number(normalizedInteger).toLocaleString("pt-BR")
    : hasComma ? "0" : "";
  const decimalPart = decimalParts.join("").slice(0, 2);

  return hasComma ? `${formattedInteger},${decimalPart}` : formattedInteger;
}

function parseDecimalBR(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function NovoProjetoModal({ onClose, onSaved, editData, proponentePreId }: {
  onClose: () => void;
  onSaved: (id?: string) => void;
  editData?: EditDataProjeto;
  proponentePreId?: string;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const [saving, setSaving] = useState(false);
  const [erro, setErro]     = useState<string | null>(null);
  const savedProjectIdRef = useRef<string | null>(editData?.id ?? null);

  const [nome, setNome]           = useState(editData?.nome ?? "");
  const [descricao, setDescricao] = useState(editData?.descricao ?? "");
  const [valorAlvo, setValorAlvo] = useState(formatDecimalBR(editData?.valor_alvo));
  const [fase, setFase] = useState(editData?.fase ?? "planejamento");
  const [pontoFocalId, setPontoFocalId] = useState<string | null>(editData?.ponto_focal_id ?? null);
  const [tiposPatrocinio, setTiposPatrocinio] = useState<string[]>(editData?.tipos_patrocinio ?? []);
  const [tipoPatrocinioCustom, setTipoPatrocinioCustom] = useState("");
  const [incentivoEscopo, setIncentivoEscopo] = useState<"estadual" | "municipal" | null>(null);
  const [incentivoNome, setIncentivoNome] = useState("");
  const [incentivoEstado, setIncentivoEstado] = useState("");
  const [incentivoCidade, setIncentivoCidade] = useState("");
  const [dataInicio, setDataInicio] = useState(editData?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(editData?.data_fim ?? "");
  const [cidade, setCidade] = useState(editData?.cidade ?? "");
  const [estado, setEstado] = useState(editData?.estado ?? "");
  const [abrangencia, setAbrangencia] = useState(editData?.abrangencia ?? "");
  const [areasCulturais, setAreasCulturais] = useState((editData?.areas_culturais ?? []).join(", "));
  const [valorGarantido, setValorGarantido] = useState(editData?.valor_garantido ? String(editData.valor_garantido) : "");
  const [tags, setTags] = useState((editData?.tags ?? []).join(", "));
  const [visibilidade, setVisibilidade] = useState(editData?.visibilidade ?? "equipe");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [identidadeTipo, setIdentidadeTipo] = useState<"padrao" | "icone" | "emoji" | "logo">(editData?.identidade_tipo ?? "icone");
  const [identidadeValor, setIdentidadeValor] = useState(editData?.identidade_valor ?? "");
  const [identidadeCor, setIdentidadeCor] = useState(editData?.identidade_cor ?? PROJECT_ICON_COLORS[0].cor);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(editData?.identidade_logo_url ?? null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Proponente combobox
  const [proponenteId, setProponenteId]     = useState<string | null>(editData?.proponente_id ?? proponentePreId ?? null);
  const [proponenteNome, setProponenteNome] = useState(editData?.proponente_nome ?? "");
  const [proponenteQuery, setProponenteQuery] = useState(editData?.proponente_nome ?? "");
  const [proponenteOptions, setProponenteOptions] = useState<ProponenteOption[]>([]);
  const [proponenteOpen, setProponenteOpen] = useState(false);
  const [showNovoProponente, setShowNovoProponente] = useState(false);
  const proponenteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!proponentePreId || editData?.id) return;
    (async () => {
      const { data } = await supabase.from("proponentes").select("id,nome,cidade,estado").eq("id", proponentePreId).maybeSingle();
      if (data) selectProponente(data as ProponenteOption);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proponentePreId]);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data: memberships } = await (supabase as any).from("organization_members").select("user_id").eq("organization_id", organizationId);
      const ids = (memberships ?? []).map((membership: any) => membership.user_id);
      if (!ids.length) return;
      const { data } = await (supabase as any).from("profiles").select("id, full_name").in("id", ids).order("full_name");
      setMembers(data ?? []);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (proponenteRef.current && !proponenteRef.current.contains(e.target as Node)) {
        setProponenteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Buscar proponentes — restrito à organização atual (auth_org_ids() devolve
  // todas as orgs do usuário, não só a ativa; sem esse filtro apareciam
  // proponentes de outras organizações do mesmo usuário).
  useEffect(() => {
    const q = proponenteQuery.trim();
    if (!proponenteOpen && q === proponenteNome) return;
    if (!organizationId) return;
    const timer = setTimeout(async () => {
      const query = supabase
        .from("proponentes")
        .select("id, nome, cidade, estado")
        .eq("organization_id", organizationId)
        .order("nome")
        .limit(8);
      if (q) query.ilike("nome_key", `%${q.toLowerCase()}%`);
      const { data } = await query;
      setProponenteOptions((data ?? []) as ProponenteOption[]);
    }, 200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proponenteQuery, proponenteOpen, organizationId]);

  function selectProponente(p: ProponenteOption) {
    setProponenteId(p.id);
    setProponenteNome(p.nome);
    setProponenteQuery(p.nome);
    setProponenteOpen(false);
  }

  function handleProponenteSaved(id: string, nome: string) {
    setProponenteId(id);
    setProponenteNome(nome);
    setProponenteQuery(nome);
    setShowNovoProponente(false);
  }

  function toggleTipoPatrocinio(value: string) {
    setTiposPatrocinio(current => current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value]);
  }

  function addTipoPatrocinioCustom() {
    const value = tipoPatrocinioCustom.trim();
    if (!value) return;
    setTiposPatrocinio(current => current.some(item => item.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR"))
      ? current
      : [...current, value]);
    setTipoPatrocinioCustom("");
  }

  function addIncentivoLocal() {
    const nomeIncentivo = incentivoNome.trim();
    const cidadeIncentivo = incentivoCidade.trim();
    if (!incentivoEscopo || !nomeIncentivo || !incentivoEstado) return;
    if (incentivoEscopo === "municipal" && !cidadeIncentivo) return;
    const value = incentivoEscopo === "estadual"
      ? `${nomeIncentivo} · ${incentivoEstado}`
      : `${nomeIncentivo} · ${cidadeIncentivo}/${incentivoEstado}`;
    setTiposPatrocinio(current => current.includes(value) ? current : [...current, value]);
    setIncentivoNome("");
    setIncentivoCidade("");
    setIncentivoEstado("");
    setIncentivoEscopo(null);
  }

  async function cropLogo(file: File): Promise<File> {
    if (!["image/png", "image/webp"].includes(file.type)) throw new Error("Envie um logotipo PNG ou WebP de até 2 MB");
    if (file.size > 2 * 1024 * 1024) throw new Error("O logotipo deve ter no máximo 2 MB");
    const source = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Não foi possível ler o logotipo")); image.src = source; });
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar o recorte");
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar o recorte");
      return new File([blob], "logo-projeto.png", { type: "image/png" });
    } finally { URL.revokeObjectURL(source); }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    try {
      const cropped = await cropLogo(file);
      setLogoFile(cropped);
      setLogoPreview(URL.createObjectURL(cropped));
      setIdentidadeTipo("logo");
      setErro(null);
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao preparar o logotipo"); }
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro("Nome do projeto é obrigatório"); return; }
    if (dataInicio && dataFim && dataFim < dataInicio) { setErro("A data final deve ser igual ou posterior à inicial"); return; }
    setSaving(true);
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado"); setSaving(false); return; }

    const payload = {
      nome:            nome.trim(),
      nome_key:        nome.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
      descricao:       descricao.trim() || null,
      valor_alvo:      valorAlvo ? parseDecimalBR(valorAlvo) : null,
      fase,
      ponto_focal_id: pontoFocalId,
      mecanismo: editData?.mecanismo ?? null,
      tipos_patrocinio: tiposPatrocinio,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      cidade: cidade.trim() || null,
      estado: estado.trim() || null,
      abrangencia: abrangencia.trim() || null,
      areas_culturais: areasCulturais.split(",").map(value => value.trim()).filter(Boolean),
      valor_garantido: valorGarantido ? Number(valorGarantido) : 0,
      tags: tags.split(",").map(value => value.trim()).filter(Boolean),
      visibilidade,
      proponente_id:   proponenteId,
      // mantém os campos legado para compatibilidade até migração ser aplicada
      proponente_nome:    proponenteNome.trim() || null,
      proponente_cidade:  null,
      proponente_estado:  null,
      identidade_tipo: identidadeTipo,
      identidade_valor: identidadeTipo === "icone" || identidadeTipo === "emoji" ? identidadeValor || null : null,
      identidade_cor: identidadeTipo === "icone" ? identidadeCor : null,
      // Mantém a URL atual só quando o tipo continua "logo" (o bloco abaixo
      // sobrescreve se houver arquivo novo); qualquer outro tipo limpa o
      // campo, para não deixar uma URL de logo obsoleta associada a um
      // projeto que já não usa logo como identidade.
      ...(identidadeTipo === "logo" ? {} : { identidade_logo_url: null }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const result = savedProjectIdRef.current
      ? await sb.from("projetos_crm").update(payload).eq("id", savedProjectIdRef.current).select("id").single()
      : await sb.from("projetos_crm").insert({ account_id: user.id, organization_id: organizationId, ...payload }).select("id").single();

    if (result.error) { setSaving(false); setErro((result.error as Error).message); return; }
    savedProjectIdRef.current = result.data.id as string;

    if (identidadeTipo === "logo" && logoFile && organizationId) {
      const projectId = result.data.id as string;
      const path = `${organizationId}/${projectId}/logo.png`;
      const { error: uploadError } = await supabase.storage.from("projetos-identidade").upload(path, logoFile, { upsert: true, contentType: "image/png" });
      if (uploadError) { setSaving(false); setErro(`Projeto salvo, mas não foi possível salvar o logotipo: ${uploadError.message}`); return; }
      const { data: publicUrl } = supabase.storage.from("projetos-identidade").getPublicUrl(path);
      const { error: logoError } = await sb.from("projetos_crm").update({ identidade_logo_url: publicUrl.publicUrl }).eq("id", projectId);
      if (logoError) { setSaving(false); setErro(`Projeto salvo, mas não foi possível salvar o logotipo: ${logoError.message}`); return; }
    }

    setSaving(false);
    onSaved(result.data?.id as string | undefined);
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-6 sm:pt-10"
        style={{ background: "rgba(0,0,0,.45)" }}
        onClick={showNovoProponente ? undefined : onClose}
        aria-hidden={showNovoProponente || undefined}
      >
        <div
          className="bg-white rounded shadow-2xl w-full flex flex-col"
          style={{ maxWidth: 600, maxHeight: "calc(100vh - 48px)" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05] text-black">
                <FolderOpen size={16} />
              </span>
              <h2 className="text-[15px] font-bold text-black">{editData ? "Editar projeto" : "Novo projeto"}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/[.06] transition">
              <X size={15} className="text-black/40" />
            </button>
          </header>

          {/* Body */}
          <main className="flex-1 overflow-y-auto">

            {/* — Identidade + Nome — */}
            <section className="px-6 py-5 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <label className="text-[11px] font-semibold text-black/50 mb-1.5 block">Nome</label>
              <input
                autoFocus
                type="text"
                placeholder="Nome do projeto"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="mb-4 w-full rounded border border-black/[.12] px-3 py-2.5 text-[13px] font-medium text-black outline-none placeholder:text-black/30 focus:border-black/25 transition"
              />
              <input ref={logoInputRef} type="file" accept="image/png,image/webp" className="hidden" onChange={e => handleLogoChange(e.target.files?.[0])} />
              <IdentityEditor
                name={nome || "Projeto"}
                type={identidadeTipo}
                value={identidadeValor}
                logoUrl={logoPreview}
                color={identidadeCor}
                iconOptions={PROJECT_ICON_OPTIONS}
                colors={PROJECT_ICON_COLORS}
                onTypeChange={setIdentidadeTipo}
                onValueChange={setIdentidadeValor}
                onColorChange={setIdentidadeCor}
                onLogoRequest={() => logoInputRef.current?.click()}
                logoHelp="PNG ou WebP, até 2 MB. Recorte quadrado automático."
              />
            </section>

            {/* — Projeto — */}
            <section className="px-6 py-5 space-y-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-black/25">Projeto</p>
              <div>
                <label className="text-[11px] font-semibold text-black/50 mb-1.5 block">Descrição</label>
                <textarea
                  placeholder="Descreva o projeto resumidamente…"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded border bg-white px-3 py-2.5 text-[13px] text-black outline-none transition"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-black/50">Meta de captação</span>
                  <input type="text" inputMode="decimal" value={valorAlvo} onChange={e => setValorAlvo(formatDecimalBR(e.target.value))} placeholder="Ex.: 1.250.000,00"
                    className="h-10 w-full rounded border bg-white px-3 text-[13px] outline-none transition"
                    style={{ borderColor: "rgba(13,13,13,.12)" }} />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-black/50">Fase</span>
                  <Dropdown value={fase} onChange={v => setFase(v as typeof fase)} options={[
                    { value: "planejamento", label: "Planejamento" },
                    { value: "captacao",     label: "Captação" },
                    { value: "execucao",     label: "Execução" },
                    { value: "prestacao",    label: "Prestação" },
                    { value: "concluido",    label: "Concluído" },
                  ]} />
                </label>
              </div>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold text-black/50">Responsável interno</span>
                <Dropdown value={pontoFocalId ?? ""} onChange={value => setPontoFocalId(value || null)} options={[
                  { value: "", label: "Sem responsável" },
                  ...members.map(member => ({ value: member.id, label: member.full_name ?? "Membro" })),
                ]} />
              </div>
            </section>

            {/* — Vínculo e gestão — */}
            <section className="px-6 py-5 space-y-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-black/25">Vínculo com o proponente</p>

              {/* Proponente combobox */}
              <div ref={proponenteRef} className="relative">
                <label className="text-[11px] font-semibold text-black/50 mb-1.5 block">Instituição proponente</label>
                <div
                  className="flex cursor-text items-center gap-2 rounded border px-3 py-2.5 transition"
                  style={{ borderColor: proponenteOpen ? "rgba(13,13,13,.30)" : "rgba(13,13,13,.12)" }}
                  onClick={() => { setProponenteOpen(true); setProponenteOptions([]); }}
                >
                  <Building2 size={13} className="flex-shrink-0 text-black/30" />
                  <input
                    type="text"
                    placeholder="Buscar proponente…"
                    value={proponenteQuery}
                    onChange={e => { setProponenteQuery(e.target.value); setProponenteId(null); setProponenteNome(""); setProponenteOpen(true); }}
                    onFocus={() => setProponenteOpen(true)}
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-black outline-none"
                  />
                  {proponenteId && (
                    <button onClick={e => { e.stopPropagation(); setProponenteId(null); setProponenteNome(""); setProponenteQuery(""); }}
                      className="flex-shrink-0 text-[14px] leading-none text-black/25 hover:text-black/50">×</button>
                  )}
                </div>
                {proponenteOpen && (
                  <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded border bg-white shadow-lg" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                    {proponenteOptions.map(opt => (
                      <button key={opt.id} onMouseDown={e => { e.preventDefault(); selectProponente(opt); }}
                        className="w-full px-3 py-2.5 text-left text-[13px] transition hover:bg-black/[0.04]">
                        <span className="font-medium text-black">{opt.nome}</span>
                        {(opt.cidade || opt.estado) && (
                          <span className="ml-1.5 text-[11px] text-black/35">{[opt.cidade, opt.estado].filter(Boolean).join(", ")}</span>
                        )}
                      </button>
                    ))}
                    {proponenteOptions.length === 0 && proponenteQuery.trim() && (
                      <p className="px-3 py-2.5 text-[12px] text-black/30">Nenhum resultado</p>
                    )}
                    <button
                      onMouseDown={e => { e.preventDefault(); setProponenteOpen(false); setShowNovoProponente(true); }}
                      className="flex w-full items-center gap-1.5 border-t px-3 py-2.5 text-left text-[12px] font-semibold text-[#7259B5] transition hover:bg-black/[0.04]"
                      style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <Plus size={11} />
                      {proponenteQuery.trim() ? `Criar "${proponenteQuery.trim()}"` : "Novo proponente"}
                    </button>
                  </div>
                )}
              </div>

            </section>

            {/* — Patrocínio — */}
            <section className="px-6 py-5 space-y-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-black/25">Patrocínio</p>

              <div>
                <p className="mb-2 text-[9px] font-medium uppercase tracking-[.1em] text-black/25">Federais e direto</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPONSORSHIP_TYPE_OPTIONS.map(option => {
                    const active = tiposPatrocinio.includes(option.value);
                    return (
                      <button key={option.value} type="button" aria-pressed={active} onClick={() => toggleTipoPatrocinio(option.value)}
                        className="rounded border px-2.5 py-1.5 text-[10px] font-medium transition"
                        style={{
                          borderColor: active ? "rgba(114,89,181,.40)" : "rgba(13,13,13,.10)",
                          background: active ? "rgba(114,89,181,.07)" : "white",
                          color: active ? "#7259B5" : "rgba(13,13,13,.50)",
                        }}>
                        {option.label}
                      </button>
                    );
                  })}
                  {tiposPatrocinio
                    .filter(value => !SPONSORSHIP_TYPE_OPTIONS.some(option => option.value === value))
                    .map(value => (
                      <button key={value} type="button" aria-pressed="true" onClick={() => toggleTipoPatrocinio(value)}
                        className="rounded border border-[#7259B5]/40 bg-[#7259B5]/[.07] px-2.5 py-1.5 text-[10px] font-medium text-[#7259B5] transition">
                        {sponsorshipTypeLabel(value)} ×
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[9px] font-medium uppercase tracking-[.1em] text-black/25">Incentivos locais</p>
                <div className="flex gap-2">
                  {(["estadual", "municipal"] as const).map(escopo => (
                    <button key={escopo} type="button"
                      onClick={() => setIncentivoEscopo(c => c === escopo ? null : escopo)}
                      className="h-8 rounded border bg-white px-3 text-[10px] font-medium transition hover:bg-black/[.03]"
                      style={{
                        borderColor: incentivoEscopo === escopo ? "rgba(114,89,181,.40)" : "rgba(13,13,13,.10)",
                        color: incentivoEscopo === escopo ? "#7259B5" : "rgba(13,13,13,.45)",
                      }}>
                      + {escopo === "estadual" ? "Estadual" : "Municipal"}
                    </button>
                  ))}
                </div>
                {incentivoEscopo && (
                  <div className="mt-2 space-y-2 rounded border p-3" style={{ borderColor: "rgba(13,13,13,.08)", background: "rgba(13,13,13,.012)" }}>
                    <div className={`grid gap-2 ${incentivoEscopo === "municipal" ? "grid-cols-[1fr_1fr_80px]" : "grid-cols-[1fr_100px]"}`}>
                      <input value={incentivoNome} onChange={e => setIncentivoNome(e.target.value)}
                        placeholder={incentivoEscopo === "estadual" ? "Nome da lei estadual" : "Nome da lei municipal"}
                        className="h-9 min-w-0 rounded border border-black/10 bg-white px-3 text-[11px] outline-none" />
                      {incentivoEscopo === "municipal" && (
                        <input value={incentivoCidade} onChange={e => setIncentivoCidade(e.target.value)} placeholder="Cidade"
                          className="h-9 min-w-0 rounded border border-black/10 bg-white px-3 text-[11px] outline-none" />
                      )}
                      <Dropdown value={incentivoEstado} onChange={setIncentivoEstado}
                        placeholder="UF"
                        options={[{ value: "", label: "UF" }, ...BRAZIL_STATES.map(([uf, n]) => ({ value: uf, label: `${uf} · ${n}` }))]} />
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={addIncentivoLocal}
                        disabled={!incentivoNome.trim() || !incentivoEstado || (incentivoEscopo === "municipal" && !incentivoCidade.trim())}
                        className="rounded bg-[#2E8932] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#267529] disabled:opacity-35">
                        Adicionar
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <input value={tipoPatrocinioCustom} onChange={e => setTipoPatrocinioCustom(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTipoPatrocinioCustom(); } }}
                    placeholder="Outro tipo…"
                    className="h-9 min-w-0 flex-1 rounded border border-black/10 bg-white px-3 text-[11px] outline-none" />
                  <button type="button" onClick={addTipoPatrocinioCustom} disabled={!tipoPatrocinioCustom.trim()}
                    className="flex h-9 items-center gap-1.5 rounded border px-3 text-[11px] font-medium text-[#7259B5] transition hover:bg-black/[.03] disabled:opacity-35"
                    style={{ borderColor: "rgba(114,89,181,.28)" }}>
                    <Plus size={11} /> Adicionar
                  </button>
                </div>
              </div>
            </section>

          </main>

          {/* Footer */}
          <footer className="flex flex-shrink-0 items-center justify-between border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {erro ? <p className="mr-4 min-w-0 text-[11px] font-medium text-[#D94E4E]">{erro}</p> : <div />}
            <div className="ml-auto flex flex-shrink-0 items-center gap-2">
              <button onClick={onClose} className="px-3 py-2 text-[12px] font-semibold text-black/35 transition hover:text-black/55">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={saving}
                className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#267529] active:translate-y-px disabled:opacity-60">
                <Save size={12} /> {saving ? "Salvando…" : "Salvar projeto"}
              </button>
            </div>
          </footer>
        </div>
      </div>

      {showNovoProponente && (
        <NovoProponenteModal
          nested
          onClose={() => setShowNovoProponente(false)}
          onSaved={handleProponenteSaved}
        />
      )}
    </>
  );
}
