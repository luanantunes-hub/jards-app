"use client";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CotaPatrocinio } from "@/lib/supabase/types";
import { PropostaOperacionalModal, type PropostaOperacionalDraft } from "@/components/projects/PropostaOperacionalModal";

export type PropostaRow = PropostaOperacionalDraft & { created_at: string };

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PropostaValuePanel({
  parentField,
  parentId,
  projetoId,
  projetoNome,
  empresaNome,
  status,
  statusAprovado = "aprovado",
  statusRecusado,
  statusOcultar,
  valorAtual,
  valorFinal,
  propostas,
  onCreated,
  onResolved,
  onEditarValor,
}: {
  parentField: "captacao_id" | "edital_user_id";
  parentId: string;
  projetoId: string | null;
  projetoNome: string;
  organizationId: string | null;
  empresaNome: string;
  status: string;
  statusAprovado?: string;
  statusRecusado: string;
  statusOcultar?: string[];
  valorAtual: number | null;
  valorFinal: number | null;
  propostas: PropostaRow[];
  onCreated: () => void;
  onResolved: (payload: { status: string; valorFinal: number | null }) => Promise<void>;
  /**
   * Sem proposta, o valor é editado direto (negociação); a proposta vira um
   * botão à parte. Sem este callback, criar a proposta é o caminho do valor.
   */
  onEditarValor?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cotas, setCotas] = useState<CotaPatrocinio[]>([]);
  const [showNovaProposta, setShowNovaProposta] = useState(false);
  const [showEditProposta, setShowEditProposta] = useState(false);
  const [showNegociarProposta, setShowNegociarProposta] = useState(false);
  const [salvandoDesfecho, setSalvandoDesfecho] = useState(false);
  const [erroDesfecho, setErroDesfecho] = useState<string | null>(null);

  useEffect(() => {
    if (!projetoId) return;
    let active = true;
    supabase
      .from("cotas_patrocinio")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("ordem")
      .then(({ data }: { data: CotaPatrocinio[] | null }) => {
        if (active) setCotas(data ?? []);
      });
    return () => { active = false; };
  }, [projetoId, supabase]);

  if (!projetoId) return null;
  if (statusOcultar?.includes(status)) return null;

  const propostaAtual = propostas[0] ?? null;
  const resolvido = status === statusAprovado || status === statusRecusado;

  async function handleAceitar() {
    if (!propostaAtual || propostaAtual.valor_proposto == null) return;
    setSalvandoDesfecho(true);
    setErroDesfecho(null);
    const acceptProposal = supabase.rpc as unknown as (
      name: "fn_aceitar_proposta_comercial",
      args: { p_proposta_id: string },
    ) => Promise<{ error: { message: string } | null }>;
    const { error } = await acceptProposal("fn_aceitar_proposta_comercial", {
      p_proposta_id: propostaAtual.id,
    });
    if (error) {
      setErroDesfecho(error.message);
      setSalvandoDesfecho(false);
      return;
    }
    onCreated();
    setSalvandoDesfecho(false);
  }

  async function handleRecusar() {
    setSalvandoDesfecho(true);
    await onResolved({ status: statusRecusado, valorFinal: null });
    setSalvandoDesfecho(false);
  }

  if (resolvido) {
    const aprovado = status === statusAprovado;
    return (
      <div
        className="flex h-11 items-center gap-2 rounded border px-4"
        style={{ borderColor: aprovado ? "#2E893240" : "#D94E4E40", background: aprovado ? "#2E893208" : "#D94E4E08" }}
      >
        <span className="text-[0.75rem] font-bold" style={{ color: aprovado ? "#2E8932" : "#D94E4E" }}>
          {aprovado ? `Aprovado · ${formatCurrency(valorFinal)}` : "Recusado"}
        </span>
      </div>
    );
  }

  const modalNovaProposta = showNovaProposta && (
    <PropostaOperacionalModal
      projetoId={projetoId}
      projetoNome={projetoNome}
      proposta={null}
      cotas={cotas}
      captacoes={[]}
      inscricoes={[]}
      fixedCase={{ kind: parentField === "captacao_id" ? "negociacao" : "edital", id: parentId, titulo: projetoNome, complemento: empresaNome }}
      onClose={() => setShowNovaProposta(false)}
      onSaved={onCreated}
    />
  );

  // Sem proposta: o valor se edita ali mesmo, e a proposta é opcional.
  if (!propostaAtual && onEditarValor) {
    return (
      <>
        <button
          type="button"
          onClick={onEditarValor}
          className="flex h-11 items-center gap-3 rounded border border-black/[.12] bg-white px-4 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
          aria-label={valorAtual ? `Valor da negociação: ${formatCurrency(valorAtual)}. Editar` : "Definir o valor da negociação"}
        >
          <div className="text-left">
            <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/35">Valor</p>
            <p className={`text-[0.75rem] font-bold tabular-nums ${valorAtual ? "text-[#B07A14]" : "text-black/35"}`}>{valorAtual ? formatCurrency(valorAtual) : "Definir"}</p>
          </div>
          <Pencil size={11} className="text-black/25" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setShowNovaProposta(true)}
          className="flex h-11 items-center gap-2 rounded border border-dashed border-black/[.18] bg-white px-4 text-[0.75rem] font-medium text-black/45 transition hover:border-[#7259B5]/40 hover:text-[#7259B5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
        >
          <Plus size={12} aria-hidden="true" /> Proposta
        </button>
        {modalNovaProposta}
      </>
    );
  }

  // Nenhuma proposta formal ainda, mas existe valor legado (registro antigo) — preserva a visibilidade
  if (!propostaAtual && valorAtual) {
    return (
      <>
        <button
          onClick={() => setShowNovaProposta(true)}
          className="flex h-11 items-center gap-3 rounded border border-black/[.12] bg-white px-4 transition hover:bg-black/[.04]"
          title="Sem proposta formal registrada — clique para criar uma"
        >
          <div className="text-left">
            <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/35">Solicitado</p>
            <p className="text-[0.75rem] font-bold text-[#B07A14]">{formatCurrency(valorAtual)}</p>
          </div>
          <Plus size={11} className="text-black/25" />
        </button>
        {showNovaProposta && (
          <PropostaOperacionalModal
            projetoId={projetoId}
            projetoNome={projetoNome}
            proposta={null}
            cotas={cotas}
            captacoes={[]}
            inscricoes={[]}
            fixedCase={{ kind: parentField === "captacao_id" ? "negociacao" : "edital", id: parentId, titulo: projetoNome, complemento: empresaNome }}
            onClose={() => setShowNovaProposta(false)}
            onSaved={onCreated}
          />
        )}
      </>
    );
  }

  // Nenhuma proposta ainda
  if (!propostaAtual) {
    return (
      <>
        <button
          onClick={() => setShowNovaProposta(true)}
          className="flex h-11 items-center gap-2 rounded border border-dashed border-black/[.18] bg-white px-4 text-[0.75rem] font-medium text-black/45 transition hover:border-[#7259B5]/40 hover:text-[#7259B5]"
        >
          <Plus size={12} /> Nova proposta
        </button>
        {showNovaProposta && (
          <PropostaOperacionalModal
            projetoId={projetoId}
            projetoNome={projetoNome}
            proposta={null}
            cotas={cotas}
            captacoes={[]}
            inscricoes={[]}
            fixedCase={{ kind: parentField === "captacao_id" ? "negociacao" : "edital", id: parentId, titulo: projetoNome, complemento: empresaNome }}
            onClose={() => setShowNovaProposta(false)}
            onSaved={onCreated}
          />
        )}
      </>
    );
  }

  // Proposta criada, mas ainda sem valor definido — precisa ser aberta/adaptada antes de decidir um desfecho
  if (propostaAtual.valor_proposto == null) {
    return (
      <>
        <button
          onClick={() => setShowEditProposta(true)}
          className="flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04]"
        >
          Abrir proposta
        </button>
        {showEditProposta && (
          <PropostaOperacionalModal
            projetoId={projetoId}
            projetoNome={projetoNome}
            proposta={propostaAtual}
            cotas={cotas}
            captacoes={[]}
            inscricoes={[]}
            fixedCase={{ kind: parentField === "captacao_id" ? "negociacao" : "edital", id: parentId, titulo: projetoNome, complemento: empresaNome }}
            onClose={() => setShowEditProposta(false)}
            onSaved={onCreated}
          />
        )}
      </>
    );
  }

  // Proposta com valor definido — decisão de desfecho
  return (
    <>
      <div className="flex h-11 items-center gap-1 rounded border border-black/[.12] bg-white pl-3 pr-1.5">
        <div className="pr-2 text-left">
          <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/35">Proposto</p>
          <p className="text-[0.75rem] font-bold text-[#B07A14]">{formatCurrency(propostaAtual.valor_proposto)}</p>
        </div>
        <div className="h-6 w-px bg-black/10" />
        <button disabled={salvandoDesfecho} onClick={handleAceitar} className="rounded px-2 py-1.5 text-[0.6875rem] font-semibold text-[#2E8932] transition hover:bg-[#2E8932]/10 disabled:opacity-40">Aceitar</button>
        <button disabled={salvandoDesfecho} onClick={() => setShowNegociarProposta(true)} className="rounded px-2 py-1.5 text-[0.6875rem] font-semibold text-[#7259B5] transition hover:bg-[#7259B5]/10 disabled:opacity-40">Negociar</button>
        <button disabled={salvandoDesfecho} onClick={handleRecusar} className="rounded px-2 py-1.5 text-[0.6875rem] font-semibold text-[#D94E4E] transition hover:bg-[#D94E4E]/10 disabled:opacity-40">Recusar</button>
      </div>
      {erroDesfecho && <p className="mt-1 max-w-sm text-[0.625rem] font-medium text-[#B23A3A]">{erroDesfecho}</p>}
      {showNegociarProposta && (
        <PropostaOperacionalModal
          projetoId={projetoId}
          projetoNome={projetoNome}
          proposta={propostaAtual}
          cotas={cotas}
          captacoes={[]}
          inscricoes={[]}
          fixedCase={{ kind: parentField === "captacao_id" ? "negociacao" : "edital", id: parentId, titulo: projetoNome, complemento: empresaNome }}
          onClose={() => setShowNegociarProposta(false)}
          onSaved={onCreated}
        />
      )}
    </>
  );
}
