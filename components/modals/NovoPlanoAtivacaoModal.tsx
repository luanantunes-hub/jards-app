"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatCotaValor } from "@/lib/cotas";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type AccountOption = { id: string; nome: string | null; empresa_crm_id: string; empresa_crm: { nome: string } | null };
type ProjectOption = { id: string; nome: string };
type CotaOption = { id: string; nome: string; valor: number; valor_maximo: number | null; modelo: "nivel" | "produto"; produto_nome: string | null; contrapartidas: string[] };
type ContractOption = { id: string; titulo: string | null; numero: string | null; valor: number };
type CaptacaoOption = { id: string; titulo: string | null };
type MemberOption = { user_id: string; papel: string; full_name: string | null; email: string | null };

type Props = {
  organizationId: string;
  initialContaId?: string;
  initialProjetoId?: string;
  onClose: () => void;
  onSaved: (planId: string) => void;
};

const STEPS = ["Contexto", "Estratégia", "Recursos"] as const;

export function NovoPlanoAtivacaoModal({ organizationId, initialContaId = "", initialProjetoId = "", onClose, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [cotas, setCotas] = useState<CotaOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [captacoes, setCaptacoes] = useState<CaptacaoOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [contaId, setContaId] = useState(initialContaId);
  const [projetoId, setProjetoId] = useState(initialProjetoId);
  const [cotaId, setCotaId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [captacaoId, setCaptacaoId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [publico, setPublico] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [valorDireito, setValorDireito] = useState("");
  const [importar, setImportar] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useModalDismiss(onClose);

  useEffect(() => {
    let active = true;
    Promise.all([
      (supabase as any).from("contas_patrocinio").select("id,nome,empresa_crm_id,empresa_crm:empresas_crm!empresa_crm_id(nome)").eq("organization_id", organizationId).eq("status", "ativa").order("created_at", { ascending: false }),
      (supabase as any).from("projetos_crm").select("id,nome").eq("organization_id", organizationId).neq("status_operacional", "arquivado").order("nome"),
      fetchOrganizationMembers(organizationId),
    ]).then(([a, p, m]) => {
      if (!active) return;
      setAccounts(a.data ?? []); setProjects(p.data ?? []); setMembers(m.filter(item => ["admin", "colaborador"].includes(item.papel)));
      setError(a.error?.message ?? p.error?.message ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [organizationId, supabase]);

  useEffect(() => {
    const selected = accounts.find(item => item.id === contaId);
    if (!selected || !projetoId) { setCaptacoes([]); setCaptacaoId(""); return; }
    (supabase as any).from("captacoes").select("id,titulo").eq("organization_id", organizationId).eq("empresa_crm_id", selected.empresa_crm_id).eq("projeto_id", projetoId).order("created_at", { ascending: false })
      .then(({ data }: any) => {
        const next = data ?? [];
        setCaptacoes(next);
        setCaptacaoId(current => current && next.some((item: CaptacaoOption) => item.id === current) ? current : "");
      });
  }, [accounts, contaId, organizationId, projetoId, supabase]);

  useEffect(() => {
    if (!contaId) { setContracts([]); setContratoId(""); return; }
    (supabase as any).from("contratos").select("id,titulo,numero,valor").eq("organization_id", organizationId).eq("conta_patrocinio_id", contaId).in("status", ["assinado", "vigente", "renovado"]).order("created_at", { ascending: false })
      .then(({ data }: any) => {
        const next = data ?? [];
        setContracts(next);
        setContratoId(current => current && next.some((item: ContractOption) => item.id === current) ? current : "");
      });
  }, [contaId, organizationId, supabase]);

  useEffect(() => {
    if (!projetoId) { setCotas([]); setCotaId(""); return; }
    (supabase as any).from("cotas_patrocinio").select("id,nome,valor,valor_maximo,modelo,produto_nome,contrapartidas").eq("organization_id", organizationId).eq("projeto_id", projetoId).order("ordem")
      .then(({ data }: any) => {
        const next = data ?? [];
        setCotas(next);
        setCotaId(current => current && next.some((item: CotaOption) => item.id === current) ? current : "");
      });
  }, [projetoId, organizationId, supabase]);

  useEffect(() => {
    const cota = cotas.find(item => item.id === cotaId);
    if (cota && !valorDireito) setValorDireito(String(cota.valor || ""));
  }, [cotaId, cotas, valorDireito]);

  const canAdvance = step === 0 ? Boolean(contaId && projetoId && nome.trim()) : true;

  async function save() {
    if (!contaId || !projetoId || !nome.trim()) return;
    setSaving(true); setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc("fn_create_activation_plan", {
      p_organization_id: organizationId,
      p_conta_patrocinio_id: contaId,
      p_projeto_id: projetoId,
      p_nome: nome.trim(),
      p_descricao: descricao.trim() || null,
      p_cota_id: cotaId || null,
      p_contrato_id: contratoId || null,
      p_captacao_id: captacaoId || null,
      p_responsavel_id: responsavelId || null,
      p_data_inicio: dataInicio || null,
      p_data_fim: dataFim || null,
      p_valor_direito: valorDireito ? Number(valorDireito) : null,
      p_publico: publico.trim() || null,
      p_objetivo: objetivo.trim() || null,
      p_importar_contrapartidas: importar,
    });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    onSaved(data as string);
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 sm:items-center sm:p-6">
    <div role="dialog" aria-modal="true" aria-labelledby="activation-modal-title" className="max-h-[94vh] w-full overflow-y-auto rounded-t bg-white sm:max-w-[45rem] sm:rounded">
      <header className="sticky top-0 z-10 border-b bg-white px-5 py-4 sm:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[0.625rem] font-medium uppercase tracking-[.12em] text-black/30">Patrocínio</p><h2 id="activation-modal-title" className="mt-1 text-[1.1875rem] font-semibold tracking-[-.02em] text-[#282525]">Novo plano de ativação</h2></div><button type="button" onClick={onClose} className="text-black/30 hover:text-black/55" aria-label="Fechar"><X size={17}/></button></div>
        <div className="mt-4 grid grid-cols-3 gap-2">{STEPS.map((label, index) => <div key={label}><div className="h-1 rounded bg-black/[.06]"><div className="h-full rounded bg-[#7259B5] transition-all" style={{ width: index <= step ? "100%" : "0%" }}/></div><p className="mt-1.5 text-[0.625rem] font-medium" style={{ color: index === step ? "#7259B5" : "rgba(13,13,13,.3)" }}>{label}</p></div>)}</div>
      </header>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {loading ? <div className="py-20 text-center text-xs text-black/30">Carregando opções…</div> : <>
          {step === 0 && <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Conta do patrocinador" value={contaId} onChange={setContaId} required options={accounts.map(item => [item.id, item.nome || item.empresa_crm?.nome || "Conta"])} />
            <SelectField label="Projeto" value={projetoId} onChange={setProjetoId} required options={projects.map(item => [item.id, item.nome])} />
            <TextField label="Nome do plano" value={nome} onChange={setNome} required placeholder="Ex.: Ativação Cota Master 2027" className="sm:col-span-2" />
            <SelectField label="Cota" value={cotaId} onChange={setCotaId} options={cotas.map(item => [item.id, `${item.nome}${item.modelo === "produto" && item.produto_nome ? ` · ${item.produto_nome}` : ""} · ${formatCotaValor(item)}`])} />
            <SelectField label="Contrato" value={contratoId} onChange={setContratoId} options={contracts.map(item => [item.id, item.titulo || item.numero || "Contrato"])} />
            <SelectField label="Negociação de origem" value={captacaoId} onChange={setCaptacaoId} options={captacoes.map(item => [item.id, item.titulo || "Negociação"])} />
            <SelectField label="Responsável" value={responsavelId} onChange={setResponsavelId} options={members.map(item => [item.user_id, item.full_name || item.email || "Membro"])} />
          </div>}
          {step === 1 && <div className="grid gap-4">
            <TextField label="Objetivo principal" value={objetivo} onChange={setObjetivo} placeholder="O que esta ativação precisa alcançar?" />
            <TextField label="Público prioritário" value={publico} onChange={setPublico} placeholder="Quem precisa ser mobilizado ou impactado?" />
            <TextArea label="Contexto" value={descricao} onChange={setDescricao} placeholder="Orientações, premissas e limites do plano" />
          </div>}
          {step === 2 && <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Início" type="date" value={dataInicio} onChange={setDataInicio} />
            <TextField label="Término" type="date" value={dataFim} onChange={setDataFim} />
            <TextField label="Valor do direito" type="number" value={valorDireito} onChange={setValorDireito} placeholder="0,00" />
            <div className="rounded border p-4" style={{ borderColor: "rgba(13,13,13,.09)" }}><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={importar} onChange={event => setImportar(event.target.checked)} className="mt-0.5 accent-[#7259B5]"/><span><span className="block text-[0.75rem] font-semibold text-black/65">Importar contrapartidas</span><span className="mt-1 block text-[0.6875rem] leading-5 text-black/35">Cria entregáveis em rascunho a partir da cota selecionada.</span></span></label></div>
          </div>}
          {error && <p className="mt-4 rounded border border-[#D94E4E]/25 px-3 py-2 text-[0.6875rem] text-[#D94E4E]" role="alert">{error}</p>}
        </>}
      </div>

      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white px-5 py-4 sm:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <button type="button" onClick={step === 0 ? onClose : () => setStep(value => value - 1)} className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-black/35 hover:text-black/55">{step > 0 && <ArrowLeft size={12}/>} {step === 0 ? "Cancelar" : "Voltar"}</button>
        {step < STEPS.length - 1 ? <button type="button" disabled={!canAdvance || loading} onClick={() => setStep(value => value + 1)} className="inline-flex h-10 items-center gap-2 rounded border border-black/[.15] bg-white px-4 text-[0.75rem] font-medium text-black/70 hover:bg-black/[.04] disabled:opacity-35">Avançar <ArrowRight size={12}/></button> : <button type="button" disabled={saving || !canAdvance} onClick={() => void save()} className="inline-flex h-10 items-center gap-2 rounded bg-[#2E8932] px-4 text-[0.75rem] font-semibold text-white hover:bg-[#26752A] disabled:opacity-40 disabled:cursor-not-allowed"><Check size={13}/>{saving ? "Salvando…" : "Criar plano"}</button>}
      </footer>
    </div>
  </div>;
}

function TextField({ label, value, onChange, required = false, type = "text", placeholder, className = "" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string; className?: string }) {
  return <label className={className}><span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">{label}{required && <span className="text-[#D94E4E]"> *</span>}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded border bg-white px-3 text-[0.75rem] outline-none focus:border-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.13)" }}/></label>;
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label><span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">{label}</span><textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} rows={4} className="w-full resize-none rounded border bg-white px-3 py-2.5 text-[0.75rem] outline-none focus:border-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.13)" }}/></label>;
}

function SelectField({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; required?: boolean }) {
  const dropdownOptions = required
    ? options.map(([id, name]) => ({ value: id, label: name }))
    : [{ value: "", label: "Nenhum" }, ...options.map(([id, name]) => ({ value: id, label: name }))];
  return (
    <div>
      <span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">
        {label}{required && <span className="text-[#D94E4E]"> *</span>}
      </span>
      <Dropdown
        value={value}
        onChange={onChange}
        placeholder="Selecionar…"
        options={dropdownOptions}
      />
    </div>
  );
}
