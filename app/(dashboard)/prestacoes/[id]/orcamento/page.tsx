"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronsDownUp, ChevronsUpDown, CopyPlus, FolderPlus, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import {
  linhasVisiveis,
  montarArvore,
  percentualPago,
  rotuloTipoNo,
  basesDoOrcamento,
  tetosPorGrupo,
  type ComprovanteDoOrcamento,
  type LinhaOrcamento,
  type NoOrcamento,
  type TipoNo,
  type VersaoOrcamento,
} from "@/lib/prestacao/orcamento";
import { AlteracoesOrcamento, type PrestacaoDaAlteracao } from "@/components/prestacao/orcamento/AlteracoesOrcamento";
import { ArvoreOrcamento } from "@/components/prestacao/orcamento/ArvoreOrcamento";
import { EditorNoOrcamento, type NoEmEdicao } from "@/components/prestacao/orcamento/EditorNoOrcamento";
import { ImportarOrcamento } from "@/components/prestacao/orcamento/ImportarOrcamento";
import { TetosDoRegime } from "@/components/prestacao/orcamento/TetosDoRegime";
import { nomeDaVersao, VersaoOrcamentoModal } from "@/components/prestacao/orcamento/VersaoOrcamentoModal";

type NoComOrigem = NoOrcamento & { origem_no_id?: string | null };

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");

const CARTAO = "rounded border bg-white";
const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const SECUNDARIO = "flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-50";

