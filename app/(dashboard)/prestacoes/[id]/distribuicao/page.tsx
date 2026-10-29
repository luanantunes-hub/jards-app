"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { DistribuicaoModal } from "@/components/prestacao/distribuicao/DistribuicaoModal";
import type { Achado } from "@/lib/prestacao/checagens";
import { checarDistribuicao } from "@/lib/prestacao/checagens/checar-distribuicao";
import {
  categoriaDistribuicao,
  chaveDoProduto,
  cotasDoProduto,
  formatarPercentual,
  limitesDoRegime,
  percentual,
  resumosPorProduto,
  rotuloDaCategoria,
  type LimitesDistribuicao,
  type ResumoDoProduto,
  type SituacaoDaCota,
} from "@/lib/prestacao/distribuicao";
import { formatarDocumento } from "@/lib/prestacao/fornecedores";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoDistribuicao } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";

type DadosDaPrestacao = {
  regime_id: string | null;
  valor_aprovado: number | null;
  data_inicio_execucao: string | null;
  data_fim_execucao: string | null;
};

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (n: number) => n.toLocaleString("pt-BR");

/** Uma cota do art. 41 no produto: o percentual, o limite e se está dentro. */
function Cota({ c }: { c: SituacaoDaCota }) {
  const Icone = c.dentro ? CheckCircle2 : Ban;
  return (
    <div className="rounded border bg-white px-3 py-2.5" style={BORDA}>
      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{c.rotulo}</p>
      <p className={`mt-0.5 text-[1rem] font-semibold tabular-nums ${c.percentual ? "text-[#282525]" : "text-black/30"}`}>{formatarPercentual(c.percentual)}</p>
      <p className="text-[0.625rem] text-black/40">{c.sentido === "max" ? "até" : "ao menos"} {formatarPercentual(c.limite)} · {c.dispositivo}</p>
      <p className="mt-1 flex items-center gap-1 text-[0.625rem] text-black/55">
        <Icone size={12} strokeWidth={1.75} aria-hidden className={`shrink-0 ${c.dentro ? "text-black/40" : "text-[#D94A4A]"}`} />
        {c.dentro ? "Dentro" : c.sentido === "max" ? "Acima do máximo" : "Abaixo do mínimo"}
      </p>
    </div>
  );
}

