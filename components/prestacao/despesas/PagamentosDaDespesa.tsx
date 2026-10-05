"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatarDocumento, limparDocumento } from "@/lib/prestacao/fornecedores";
import { lerValor } from "@/lib/prestacao/orcamento";
import { FORMAS_PAGAMENTO, rotuloDaForma, situacaoDosPagamentos } from "@/lib/prestacao/pagamentos";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoFornecedor, PrestacaoPagamento } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "w-full rounded border border-black/[.12] px-3 py-2 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20";
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const hoje = () => new Date().toLocaleDateString("sv-SE");

/** Pagamentos de uma despesa: o que já saiu, para quem, e o registro de um novo. */
export function PagamentosDaDespesa({ despesaId, liquido, fornecedor, pagamentos, podeEditar, onMudou }: {
  despesaId: string;
  /** Líquido da despesa como está no formulário (bruto menos retenções). */
  liquido: number | null;
  fornecedor: PrestacaoFornecedor | null;
  pagamentos: readonly PrestacaoPagamento[];
  podeEditar: boolean;
  onMudou: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const idBase = useId();
  const { pago, falta, situacao } = situacaoDosPagamentos(liquido, pagamentos);
  const [forma, setForma] = useState("pix");
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [numero, setNumero] = useState("");
  const [favorecido, setFavorecido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const ordenados = [...pagamentos].sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at));
  const valorSugerido = falta !== null && falta > 0 ? String(falta).replace(".", ",") : "";
  const favorecidoSugerido = fornecedor?.documento ? formatarDocumento(fornecedor.documento) : "";

  async function registrar() {
    const v = valor.trim() ? lerValor(valor) : valorSugerido ? lerValor(valorSugerido) : 0;
    if (!(v > 0)) { setErro("Informe o valor pago."); return; }
    if (!data) { setErro("Informe a data do pagamento."); return; }
    setSalvando(true);
    setErro("");
    const documento = limparDocumento(favorecido.trim() || favorecidoSugerido);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
    const { error } = await (supabase as any).from("prestacao_pagamentos").insert({
      despesa_id: despesaId,
      forma,
      data,
      valor: v,
      numero_documento: numero.trim() || null,
      favorecido_documento: documento || null,
      favorecido_nome: documento && documento === limparDocumento(fornecedor?.documento) ? fornecedor?.razao_social ?? fornecedor?.nome ?? null : null,
    });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível registrar o pagamento")); return; }
    setValor("");
    setNumero("");
    setFavorecido("");
    onMudou();
  }

  function excluir(p: PrestacaoPagamento) {
    confirmDelete({
      title: "Excluir pagamento?",
      description: `O pagamento de ${reais(Number(p.valor))} em ${dataBr(p.data)} sai desta despesa.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
        const { error } = await (supabase as any).from("prestacao_pagamentos").delete().eq("id", p.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir o pagamento"));
        onMudou();
      },
    });
  }

  return (
    <div>
      <p className="mb-2 text-[0.75rem] text-black/55">
        {situacao === "sem_pagamento" && (liquido !== null ? <>Nada pago ainda de <span className="tabular-nums">{reais(liquido)}</span>.</> : "Nada pago ainda.")}
        {situacao === "parcial" && <>Pago <span className="tabular-nums text-black/80">{reais(pago)}</span>{falta !== null && <>; faltam <span className="tabular-nums">{reais(falta)}</span></>}.</>}
        {situacao === "pago" && <span className="text-[#2E8932]">Pago: <span className="tabular-nums">{reais(pago)}</span>.</span>}
        {situacao === "excedido" && <span className="text-[#B23B3B]">Pago <span className="tabular-nums">{reais(pago)}</span>, acima do líquido.</span>}
      </p>

      {ordenados.length > 0 && (
        <ul className="mb-3 divide-y divide-black/[.05] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-label="Pagamentos registrados">
          {ordenados.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-[0.75rem]">
              <span className="w-[4.75rem] shrink-0 tabular-nums text-black/60">{dataBr(p.data)}</span>
              <span className="min-w-0 flex-1 truncate text-black/70">
                {rotuloDaForma(p.forma)}
                {p.numero_documento && <span className="text-black/40"> · nº {p.numero_documento}</span>}
                {p.favorecido_documento && <span className="text-black/40"> · para {formatarDocumento(p.favorecido_documento)}</span>}
                {p.lancamento_id && <span className="text-[#2E8932]"> · conciliado</span>}
              </span>
              <span className="shrink-0 tabular-nums text-black/80">{reais(Number(p.valor))}</span>
              {podeEditar && (
                <button type="button" onClick={() => excluir(p)} aria-label={`Excluir pagamento de ${dataBr(p.data)}`} title="Excluir" className="rounded p-1.5 text-black/30 transition hover:bg-black/[.04] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
                  <Trash2 size={12} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <fieldset className="rounded border p-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <legend className="px-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">Registrar pagamento</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[8.5rem_9.5rem_8rem_1fr]">
            <div>
              <span className={ROTULO}>Forma</span>
              <Dropdown value={forma} onChange={setForma} ariaLabel="Forma de pagamento" options={FORMAS_PAGAMENTO.map(f => ({ value: f.id, label: f.rotulo }))} />
            </div>
            <label className="block" htmlFor={`${idBase}-data`}>
              <span className={ROTULO}>Data</span>
              <input id={`${idBase}-data`} type="date" value={data} onChange={e => setData(e.target.value)} className={CAMPO} />
            </label>
            <label className="block" htmlFor={`${idBase}-valor`}>
              <span className={ROTULO}>Valor</span>
              <input id={`${idBase}-valor`} inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder={valorSugerido || "0,00"} className={`${CAMPO} tabular-nums`} />
            </label>
            <label className="block" htmlFor={`${idBase}-numero`}>
              <span className={ROTULO}>Nº do documento (igual ao extrato)</span>
              <input id={`${idBase}-numero`} value={numero} onChange={e => setNumero(e.target.value)} className={`${CAMPO} tabular-nums`} placeholder="Ex.: E0000000020261005" />
            </label>
            <label className="col-span-2 block sm:col-span-3" htmlFor={`${idBase}-favorecido`}>
              <span className={ROTULO}>Favorecido (CPF ou CNPJ)</span>
              <input id={`${idBase}-favorecido`} value={favorecido} onChange={e => setFavorecido(e.target.value)} placeholder={favorecidoSugerido || "Documento de quem recebeu"} className={`${CAMPO} tabular-nums`} />
            </label>
            <div className="col-span-2 flex items-end justify-end sm:col-span-1">
              <button
                type="button"
                onClick={registrar}
                disabled={salvando}
                className="flex h-[2.375rem] w-full items-center justify-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] font-medium text-black/75 transition hover:border-black/25 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-wait disabled:text-black/35 motion-reduce:transform-none"
                style={{ borderColor: "rgba(13,13,13,.16)" }}
              >
                <Plus size={13} aria-hidden /> {salvando ? "Registrando…" : "Adicionar"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[0.625rem] text-black/40">Valor e favorecido em branco usam o que falta pagar e o documento do fornecedor.</p>
          {erro && <p role="alert" className="mt-2 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
        </fieldset>
      )}
    </div>
  );
}
