"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { InputValor } from "@/components/ui/CampoValor";
import { formatarValorBRL } from "@/lib/valor";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { FornecedorCombobox } from "@/components/prestacao/despesas/FornecedorCombobox";
import { PagamentosDaDespesa } from "@/components/prestacao/despesas/PagamentosDaDespesa";
import { EtiquetaSancoes, EtiquetaSituacao } from "@/components/prestacao/fornecedores/EtiquetasFornecedor";
import type { DocumentoResumido } from "@/hooks/useFornecedoresDaOrganizacao";
import type { ItemDoOrcamento } from "@/hooks/useItensDoOrcamento";
import { formatarCodigoCnae } from "@/lib/prestacao/cnae";
import {
  alertasDaDespesa,
  ehDespesa,
  faltaJustificativa,
  IDENTIFICACAO_PROJETO,
  lerChaveAcesso,
  limparChave,
  rotuloDoModelo,
  totalRetido,
  type AlertaDespesa,
  type DespesaParaChecar,
} from "@/lib/prestacao/despesas";
import { formatarDocumento } from "@/lib/prestacao/fornecedores";
import { citacaoDaFonte, motivosDaIa, motivosParaMostrar } from "@/lib/prestacao/leitura-ia";
import { definida, regraDoRegime, type RegimeNormativo } from "@/lib/prestacao/regimes";
import { lerValor } from "@/lib/prestacao/orcamento";
import { alertasDosPagamentos } from "@/lib/prestacao/pagamentos";
import type { PagamentosRegime } from "@/lib/prestacao/regimes/tipos";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoBem, PrestacaoComprovante, PrestacaoFornecedor, PrestacaoMeta, PrestacaoPagamento, TipoComprovante } from "@/lib/supabase/types";
import { metaDoItem } from "@/lib/prestacao/objeto";
import { despesaTemBem } from "@/lib/prestacao/bens";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "w-full rounded border border-black/[.12] px-3 py-2 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20 disabled:bg-black/[.02] disabled:text-black/50";
const SECAO = "mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valorOuZero = (t: string) => (t.trim() ? lerValor(t) : 0);

/** De onde sai o dinheiro da despesa (P7.2); vazio é o recurso do projeto. */
const PAGA_COM = [
  { value: "", label: "Recurso do projeto" },
  { value: "financeira", label: "Contrapartida em dinheiro" },
  { value: "doacao", label: "Contrapartida por doação (bens e serviços)" },
];

