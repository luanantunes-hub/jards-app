"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Briefcase, Building2, ChevronDown, Link, Mail, MessageCircle,
  Phone, Plus, Save, ShieldCheck, Sparkles, User, UserRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type EmpresaCRM = { id: string; nome: string };
type SearchOpt = { id: string; nome: string };
type MembroOption = { id: string; nome: string; email: string | null };
type VinculoTipo = "empresa_crm" | "proponente" | "captador" | "";

function Field({ icon: Icon, label, value, onChange, type = "text", placeholder, required = false }: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-semibold text-black">
      <Icon size={12} className="text-black/35" /> {label}
    </label>
    <input type={type} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)}
      className="h-10 w-full rounded border border-black/[.15] bg-white px-3 text-[0.8125rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10" />
  </div>;
}

const VINCULO_OPTS: { value: Exclude<VinculoTipo, "">; label: string }[] = [
  { value: "empresa_crm", label: "Empresa" },
  { value: "proponente", label: "Proponente" },
  { value: "captador", label: "Captador" },
];

const PAPEL_OPTIONS = [
  { value: "", label: "Não definido" },
  { value: "decision_maker", label: "Decision maker" },
  { value: "champion", label: "Champion" },
  { value: "influencer", label: "Influenciador" },
  { value: "gatekeeper", label: "Gatekeeper" },
];

const CANAL_OPTIONS = [
  { value: "", label: "Não definido" },
  { value: "mensagem", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "reuniao", label: "Reunião" },
  { value: "outro", label: "Outro" },
];

const ORIGEM_OPTIONS = [
  { value: "", label: "Não definida" },
  { value: "jards", label: "Jards" },
  { value: "proprio", label: "Base própria" },
  { value: "indicacao", label: "Indicação" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "outro", label: "Outro" },
];