export default function OrcamentoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const organizationId = usePrestacaoOrganizacao(id);
  const permissoes = usePermissoesPrestacao(id);
  const regimes = useRegimesPublicados();
  const { confirmDelete } = useDeleteConfirm();

  const [recarga, setRecarga] = useState(0);
  const [base, setBase] = useState<{
    prestacaoId: string;
    regimeId: string | null;
    prestacao: PrestacaoDaAlteracao | null;
    versoes: VersaoOrcamento[];
    comprovantes: ComprovanteDoOrcamento[];
  } | null>(null);
  const [nosCarregados, setNosCarregados] = useState<{ versaoId: string; nos: NoComOrigem[] } | null>(null);
  const [versaoEscolhida, setVersaoEscolhida] = useState<string | null>(null);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [edicao, setEdicao] = useState<{ versaoId: string; edicao: NoEmEdicao } | null>(null);
  const [versaoModal, setVersaoModal] = useState<"nova" | "editar" | null>(null);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const recarregar = () => setRecarga(n => n + 1);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    Promise.all([
      db.from("prestacoes_contas").select("regime_id, titulo, identificador_oficial, data_liberacao, data_fim_execucao").eq("id", id).maybeSingle(),
      db.from("prestacao_orcamento_versoes").select("*").eq("prestacao_id", id).order("created_at"),
      db.from("prestacao_comprovantes").select("no_id, status, valor_extraido").eq("prestacao_id", id),
    ]).then(([prestacao, versoes, comprovantes]) => {
      if (!ativo) return;
      setBase({
        prestacaoId: id,
        regimeId: prestacao.data?.regime_id ?? null,
        prestacao: prestacao.data ?? null,
        versoes: (versoes.data as VersaoOrcamento[]) ?? [],
        comprovantes: (comprovantes.data as ComprovanteDoOrcamento[]) ?? [],
      });
      if (versoes.error) setErro(mensagemErroPrestacao(versoes.error, "Não foi possível carregar o orçamento"));
    });
    return () => { ativo = false; };
  }, [id, supabase, recarga]);

  const versoes = useMemo(() => (base?.prestacaoId === id ? base.versoes : []), [base, id]);
  const versao = versoes.find(v => v.id === versaoEscolhida) ?? versoes.find(v => v.ativa) ?? versoes[0] ?? null;
  const versaoId = versao?.id ?? null;
  const versaoAtiva = versoes.find(v => v.ativa) ?? null;

  useEffect(() => {
    if (!versaoId) return;
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
    (supabase as any)
      .from("prestacao_orcamento_nos")
      .select("*")
      .eq("versao_id", versaoId)
      .then(({ data }: { data: NoComOrigem[] | null }) => {
        if (ativo) setNosCarregados({ versaoId, nos: data ?? [] });
      });
    return () => { ativo = false; };
  }, [supabase, versaoId, recarga]);

  const nos = useMemo(() => (versaoId && nosCarregados?.versaoId === versaoId ? nosCarregados.nos : []), [nosCarregados, versaoId]);
  const carregando = !base || base.prestacaoId !== id || (versaoId !== null && nosCarregados?.versaoId !== versaoId);

  // Numa versão que não está em uso, os comprovantes aparecem no item copiado do que está em uso.
  const comprovantes = useMemo(() => {
    const todos = base?.prestacaoId === id ? base.comprovantes : [];
    if (!versao || versao.ativa) return todos;
    const correspondente = new Map(nos.filter(no => no.origem_no_id).map(no => [no.origem_no_id as string, no.id]));
    return todos.map(c => (c.no_id && correspondente.has(c.no_id) ? { ...c, no_id: correspondente.get(c.no_id)! } : c));
  }, [base, id, nos, versao]);

  const arvore = useMemo(() => montarArvore(nos, comprovantes), [nos, comprovantes]);
  const linhas = linhasVisiveis(arvore.raizes, fechados);
  const regime = regimes.find(r => r.id === base?.regimeId)?.regime ?? null;
  const tetos = useMemo(() => tetosPorGrupo(arvore.raizes, regime), [arvore, regime]);
  const bases = useMemo(() => basesDoOrcamento(arvore.raizes, regime), [arvore, regime]);
  const agrupadores = nos.filter(no => no.tipo !== "item").map(no => no.id);
  const percentual = percentualPago(arvore.total);
  const podeEditar = permissoes.editar;

  async function garantirVersao(): Promise<string | null> {
    if (versaoId) return versaoId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
    const { data, error } = await (supabase as any)
      .from("prestacao_orcamento_versoes")
      .insert({ prestacao_id: id, tipo: "aprovada" })
      .select("id")
      .single();
    if (error || !data) { setErro(mensagemErroPrestacao(error, "Não foi possível criar o orçamento")); return null; }
    setVersaoEscolhida(data.id);
    recarregar();
    return data.id as string;
  }

  async function abrirNovo(parentId: string | null, tipo: TipoNo) {
    setErro("");
    const alvo = await garantirVersao();
    if (alvo) setEdicao({ versaoId: alvo, edicao: { modo: "novo", parentId, tipo } });
  }

  function excluir(linha: LinhaOrcamento) {
    const { no } = linha;
    const agrupador = no.tipo !== "item";
    confirmDelete({
      title: agrupador ? `Excluir ${rotuloTipoNo(no.tipo).toLowerCase()} “${no.nome}”?` : `Excluir “${no.nome}”?`,
      description: agrupador
        ? `Tudo o que está dentro (${linha.totais.itens} ${linha.totais.itens === 1 ? "item" : "itens"}, ${fmt(linha.totais.vigente)}) sai desta versão. Comprovantes ligados a esses itens ficam sem item.`
        : "O item sai desta versão. Comprovantes ligados a ele ficam sem item.",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
        const { error } = await (supabase as any).from("prestacao_orcamento_nos").delete().eq("id", no.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir"));
        recarregar();
      },
    });
  }

  function excluirVersao() {
    if (!versao || versao.ativa) return;
    confirmDelete({
      title: `Excluir a versão ${nomeDaVersao(versao)}?`,
      description: `Os ${arvore.total.itens} itens desta versão saem junto. A versão em uso não muda.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
        const { error } = await (supabase as any).from("prestacao_orcamento_versoes").delete().eq("id", versao.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a versão"));
        setVersaoEscolhida(null);
        recarregar();
      },
    });
  }

  async function tornarAtiva() {
    if (!versao) return;
    setAtivando(true);
    setErro("");
    const { error } = await supabase.rpc("fn_prestacao_orcamento_ativar_versao" as never, { p_versao_id: versao.id } as never);
    setAtivando(false);
    if (error) {
      setErro(error.message?.includes("sem_permissao")
        ? "Tornar uma versão a que está em uso cabe ao administrador ou ao responsável pela prestação."
        : mensagemErroPrestacao(error, "Não foi possível trocar a versão em uso"));
      return;
    }
    setAviso(`${nomeDaVersao(versao)} passou a ser o orçamento em uso. Os comprovantes foram para os itens correspondentes.`);
    recarregar();
  }

  function alternar(noId: string) {
    setFechados(atual => {
      const proximo = new Set(atual);
      if (proximo.has(noId)) proximo.delete(noId); else proximo.add(noId);
      return proximo;
    });
  }

  const ordemNova = nos.reduce((maior, no) => Math.max(maior, no.ordem), -1) + 1;
  const editorRaizes = edicao?.versaoId === versaoId ? arvore.raizes : [];

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      {erro && (
        <p role="alert" className="rounded border px-4 py-3 text-[0.75rem]" style={{ background: "#D94A4A08", borderColor: "#D94A4A30", color: "#B23B3B" }}>{erro}</p>
      )}
      {aviso && (
        <p role="status" className="flex items-center gap-2 rounded border px-4 py-3 text-[0.75rem]" style={{ background: "#2E893208", borderColor: "#2E893230", color: "#24702A" }}>
          <CheckCircle2 size={14} aria-hidden /> {aviso}
        </p>
      )}

      {/* Versão e ações */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {versoes.length > 0 && (
            <Dropdown
              className="w-[18rem] max-w-full"
              value={versaoId ?? ""}
              onChange={valor => { setVersaoEscolhida(valor); setAviso(""); setFechados(new Set()); }}
              ariaLabel="Versão do orçamento"
              options={versoes.map(v => ({ value: v.id, label: `${nomeDaVersao(v)}${v.ativa ? " · em uso" : ""}` }))}
            />
          )}
          {versao && (
            <span
              className="rounded border bg-white px-2 py-1 text-[0.625rem] font-medium"
              style={versao.ativa ? { borderColor: "#2E893247", color: "#2E8932" } : { borderColor: "rgba(13,13,13,.15)", color: "rgba(13,13,13,.5)" }}
            >
              {versao.ativa ? "Em uso" : "Não está em uso"}
            </span>
          )}
          {versao?.ato && (
            <span className="text-[0.6875rem] text-black/45">{versao.ato}{versao.data_ato ? ` de ${dataBR(versao.data_ato)}` : ""}</span>
          )}
          {podeEditar && versao && (
            <>
              <button type="button" onClick={() => setVersaoModal("editar")} className={SECUNDARIO} style={BORDA}>
                <Pencil size={12} aria-hidden /> Dados da versão
              </button>
              <button type="button" onClick={() => setVersaoModal("nova")} className={SECUNDARIO} style={BORDA}>
                <CopyPlus size={13} aria-hidden /> Nova versão
              </button>
            </>
          )}
          {versao && !versao.ativa && permissoes.decidir && (
            <button
              type="button"
              onClick={tornarAtiva}
              disabled={ativando}
              className="flex h-9 items-center gap-1.5 rounded bg-[#2E8932] px-3 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-50"
            >
              <CheckCircle2 size={13} aria-hidden /> {ativando ? "Trocando…" : "Tornar ativa"}
            </button>
          )}
          {versao && !versao.ativa && podeEditar && (
            <button type="button" onClick={excluirVersao} className="flex h-9 items-center gap-1.5 rounded px-2 text-[0.75rem] text-[#B23B3B]/80 transition hover:bg-[#D94A4A]/[.06] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
              <Trash2 size={12} aria-hidden /> Excluir versão
            </button>
          )}
        </div>

        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <ImportarOrcamento
              prestacaoId={id}
              organizationId={organizationId}
              versaoId={versaoId}
              garantirVersao={garantirVersao}
              nos={nos}
              disabled={carregando}
              onImported={mensagem => { setAviso(mensagem); recarregar(); }}
            />
            <button type="button" onClick={() => abrirNovo(null, "etapa")} disabled={carregando} className={SECUNDARIO} style={BORDA}>
              <FolderPlus size={13} aria-hidden /> Agrupador
            </button>
            <button
              type="button"
              onClick={() => abrirNovo(null, "item")}
              disabled={carregando}
              className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-semibold text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98] disabled:opacity-50"
            >
              <Plus size={13} aria-hidden /> Adicionar item
            </button>
          </div>
        )}
      </div>

      {versao && !versao.ativa && versaoAtiva && (
        <p className="flex items-start gap-2 text-[0.6875rem] leading-4 text-black/50">
          <Info size={13} className="mt-px shrink-0 text-[#2D72B0]" aria-hidden />
          Você está vendo uma versão que não está em uso. O orçamento em uso é {nomeDaVersao(versaoAtiva)}; os comprovantes aparecem aqui nos itens copiados dele.
        </p>
      )}
      {!podeEditar && !carregando && (
        <p className="text-[0.6875rem] text-black/45">Você pode consultar o orçamento. Editar cabe ao administrador ou ao colaborador com a prestação.</p>
      )}

      {carregando ? (
        <div aria-busy="true" aria-label="Carregando o orçamento" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[4.25rem] animate-pulse rounded bg-black/[.05] motion-reduce:animate-none" />)}
          </div>
          <div className={`${CARTAO} space-y-2 p-4`} style={BORDA}>
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-7 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}
          </div>
        </div>
      ) : nos.length === 0 ? (
        <div className={`${CARTAO} px-6 py-12 text-center`} style={BORDA}>
          <p className="text-[0.875rem] font-medium text-black/60">{versao ? "Nenhum item nesta versão." : "O orçamento ainda não foi cadastrado."}</p>
          <p className="mx-auto mt-1 max-w-[32rem] text-[0.75rem] leading-5 text-black/40">
            {podeEditar
              ? "Importe o orçamento aprovado (CSV ou PDF) ou adicione os itens. Etapas e produtos agrupam os itens; o grupo de custo de cada item alimenta os tetos do regime."
              : "Quando o orçamento for cadastrado, ele aparece aqui com o executado de cada item."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              {
                rotulo: "Vigente",
                valor: fmt(arvore.total.vigente),
                nota: arvore.total.remanejado !== 0 ? `Aprovado ${fmt(arvore.total.aprovado)}` : `${arvore.total.itens} itens`,
              },
              { rotulo: "Comprometido", valor: fmt(arvore.total.comprometido), nota: "Comprovantes em análise" },
              { rotulo: "Pago", valor: fmt(arvore.total.pago), nota: "Comprovantes aceitos" },
              { rotulo: "Saldo", valor: fmt(arvore.total.saldo), nota: "Vigente − comprometido − pago", alerta: arvore.total.saldo < 0 },
              { rotulo: "% pago", valor: percentual !== null ? `${percentual}%` : "—", nota: "Sobre o vigente" },
            ].map(cartao => (
              <div key={cartao.rotulo} className={`${CARTAO} p-3`} style={BORDA}>
                <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">{cartao.rotulo}</p>
                <p className={`mt-1 text-[1rem] font-semibold tabular-nums ${cartao.alerta ? "text-[#B23B3B]" : "text-[#0D0D0D]"}`}>{cartao.valor}</p>
                <p className="mt-0.5 text-[0.625rem] text-black/35">{cartao.nota}</p>
              </div>
            ))}
          </div>

          <TetosDoRegime tetos={tetos} regimeNome={regime?.nome ?? null} bases={bases} />

          <section aria-labelledby="itens-titulo" className={`${CARTAO} overflow-hidden`} style={BORDA}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <h2 id="itens-titulo" className="text-[0.75rem] font-semibold text-[#0D0D0D]">Itens do orçamento</h2>
              {agrupadores.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFechados(fechados.size > 0 ? new Set() : new Set(agrupadores))}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[0.6875rem] text-black/45 transition hover:bg-black/5 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                >
                  {fechados.size > 0 ? <><ChevronsUpDown size={12} aria-hidden /> Expandir tudo</> : <><ChevronsDownUp size={12} aria-hidden /> Recolher tudo</>}
                </button>
              )}
            </div>
            <ArvoreOrcamento
              linhas={linhas}
              fechados={fechados}
              onAlternar={alternar}
              total={arvore.total}
              podeEditar={podeEditar}
              onEditar={no => versaoId && setEdicao({ versaoId, edicao: { modo: "editar", no } })}
              onAdicionarDentro={no => abrirNovo(no.id, "item")}
              onExcluir={excluir}
            />
          </section>

          <AlteracoesOrcamento
            prestacaoId={id}
            organizationId={organizationId}
            prestacao={base?.prestacao ?? null}
            regime={regime}
            versaoAtiva={versaoAtiva}
            nosAtivos={versao?.ativa ? nos : null}
            permissoes={permissoes}
            recarga={recarga}
            onChanged={mensagem => { if (mensagem) setAviso(mensagem); recarregar(); }}
          />

          {arvore.foraDaVersao.quantidade > 0 && (
            <p className="flex items-start gap-2 text-[0.6875rem] leading-4 text-black/50">
              <Info size={13} className="mt-px shrink-0 text-[#B07A14]" aria-hidden />
              <span>
                {arvore.foraDaVersao.quantidade} {arvore.foraDaVersao.quantidade === 1 ? "comprovante não está ligado" : "comprovantes não estão ligados"} a um item desta versão
                ({fmt(arvore.foraDaVersao.pago)} aceitos, {fmt(arvore.foraDaVersao.comprometido)} em análise) e não entram nas colunas acima.{" "}
                <Link href={`/prestacoes/${id}/comprovantes`} className="text-[#684DB0] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">Ligar em Comprovantes</Link>
              </span>
            </p>
          )}
        </>
      )}

      {edicao && (
        <EditorNoOrcamento
          versaoId={edicao.versaoId}
          raizes={editorRaizes}
          edicao={edicao.edicao}
          ordemNova={ordemNova}
          onClose={() => setEdicao(null)}
          onSaved={() => { setEdicao(null); recarregar(); }}
        />
      )}
      {versaoModal && (
        <VersaoOrcamentoModal
          prestacaoId={id}
          editando={versaoModal === "editar" ? versao : null}
          base={versaoModal === "nova" ? versao : null}
          onClose={() => setVersaoModal(null)}
          onSaved={novaId => {
            setVersaoModal(null);
            setVersaoEscolhida(novaId);
            setAviso(versaoModal === "nova" ? "Versão criada. Ela não muda o orçamento em uso até ser tornada ativa." : "");
            recarregar();
          }}
        />
      )}
    </div>
  );
}