/** Achados de uma linha ou de um produto, com a justificativa quando já há. */
function Avisos({ achados }: { achados: readonly Achado[] }) {
  if (achados.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {achados.map(a => {
        const bloqueio = a.severidade === "bloqueio";
        const Icone = bloqueio ? Ban : AlertTriangle;
        return (
          <li key={a.chave} className={`flex items-start gap-1 text-[0.6875rem] ${a.justificativa ? "text-black/45" : "text-black/60"}`}>
            <Icone size={12} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${a.justificativa ? "text-black/40" : bloqueio ? "text-[#D94A4A]" : "text-[#B07A14]"}`} aria-hidden />
            <span>{a.mensagem}{a.justificativa ? ` Justificativa: ${a.justificativa}` : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Preco({ l }: { l: PrestacaoDistribuicao }) {
  if (!categoriaDistribuicao(l.categoria)?.venda) return <span className="text-black/35">Gratuito</span>;
  return <span className="tabular-nums">{l.preco ? reais(Number(l.preco)) : "—"}</span>;
}

function QuemRecebeu({ l }: { l: PrestacaoDistribuicao }) {
  if (!l.beneficiario && !l.beneficiario_documento) return <span className="text-black/30">—</span>;
  return (
    <span>
      {l.beneficiario}
      {l.beneficiario_documento && <span className="block whitespace-nowrap tabular-nums text-black/40">{formatarDocumento(l.beneficiario_documento)}</span>}
    </span>
  );
}

function Produto({ resumo, limites, achadosDoProduto, achadosDaLinha, podeEditar, onEditar, onExcluir }: {
  resumo: ResumoDoProduto<PrestacaoDistribuicao>;
  limites: LimitesDistribuicao | null;
  achadosDoProduto: readonly Achado[];
  achadosDaLinha: ReadonlyMap<string, Achado[]>;
  podeEditar: boolean;
  onEditar: (l: PrestacaoDistribuicao) => void;
  onExcluir: (l: PrestacaoDistribuicao) => void;
}) {
  const cotas = limites ? cotasDoProduto(resumo, limites) : [];
  // As cotas já aparecem nos blocos; aqui ficam os outros avisos do produto.
  const outros = achadosDoProduto.filter(a => a.codigo !== "DISTRIBUICAO_COTA");
  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";
  const titulo = `produto-${resumo.chave}`;

  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby={titulo}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <h3 id={titulo} className="text-[0.75rem] font-semibold text-[#282525]">{resumo.produto}</h3>
        <p className="text-[0.6875rem] tabular-nums text-black/45">
          {inteiro(resumo.total)} {resumo.base === "realizado" ? "distribuídos e vendidos" : "no plano"}
          {resumo.receita > 0 && <> · receita prevista {reais(resumo.receita)}</>}
        </p>
      </div>

      {(cotas.length > 0 || resumo.vendidos > 0) && (
        <div className="space-y-3 border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {cotas.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {cotas.map(c => <Cota key={c.cota} c={c} />)}
            </div>
          )}
          {resumo.vendidos > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.6875rem]">
              <div className="flex items-baseline gap-1.5">
                <dt className={ROTULO}>Meia-entrada</dt>
                <dd className="font-semibold tabular-nums text-[#282525]">
                  {inteiro(resumo.meias)} de {inteiro(resumo.vendidos)} vendidos · {formatarPercentual(percentual(resumo.meias, resumo.vendidos))}
                  {limites?.meiaMin != null && <span className="font-normal text-black/40"> (ao menos {formatarPercentual(limites.meiaMin)})</span>}
                </dd>
              </div>
              {resumo.precoMedio !== null && (
                <div className="flex items-baseline gap-1.5">
                  <dt className={ROTULO}>Preço médio da venda livre</dt>
                  <dd className="font-semibold tabular-nums text-[#282525]">
                    {reais(resumo.precoMedio)}
                    {limites?.precoMedioMax != null && <span className="font-normal text-black/40"> (até {reais(limites.precoMedioMax)})</span>}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <Avisos achados={outros} />
        </div>
      )}

      {/* Computador: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[0.75rem]">
          <thead>
            <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <th className={`${CABECALHO} w-full`}>Categoria</th>
              <th className={`${CABECALHO} whitespace-nowrap text-right`}>Previsto</th>
              <th className={`${CABECALHO} whitespace-nowrap text-right`}>Realizado</th>
              <th className={`${CABECALHO} whitespace-nowrap text-right`}>Meias</th>
              <th className={`${CABECALHO} whitespace-nowrap text-right`}>Preço</th>
              <th className={`${CABECALHO} whitespace-nowrap`}>Quem recebeu</th>
              {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map(l => (
              <tr key={l.id} className="border-b align-top transition last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                <td className="px-4 py-3">
                  <p className="text-black/80">{rotuloDaCategoria(l.categoria)}</p>
                  <p className="text-[0.625rem] text-black/40">{categoriaDistribuicao(l.categoria)?.descricao}</p>
                  {l.observacoes && <p className="mt-0.5 text-[0.625rem] text-black/45">{l.observacoes}</p>}
                  <Avisos achados={achadosDaLinha.get(l.id) ?? []} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/75">{inteiro(l.quantidade)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/75">{l.quantidade_realizada === null ? <span className="text-black/30">—</span> : inteiro(l.quantidade_realizada)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/60">{categoriaDistribuicao(l.categoria)?.venda ? inteiro(l.quantidade_meia) : <span className="text-black/30">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-black/60"><Preco l={l} /></td>
                <td className="min-w-[11rem] px-4 py-3 text-[0.6875rem] text-black/60"><QuemRecebeu l={l} /></td>
                {podeEditar && (
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <button type="button" onClick={() => onEditar(l)} aria-label={`Editar ${rotuloDaCategoria(l.categoria)} de ${resumo.produto}`} className={botaoIcone}><Pencil size={13} /></button>
                    <button type="button" onClick={() => onExcluir(l)} aria-label={`Excluir ${rotuloDaCategoria(l.categoria)} de ${resumo.produto}`} className={botaoExcluir}><Trash2 size={13} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: cartões */}
      <ul className="divide-y divide-black/[.05] md:hidden">
        {resumo.linhas.map(l => (
          <li key={l.id} className="space-y-2 px-5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[0.75rem] text-black/80">{rotuloDaCategoria(l.categoria)}</p>
                <p className="text-[0.625rem] text-black/40">{categoriaDistribuicao(l.categoria)?.descricao}</p>
              </div>
              {podeEditar && (
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => onEditar(l)} aria-label={`Editar ${rotuloDaCategoria(l.categoria)} de ${resumo.produto}`} className={botaoIcone}><Pencil size={13} /></button>
                  <button type="button" onClick={() => onExcluir(l)} aria-label={`Excluir ${rotuloDaCategoria(l.categoria)} de ${resumo.produto}`} className={botaoExcluir}><Trash2 size={13} /></button>
                </div>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.6875rem]">
              <dt className="text-black/40">Previsto</dt><dd className="tabular-nums text-black/70">{inteiro(l.quantidade)}</dd>
              <dt className="text-black/40">Realizado</dt><dd className="tabular-nums text-black/70">{l.quantidade_realizada === null ? "—" : inteiro(l.quantidade_realizada)}</dd>
              {categoriaDistribuicao(l.categoria)?.venda && <><dt className="text-black/40">Meias</dt><dd className="tabular-nums text-black/70">{inteiro(l.quantidade_meia)}</dd></>}
              <dt className="text-black/40">Preço</dt><dd className="text-black/70"><Preco l={l} /></dd>
              {(l.beneficiario || l.beneficiario_documento) && <><dt className="text-black/40">Quem recebeu</dt><dd className="text-black/70"><QuemRecebeu l={l} /></dd></>}
            </dl>
            <Avisos achados={achadosDaLinha.get(l.id) ?? []} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DistribuicaoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const podeEditar = permissoes.editar;
  const { confirmDelete } = useDeleteConfirm();
  const regimes = useRegimesPublicados();

  const [linhas, setLinhas] = useState<PrestacaoDistribuicao[]>([]);
  const [prestacao, setPrestacao] = useState<DadosDaPrestacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<PrestacaoDistribuicao | "nova" | null>(null);
  const abriuDoLink = useRef(false);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [d, p] = await Promise.all([
      db.from("prestacao_distribuicao").select("*").eq("prestacao_id", id).order("ordem").order("created_at"),
      db.from("prestacoes_contas").select("regime_id, valor_aprovado, data_inicio_execucao, data_fim_execucao").eq("id", id).maybeSingle(),
    ]);
    const falha = d.error ?? p.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar a distribuição") : "",
      linhas: ((d.data ?? []) as PrestacaoDistribuicao[]).map(l => ({ ...l, preco: l.preco === null ? null : Number(l.preco) })),
      prestacao: (p.data ?? null) as DadosDaPrestacao | null,
    };
  }, [id, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setLinhas(dados.linhas);
    setPrestacao(dados.prestacao);
    setCarregando(false);
    // Link das verificações: ?linha=<id> abre a linha, só na primeira leitura.
    if (!abriuDoLink.current) {
      abriuDoLink.current = true;
      const linha = dados.linhas.find(l => l.id === new URLSearchParams(window.location.search).get("linha"));
      if (linha) setEditando(linha);
    }
  }, []);

  const carregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const regime = regimes.find(r => r.id === prestacao?.regime_id)?.regime ?? null;
  const limites = useMemo(() => limitesDoRegime(regime), [regime]);
  const resumos = useMemo(() => resumosPorProduto(linhas, limites), [linhas, limites]);

  // A conferência do motor, para mostrar em cada produto e em cada linha.
  const achados = useMemo(() => checarDistribuicao({
    regime, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
    prestacao: { data_inicio_execucao: prestacao?.data_inicio_execucao ?? null, data_fim_execucao: prestacao?.data_fim_execucao ?? null },
    distribuicao: linhas,
    valorAprovado: prestacao?.valor_aprovado === null || prestacao?.valor_aprovado === undefined ? null : Number(prestacao.valor_aprovado),
  }), [regime, prestacao, linhas]);
  const { porProduto, porLinha, receita } = useMemo(() => {
    const porProduto = new Map<string, Achado[]>();
    const porLinha = new Map<string, Achado[]>();
    for (const a of achados) {
      if (a.entidade.tipo === "distribuicao" && a.entidade.id) porLinha.set(a.entidade.id, [...(porLinha.get(a.entidade.id) ?? []), a]);
      else if (typeof a.dados.produto === "string") {
        const chave = chaveDoProduto(a.dados.produto);
        porProduto.set(chave, [...(porProduto.get(chave) ?? []), a]);
      }
    }
    return { porProduto, porLinha, receita: achados.filter(a => a.codigo === "DISTRIBUICAO_RECEITA") };
  }, [achados]);

  const produtos = useMemo(() => resumos.map(r => r.produto), [resumos]);
  const receitaTotal = resumos.reduce((s, r) => s + r.receita, 0);
  const foraDasCotas = resumos.reduce((n, r) => n + (limites ? cotasDoProduto(r, limites).filter(c => !c.dentro).length : 0), 0);

  function salvou() {
    setEditando(null);
    carregar();
    pedirVerificacao(id);
  }

  function excluir(l: PrestacaoDistribuicao) {
    confirmDelete({
      title: "Excluir linha do plano?",
      description: `${rotuloDaCategoria(l.categoria)} de "${l.produto}" sai do plano de distribuição.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_distribuicao ainda não está no tipo Database
        const { error } = await (supabase as any).from("prestacao_distribuicao").delete().eq("id", l.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a linha"));
        await carregar();
        pedirVerificacao(id);
      },
    });
  }

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Distribuição</h2>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando("nova")}
            className="flex h-9 items-center gap-1.5 rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]"
          >
            <Plus size={13} aria-hidden /> Adicionar ao plano
          </button>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={BORDA}>{erro}</p>}

      {!carregando && linhas.length > 0 && (
        <div className="rounded border bg-white px-5 py-3" style={BORDA}>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.6875rem]">
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Produtos</dt><dd className={`font-semibold tabular-nums ${resumos.length ? "text-[#282525]" : "text-black/30"}`}>{resumos.length}</dd></div>
            {receitaTotal > 0 && <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Receita prevista</dt><dd className="font-semibold tabular-nums text-[#282525]">{reais(receitaTotal)}</dd></div>}
            {limites && (
              <div className="flex items-center gap-1.5">
                <dt className={`${ROTULO} inline-flex items-center gap-1`}>
                  {foraDasCotas > 0 && <Ban size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#D94A4A]" />}
                  Cotas fora do limite
                </dt>
                <dd className={`font-semibold tabular-nums ${foraDasCotas ? "text-[#282525]" : "text-black/30"}`}>{foraDasCotas}</dd>
              </div>
            )}
          </dl>
          <Avisos achados={receita} />
          {!limites && (
            <p className="mt-1 text-[0.6875rem] text-black/45">
              {regime ? "O regime desta prestação não define cotas de distribuição; o plano é conferido contra o realizado." : "Sem regime definido, as cotas não são conferidas."}
            </p>
          )}
        </div>
      )}

      {carregando ? (
        <div className="space-y-2 rounded border bg-white p-5" style={BORDA}>{[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : linhas.length === 0 ? (
        <div className="rounded border bg-white px-5 py-12 text-center" style={BORDA}>
          <Ticket size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mt-2 text-[0.75rem] text-black/55">Nenhum plano de distribuição.</p>
          <p className="mx-auto max-w-[28rem] text-[0.6875rem] text-black/35">
            {podeEditar
              ? "Cadastre a distribuição dos ingressos ou produtos: cotas gratuitas, preço popular e venda."
              : "Nenhum plano de distribuição cadastrado."}
          </p>
        </div>
      ) : (
        resumos.map(r => (
          <Produto
            key={r.chave}
            resumo={r}
            limites={limites}
            achadosDoProduto={porProduto.get(r.chave) ?? []}
            achadosDaLinha={porLinha}
            podeEditar={podeEditar}
            onEditar={setEditando}
            onExcluir={excluir}
          />
        ))
      )}

      {editando && (
        <DistribuicaoModal
          prestacaoId={id}
          linha={editando === "nova" ? null : editando}
          produtos={produtos}
          limites={limites}
          onClose={() => setEditando(null)}
          onSaved={salvou}
        />
      )}
    </div>
  );
}