export function NovoContatoModal({ onClose, onSaved, empresaPreId, captadorPreId, proponentePreId, initialNome, initialEmail, initialLinkedin, initialCargo }: {
  onClose: () => void;
  onSaved: (id?: string) => void;
  empresaPreId?: string;
  captadorPreId?: string;
  proponentePreId?: string;
  initialNome?: string;
  initialEmail?: string;
  initialLinkedin?: string;
  initialCargo?: string;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);
  const [showMore, setShowMore] = useState(false);
  const [nome, setNome] = useState(initialNome ?? "");
  const [cargo, setCargo] = useState(initialCargo ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [linkedin, setLinkedin] = useState(initialLinkedin ?? "");
  const [telefone, setTelefone] = useState("");
  const [papelDecisao, setPapelDecisao] = useState("");
  const [canalPreferido, setCanalPreferido] = useState("");
  const [origem, setOrigem] = useState("");
  const [responsavelInternoId, setResponsavelInternoId] = useState("");
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const initTipo: VinculoTipo = captadorPreId ? "captador" : proponentePreId ? "proponente" : "empresa_crm";
  const [vinculoTipo, setVinculoTipo] = useState<VinculoTipo>(initTipo);
  const [empresas, setEmpresas] = useState<EmpresaCRM[]>([]);
  const [empresaId, setEmpresaId] = useState(empresaPreId ?? "");
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState("");
  const [criandoEmpresaLoading, setCriandoEmpresaLoading] = useState(false);
  const [entityId, setEntityId] = useState(captadorPreId ?? proponentePreId ?? "");
  const [entityNome, setEntityNome] = useState("");
  const [entityQuery, setEntityQuery] = useState("");
  const [entityOptions, setEntityOptions] = useState<SearchOpt[]>([]);
  const [entityOpen, setEntityOpen] = useState(false);
  const entityRef = useRef<HTMLDivElement>(null);
  const entityMenuPos = usePortalPosition(entityRef, entityOpen);

  useEffect(() => {
    if (!organizationId) return;
    void Promise.all([
      (supabase as any).from("empresas_crm").select("id,nome").eq("organization_id", organizationId).order("nome").limit(200),
      (supabase as any).rpc("get_organization_members", { org_id: organizationId }),
    ]).then(([empresasResult, membrosResult]) => {
      setEmpresas((empresasResult.data ?? []) as EmpresaCRM[]);
      setMembros(((membrosResult.data ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>)
        .filter(membro => membro.full_name || membro.email)
        .map(membro => ({ id: membro.user_id, nome: membro.full_name ?? membro.email ?? "Membro", email: membro.email })));
    });
  }, [organizationId]);

  useEffect(() => {
    if (captadorPreId) {
      (supabase as any).from("captadores").select("nome").eq("id", captadorPreId).single()
        .then(({ data }: any) => { if (data) { setEntityNome(data.nome); setEntityQuery(data.nome); } });
    } else if (proponentePreId) {
      (supabase as any).from("proponentes").select("nome").eq("id", proponentePreId).single()
        .then(({ data }: any) => { if (data) { setEntityNome(data.nome); setEntityQuery(data.nome); } });
    }
  }, []);

  useEffect(() => {
    if (vinculoTipo !== "proponente" && vinculoTipo !== "captador") return;
    if (!entityOpen && entityQuery === entityNome) return;
    if (!organizationId) return;
    const table = vinculoTipo === "proponente" ? "proponentes" : "captadores";
    const timer = setTimeout(async () => {
      // Restrito à organização atual — captadores/proponentes são visíveis em
      // todas as organizações de que o usuário participa (RLS por
      // membership/dono, não pela organização ativa na tela), então sem esse
      // filtro o dropdown misturava resultados de outras organizações.
      const request = (supabase as any).from(table).select("id,nome").eq("organization_id", organizationId).order("nome").limit(8);
      if (entityQuery.trim()) request.ilike("nome", `%${entityQuery.trim()}%`);
      const { data } = await request;
      setEntityOptions(data ?? []);
    }, 200);
    return () => clearTimeout(timer);
  }, [entityQuery, entityOpen, entityNome, vinculoTipo, organizationId]);

  useEffect(() => {
    function closeEntityMenu(event: MouseEvent) {
      if (entityRef.current && !entityRef.current.contains(event.target as Node)) setEntityOpen(false);
    }
    document.addEventListener("mousedown", closeEntityMenu);
    return () => document.removeEventListener("mousedown", closeEntityMenu);
  }, []);

  function changeVinculo(tipo: VinculoTipo) {
    setVinculoTipo(tipo);
    setEntityId(""); setEntityNome(""); setEntityQuery(""); setEntityOptions([]); setEmpresaId("");
  }

  async function handleCriarEmpresa() {
    if (!novaEmpresaNome.trim()) return;
    setCriandoEmpresaLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCriandoEmpresaLoading(false); setErro("Usuário não autenticado"); return; }
    const { data, error } = await (supabase as any).from("empresas_crm")
      .insert({ nome: novaEmpresaNome.trim(), organization_id: organizationId, account_id: user.id }).select("id,nome").single();
    setCriandoEmpresaLoading(false);
    if (error || !data) { setErro(error?.message ?? "Não foi possível criar a empresa."); return; }
    setEmpresas(current => [...current, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setEmpresaId(data.id); setNovaEmpresaNome(""); setCriandoEmpresa(false);
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro("Informe o nome do contato."); return; }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) { setErro("Informe um e-mail válido."); return; }
    setSaving(true); setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado."); setSaving(false); return; }
    const { data, error } = await (supabase as any).from("contatos").insert({
      account_id: user.id,
      organization_id: organizationId,
      nome: nome.trim(),
      empresa_crm_id: vinculoTipo === "empresa_crm" ? (empresaId || null) : null,
      captador_id: vinculoTipo === "captador" ? (entityId || null) : null,
      proponente_id: vinculoTipo === "proponente" ? (entityId || null) : null,
      cargo: cargo.trim() || null,
      email: email.trim() || null,
      linkedin_url: linkedin.trim() || null,
      telefone: telefone.trim() || null,
      papel_decisao: papelDecisao || null,
      canal_preferido: canalPreferido || null,
      origem: origem || null,
      responsavel_interno_id: responsavelInternoId || null,
    }).select("id").single();
    setSaving(false);
    if (error) { setErro(error.message); return; }
    onSaved(data?.id as string | undefined); onClose();
  }

  return <div className="fixed inset-0 z-50 flex flex-col items-center bg-black/45" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[calc(100dvh-20px)] w-full max-w-[35rem] flex-col overflow-hidden rounded-b border-x border-b border-black/[.07] bg-white shadow-[0_16px_45px_rgba(13,13,13,.15)]" onClick={event => event.stopPropagation()}>
      <header className="flex shrink-0 items-center justify-between border-b border-black/[.08] px-5 py-4">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05]"><User size={16} className="text-black/50" /></div><div><h2 id={titleId} className="text-[0.9375rem] font-bold text-black">Novo contato</h2><p className="mt-0.5 text-[0.625rem] text-black/35">Cadastre quem participa da relação comercial</p></div></div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]"><X size={15} className="text-black/40" /></button>
      </header>

      <main className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <section className="space-y-4">
          <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-black/30">Informações principais</p>
          <Field icon={User} label="Nome completo" value={nome} onChange={setNome} placeholder="Nome do contato" required />
          <div>
            <div className="mb-1.5 flex items-center justify-between"><label className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-black"><Building2 size={12} className="text-black/35" />Vínculo</label>{vinculoTipo === "empresa_crm" && !criandoEmpresa && <button type="button" onClick={() => setCriandoEmpresa(true)} className="flex items-center gap-1 text-[0.6875rem] font-medium text-black/40 transition hover:text-black"><Plus size={11}/>Nova empresa</button>}</div>
            <div className="mb-2 flex items-center rounded bg-white p-px">{VINCULO_OPTS.map((option, index) => { const selected = vinculoTipo === option.value; return <button key={option.value} type="button" onClick={() => changeVinculo(option.value)} className={`relative h-9 flex-1 border text-[0.6875rem] font-medium transition first:rounded-l last:rounded-r ${index > 0 ? "-ml-px" : ""} ${selected ? "z-10 border-[#7259B5] text-[#7259B5]" : "border-black/10 text-black/40 hover:bg-black/[.03]"}`}>{option.label}</button>; })}</div>
            {vinculoTipo === "empresa_crm" && (criandoEmpresa ? <div className="flex gap-2"><input autoFocus value={novaEmpresaNome} onChange={event => setNovaEmpresaNome(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void handleCriarEmpresa(); if (event.key === "Escape") { event.preventDefault(); setCriandoEmpresa(false); } }} placeholder="Nome da nova empresa" className="h-10 min-w-0 flex-1 rounded border border-black/[.15] px-3 text-[0.8125rem] outline-none focus:border-[#7259B5]"/><button type="button" onClick={() => void handleCriarEmpresa()} disabled={criandoEmpresaLoading || !novaEmpresaNome.trim()} className="rounded border border-black/10 px-3 text-[0.6875rem] font-semibold disabled:opacity-40">{criandoEmpresaLoading ? "Criando…" : "Criar"}</button><button type="button" onClick={() => { setCriandoEmpresa(false); setNovaEmpresaNome(""); }} aria-label="Cancelar nova empresa" className="flex h-10 w-10 items-center justify-center rounded text-black/35 hover:bg-black/[.04]"><X size={13}/></button></div> : <CustomDropdown value={empresaId} onChange={setEmpresaId} options={empresas.map(empresa => ({ value: empresa.id, label: empresa.nome }))} placeholder="Selecionar empresa…" icon={<Building2 size={13}/>} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/>)}
            {(vinculoTipo === "proponente" || vinculoTipo === "captador") && <div ref={entityRef} className="relative"><div className="flex h-10 items-center gap-2 rounded border border-black/[.15] px-3 focus-within:border-[#7259B5]"><Building2 size={13} className="text-black/35"/><input value={entityQuery} onChange={event => { setEntityQuery(event.target.value); setEntityId(""); setEntityNome(""); setEntityOpen(true); }} onFocus={() => setEntityOpen(true)} placeholder={vinculoTipo === "proponente" ? "Buscar proponente…" : "Buscar captador…"} className="min-w-0 flex-1 bg-transparent text-[0.75rem] outline-none"/></div>{entityOpen && <PortalMenu position={entityMenuPos}>{entityOptions.length ? entityOptions.map(option => <button key={option.id} type="button" onMouseDown={event => { event.preventDefault(); setEntityId(option.id); setEntityNome(option.nome); setEntityQuery(option.nome); setEntityOpen(false); }} className="block w-full px-3 py-2 text-left text-[0.75rem] font-medium hover:bg-black/[.04]">{option.nome}</button>) : <p className="px-3 py-2 text-[0.6875rem] text-black/30">Nenhum resultado</p>}</PortalMenu>}</div>}
          </div>
          <Field icon={Briefcase} label="Cargo" value={cargo} onChange={setCargo} placeholder="Ex.: Gerente de Marketing" />
          <div className="grid gap-4 sm:grid-cols-2"><Field icon={Mail} label="E-mail" value={email} onChange={setEmail} type="email" placeholder="email@empresa.com"/><Field icon={Phone} label="Telefone" value={telefone} onChange={setTelefone} placeholder="+55 (11) 00000-0000"/></div>
        </section>

        <section className="space-y-4 border-t border-black/[.07] pt-4">
          <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-black/30">Contexto comercial</p>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-semibold text-black"><ShieldCheck size={12} className="text-black/35"/>Papel na decisão</label><CustomDropdown value={papelDecisao} onChange={setPapelDecisao} options={PAPEL_OPTIONS} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/></div><div><label className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-semibold text-black"><MessageCircle size={12} className="text-black/35"/>Canal preferido</label><CustomDropdown value={canalPreferido} onChange={setCanalPreferido} options={CANAL_OPTIONS} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/></div></div>
          <div><label className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-semibold text-black"><UserRound size={12} className="text-black/35"/>Responsável interno <span className="font-normal text-black/30">recomendado</span></label><CustomDropdown value={responsavelInternoId} onChange={setResponsavelInternoId} options={[{ value: "", label: "Sem responsável" }, ...membros.map(membro => ({ value: membro.id, label: membro.nome, sublabel: membro.email ?? undefined }))]} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/></div>
        </section>

        <section className="border-t border-black/[.07] pt-3"><button type="button" onClick={() => setShowMore(value => !value)} aria-expanded={showMore} className="flex w-full items-center justify-between rounded px-1 py-2 text-[0.75rem] font-semibold text-black/50 transition hover:text-black/75"><span>Mais opções</span><ChevronDown size={13} className={`transition-transform ${showMore ? "rotate-180" : ""}`}/></button>{showMore && <div className="mt-2 grid gap-4 pb-1 sm:grid-cols-2"><Field icon={Link} label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="linkedin.com/in/…"/><div><label className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-semibold text-black"><Sparkles size={12} className="text-black/35"/>Origem</label><CustomDropdown value={origem} onChange={setOrigem} options={ORIGEM_OPTIONS} compact placement="top" portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/></div></div>}</section>
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-black/[.08] px-5 py-3.5">{erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div/>}<div className="ml-auto flex shrink-0 items-center gap-2"><button type="button" onClick={onClose} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button><button type="button" onClick={() => void handleSalvar()} disabled={saving || !nome.trim()} className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.75rem] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"><Save size={12}/>{saving ? "Salvando…" : "Salvar contato"}</button></div></footer>
    </div>
  </div>;
}
