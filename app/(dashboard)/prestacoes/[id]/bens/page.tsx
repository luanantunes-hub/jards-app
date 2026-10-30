"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { useItensDoOrcamento } from "@/hooks/useItensDoOrcamento";
import { BemModal, type DespesaParaBem } from "@/components/prestacao/bens/BemModal";
import type { Achado, EstadoDaPrestacao } from "@/lib/prestacao/checagens";
import { checarBens } from "@/lib/prestacao/checagens/checar-bens";
import { despesasSemBem, lerCotacoes, menorCotacao, rotuloDaDestinacao, rotuloDoTipoBem } from "@/lib/prestacao/bens";
import { formatarDocumento } from "@/lib/prestacao/fornecedores";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoBem } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";

type DadosDaPrestacao = { regime_id: string | null; data_inicio_execucao: string | null; data_fim_execucao: string | null };
type Editando = { bem: PrestacaoBem | null; inicial?: { despesa_id?: string | null; no_id?: string | null; descricao?: string; valor?: number | null } };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Avisos({ achados }: { achados: readonly Achado[] }) {
  if (achados.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {achados.map(a => (
        <li key={a.chave} className={`flex items-start gap-1 text-[0.6875rem] ${a.justificativa ? "text-black/45" : "text-black/60"}`}>
          <AlertTriangle size={12} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${a.justificativa ? "text-black/40" : "text-[#B07A14]"}`} aria-hidden />
          <span>{a.mensagem}{a.justificativa ? ` Justificativa: ${a.justificativa}` : ""}</span>
        </li>
      ))}
    </ul>
  );
}

function Destinacao({ b }: { b: PrestacaoBem }) {
  if (!b.destinacao) return <span className="text-black/30">Sem destinação</span>;
  return (
    <span>
      {rotuloDaDestinacao(b.destinacao)}
      {b.destinacao === "doacao" && b.beneficiario && <span className="block text-black/45">{b.beneficiario}</span>}
      {b.destinacao === "doacao" && b.beneficiario_documento && <span className="block whitespace-nowrap tabular-nums text-black/40">{formatarDocumento(b.beneficiario_documento)}</span>}
      {b.destinacao === "outra" && b.destinacao_descricao && <span className="block text-black/45">{b.destinacao_descricao}</span>}
    </span>
  );
}

function Cotacoes({ b }: { b: PrestacaoBem }) {
  const menor = menorCotacao(b.cotacoes);
  if (!menor) return <span className="text-black/30">Nenhuma</span>;
  return (
    <span className="tabular-nums">
      {b.cotacoes.length} · menor {reais(menor.valor)}
      <span className="block text-black/40">{menor.fornecedor}</span>
    </span>
  );
}

export default function BensPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const podeEditar = permissoes.editar;
  const { confirmDelete } = useDeleteConfirm();
  const regimes = useRegimesPublicados();
  const organizationId = usePrestacaoOrganizacao(id);
  const [recarga, setRecarga] = useState(0);
  const { itens } = useItensDoOrcamento(id, recarga);

  const [bens, setBens] = useState<PrestacaoBem[]>([]);
  const [despesas, setDespesas] = useState<DespesaParaBem[]>([]);
  const [prestacao, setPrestacao] = useState<DadosDaPrestacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Editando | null>(null);
  const abriuDoLink = useRef(false);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [b, d, p] = await Promise.all([
      db.from("prestacao_bens").select("*").eq("prestacao_id", id).order("ordem").order("created_at"),
      db.from("prestacao_comprovantes").select("id, nome_arquivo, no_id, valor_extraido, status").eq("prestacao_id", id).order("created_at"),
      db.from("prestacoes_contas").select("regime_id, data_inicio_execucao, data_fim_execucao").eq("id", id).maybeSingle(),
    ]);
    const falha = b.error ?? d.error ?? p.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar os bens") : "",
      bens: ((b.data ?? []) as PrestacaoBem[]).map(x => ({ ...x, valor: x.valor === null ? null : Number(x.valor), cotacoes: lerCotacoes(x.cotacoes) })),
      despesas: ((d.data ?? []) as DespesaParaBem[]).map(x => ({ ...x, valor_extraido: x.valor_extraido === null ? null : Number(x.valor_extraido) })),
      prestacao: (p.data ?? null) as DadosDaPrestacao | null,
    };
  }, [id, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setBens(dados.bens);
    setDespesas(dados.despesas);
    setPrestacao(dados.prestacao);
    setCarregando(false);
    // Links das verificações: ?bem=<id> abre o bem; ?despesa=<id> registra o bem dela.
    if (!abriuDoLink.current) {
      abriuDoLink.current = true;
      const busca = new URLSearchParams(window.location.search);
      const bem = dados.bens.find(b => b.id === busca.get("bem"));
      const despesa = dados.despesas.find(x => x.id === busca.get("despesa"));
      if (bem) setEditando({ bem });
      else if (despesa) setEditando({ bem: null, inicial: { despesa_id: despesa.id, no_id: despesa.no_id, valor: despesa.valor_extraido } });
    }
  }, []);

  const carregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const regime = regimes.find(r => r.id === prestacao?.regime_id)?.regime ?? null;
  const itensDeBem = useMemo(() => new Set(itens.filter(i => i.bemPermanente).map(i => i.id)), [itens]);
  const nomeDoItem = useMemo(() => new Map(itens.map(i => [i.id, i.nome])), [itens]);
  const pendentes = useMemo(() => despesasSemBem(despesas, itensDeBem, bens), [despesas, itensDeBem, bens]);

  // A conferência do motor em cada bem (a despesa sem bem aparece na lista acima).
  const achadosPorBem = useMemo(() => {
    const achados = checarBens({
      regime, fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
      // Só id, item, situação, nome e valor contam aqui: o valor pago vem da despesa ligada ao bem.
      despesas: despesas as unknown as EstadoDaPrestacao["despesas"],
      prestacao: { data_inicio_execucao: prestacao?.data_inicio_execucao ?? null, data_fim_execucao: prestacao?.data_fim_execucao ?? null },
      bens,
    });
    const porBem = new Map<string, Achado[]>();
    for (const a of achados) {
      if (a.entidade.tipo === "bem" && a.entidade.id) porBem.set(a.entidade.id, [...(porBem.get(a.entidade.id) ?? []), a]);
    }
    return porBem;
  }, [regime, prestacao, bens, despesas]);

  const totalDoacao = bens.filter(b => b.destinacao === "doacao").length;
  const semDestinacao = bens.filter(b => !b.destinacao).length;

  function salvou() {
    setEditando(null);
    setRecarga(r => r + 1);
    carregar();
    pedirVerificacao(id);
  }

  function excluir(b: PrestacaoBem) {
    confirmDelete({
      title: "Excluir bem?",
      description: `"${b.descricao}" sai da relação de bens, com as cotações e os documentos anexados.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_bens ainda não está no tipo Database
        const { error } = await (supabase as any).from("prestacao_bens").delete().eq("id", b.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir o bem"));
        const arquivos = [b.doacao_storage_path, b.aceite_storage_path, ...b.cotacoes.map(c => c.storage_path)].filter((p): p is string => Boolean(p));
        if (arquivos.length) await supabase.storage.from("documentos").remove(arquivos);
        await carregar();
        pedirVerificacao(id);
      },
    });
  }

  const despesaDoBem = (b: PrestacaoBem) => despesas.find(d => d.id === b.despesa_id) ?? null;
  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Bens</h2>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando({ bem: null })}
            className="flex h-9 items-center gap-1.5 rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]"
          >
            <Plus size={13} aria-hidden /> Registrar bem
          </button>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={BORDA}>{erro}</p>}

      {!carregando && (bens.length > 0 || itensDeBem.size > 0) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded border bg-white px-5 py-3 text-[0.6875rem]" style={BORDA}>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Bens</dt><dd className={`font-semibold tabular-nums ${bens.length ? "text-[#282525]" : "text-black/30"}`}>{bens.length}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Itens de bem no orçamento</dt><dd className={`font-semibold tabular-nums ${itensDeBem.size ? "text-[#282525]" : "text-black/30"}`}>{itensDeBem.size}</dd></div>
          {totalDoacao > 0 && <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Doados</dt><dd className="font-semibold tabular-nums text-[#282525]">{totalDoacao}</dd></div>}
          {semDestinacao > 0 && (
            <div className="flex items-center gap-1.5">
              <dt className={`${ROTULO} inline-flex items-center gap-1`}>
                <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                Sem destinação
              </dt>
              <dd className="font-semibold tabular-nums text-[#282525]">{semDestinacao}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Despesas de item de bem ainda sem o bem */}
      {!carregando && pendentes.length > 0 && (
        <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="pendentes-titulo">
          <div className="border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <h3 id="pendentes-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Despesas de bem sem o bem <span className="font-normal tabular-nums text-black/35">({pendentes.length})</span></h3>
            <p className="text-[0.6875rem] text-black/45">Os itens marcados como bem permanente pedem o bem registrado, com a destinação.</p>
          </div>
          <ul className="divide-y divide-black/[.05]">
            {pendentes.map(d => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.75rem] text-black/80">{d.nome_arquivo ?? "Despesa"}</p>
                  <p className="text-[0.625rem] text-black/45">
                    {nomeDoItem.get(d.no_id ?? "") ?? "Item do orçamento"}
                    {d.valor_extraido !== null && <span className="tabular-nums"> · {reais(d.valor_extraido)}</span>}
                  </p>
                </div>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => setEditando({ bem: null, inicial: { despesa_id: d.id, no_id: d.no_id, valor: d.valor_extraido } })}
                    className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                    style={{ borderColor: "rgba(13,13,13,.14)" }}
                  >
                    <Plus size={12} aria-hidden /> Registrar o bem
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="bens-titulo">
        <div className="border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id="bens-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Relação de bens <span className="font-normal tabular-nums text-black/35">({bens.length})</span></h3>
        </div>
        {carregando ? (
          <div className="space-y-2 p-5">{[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
        ) : bens.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Package size={22} className="mx-auto text-black/20" aria-hidden />
            <p className="mt-2 text-[0.75rem] text-black/55">Nenhum bem registrado.</p>
            <p className="mx-auto max-w-[30rem] text-[0.6875rem] text-black/35">
              {itensDeBem.size > 0
                ? "Registre cada bem comprado com as despesas dos itens de bem permanente, com as cotações e a destinação."
                : <>Marque na aba <Link href={`/prestacoes/${id}/orcamento`} className="underline decoration-black/20 underline-offset-2 hover:text-black/60">Orçamento</Link> os itens que são bens permanentes; as despesas deles pedem o registro aqui.</>}
            </p>
          </div>
        ) : (
          <>
            {/* Computador: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <th className={`${CABECALHO} w-full`}>Bem</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>De onde veio</th>
                    <th className={`${CABECALHO} whitespace-nowrap text-right`}>Valor</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>Cotações</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>Destinação</th>
                    {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {bens.map(b => {
                    const d = despesaDoBem(b);
                    const valor = d?.valor_extraido ?? b.valor;
                    return (
                      <tr key={b.id} className="border-b align-top transition last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="px-4 py-3">
                          <p className="text-black/80">{b.descricao}{b.quantidade > 1 && <span className="tabular-nums text-black/45"> · {b.quantidade} un.</span>}</p>
                          <p className="text-[0.625rem] text-black/40">{rotuloDoTipoBem(b.tipo)}{b.numero_patrimonio ? ` · patrimônio ${b.numero_patrimonio}` : ""}</p>
                          <Avisos achados={achadosPorBem.get(b.id) ?? []} />
                        </td>
                        <td className="min-w-[10rem] px-4 py-3 text-[0.6875rem] text-black/60">
                          {b.no_id ? nomeDoItem.get(b.no_id) ?? "Item de outra versão" : <span className="text-black/30">Sem item</span>}
                          {d && <span className="block min-w-0 break-words text-black/40">{d.nome_arquivo ?? "Despesa"}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/70">{valor !== null && valor !== undefined ? reais(Number(valor)) : <span className="text-black/30">—</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[0.6875rem] text-black/60"><Cotacoes b={b} /></td>
                        <td className="min-w-[9rem] px-4 py-3 text-[0.6875rem] text-black/65"><Destinacao b={b} /></td>
                        {podeEditar && (
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            <button type="button" onClick={() => setEditando({ bem: b })} aria-label={`Editar ${b.descricao}`} className={botaoIcone}><Pencil size={13} /></button>
                            <button type="button" onClick={() => excluir(b)} aria-label={`Excluir ${b.descricao}`} className={botaoExcluir}><Trash2 size={13} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <ul className="divide-y divide-black/[.05] md:hidden">
              {bens.map(b => {
                const d = despesaDoBem(b);
                const valor = d?.valor_extraido ?? b.valor;
                return (
                  <li key={b.id} className="space-y-2 px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[0.75rem] text-black/80">{b.descricao}</p>
                        <p className="text-[0.625rem] text-black/40">{rotuloDoTipoBem(b.tipo)}{b.numero_patrimonio ? ` · patrimônio ${b.numero_patrimonio}` : ""}</p>
                      </div>
                      {podeEditar && (
                        <div className="flex shrink-0 items-center">
                          <button type="button" onClick={() => setEditando({ bem: b })} aria-label={`Editar ${b.descricao}`} className={botaoIcone}><Pencil size={13} /></button>
                          <button type="button" onClick={() => excluir(b)} aria-label={`Excluir ${b.descricao}`} className={botaoExcluir}><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.6875rem]">
                      <dt className="text-black/40">Item</dt><dd className="text-black/70">{b.no_id ? nomeDoItem.get(b.no_id) ?? "Outra versão" : "—"}</dd>
                      <dt className="text-black/40">Valor</dt><dd className="tabular-nums text-black/70">{valor !== null && valor !== undefined ? reais(Number(valor)) : "—"}</dd>
                      <dt className="text-black/40">Cotações</dt><dd className="text-black/70"><Cotacoes b={b} /></dd>
                      <dt className="text-black/40">Destinação</dt><dd className="text-black/70"><Destinacao b={b} /></dd>
                    </dl>
                    <Avisos achados={achadosPorBem.get(b.id) ?? []} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {editando && (
        <BemModal
          prestacaoId={id}
          organizationId={organizationId}
          bem={editando.bem}
          inicial={editando.inicial}
          itens={itens.map(i => ({ id: i.id, nome: i.nome, bemPermanente: i.bemPermanente }))}
          despesas={despesas}
          onClose={() => setEditando(null)}
          onSaved={salvou}
        />
      )}
    </div>
  );
}
