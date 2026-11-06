"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, GitBranch, RefreshCw, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { RenewalDecisionSheet, type RenewalEvaluationState } from "@/components/customer-success/RenewalDecisionSheet";
import { DEFAULT_RENEWAL_DECISION_TREE, OUTCOME_LABELS, cloneDecisionTree, type RenewalDecisionNode, type RenewalDecisionOutcome } from "@/lib/customer-success/renewalDecisionTree";

export type RenewalPlan = {
  id: string;
  contrato_origem_id: string;
  projeto_id: string | null;
  captacao_id: string | null;
  atividade_id: string | null;
  responsavel_id: string | null;
  captador_id: string | null;
  cenario: "renovar" | "expandir" | "reduzir" | "encerrar";
  status: "programada" | "em_negociacao" | "aprovada" | "recusada" | "encerrada" | "cancelada";
  valor_atual: number | null;
  valor_esperado: number | null;
  probabilidade: number | null;
  confianca: "baixa" | "media" | "alta" | null;
  iniciar_negociacao_em: string;
  nota: string | null;
  riscos: string | null;
  iniciada_em: string | null;
  concluida_em: string | null;
  arvore_snapshot?: RenewalDecisionNode[] | null;
  arvore_respostas?: Record<string, string> | null;
  no_atual?: string | null;
  diagnostico?: RenewalDecisionOutcome | null;
  avaliacao_status?: "nao_avaliada" | "em_andamento" | "concluida";
};

type Contract = { id: string; titulo: string | null; numero: string | null; valor: number; proxima_renovacao: string | null; status: string };
type Project = { id: string; nome: string };
type Member = { id: string; nome: string };
type Agency = { id: string; nome: string };