/** Alertas da despesa, os que pedem justificativa primeiro. */
export function ListaAlertasDespesa({ alertas }: { alertas: readonly AlertaDespesa[] }) {
  if (!alertas.length) {
    return (
      <p className="flex items-center gap-2 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>
        <CheckCircle2 size={14} aria-hidden /> Nada a resolver nesta despesa.
      </p>
    );
  }
  const ordenados = [...alertas].sort((a, b) => Number(b.nivel === "alerta") - Number(a.nivel === "alerta"));
  return (
    <ul className="space-y-1.5">
      {ordenados.map((a, i) => (
        <li key={`${a.codigo}-${i}`} className={`flex items-start gap-2 text-[0.75rem] ${a.nivel === "alerta" ? "text-[#B23B3B]" : "text-black/55"}`}>
          {a.nivel === "alerta" ? <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-label="Alerta" /> : <Info size={13} className="mt-0.5 shrink-0" aria-label="Informação" />}
          <span>{a.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** Item de bem permanente (P3.5): o bem que a despesa comprou ou o link para registrá-lo. */
function BemDaDespesa({ prestacaoId, despesa, bens, salva }: {
  prestacaoId: string;
  despesa: { id: string; no_id: string | null; status: string };
  bens: readonly Pick<PrestacaoBem, "id" | "descricao" | "despesa_id" | "no_id">[];
  /** O item escolhido já está salvo na despesa. */
  salva: boolean;
}) {
  const link = "underline decoration-black/20 underline-offset-2 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const doBem = bens.find(b => b.despesa_id === despesa.id) ?? (despesaTemBem(despesa, bens) ? bens.find(b => !b.despesa_id && b.no_id === despesa.no_id) : undefined);
  if (doBem) {
    return (
      <p className="mt-1.5 text-[0.625rem] text-black/55">
        Bem: <Link href={`/prestacoes/${prestacaoId}/bens?bem=${doBem.id}`} className={link}>{doBem.descricao}</Link>
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-[0.625rem] text-[#B07A14]">
      Item de bem permanente.{" "}
      {salva
        ? <Link href={`/prestacoes/${prestacaoId}/bens?despesa=${despesa.id}`} className={link}>Registre o bem</Link>
        : "Salve a despesa e registre o bem na aba Bens"}
      , com a destinação.
    </p>
  );
}

/**
 * A despesa de um comprovante fiscal (P2.4): documento, fornecedor, item,
 * retenções e o que precisa de justificativa. Os alertas mudam enquanto a
 * pessoa preenche; salvar não depende deles.
 */
export function DespesaModal({ comprovante, tipos, itens, metas = [], bens = [], fornecedores, documentosDe, outrasChaves, pagamentos, regimePagamentos, regime = null, onPagamentosMudaram, podeEditar, onClose, onSalvo }: {
  comprovante: PrestacaoComprovante;
  tipos: { value: TipoComprovante; label: string }[];
  itens: readonly ItemDoOrcamento[];
  /** Metas do objeto (P3.3): a despesa mostra a meta a que serve, pelo agrupador do item. */
  metas?: readonly Pick<PrestacaoMeta, "id" | "descricao" | "no_id">[];
  /** Bens da prestação (P3.5): a despesa de item de bem permanente mostra o bem ou pede o registro. */
  bens?: readonly Pick<PrestacaoBem, "id" | "descricao" | "despesa_id" | "no_id">[];
  fornecedores: readonly PrestacaoFornecedor[];
  documentosDe: (fornecedorId: string | null | undefined) => DocumentoResumido[];
  outrasChaves: readonly string[];
  /** Pagamentos desta despesa (P2.5) e os meios que o regime aceita. */
  pagamentos: readonly PrestacaoPagamento[];
  regimePagamentos: PagamentosRegime | null;
  /** Regime da prestação, para a fonte do que a leitura por IA apontou (P2.10b). */
  regime?: RegimeNormativo | null;
  onPagamentosMudaram: () => void;
  podeEditar: boolean;
  onClose: () => void;
  onSalvo: (comprovante: PrestacaoComprovante) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const idBase = useId();
  const c = comprovante;
  const [tipo, setTipo] = useState<TipoComprovante>(c.tipo);
  const [dataDoc, setDataDoc] = useState(c.data_doc ?? "");
  const [numero, setNumero] = useState(c.numero_documento ?? "");
  const [serie, setSerie] = useState(c.serie ?? "");
  const [chave, setChave] = useState(c.chave_acesso ?? "");
  const [descricao, setDescricao] = useState(c.descricao_servico ?? "");
  const [identificacao, setIdentificacao] = useState<string>(c.identificacao_projeto ?? "");
  const [fornecedorId, setFornecedorId] = useState<string | null>(c.fornecedor_id ?? null);
  const [itemId, setItemId] = useState(c.no_id ?? "");
  const [valor, setValor] = useState(formatarValorBRL(c.valor_extraido));
  const [iss, setIss] = useState(formatarValorBRL(c.iss || null));
  const [inss, setInss] = useState(formatarValorBRL(c.inss || null));
  const [irrf, setIrrf] = useState(formatarValorBRL(c.irrf || null));
  const [outras, setOutras] = useState(formatarValorBRL(c.outras_retencoes || null));
  const [justificativa, setJustificativa] = useState(c.justificativa ?? "");
  const [contrapartida, setContrapartida] = useState<string>(c.contrapartida ?? "");
  // O que a leitura por IA apontou; descartar tira da despesa ao salvar.
  const [motivosIa, setMotivosIa] = useState(() => motivosDaIa(c.motivos_ia));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const fornecedor = fornecedores.find(f => f.id === fornecedorId) ?? null;
  const item = itens.find(i => i.id === itemId) ?? null;
  const metaDaDespesa = item ? metaDoItem(item.ancestrais, metas) : null;
  const despesa: DespesaParaChecar = {
    tipo,
    data_doc: dataDoc || null,
    valor_extraido: valor.trim() ? lerValor(valor) : null,
    fornecedor_id: fornecedorId,
    numero_documento: numero.trim() || null,
    chave_acesso: limparChave(chave) || null,
    iss: valorOuZero(iss),
    inss: valorOuZero(inss),
    irrf: valorOuZero(irrf),
    outras_retencoes: valorOuZero(outras),
    identificacao_projeto: (identificacao || null) as DespesaParaChecar["identificacao_projeto"],
  };
  const chaveLida = lerChaveAcesso(chave);
  const retido = totalRetido(despesa);
  const liquido = despesa.valor_extraido !== null ? Math.round((despesa.valor_extraido - retido) * 100) / 100 : null;
  const alertas = [
    ...alertasDaDespesa({
      despesa,
      fornecedor,
      documentosDoFornecedor: documentosDe(fornecedorId),
      item: item ? { nome: item.nome, cnaes: item.cnaes, origem: item.cnaesDe } : null,
      outrasChaves,
    }),
    ...alertasDosPagamentos({ despesa, liquido, fornecedor, pagamentos, regime: regimePagamentos }),
  ];
  const fiscal = ehDespesa(tipo);
  // O campo aparece quando o regime pede contrapartida (ANCINE) ou a despesa já foi marcada.
  const pedeContrapartida = Boolean(regraDoRegime(regime, "contrapartida_minima")) || Boolean(c.contrapartida);
  const vedadaNaContrapartida = regime ? definida(regime.despesas)?.vedadas.find(v => v.codigo === "contrapartida_publica") : undefined;
  const dicaDaContrapartida = contrapartida === "doacao" ? regraDoRegime(regime, "contrapartida_por_doacao")?.descricao
    : contrapartida === "financeira" && vedadaNaContrapartida ? `Não vale ${vedadaNaContrapartida.descricao.charAt(0).toLowerCase()}${vedadaNaContrapartida.descricao.slice(1)}.`
    : null;
  const pedeJustificativa = faltaJustificativa(alertas, justificativa);

  async function salvar() {
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
    const { data, error } = await (supabase as any)
      .from("prestacao_comprovantes")
      .update({
        tipo,
        data_doc: despesa.data_doc,
        numero_documento: despesa.numero_documento,
        serie: serie.trim() || null,
        chave_acesso: despesa.chave_acesso,
        descricao_servico: descricao.trim() || null,
        identificacao_projeto: despesa.identificacao_projeto,
        fornecedor_id: fornecedorId,
        no_id: itemId || null,
        valor_extraido: despesa.valor_extraido,
        iss: despesa.iss,
        inss: despesa.inss,
        irrf: despesa.irrf,
        outras_retencoes: despesa.outras_retencoes,
        justificativa: justificativa.trim() || null,
        motivos_ia: motivosIa,
        contrapartida: contrapartida || null,
      })
      .eq("id", c.id)
      .select("*")
      .single();
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a despesa")); return; }
    onSalvo(data as PrestacaoComprovante);
  }

  const campoValor = (id: string, rotulo: string, v: string, set: (t: string) => void) => (
    <label className="block" htmlFor={`${idBase}-${id}`}>
      <span className={ROTULO}>{rotulo}</span>
      <InputValor id={`${idBase}-${id}`} value={v} onChange={set} disabled={!podeEditar} className={`${CAMPO} tabular-nums`} placeholder="0,00" />
    </label>
  );

  return (
    <ModalPrestacao
      titulo="Despesa"
      subtitulo={c.nome_arquivo}
      onClose={onClose}
      largura="max-w-[46rem]"
      rodape={podeEditar ? <>
        <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2 text-[0.8125rem] font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none"
        >
          {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
          Salvar
        </button>
      </> : <><span /><button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Fechar</button></>}
    >
      <div className="space-y-6 px-6 py-5">
        {fiscal ? (
          <section aria-labelledby={`${idBase}-conferencia`}>
            <h3 id={`${idBase}-conferencia`} className={SECAO}>Conferência</h3>
            <ListaAlertasDespesa alertas={alertas} />
            {motivosIa.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="flex items-center gap-1.5 text-[0.6875rem] text-black/55">
                  <Sparkles size={12} className="shrink-0 text-black/40" aria-hidden /> A leitura por IA apontou para revisar
                </p>
                <ul className="space-y-1.5">
                  {motivosParaMostrar(motivosIa, regime).map((m, i) => {
                    const citacao = citacaoDaFonte(m.fonte);
                    return (
                      <li key={`${m.codigo}-${i}`} className="flex items-start gap-3 rounded border bg-white px-3 py-2 text-[0.75rem]" style={{ borderColor: "#B07A1447" }}>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-[#B07A14]">{m.titulo}:</span> <span className="text-black/70">{m.texto}</span>
                          {citacao && <span className="mt-0.5 block text-[0.625rem] text-black/45">{citacao}</span>}
                        </span>
                        {podeEditar && (
                          <button
                            type="button"
                            onClick={() => setMotivosIa(atual => atual.filter((_, j) => j !== i))}
                            className="shrink-0 rounded px-1.5 py-0.5 text-[0.6875rem] text-black/50 transition hover:bg-black/[.04] hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                            aria-label={`Descartar: ${m.titulo}`}
                          >
                            Descartar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {podeEditar && <p className="text-[0.625rem] text-black/40">Descarte o que você conferiu no documento; vale ao salvar.</p>}
              </div>
            )}
          </section>
        ) : (
          <p className="text-[0.75rem] text-black/50">Documento complementar: não é a despesa. Ligue-o ao item e use a nota ou o recibo para os dados fiscais.</p>
        )}

        <section aria-labelledby={`${idBase}-documento`}>
          <h3 id={`${idBase}-documento`} className={SECAO}>Documento</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className={ROTULO}>Tipo</span>
              <Dropdown value={tipo} onChange={v => setTipo(v as TipoComprovante)} options={tipos} ariaLabel="Tipo do documento" disabled={!podeEditar} />
            </div>
            <label className="block" htmlFor={`${idBase}-data`}>
              <span className={ROTULO}>Data do documento</span>
              <input id={`${idBase}-data`} type="date" value={dataDoc} onChange={e => setDataDoc(e.target.value)} disabled={!podeEditar} className={CAMPO} />
            </label>
            {fiscal && <>
              <label className="block" htmlFor={`${idBase}-numero`}>
                <span className={ROTULO}>Número</span>
                <input id={`${idBase}-numero`} value={numero} onChange={e => setNumero(e.target.value)} disabled={!podeEditar} className={`${CAMPO} tabular-nums`} />
              </label>
              <label className="block" htmlFor={`${idBase}-serie`}>
                <span className={ROTULO}>Série</span>
                <input id={`${idBase}-serie`} value={serie} onChange={e => setSerie(e.target.value)} disabled={!podeEditar} className={`${CAMPO} tabular-nums`} />
              </label>
              <label className="block sm:col-span-2" htmlFor={`${idBase}-chave`}>
                <span className={ROTULO}>Chave de acesso</span>
                <input id={`${idBase}-chave`} value={chave} onChange={e => setChave(e.target.value)} disabled={!podeEditar} className={`${CAMPO} font-mono text-[0.75rem] tracking-wide`} placeholder="44 posições (NF-e) ou 50 (NFS-e nacional)" />
                {chaveLida?.ok && (
                  <span className="mt-1 block text-[0.625rem] text-black/45">
                    {chaveLida.familia === "nfe"
                      ? `${rotuloDoModelo(chaveLida.modelo)} · emitente ${formatarDocumento(chaveLida.emitente)} · ${chaveLida.anoMes.split("-").reverse().join("/")}${chaveLida.serie ? ` · série ${Number(chaveLida.serie)}` : ""} · nº ${Number(chaveLida.numero)}`
                      : `NFS-e nacional · emitente ${formatarDocumento(chaveLida.emitente)} · ${chaveLida.anoMes.split("-").reverse().join("/")} · nº ${Number(chaveLida.numero)}`}
                  </span>
                )}
              </label>
            </>}
            <label className="block sm:col-span-2" htmlFor={`${idBase}-descricao`}>
              <span className={ROTULO}>Descrição</span>
              <input id={`${idBase}-descricao`} value={descricao} onChange={e => setDescricao(e.target.value)} disabled={!podeEditar} className={CAMPO} placeholder="Como está no documento" />
            </label>
            {fiscal && (
              <div>
                <span className={ROTULO}>Identificação do projeto no documento</span>
                <Dropdown
                  value={identificacao}
                  onChange={setIdentificacao}
                  ariaLabel="Identificação do projeto no documento"
                  disabled={!podeEditar}
                  options={[{ value: "", label: "Não informado" }, ...IDENTIFICACAO_PROJETO.map(i => ({ value: i.id, label: i.rotulo }))]}
                />
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby={`${idBase}-ligacoes`}>
          <h3 id={`${idBase}-ligacoes`} className={SECAO}>Fornecedor e item</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={ROTULO} htmlFor={`${idBase}-fornecedor`}>Fornecedor</label>
              <FornecedorCombobox id={`${idBase}-fornecedor`} fornecedores={fornecedores} valor={fornecedorId} onChange={setFornecedorId} disabled={!podeEditar} />
              {fornecedor && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <EtiquetaSituacao fornecedor={fornecedor} />
                  <EtiquetaSancoes fornecedor={fornecedor} />
                  {fornecedor.cnae_principal && <span className="text-[0.625rem] tabular-nums text-black/40">CNAE {fornecedor.cnae_principal}{(fornecedor.cnaes_secundarios?.length ?? 0) > 0 ? ` +${fornecedor.cnaes_secundarios!.length}` : ""}</span>}
                </div>
              )}
            </div>
            <div>
              <span className={ROTULO}>Item do orçamento</span>
              <Dropdown
                value={itemId}
                onChange={setItemId}
                ariaLabel="Item do orçamento"
                disabled={!podeEditar}
                options={[
                  { value: "", label: c.no_id && !item ? "Item de outra versão" : "Sem item" },
                  ...itens.map(i => ({ value: i.id, label: i.caminho.length ? `${i.caminho[i.caminho.length - 1]} › ${i.nome}` : i.nome })),
                ]}
              />
              {metaDaDespesa && (
                <p className="mt-1.5 text-[0.625rem] text-black/55">Serve à meta: {metaDaDespesa.descricao}</p>
              )}
              {item?.bemPermanente && (
                <BemDaDespesa
                  prestacaoId={c.prestacao_id}
                  despesa={{ id: c.id, no_id: itemId || null, status: c.status }}
                  bens={bens}
                  salva={itemId === (c.no_id ?? "")}
                />
              )}
              {item && (
                <p className="mt-1.5 text-[0.625rem] text-black/40">
                  {item.cnaes.length
                    ? <>Aceita CNAE <span className="tabular-nums">{item.cnaes.map(formatarCodigoCnae).join(", ")}</span>{item.cnaesDe && item.cnaesDe.id !== item.id ? ` (de ${item.cnaesDe.nome})` : ""}</>
                    : "O item não define CNAEs aceitos; defina na aba Orçamento."}
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby={`${idBase}-valores`}>
          <h3 id={`${idBase}-valores`} className={SECAO}>Valores</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">{campoValor("valor", "Valor do documento", valor, setValor)}</div>
            {fiscal && <>
              {campoValor("iss", "ISS retido", iss, setIss)}
              {campoValor("inss", "INSS retido", inss, setInss)}
              {campoValor("irrf", "IRRF retido", irrf, setIrrf)}
              {campoValor("outras", "Outras retenções", outras, setOutras)}
            </>}
          </div>
          {fiscal && liquido !== null && (
            <p className="mt-2 text-[0.75rem] text-black/55">
              Líquido para o fornecedor: <span className="font-medium tabular-nums text-black/80">{reais(liquido)}</span>
              {retido > 0 && <span className="text-black/40"> ({reais(retido)} retidos)</span>}
            </p>
          )}
        </section>

        {fiscal && (
          <section aria-labelledby={`${idBase}-pagamentos`}>
            <h3 id={`${idBase}-pagamentos`} className={SECAO}>Pagamentos</h3>
            {pedeContrapartida && (
              <div className="mb-3 max-w-[22rem]">
                <span className={ROTULO}>Paga com</span>
                <Dropdown value={contrapartida} onChange={setContrapartida} options={PAGA_COM} ariaLabel="Paga com" disabled={!podeEditar} />
                {dicaDaContrapartida && <p className="mt-1 text-[0.625rem] text-black/45">{dicaDaContrapartida}</p>}
              </div>
            )}
            <PagamentosDaDespesa despesaId={c.id} liquido={liquido} fornecedor={fornecedor} pagamentos={pagamentos} podeEditar={podeEditar} onMudou={onPagamentosMudaram} />
          </section>
        )}

        {fiscal && (
          <section aria-labelledby={`${idBase}-justificativa`}>
            <h3 id={`${idBase}-justificativa`} className={SECAO}>Justificativa</h3>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              disabled={!podeEditar}
              rows={2}
              aria-labelledby={`${idBase}-justificativa`}
              className={`${CAMPO} resize-y`}
              placeholder="Por que a despesa segue apesar dos alertas (ex.: fornecedor do Simples, sem retenção)"
            />
            {pedeJustificativa && <p className="mt-1 text-[0.625rem] text-[#B23B3B]">Há alerta sem justificativa: explique antes de mandar para revisão.</p>}
          </section>
        )}

        {erro && (
          <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>
        )}
      </div>
    </ModalPrestacao>
  );
}
