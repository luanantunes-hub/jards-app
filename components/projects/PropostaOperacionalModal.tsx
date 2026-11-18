"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useId, useMemo, useState } from "react";
import { Check, FileCheck2, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { CotaPatrocinio, Proposta, StatusProposta } from "@/lib/supabase/types";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatCotaValor, valorForaDaFaixa } from "@/lib/cotas";
import { SITUACAO_PROPOSTA } from "@/lib/propostas";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type CaseOption = { id: string; titulo: string; complemento?: string | null };

export type PropostaOperacionalDraft = Pick<
  Proposta,
  "id" | "titulo" | "valor_proposto" | "cota_id" |
  "contrapartidas" | "observacoes_comerciais"
> & Partial<Pick<
  Proposta,
  "captacao_id" | "edital_user_id" | "slide_capa" | "slide_historia" | "slide_numeros" | "slide_contato"
>> & { status: string };

export type FixedProposalCase = CaseOption & { kind: "negociacao" | "edital" };

// Aceitar não é uma situação escolhida aqui: é "Fechar negócio", que registra
// a venda. Uma proposta já aceita aparece como tal, sem poder voltar.
const SITUACOES_EDITAVEIS = ["rascunho", "enviada", "arquivada"] as const;

function money(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PropostaOperacionalModal({
  projetoId,
  projetoNome,
  proposta,
  cotas,
  captacoes,
  inscricoes,
  fixedCase,
  valorInicial,
  onClose,
  onSaved,
}: {
  projetoId: string;
  projetoNome: string;
  proposta: PropostaOperacionalDraft | null;
  cotas: CotaPatrocinio[];
  captacoes: CaseOption[];
  inscricoes: CaseOption[];
  fixedCase?: FixedProposalCase;
  /** Valor atual da negociação/inscrição: ponto de partida de uma proposta nova. */
  valorInicial?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const organizationId = useOrganizationId();
  const initialKind = fixedCase?.kind ?? (proposta?.edital_user_id ? "edital" : "negociacao");
  const [titulo, setTitulo] = useState(proposta?.titulo ?? `${projetoNome} — proposta`);
  const [caseKind, setCaseKind] = useState<"negociacao" | "edital">(initialKind);
  const [caseId, setCaseId] = useState(fixedCase?.id ?? proposta?.captacao_id ?? proposta?.edital_user_id ?? "");
  const [cotaId, setCotaId] = useState(proposta?.cota_id ?? "");
  // Mesmo formato que o campo lê (vírgula decimal): String(120000.5) virava 1.200.005 ao salvar.
  const [valor, setValor] = useState(() => {
    const inicial = proposta ? proposta.valor_proposto : valorInicial ?? null;
    return inicial != null ? inicial.toLocaleString("pt-BR", { useGrouping: false, minimumFractionDigits: 2 }) : "";
  });
  const [contrapartidas, setContrapartidas] = useState<string[]>(proposta?.contrapartidas ?? []);
  const [observacoes, setObservacoes] = useState(proposta?.observacoes_comerciais ?? "");
  const [status, setStatus] = useState<string>(proposta?.status ?? "rascunho");
  const situacaoTravada = proposta?.status === "aceita";
  const situacoes = [...SITUACOES_EDITAVEIS, ...(SITUACOES_EDITAVEIS.includes(status as typeof SITUACOES_EDITAVEIS[number]) ? [] : [status])];
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  const cotaBase = cotas.find(item => item.id === cotaId) ?? null;
  const selectedOptions = caseKind === "negociacao" ? captacoes : inscricoes;
  const numericValue = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null;
  const added = cotaBase ? contrapartidas.filter(item => item.trim() && !cotaBase.contrapartidas.includes(item.trim())) : contrapartidas.filter(item => item.trim());
  const removed = cotaBase ? cotaBase.contrapartidas.filter(item => !contrapartidas.map(value => value.trim()).includes(item)) : [];
  const valueDelta = cotaBase && numericValue != null ? numericValue - cotaBase.valor : null;

  function changeKind(kind: "negociacao" | "edital") {
    setCaseKind(kind);
    setCaseId("");
  }

  function selectCota(nextId: string) {
    setCotaId(nextId);
    const next = cotas.find(item => item.id === nextId);
    if (!next) { setValor(""); setContrapartidas([]); return; }
    setValor(next.valor.toLocaleString("pt-BR", { useGrouping: false, minimumFractionDigits: 2 }));
    setContrapartidas([...next.contrapartidas]);
  }

  async function save() {
    if (!titulo.trim()) { setErro("Informe o título interno."); return; }
    if (!caseId) { setErro(`Selecione ${caseKind === "negociacao" ? "uma negociação" : "uma inscrição"}.`); return; }
    if (numericValue != null && (!Number.isFinite(numericValue) || numericValue < 0)) { setErro("Informe um valor válido."); return; }
    setSaving(true);
    setErro(null);
    let orgId = organizationId;
    if (!orgId) {
      const { data } = await supabase.rpc("auth_org_ids");
      orgId = (data as unknown as string[] | null)?.[0] ?? null;
    }
    if (!orgId) { setErro("Organização não encontrada."); setSaving(false); return; }

    const payload = {
      projeto_id: projetoId,
      organization_id: orgId,
      titulo: titulo.trim(),
      captacao_id: caseKind === "negociacao" ? caseId : null,
      edital_user_id: caseKind === "edital" ? caseId : null,
      cota_id: cotaId || null,
      valor_proposto: numericValue,
      contrapartidas: contrapartidas.map(item => item.trim()).filter(Boolean),
      observacoes_comerciais: observacoes.trim() || null,
      status: status as StatusProposta,
      slide_capa: proposta?.slide_capa ?? {},
      slide_historia: proposta?.slide_historia ?? {},
      slide_numeros: proposta?.slide_numeros ?? {},
      slide_contato: proposta?.slide_contato ?? {},
    };
    const query = proposta
      ? (supabase as any).from("propostas").update(payload).eq("id", proposta.id)
      : (supabase as any).from("propostas").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) { setErro(error.message); return; }
    onSaved();
    onClose();
  }

  function remove() {
    if (!proposta) return;
    confirmDelete({
      title: "Excluir esta proposta?",
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "propostas", proposta.id);
        onSaved();
        onClose();
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center veu p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded bg-white border elevacao-3" onClick={event => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-black/[.07] px-6 py-4">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded bg-black/[.045] text-black/45"><FileCheck2 size={16} /></span><div><h2 id={titleId} className="text-[0.875rem] font-semibold text-black/80">{proposta ? "Proposta completa" : "Nova proposta"}</h2></div></div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-2 text-black/30 hover:bg-black/[.05]"><X size={14} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Título</label><input value={titulo} onChange={event => setTitulo(event.target.value)} className="h-10 w-full rounded border border-black/[.12] px-3 text-[0.8125rem] outline-none focus:border-[#7259B5]/60" /></div>

          <div>
            <label className="mb-2 block text-[0.6875rem] font-semibold text-black/55">Para</label>
            {fixedCase ? (
              <div className="rounded border border-black/[.09] bg-black/[.025] px-3 py-2.5">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/30">{fixedCase.kind === "negociacao" ? "Negociação" : "Inscrição"}</p>
                <p className="mt-0.5 truncate text-[0.75rem] font-semibold text-black/65">{fixedCase.titulo}{fixedCase.complemento ? ` · ${fixedCase.complemento}` : ""}</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex w-fit rounded border border-black/[.09] bg-black/[.025] p-0.5"><button type="button" onClick={() => changeKind("negociacao")} className={`rounded px-3 py-1.5 text-[0.6875rem] font-semibold ${caseKind === "negociacao" ? "bg-white text-black/70 shadow-sm" : "text-black/35"}`}>Negociação</button><button type="button" onClick={() => changeKind("edital")} className={`rounded px-3 py-1.5 text-[0.6875rem] font-semibold ${caseKind === "edital" ? "bg-white text-black/70 shadow-sm" : "text-black/35"}`}>Inscrição</button></div>
                <Dropdown
                  value={caseId}
                  onChange={setCaseId}
                  placeholder="Selecione…"
                  options={selectedOptions.map(item => ({ value: item.id, label: item.titulo + (item.complemento ? ` · ${item.complemento}` : "") }))}
                />
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Cota <span className="font-normal text-black/35">(opcional)</span></label><Dropdown value={cotaId} onChange={selectCota} options={[{ value: "", label: "Sem cota" }, ...cotas.map(item => ({ value: item.id, label: `${item.nome}${item.modelo === "produto" && item.produto_nome ? ` · ${item.produto_nome}` : ""} · ${formatCotaValor(item)}` }))]} /></div>
            <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Valor</label><div className="flex h-10 items-center rounded border border-black/[.12] px-3 focus-within:border-[#7259B5]/60"><span className="mr-2 text-[0.6875rem] text-black/30">R$</span><input inputMode="decimal" value={valor} onChange={event => setValor(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none" /></div></div>
          </div>
          {cotaBase && valorForaDaFaixa(cotaBase, numericValue) && (
            <p className="text-[0.6875rem] text-[#B07A14]">O valor está fora da faixa de {formatCotaValor(cotaBase)}. Confira se outra cota é mais adequada; você ainda pode salvar esta proposta.</p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between"><label className="text-[0.6875rem] font-semibold text-black/55">Contrapartidas</label><button type="button" onClick={() => setContrapartidas(items => [...items, ""])} className="flex items-center gap-1 text-[0.6875rem] font-semibold text-[#7259B5]"><Plus size={11} /> Adicionar</button></div>
            <div className="space-y-2">{contrapartidas.length === 0 ? <button type="button" onClick={() => setContrapartidas([""])} className="w-full rounded border border-dashed border-black/[.12] py-5 text-[0.6875rem] text-black/35">Adicionar contrapartida</button> : contrapartidas.map((item, index) => <div key={index} className="flex gap-2"><input value={item} onChange={event => setContrapartidas(items => items.map((current, position) => position === index ? event.target.value : current))} className="h-9 min-w-0 flex-1 rounded border border-black/[.12] px-3 text-[0.75rem] outline-none focus:border-[#7259B5]/60" /><button type="button" onClick={() => setContrapartidas(items => items.filter((_, position) => position !== index))} aria-label="Remover contrapartida" className="rounded p-2 text-black/20 hover:bg-black/[.04] hover:text-[#D94E4E]"><X size={12} /></button></div>)}</div>
          </div>

          {cotaBase && (valueDelta !== 0 || added.length > 0 || removed.length > 0) && (
            <div className="rounded border border-[#7259B5]/15 bg-white p-4"><p className="text-[0.6875rem] font-semibold text-black/60">Ajustes sobre {cotaBase.nome}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.625rem] text-black/40">{valueDelta !== null && valueDelta !== 0 && <span>Valor {valueDelta > 0 ? "+" : ""}{money(valueDelta)}</span>}{added.length > 0 && <span>{added.length} adicionada{added.length === 1 ? "" : "s"}</span>}{removed.length > 0 && <span>{removed.length} removida{removed.length === 1 ? "" : "s"}</span>}</div></div>
          )}

          <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Observações</label><textarea value={observacoes} onChange={event => setObservacoes(event.target.value)} rows={4} className="w-full resize-none rounded border border-black/[.12] px-3 py-2.5 text-[0.8125rem] outline-none focus:border-[#7259B5]/60" /></div>
          <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Situação</label><Dropdown value={status} onChange={setStatus} disabled={situacaoTravada} options={situacoes.map(item => ({ value: item, label: SITUACAO_PROPOSTA[item] ?? item }))} /></div>
          {erro && <p role="alert" className="rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.6875rem] text-[#B23A3A]">{erro}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-black/[.07] px-6 py-4"><div>{proposta && <button type="button" onClick={remove} className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[#D94E4E]/70 hover:text-[#D94E4E]"><Trash2 size={12} /> Excluir</button>}</div><div className="flex items-center gap-3"><button type="button" onClick={onClose} className="text-[0.75rem] font-semibold text-black/35 hover:text-black/55">Cancelar</button><button type="button" onClick={() => void save()} disabled={saving} className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40 disabled:cursor-not-allowed"><Check size={12} /> {saving ? "Salvando…" : "Salvar"}</button></div></div>
      </div>
    </div>
  );
}