type Props = {
  open: boolean;
  contaId: string;
  organizationId: string;
  contracts: Contract[];
  projects: Project[];
  plans: RenewalPlan[];
  initialContractId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const SCENARIOS = [
  { value: "renovar", label: "Renovar nas condições atuais" },
  { value: "expandir", label: "Expandir a parceria" },
  { value: "reduzir", label: "Reduzir ou renegociar" },
  { value: "encerrar", label: "Encerrar ao fim do contrato" },
];

function suggestedDate(contract: Contract | undefined) {
  if (contract?.proxima_renovacao) {
    const value = new Date(`${contract.proxima_renovacao.slice(0, 10)}T12:00:00`);
    value.setDate(value.getDate() - 60);
    return value.toISOString().slice(0, 10);
  }
  const value = new Date();
  value.setDate(value.getDate() + 30);
  return value.toISOString().slice(0, 10);
}

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!normalized) return null;
  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RenewalPlanningSheet({ open, contaId, organizationId, contracts, projects, plans, initialContractId, onClose, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const firstContractId = initialContractId ?? contracts[0]?.id ?? "";
  const initialPlan = plans.find(plan => plan.contrato_origem_id === firstContractId);
  const [contractId, setContractId] = useState(firstContractId);
  const [scenario, setScenario] = useState(initialPlan?.cenario ?? "renovar");
  const [projectId, setProjectId] = useState(initialPlan?.projeto_id ?? "");
  const [responsibleId, setResponsibleId] = useState(initialPlan?.responsavel_id ?? "");
  const [agencyId, setAgencyId] = useState(initialPlan?.captador_id ?? "");
  const [startDate, setStartDate] = useState(initialPlan?.iniciar_negociacao_em?.slice(0, 10) ?? suggestedDate(contracts.find(contract => contract.id === firstContractId)));
  const [expectedValue, setExpectedValue] = useState(initialPlan?.valor_esperado?.toString() ?? contracts.find(contract => contract.id === firstContractId)?.valor?.toString() ?? "");
  const [note, setNote] = useState(initialPlan?.nota ?? "");
  const [risks, setRisks] = useState(initialPlan?.riscos ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [contractAgencies, setContractAgencies] = useState<Record<string, string>>({});
  const [tree, setTree] = useState<RenewalDecisionNode[]>(cloneDecisionTree(DEFAULT_RENEWAL_DECISION_TREE));
  const [evaluation, setEvaluation] = useState<RenewalEvaluationState>({ answers: {}, currentNodeId: DEFAULT_RENEWAL_DECISION_TREE[0]?.id ?? null, outcome: null, status: "nao_avaliada" });
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPlan = plans.find(plan => plan.contrato_origem_id === contractId);
  const decisionTree = selectedPlan?.arvore_snapshot?.length ? selectedPlan.arvore_snapshot : tree;

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      const [{ data: memberships }, { data: treeConfig }, { data: agencyRows }, { data: participationRows }] = await Promise.all([
        (supabase as any).from("organization_members").select("user_id").eq("organization_id", organizationId),
        (supabase as any).from("renovacao_arvores_decisao").select("nos").eq("organization_id", organizationId).maybeSingle(),
        (supabase as any).from("captadores").select("id,nome").eq("organization_id", organizationId).or("ativo.eq.true,ativo.is.null").order("nome"),
        (supabase as any).from("participacoes_agencia_cliente").select("contrato_id,captador_id,papel,status").in("contrato_id", contracts.length ? contracts.map(contract => contract.id) : ["00000000-0000-0000-0000-000000000000"]).eq("status", "ativa"),
      ]);
      const configuredTree = Array.isArray(treeConfig?.nos) && treeConfig.nos.length ? treeConfig.nos as RenewalDecisionNode[] : DEFAULT_RENEWAL_DECISION_TREE;
      if (active) setTree(cloneDecisionTree(configuredTree));
      if (active) {
        setAgencies((agencyRows ?? []) as Agency[]);
        const nextContractAgencies: Record<string, string> = {};
        for (const row of participationRows ?? []) if (!nextContractAgencies[row.contrato_id] || row.papel === "principal") nextContractAgencies[row.contrato_id] = row.captador_id;
        setContractAgencies(nextContractAgencies);
        const currentPlan = plans.find(plan => plan.contrato_origem_id === firstContractId);
        setAgencyId(currentPlan?.captador_id ?? nextContractAgencies[firstContractId] ?? "");
      }
      const ids = (memberships ?? []).map((membership: { user_id: string }) => membership.user_id);
      if (!ids.length) { if (active) setMembers([]); return; }
      const { data: profiles } = await (supabase as any).from("profiles").select("id,full_name,email").in("id", ids).order("full_name");
      if (active) setMembers((profiles ?? []).map((profile: { id: string; full_name: string | null; email: string | null }) => ({ id: profile.id, nome: profile.full_name || profile.email || "Membro" })));
    })();
    return () => { active = false; };
  }, [open, organizationId, supabase, contracts, plans, firstContractId]);

  useEffect(() => {
    if (!open) return;
    const nextContractId = initialContractId ?? contracts[0]?.id ?? "";
    const plan = plans.find(item => item.contrato_origem_id === nextContractId);
    const contract = contracts.find(item => item.id === nextContractId);
    setContractId(nextContractId);
    setScenario(plan?.cenario ?? "renovar");
    setProjectId(plan?.projeto_id ?? "");
    setResponsibleId(plan?.responsavel_id ?? "");
    setAgencyId(plan?.captador_id ?? contractAgencies[nextContractId] ?? "");
    setStartDate(plan?.iniciar_negociacao_em?.slice(0, 10) ?? suggestedDate(contract));
    setExpectedValue(plan?.valor_esperado?.toString() ?? contract?.valor?.toString() ?? "");
    const activeTree = plan?.arvore_snapshot?.length ? plan.arvore_snapshot : tree;
    setEvaluation({ answers: plan?.arvore_respostas ?? {}, currentNodeId: plan?.no_atual ?? activeTree[0]?.id ?? null, outcome: plan?.diagnostico ?? null, status: plan?.avaliacao_status ?? "nao_avaliada" });
    setNote(plan?.nota ?? "");
    setRisks(plan?.riscos ?? "");
    setError(null);
  }, [open, initialContractId, contracts, plans, tree, contractAgencies]);

  useModalDismiss(onClose, { enabled: open });

  function selectContract(value: string) {
    setContractId(value);
    const plan = plans.find(item => item.contrato_origem_id === value);
    const contract = contracts.find(item => item.id === value);
    setScenario(plan?.cenario ?? "renovar");
    setProjectId(plan?.projeto_id ?? "");
    setResponsibleId(plan?.responsavel_id ?? "");
    setAgencyId(plan?.captador_id ?? contractAgencies[value] ?? "");
    setStartDate(plan?.iniciar_negociacao_em?.slice(0, 10) ?? suggestedDate(contract));
    setExpectedValue(plan?.valor_esperado?.toString() ?? contract?.valor?.toString() ?? "");
    const activeTree = plan?.arvore_snapshot?.length ? plan.arvore_snapshot : tree;
    setEvaluation({ answers: plan?.arvore_respostas ?? {}, currentNodeId: plan?.no_atual ?? activeTree[0]?.id ?? null, outcome: plan?.diagnostico ?? null, status: plan?.avaliacao_status ?? "nao_avaliada" });
    setNote(plan?.nota ?? "");
    setRisks(plan?.riscos ?? "");
  }

  async function save() {
    if (!contractId || !startDate) return;
    setSaving(true);
    setError(null);
    const { data: savedPlan, error: saveError } = await (supabase as any).rpc("fn_planejar_renovacao_cliente", {
      p_conta_id: contaId,
      p_contrato_id: contractId,
      p_cenario: scenario,
      p_iniciar_em: startDate,
      p_valor_esperado: parseMoney(expectedValue),
      p_probabilidade: null,
      p_confianca: null,
      p_projeto_id: projectId || null,
      p_responsavel_id: responsibleId || null,
      p_nota: note.trim() || null,
      p_riscos: risks.trim() || null,
    });
    if (saveError) { setSaving(false); setError(saveError.message); return; }
    const renewalId = savedPlan?.id as string | undefined;
    if (renewalId) {
      const { error: agencyError } = await (supabase as any).rpc("fn_definir_agencia_renovacao", {
        p_renovacao_id: renewalId,
        p_captador_id: agencyId || null,
      });
      if (agencyError) { setSaving(false); setError(agencyError.message); return; }
      const { error: evaluationError } = await (supabase as any).rpc("fn_salvar_avaliacao_renovacao", {
        p_renovacao_id: renewalId,
        p_arvore_snapshot: decisionTree,
        p_respostas: evaluation.answers,
        p_no_atual: evaluation.currentNodeId,
        p_diagnostico: evaluation.outcome,
        p_status: evaluation.status,
      });
      if (evaluationError) { setSaving(false); setError(evaluationError.message); return; }
    }
    setSaving(false);
    onSaved();
  }

  if (!open) return null;

  const contractOptions = contracts.map(contract => ({ value: contract.id, label: contract.titulo || contract.numero || "Contrato" }));
  const projectOptions = [{ value: "", label: "Sem projeto definido" }, ...projects.map(project => ({ value: project.id, label: project.nome }))];
  const memberOptions = [{ value: "", label: "Sem responsável definido" }, ...members.map(member => ({ value: member.id, label: member.nome }))];
  const agencyOptions = [{ value: "", label: "Sem agência vinculada" }, ...agencies.map(agency => ({ value: agency.id, label: agency.nome }))];

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/40 px-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="renewal-sheet-title" className="max-h-[92dvh] w-full max-w-[42.5rem] overflow-y-auto rounded-b bg-white border-x border-b elevacao-2">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[.07] bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-black/[.045] text-black/45"><RefreshCw size={16} /></span>
            <div><p className="text-[0.625rem] font-medium text-black/30">Continuidade da parceria</p><h2 id="renewal-sheet-title" className="text-[0.9375rem] font-semibold text-black/80">Planejar renovação</h2></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60"><X size={15} /></button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Contrato"><CustomDropdown value={contractId} onChange={selectContract} options={contractOptions} compact portalZIndex={1100} className="w-full [&>button]:w-full" /></FieldLabel>
            <FieldLabel label="Cenário"><CustomDropdown value={scenario} onChange={value => setScenario(value as RenewalPlan["cenario"])} options={SCENARIOS} compact portalZIndex={1100} className="w-full [&>button]:w-full" /></FieldLabel>
            <FieldLabel label="Projeto"><CustomDropdown value={projectId} onChange={setProjectId} options={projectOptions} compact portalZIndex={1100} className="w-full [&>button]:w-full" /></FieldLabel>
            <FieldLabel label="Responsável"><CustomDropdown value={responsibleId} onChange={setResponsibleId} options={memberOptions} compact portalZIndex={1100} className="w-full [&>button]:w-full" /></FieldLabel>
            <FieldLabel label="Agência de captação"><CustomDropdown value={agencyId} onChange={setAgencyId} options={agencyOptions} compact portalZIndex={1100} className="w-full [&>button]:w-full" /></FieldLabel>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Iniciar negociação em"><div className="relative"><CalendarClock size={13} className="pointer-events-none absolute left-3 top-3 text-black/30"/><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="h-10 w-full rounded border border-black/[.12] bg-white pl-9 pr-3 text-[0.75rem] text-black/70 outline-none focus:border-black/30" /></div></FieldLabel>
            <FieldLabel label="Valor esperado"><input inputMode="decimal" value={expectedValue} onChange={event => setExpectedValue(event.target.value)} placeholder="R$" className="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 outline-none focus:border-black/30" /></FieldLabel>
          </div>

          <div className="rounded border border-black/[.08] bg-black/[.012] p-4">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded bg-white text-black/40 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07)]"><GitBranch size={15}/></span><div className="min-w-0 flex-1"><p className="text-[0.6875rem] font-semibold text-black/45">Decisão da renovação</p><p className="mt-0.5 truncate text-[0.8125rem] font-semibold text-black/70">{evaluation.outcome ? OUTCOME_LABELS[evaluation.outcome] : evaluation.status === "em_andamento" ? "Avaliação em andamento" : "Ainda não avaliada"}</p></div><button type="button" onClick={() => setDecisionOpen(true)} className="rounded border border-black/[.1] bg-white px-3 py-2 text-[0.6875rem] font-semibold text-black/55 hover:bg-black/[.04]">{evaluation.status === "nao_avaliada" ? "Avaliar" : "Continuar"}</button></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Nota para a negociação"><textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="Contexto e abordagem para o próximo ciclo" className="w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.75rem] leading-5 text-black/70 outline-none focus:border-black/30" /></FieldLabel>
            <FieldLabel label="Riscos"><textarea value={risks} onChange={event => setRisks(event.target.value)} rows={4} placeholder="Objeções, orçamento ou mudanças de cenário" className="w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.75rem] leading-5 text-black/70 outline-none focus:border-black/30" /></FieldLabel>
          </div>
          {error && <p role="alert" className="rounded border border-[#D94E4E]/20 bg-white px-3 py-2 text-[0.6875rem] text-[#D94E4E]">{error}</p>}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-black/[.07] bg-white px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="px-2 py-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
          <button type="button" onClick={save} disabled={saving || !contractId || !startDate} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-40"><Save size={12}/>{saving ? "Salvando…" : "Salvar"}</button>
        </footer>
      </div>
      <RenewalDecisionSheet open={decisionOpen} tree={decisionTree} value={evaluation} onChange={setEvaluation} onClose={() => setDecisionOpen(false)}/>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="block"><span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">{label}</span>{children}</div>;
}
