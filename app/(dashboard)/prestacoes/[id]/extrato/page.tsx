"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CloudDownload, Landmark, Pencil, Plus, Search, Trash2, Undo2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { ContaBancariaModal, rotuloDaConta } from "@/components/prestacao/extrato/ContaBancariaModal";
import { ImportarExtrato } from "@/components/prestacao/extrato/ImportarExtrato";
import { ImportarDoTransferegov } from "@/components/prestacao/extrato/ImportarDoTransferegov";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { processoDoNup } from "@/lib/prestacao/transferegov";
import { CATEGORIAS_LANCAMENTO } from "@/lib/prestacao/extrato";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoContaBancaria, PrestacaoExtratoImportacao, PrestacaoLancamento } from "@/lib/supabase/types";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
const rotuloCategoria = (id: string) => CATEGORIAS_LANCAMENTO.find(c => c.id === id)?.rotulo ?? id;
const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const LINHA = { borderColor: "rgba(13,13,13,.05)" };

type Natureza = "todos" | "credito" | "debito";

export default function ExtratoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const organizationId = usePrestacaoOrganizacao(id);
  const permissoes = usePermissoesPrestacao(id);
  const { confirmDelete } = useDeleteConfirm();

  const [contas, setContas] = useState<PrestacaoContaBancaria[]>([]);
  const [importacoes, setImportacoes] = useState<PrestacaoExtratoImportacao[]>([]);
  const [lancamentos, setLancamentos] = useState<PrestacaoLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [editandoConta, setEditandoConta] = useState<PrestacaoContaBancaria | "nova" | null>(null);
  const [importando, setImportando] = useState(false);
  const [importandoTransferegov, setImportandoTransferegov] = useState(false);
  // P9.4: nas prestações do Transferegov (Pronon e Pronas/PCD), o extrato também vem da API pública, pelo NUP.
  const regimes = useRegimesPublicados();
  const [dadosOficiais, setDadosOficiais] = useState<{ regime_id: string | null; identificador_oficial: string | null } | null>(null);
  const [filtroConta, setFiltroConta] = useState("todas");
  const [filtroNatureza, setFiltroNatureza] = useState<Natureza>("todos");
  const [busca, setBusca] = useState("");

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do extrato ainda não estão no tipo Database
    const db = supabase as any;
    const [c, imp, l, p] = await Promise.all([
      db.from("prestacao_contas_bancarias").select("*").eq("prestacao_id", id).order("created_at"),
      db.from("prestacao_extrato_importacoes").select("*").eq("prestacao_id", id).order("created_at", { ascending: false }),
      db.from("prestacao_lancamentos").select("*").eq("prestacao_id", id).order("data", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
      db.from("prestacoes_contas").select("regime_id, identificador_oficial").eq("id", id).maybeSingle(),
    ]);
    const falha = c.error ?? imp.error ?? l.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar o extrato") : "",
      contas: (c.data ?? []) as PrestacaoContaBancaria[],
      importacoes: (imp.data ?? []) as PrestacaoExtratoImportacao[],
      // Valor sempre como número para as somas da tela.
      lancamentos: ((l.data ?? []) as PrestacaoLancamento[]).map(x => ({ ...x, valor: Number(x.valor) })),
      prestacao: (p.data ?? null) as { regime_id: string | null; identificador_oficial: string | null } | null,
    };
  }, [id, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setContas(dados.contas);
    setImportacoes(dados.importacoes);
    setLancamentos(dados.lancamentos);
    setDadosOficiais(dados.prestacao);
    setCarregando(false);
  }, []);

  const carregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const doTransferegov = Boolean(dadosOficiais && regimes.find(r => r.id === dadosOficiais.regime_id)?.regime?.sistemaOficial?.includes("Transferegov"));
  const nupValido = Boolean(processoDoNup(dadosOficiais?.identificador_oficial));

  const contaPorId = useMemo(() => new Map(contas.map(c => [c.id, c])), [contas]);
  const lancamentosPorConta = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const l of lancamentos) contagem.set(l.conta_id, (contagem.get(l.conta_id) ?? 0) + 1);
    return contagem;
  }, [lancamentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter(l =>
      (filtroConta === "todas" || l.conta_id === filtroConta)
      && (filtroNatureza === "todos" || l.natureza === filtroNatureza)
      && (!termo || l.historico.toLowerCase().includes(termo) || (l.numero_documento ?? "").toLowerCase().includes(termo)));
  }, [lancamentos, filtroConta, filtroNatureza, busca]);

  const totais = useMemo(() => filtrados.reduce(
    (soma, l) => (l.natureza === "credito" ? { ...soma, creditos: soma.creditos + l.valor } : { ...soma, debitos: soma.debitos + l.valor }),
    { creditos: 0, debitos: 0 },
  ), [filtrados]);

  function excluirConta(conta: PrestacaoContaBancaria) {
    const quantos = lancamentosPorConta.get(conta.id) ?? 0;
    confirmDelete({
      title: "Excluir conta?",
      description: quantos
        ? `"${rotuloDaConta(conta)}" e os ${quantos} lançamentos importados nela saem do extrato.`
        : `"${rotuloDaConta(conta)}" sai da prestação.`,
      onConfirm: async () => {
        const caminhos = importacoes.filter(i => i.conta_id === conta.id && i.storage_path).map(i => i.storage_path as string);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do extrato ainda não estão no tipo Database
        const { error } = await (supabase as any).from("prestacao_contas_bancarias").delete().eq("id", conta.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a conta"));
        if (caminhos.length) await supabase.storage.from("documentos").remove(caminhos);
        await carregar();
        pedirVerificacao(id);
      },
    });
  }

  function desfazerImportacao(importacao: PrestacaoExtratoImportacao) {
    confirmDelete({
      title: "Desfazer importação?",
      description: `Os ${importacao.lancamentos_novos} lançamentos de "${importacao.nome_arquivo ?? "arquivo"}" saem do extrato e o arquivo é apagado.`,
      confirmLabel: "Desfazer",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do extrato ainda não estão no tipo Database
        const { error } = await (supabase as any).from("prestacao_extrato_importacoes").delete().eq("id", importacao.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível desfazer a importação"));
        if (importacao.storage_path) await supabase.storage.from("documentos").remove([importacao.storage_path]);
        await carregar();
        pedirVerificacao(id);
      },
    });
  }

  const podeEditar = permissoes.editar;

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Extrato bancário</h2>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditandoConta("nova")}
              className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              style={{ borderColor: "rgba(13,13,13,.14)" }}
            >
              <Plus size={13} aria-hidden /> Nova conta
            </button>
            {doTransferegov && (
              <button
                type="button"
                onClick={() => { setAviso(""); setImportandoTransferegov(true); }}
                disabled={!nupValido}
                title={nupValido ? "Importar as linhas do extrato pela API pública do Transferegov" : "Informe o NUP nos dados oficiais da prestação"}
                className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: "rgba(13,13,13,.14)" }}
              >
                <CloudDownload size={13} aria-hidden /> Importar do Transferegov
              </button>
            )}
            <button
              type="button"
              onClick={() => { setAviso(""); setImportando(true); }}
              disabled={contas.length === 0}
              title={contas.length === 0 ? "Cadastre a conta antes de importar" : undefined}
              className="flex h-9 items-center gap-1.5 rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload size={13} aria-hidden /> Importar extrato
            </button>
          </div>
        )}
      </div>

      {aviso && <p role="status" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={BORDA}>{aviso}</p>}
      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={BORDA}>{erro}</p>}

      {/* Contas */}
      <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="contas-titulo">
        <div className="border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id="contas-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Contas</h3>
        </div>
        {carregando ? (
          <div className="space-y-2 p-5">{[0, 1].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
        ) : contas.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Landmark size={20} className="mx-auto text-black/20" aria-hidden />
            <p className="mt-2 text-[0.75rem] text-black/55">Nenhuma conta cadastrada.</p>
            <p className="text-[0.6875rem] text-black/35">{podeEditar ? "Cadastre a conta do projeto para importar o extrato." : "Nenhuma conta cadastrada."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[.05]">
            {contas.map(conta => (
              <li key={conta.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.75rem] font-medium text-black/80">{rotuloDaConta(conta)}</p>
                  <p className="text-[0.625rem] text-black/40">
                    {[conta.banco, conta.agencia && `ag. ${conta.agencia}`, conta.conta && `c/c ${conta.conta}`].filter(Boolean).join(" · ") || "Sem dados bancários"}
                    {" · "}<span className="tabular-nums">{lancamentosPorConta.get(conta.id) ?? 0}</span> lançamentos
                  </p>
                </div>
                {podeEditar && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setEditandoConta(conta)} aria-label={`Editar ${rotuloDaConta(conta)}`} className="rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => excluirConta(conta)} aria-label={`Excluir ${rotuloDaConta(conta)}`} className="rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Lançamentos */}
      <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="lancamentos-titulo">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id="lancamentos-titulo" className="mr-auto text-[0.75rem] font-semibold text-[#282525]">
            Lançamentos <span className="font-normal tabular-nums text-black/35">({filtrados.length})</span>
          </h3>
          {contas.length > 1 && (
            <Select block={false} aria-label="Filtrar por conta" value={filtroConta} onChange={e => setFiltroConta(e.target.value)} className="h-9 max-w-[14rem] truncate pl-3 text-black/65">
              <option value="todas">Todas as contas</option>
              {contas.map(c => <option key={c.id} value={c.id}>{rotuloDaConta(c)}</option>)}
            </Select>
          )}
          <div role="group" aria-label="Filtrar por sentido" className="flex shrink-0 gap-1">
            {([["todos", "Todos"], ["credito", "Créditos"], ["debito", "Débitos"]] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtroNatureza === valor}
                onClick={() => setFiltroNatureza(valor)}
                className={`h-9 rounded border px-3 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${filtroNatureza === valor ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.08] text-black/45 hover:bg-black/[.03]"}`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <label className="relative block w-full sm:w-[17.5rem]">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/25" aria-hidden />
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar no histórico ou no documento" placeholder="Buscar no histórico ou documento" className="h-9 w-full rounded border border-black/10 bg-white pl-9 pr-3 text-[0.75rem] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/10" />
          </label>
        </div>

        {filtrados.length > 0 && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b px-5 py-2.5 text-[0.6875rem]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Créditos</dt><dd className={`font-semibold tabular-nums ${totais.creditos ? "text-[#282525]" : "text-black/30"}`}>{fmt(totais.creditos)}</dd></div>
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Débitos</dt><dd className={`font-semibold tabular-nums ${totais.debitos ? "text-[#282525]" : "text-black/30"}`}>{fmt(totais.debitos)}</dd></div>
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Diferença</dt><dd className={`font-semibold tabular-nums ${totais.creditos - totais.debitos ? "text-[#282525]" : "text-black/30"}`}>{fmt(totais.creditos - totais.debitos)}</dd></div>
          </dl>
        )}

        {carregando ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
        ) : filtrados.length === 0 ? (
          <p className="px-5 py-10 text-center text-[0.75rem] text-black/40">
            {lancamentos.length === 0
              ? contas.length === 0 ? "Cadastre a conta e importe o extrato para ver os lançamentos." : "Importe o extrato da conta para ver os lançamentos."
              : "Nenhum lançamento com esses filtros."}
          </p>
        ) : (
          <>
            <table className="hidden w-full text-[0.75rem] md:table">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  {["Data", "Histórico", "Categoria", ...(contas.length > 1 ? ["Conta"] : []), "Crédito", "Débito"].map(titulo => (
                    <th key={titulo} scope="col" className={`px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35 ${titulo === "Crédito" || titulo === "Débito" ? "text-right" : "text-left"}`}>{titulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-black/[.015]" style={LINHA}>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-black/55">{dataCurta(l.data)}</td>
                    <td className="max-w-[28rem] px-4 py-2">
                      <p className="truncate text-black/80" title={l.historico}>{l.historico || "—"}</p>
                      {l.numero_documento && <p className="truncate text-[0.625rem] text-black/35">Doc. {l.numero_documento}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-black/50">{rotuloCategoria(l.categoria)}</td>
                    {contas.length > 1 && <td className="max-w-[12rem] truncate px-4 py-2 text-black/45">{contaPorId.get(l.conta_id) ? rotuloDaConta(contaPorId.get(l.conta_id)!) : "—"}</td>}
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-black/75">{l.natureza === "credito" ? fmt(l.valor) : ""}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-black/75">{l.natureza === "debito" ? fmt(l.valor) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-black/[.05] md:hidden">
              {filtrados.map(l => (
                <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.75rem] text-black/80">{l.historico || "—"}</p>
                    <p className="text-[0.625rem] text-black/40"><span className="tabular-nums">{dataCurta(l.data)}</span> · {rotuloCategoria(l.categoria)}</p>
                  </div>
                  <p className="shrink-0 text-[0.75rem] tabular-nums text-black/75">
                    {l.natureza === "credito" ? "+" : "−"} {fmt(l.valor)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Importações */}
      {importacoes.length > 0 && (
        <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="importacoes-titulo">
          <div className="border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <h3 id="importacoes-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Arquivos importados</h3>
          </div>
          <ul className="divide-y divide-black/[.05]">
            {importacoes.map(imp => (
              <li key={imp.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.75rem] text-black/80" title={imp.nome_arquivo ?? undefined}>
                    {imp.nome_arquivo ?? "Arquivo"} <span className="text-black/35">· {imp.formato.toUpperCase()}</span>
                  </p>
                  <p className="text-[0.625rem] text-black/40">
                    {contaPorId.get(imp.conta_id) ? rotuloDaConta(contaPorId.get(imp.conta_id)!) : "Conta"}
                    {imp.periodo_inicio && imp.periodo_fim && <> · <span className="tabular-nums">{dataCurta(imp.periodo_inicio)} a {dataCurta(imp.periodo_fim)}</span></>}
                    {" · "}<span className="tabular-nums">{imp.lancamentos_novos}</span> novos
                    {imp.lancamentos_repetidos > 0 && <>, <span className="tabular-nums">{imp.lancamentos_repetidos}</span> já estavam</>}
                  </p>
                </div>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => desfazerImportacao(imp)}
                    className="flex h-8 items-center gap-1.5 rounded px-2 text-[0.6875rem] text-black/45 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]"
                  >
                    <Undo2 size={12} aria-hidden /> Desfazer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editandoConta && (
        <ContaBancariaModal
          prestacaoId={id}
          conta={editandoConta === "nova" ? null : editandoConta}
          onClose={() => setEditandoConta(null)}
          onSaved={() => { setEditandoConta(null); void carregar(); }}
        />
      )}
      {importandoTransferegov && (
        <ImportarDoTransferegov
          prestacaoId={id}
          contas={contas}
          lancamentos={lancamentos}
          onClose={() => setImportandoTransferegov(false)}
          onImported={mensagem => { setImportandoTransferegov(false); setAviso(mensagem); void carregar(); pedirVerificacao(id); }}
        />
      )}
      {importando && (
        <ImportarExtrato
          prestacaoId={id}
          organizationId={organizationId}
          contas={contas}
          contaInicial={filtroConta === "todas" ? "" : filtroConta}
          onClose={() => setImportando(false)}
          onImported={mensagem => { setImportando(false); setAviso(mensagem); void carregar(); pedirVerificacao(id); }}
        />
      )}
    </div>
  );
}
