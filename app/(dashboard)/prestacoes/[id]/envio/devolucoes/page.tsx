"use client";

// Devoluções (P4.4): as guias de recolhimento da prestação. Saldo e
// rendimentos voltam como estão no encerramento; o valor irregular (glosa,
// reprovação) volta atualizado pelo índice do regime. Cada devolução mostra
// os campos da guia para copiar no PagTesouro, a atualização pela poupança
// (série 195 do Banco Central) e o pagamento, com o comprovante.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft, Clock, ExternalLink, FileText, Pencil, Plus, Receipt, RefreshCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { CampoParaCopiar } from "@/components/prestacao/CampoParaCopiar";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { DevolucaoModal, type InicioDaDevolucao } from "@/components/prestacao/devolucoes/DevolucaoModal";
import {
  aniversarioDaPoupanca,
  aniversarios,
  atualizarPelaPoupanca,
  camposDaGuia,
  devolucaoDoRegime,
  guiasDoRegime,
  recolhimentoDoEncerramento,
  reais,
  referenciaDaPrestacao,
  ROTULO_DO_INDICE,
  rotuloDoMotivo,
  situacaoDaDevolucao,
  type SituacaoDaDevolucao,
  type TaxaDaPoupanca,
} from "@/lib/prestacao/devolucoes";
import { nomeDaConta, ultimoExtrato } from "@/lib/prestacao/envio";
import { descreverRegra, prazoDoSaldo } from "@/lib/prestacao/prazo-final";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoDevolucao } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:text-black/35 active:scale-[.98]";
const ICONE = "rounded p-2 text-black/35 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
const PAGTESOURO = "https://pagtesouro.tesouro.gov.br/portal-gru/#/emissao-gru";

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const diasAte = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
const fator = (f: number) => f.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });

type Prestacao = { titulo: string; identificador_oficial: string | null; numero_processo: string | null; proponente: { nome: string; cnpj: string | null } | null };

const COR_DA_SITUACAO: Record<SituacaoDaDevolucao["estado"], string> = { paga: "#2E8932", vencida: "#D94A4A", a_pagar: "#B07A14" };

function EtiquetaDaSituacao({ situacao }: { situacao: SituacaoDaDevolucao }) {
  const cor = COR_DA_SITUACAO[situacao.estado];
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>
      {situacao.texto}
    </span>
  );
}

function Atualizacao({ d, podeEditar, atualizando, onAtualizar }: { d: PrestacaoDevolucao; podeEditar: boolean; atualizando: boolean; onAtualizar: () => void }) {
  if (d.indice === "nenhum") {
    return <p className="text-black/45">{d.motivo === "saldo" || d.motivo === "rendimento" ? "Sem atualização: volta como está no extrato." : "Sem atualização."}</p>;
  }
  const meses = d.data_base && d.atualizado_ate ? aniversarios(d.data_base, d.atualizado_ate).length : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 text-black/60">
        {ROTULO_DO_INDICE[d.indice]} desde {dataBr(d.data_base)}
        {d.valor_atualizado !== null && d.atualizado_ate
          ? <>: <span className="tabular-nums text-black/85">{reais(centavos(d.valor_atualizado))}</span> até {dataBr(d.atualizado_ate)}
              {d.indice === "poupanca" && <span className="tabular-nums text-black/40"> · {meses} {meses === 1 ? "mês" : "meses"}, fator {fator(Number(d.fator ?? 1))}</span>}</>
          : <> · <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mr-0.5 inline-block align-[-0.125rem] text-[#B07A14]" />ainda não atualizado</>}
      </p>
      {d.indice === "poupanca" && podeEditar && d.situacao !== "paga" && (
        <button type="button" onClick={onAtualizar} disabled={atualizando} className={BOTAO} style={BORDA}>
          <RefreshCw size={12} className={atualizando ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden /> Atualizar até hoje
        </button>
      )}
    </div>
  );
}

function CartaoDaDevolucao({ d, hoje, podeEditar, atualizando, onGuia, onPagar, onEditar, onExcluir, onAtualizar, onAbrir }: {
  d: PrestacaoDevolucao;
  hoje: string;
  podeEditar: boolean;
  atualizando: boolean;
  onGuia: () => void;
  onPagar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onAtualizar: () => void;
  onAbrir: () => void;
}) {
  const situacao = situacaoDaDevolucao(d, hoje);
  const total = centavos(d.valor_atualizado ?? d.valor_principal);
  return (
    <li className="space-y-3 px-5 py-4 text-[0.75rem]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-black/85">{rotuloDoMotivo(d.motivo)}</p>
          {d.descricao && <p className="text-[0.6875rem] text-black/50">{d.descricao}</p>}
          <p className="mt-0.5 text-[0.6875rem] tabular-nums text-black/40">
            {[d.gru_codigo ? `Código ${d.gru_codigo}` : null, d.gru_unidade_gestora ? `UG ${d.gru_unidade_gestora}` : null, d.competencia ? `competência ${d.competencia}` : null].filter(Boolean).join(" · ") || "Guia sem código"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-[0.875rem] tabular-nums text-black/85">{reais(total)}</p>
            {d.valor_atualizado !== null && <p className="text-[0.625rem] tabular-nums text-black/40">principal {reais(centavos(d.valor_principal))}</p>}
          </div>
          <EtiquetaDaSituacao situacao={situacao} />
        </div>
      </div>

      <div className="text-[0.6875rem]">
        <Atualizacao d={d} podeEditar={podeEditar} atualizando={atualizando} onAtualizar={onAtualizar} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onGuia} className={BOTAO} style={BORDA}>
          <Receipt size={12} aria-hidden /> Campos da guia
        </button>
        {podeEditar && d.situacao !== "paga" && (
          <button type="button" onClick={onPagar} className={BOTAO} style={BORDA}>Registrar pagamento</button>
        )}
        {d.storage_path ? (
          <button type="button" onClick={onAbrir} className={BOTAO} style={BORDA}>
            <FileText size={12} aria-hidden /> {d.nome_arquivo ?? "Comprovante"}
          </button>
        ) : d.situacao === "paga" && (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-black/55">
            <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
            Sem o comprovante do pagamento
          </span>
        )}
        {podeEditar && (
          <span className="ml-auto flex items-center">
            <button type="button" onClick={onEditar} aria-label={`Editar ${rotuloDoMotivo(d.motivo).toLowerCase()}`} className={ICONE}><Pencil size={13} aria-hidden /></button>
            <button type="button" onClick={onExcluir} aria-label={`Excluir ${rotuloDoMotivo(d.motivo).toLowerCase()}`} className={ICONE}><Trash2 size={13} aria-hidden /></button>
          </span>
        )}
      </div>
    </li>
  );
}

function GuiaModal({ d, prestacao, descricaoDoRegime, onClose }: {
  d: PrestacaoDevolucao;
  prestacao: Prestacao | null;
  descricaoDoRegime: string | null;
  onClose: () => void;
}) {
  const campos = camposDaGuia(d, prestacao?.proponente ? { nome: prestacao.proponente.nome, documento: prestacao.proponente.cnpj } : null);
  // Só a inicial baixa, e só em palavra comum: "CNPJ ou CPF" fica como está.
  const faltam = campos.filter(c => !c.valor && c.rotulo !== "Vencimento").map(c => c.rotulo.replace(/^(\p{Lu})(?=\p{Ll})/u, l => l.toLowerCase()));
  return (
    <ModalPrestacao
      titulo="Campos da guia"
      subtitulo={`${rotuloDoMotivo(d.motivo)} · ${reais(centavos(d.valor_atualizado ?? d.valor_principal))}`}
      onClose={onClose}
      largura="max-w-[36rem]"
      rodape={<>
        <p className="hidden text-[0.6875rem] text-black/40 sm:block">Copie cada campo e cole na emissão da GRU.</p>
        <a href={PAGTESOURO} target="_blank" rel="noopener noreferrer" className={`${BOTAO} ml-auto`} style={BORDA}>
          Abrir o PagTesouro <ExternalLink size={12} aria-hidden />
        </a>
      </>}
    >
      <div className="py-2">
        {faltam.length > 0 && (
          <p className="mx-6 my-2 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B07A14]" style={{ borderColor: "#B07A1440" }}>
            Falta: {faltam.join(", ")}.
          </p>
        )}
        {campos.map(c => <CampoParaCopiar key={c.rotulo} rotulo={c.rotulo} valor={c.valor} />)}
        {descricaoDoRegime && <p className="mx-6 mt-3 text-[0.6875rem] text-black/45">{descricaoDoRegime}</p>}
      </div>
    </ModalPrestacao>
  );
}

export default function DevolucoesPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const organizationId = usePrestacaoOrganizacao(id);
  const { confirmDelete } = useDeleteConfirm();
  const { dados, recarregar: recarregarEnvio } = useDadosDoEnvio(id);
  const [prestacao, setPrestacao] = useState<Prestacao | null>(null);
  const [devolucoes, setDevolucoes] = useState<PrestacaoDevolucao[] | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<{ devolucao: PrestacaoDevolucao | null; inicio?: InicioDaDevolucao } | null>(null);
  const [guia, setGuia] = useState<PrestacaoDevolucao | null>(null);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const hoje = hojeIso();

  const carregar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [p, d] = await Promise.all([
      db.from("prestacoes_contas").select("titulo, identificador_oficial, numero_processo, proponente:proponente_id(nome, cnpj)").eq("id", id).maybeSingle(),
      db.from("prestacao_devolucoes").select("*").eq("prestacao_id", id).order("ordem").order("created_at"),
    ]);
    return {
      prestacao: (p.data ?? null) as Prestacao | null,
      devolucoes: (d.data ?? []) as PrestacaoDevolucao[],
      erro: p.error || d.error ? mensagemErroPrestacao(p.error ?? d.error, "Não foi possível carregar as devoluções") : "",
    };
  }, [id, supabase]);

  const recarregar = useCallback(async () => {
    const lido = await carregar();
    setPrestacao(lido.prestacao);
    setDevolucoes(lido.devolucoes);
    if (lido.erro) setErro(lido.erro);
    await recarregarEnvio();
  }, [carregar, recarregarEnvio]);

  useEffect(() => {
    let ativo = true;
    carregar().then(lido => {
      if (!ativo) return;
      setPrestacao(lido.prestacao);
      setDevolucoes(lido.devolucoes);
      setErro(lido.erro);
    });
    return () => { ativo = false; };
  }, [carregar]);

  const regime = dados?.regime ?? null;
  const doRegime = devolucaoDoRegime(regime);
  const guias = useMemo(() => guiasDoRegime(regime), [regime]);
  const podeEditar = permissoes.editar;
  // O formulário nasce com a guia e o índice do regime: só abre depois de tudo carregado.
  const carregado = dados !== null && devolucoes !== null;
  // P9.4: o prazo do saldo no encerramento (na saúde, a GRU em 30 dias do término) e se as guias dele já estão pagas.
  const prazoSaldo = prazoDoSaldo(regime, { data_fim_execucao: dados?.estado.prestacao?.data_fim_execucao ?? null });
  const recolhido = devolucoes ? (() => { const r = recolhimentoDoEncerramento(devolucoes); return r.guias > 0 && r.aPagar === 0; })() : false;

  // Saldo pelo último extrato de cada conta: a sugestão da guia do saldo.
  const saldo = useMemo(() => {
    const contas = (dados?.contas ?? []).map(c => ({ conta: c, extrato: ultimoExtrato(c) }))
      .filter(u => u.extrato && centavos(u.extrato.saldo_final) > 0);
    const ate = contas.map(u => u.extrato!.periodo_fim ?? "").sort().at(-1) ?? "";
    return { total: contas.reduce((s, u) => s + centavos(u.extrato!.saldo_final), 0), contas, ate };
  }, [dados]);
  // Uma guia do saldo a pagar, ou paga depois do extrato, já cobre o saldo que ele mostra.
  const saldoSemGuia = saldo.total > 0 && !(devolucoes ?? []).some(d => d.motivo === "saldo" && (d.situacao === "a_pagar" || (d.pago_em ?? "") >= saldo.ate));

  const resumo = useMemo(() => {
    const lista = devolucoes ?? [];
    const aPagar = lista.filter(d => d.situacao !== "paga");
    return {
      aPagar: aPagar.reduce((s, d) => s + centavos(d.valor_atualizado ?? d.valor_principal), 0),
      vencidas: aPagar.filter(d => situacaoDaDevolucao(d, hoje).estado === "vencida").length,
      pago: lista.filter(d => d.situacao === "paga").reduce((s, d) => s + centavos(d.valor_pago), 0),
      semComprovante: lista.filter(d => d.situacao === "paga" && !d.storage_path).length,
    };
  }, [devolucoes, hoje]);

  async function abrir(d: PrestacaoDevolucao) {
    if (!d.storage_path) return;
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(d.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o comprovante${error ? `: ${error.message}` : ""}.`);
  }

  function excluir(d: PrestacaoDevolucao) {
    confirmDelete({
      title: "Excluir devolução?",
      description: `${rotuloDoMotivo(d.motivo)}, ${reais(centavos(d.valor_atualizado ?? d.valor_principal))}${d.storage_path ? ", com o comprovante" : ""}.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_devolucoes ainda não está no tipo Database
        const { error } = await (supabase as any).from("prestacao_devolucoes").delete().eq("id", d.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a devolução"));
        if (d.storage_path) await supabase.storage.from("documentos").remove([d.storage_path]);
        await recarregar();
      },
    });
  }

  async function atualizar(d: PrestacaoDevolucao) {
    if (!d.data_base) return;
    setAtualizando(d.id);
    setErro("");
    try {
      let taxas: TaxaDaPoupanca[] = [];
      if (aniversarios(d.data_base, hoje).length > 0) {
        const resposta = await fetch(`/api/indices/poupanca?de=${aniversarioDaPoupanca(d.data_base)}&ate=${hoje}`);
        const corpo = await resposta.json().catch(() => null);
        if (!resposta.ok) throw new Error(corpo?.error === "indice_indisponivel" ? "O Banco Central não respondeu agora. Tente de novo em instantes." : "Não foi possível buscar a poupança.");
        taxas = corpo?.taxas ?? [];
      }
      const a = atualizarPelaPoupanca(centavos(d.valor_principal), d.data_base, hoje, taxas);
      if (a.faltando.length) throw new Error(`A série do Banco Central ainda não tem a taxa de ${a.faltando.map(dataBr).join(", ")}.`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_devolucoes ainda não está no tipo Database
      const { error } = await (supabase as any).from("prestacao_devolucoes")
        .update({ atualizado_ate: a.ate, fator: Number(a.fator.toFixed(10)), valor_atualizado: a.valor / 100 }).eq("id", d.id);
      if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível gravar a atualização"));
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
    setAtualizando(null);
  }

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Devoluções</h2>
          <p className="max-w-[44rem] text-[0.6875rem] text-black/45">
            As guias de recolhimento: saldo e rendimentos no encerramento, e o valor irregular depois da análise, atualizado pelo índice do regime. Os campos da guia vão prontos para copiar no PagTesouro.
          </p>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando({ devolucao: null })}
            disabled={!carregado}
            className="flex h-9 items-center gap-1.5 rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} aria-hidden /> Nova devolução
          </button>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}

      {doRegime && (
        <div className="space-y-1.5 rounded border bg-white px-5 py-4 text-[0.6875rem]" style={BORDA}>
          <p className="text-black/70">{doRegime.descricao}</p>
          {prazoSaldo && (
            <p className="flex items-start gap-1 text-black/60">
              <Clock size={12} strokeWidth={1.75} aria-hidden className={`mt-px shrink-0 ${!recolhido && hoje > prazoSaldo.data ? "text-[#B07A14]" : "text-black/40"}`} />
              <span>
                {prazoSaldo.rotulo}: até <span className="tabular-nums">{dataBr(prazoSaldo.data)}</span> ({descreverRegra(prazoSaldo.regra)}).{" "}
                {recolhido ? "As guias do saldo e dos rendimentos estão pagas." : hoje > prazoSaldo.data ? "O prazo venceu." : `Faltam ${diasAte(hoje, prazoSaldo.data)} dias.`}
              </span>
            </p>
          )}
          <p className="text-black/50">Atualização: {doRegime.atualizacao}</p>
          {guias.length > 0 && (
            <ul className="space-y-0.5 tabular-nums text-black/50">
              {guias.map(g => (
                <li key={`${g.unidadeGestora}:${g.codigo}`}>
                  UG {g.unidadeGestora}{g.gestao ? ` · gestão ${g.gestao}` : ""} · código {g.codigo} · referência: {g.referencia}
                  {g.fonte.aConfirmar && <> · <AlertCircle size={12} strokeWidth={1.75} aria-hidden className="mr-0.5 inline-block align-[-0.125rem] text-black/40" />a confirmar com o órgão</>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-black/35">{[doRegime.fonte.documento, doRegime.fonte.dispositivo].filter(Boolean).join(", ")}</p>
        </div>
      )}

      {carregado && saldoSemGuia && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white px-5 py-3 text-[0.75rem]" style={{ borderColor: "#B07A1440" }}>
          <p className="flex min-w-0 items-start gap-1.5 text-[#B07A14]">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              O último extrato mostra saldo de {reais(saldo.total)} ({saldo.contas.map(u => `${nomeDaConta(u.conta)}, ${reais(centavos(u.extrato!.saldo_final))}${u.extrato!.periodo_fim ? ` em ${dataBr(u.extrato!.periodo_fim)}` : ""}`).join("; ")}).
            </span>
          </p>
          {podeEditar && (
            <button type="button" onClick={() => setEditando({ devolucao: null, inicio: { motivo: "saldo", valor: saldo.total / 100 } })} className={BOTAO} style={BORDA}>
              Registrar a guia do saldo
            </button>
          )}
        </div>
      )}

      {devolucoes === null && !erro && <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-24 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {devolucoes && devolucoes.length === 0 && (
        <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
          <Receipt size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mx-auto mt-2 max-w-[30rem] text-[0.75rem] text-black/55">
            Nenhuma devolução registrada. Registre a guia do saldo e dos rendimentos no encerramento, ou do valor glosado depois da análise, para ter os campos prontos e acompanhar o pagamento.
          </p>
        </div>
      )}

      {devolucoes && devolucoes.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border bg-white px-5 py-4 text-[0.6875rem] md:grid-cols-4" style={BORDA}>
            <div>
              <dt className={ROTULO}>
                {resumo.aPagar > 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
                A pagar
              </dt>
              <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${resumo.aPagar ? "text-[#282525]" : "text-black/30"}`}>{reais(resumo.aPagar)}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Pago</dt>
              <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${resumo.pago ? "text-[#282525]" : "text-black/30"}`}>{reais(resumo.pago)}</dd>
            </div>
            <div>
              <dt className={ROTULO}>
                {resumo.vencidas > 0 && <Clock size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#D94A4A]" />}
                Vencidas
              </dt>
              <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${resumo.vencidas ? "text-[#282525]" : "text-black/30"}`}>{resumo.vencidas}</dd>
            </div>
            <div>
              <dt className={ROTULO}>
                {resumo.semComprovante > 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
                Pagas sem comprovante
              </dt>
              <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${resumo.semComprovante ? "text-[#282525]" : "text-black/30"}`}>{resumo.semComprovante}</dd>
            </div>
          </dl>
          <ul className="divide-y divide-black/[.05] overflow-hidden rounded border bg-white" style={BORDA} aria-label="Devoluções">
            {devolucoes.map(d => (
              <CartaoDaDevolucao
                key={d.id}
                d={d}
                hoje={hoje}
                podeEditar={podeEditar}
                atualizando={atualizando === d.id}
                onGuia={() => setGuia(d)}
                onPagar={() => setEditando({ devolucao: d, inicio: { pagar: true } })}
                onEditar={() => setEditando({ devolucao: d })}
                onExcluir={() => excluir(d)}
                onAtualizar={() => atualizar(d)}
                onAbrir={() => abrir(d)}
              />
            ))}
          </ul>
        </>
      )}

      {editando && (
        <DevolucaoModal
          prestacaoId={id}
          organizationId={organizationId}
          regime={regime}
          guias={guias}
          referencia={referenciaDaPrestacao(regime, prestacao)}
          devolucao={editando.devolucao}
          inicio={editando.inicio}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar(); }}
        />
      )}
      {guia && <GuiaModal d={guia} prestacao={prestacao} descricaoDoRegime={doRegime?.descricao ?? null} onClose={() => setGuia(null)} />}
    </div>
  );
}
