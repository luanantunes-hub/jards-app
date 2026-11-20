"use client";

// Importar o extrato do Transferegov (P9.4): as linhas das contas do projeto
// pela API pública de parcerias, sem arquivo do banco. Cada conta da API é
// ligada à conta da prestação com o mesmo número (ou cadastrada na hora); o
// que já veio do Transferegov e o que já está no extrato importado do banco
// (mesma data, sentido e valor) ficam de fora.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { rotuloDaConta } from "@/components/prestacao/extrato/ContaBancariaModal";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import {
  contaCorrespondente,
  ERROS_DO_TRANSFEREGOV,
  resumoDaImportacao,
  separarLancamentosNovos,
  type ContaComExtrato,
  type RespostaDoTransferegov,
} from "@/lib/prestacao/transferegov";
import type { PrestacaoContaBancaria, PrestacaoLancamento } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

type Plano = {
  conta: ContaComExtrato;
  daPrestacao: PrestacaoContaBancaria | null;
  separacao: ReturnType<typeof separarLancamentosNovos>;
};

export function ImportarDoTransferegov({ prestacaoId, contas, lancamentos, onClose, onImported }: {
  prestacaoId: string;
  contas: PrestacaoContaBancaria[];
  lancamentos: Pick<PrestacaoLancamento, "conta_id" | "chave" | "data" | "natureza" | "valor">[];
  onClose: () => void;
  onImported: (mensagem: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [resposta, setResposta] = useState<RespostaDoTransferegov | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gravando, setGravando] = useState(false);
  // Todas as contas com o que importar entram; a pessoa desmarca a que não quer.
  const [desmarcadas, setDesmarcadas] = useState<Set<number>>(new Set());

  useEffect(() => {
    let ativo = true;
    fetch(`/api/prestacoes/${prestacaoId}/transferegov`, { cache: "no-store" })
      .then(async r => {
        const corpo = await r.json().catch(() => ({}));
        if (!ativo) return;
        if (!r.ok) { setErro(ERROS_DO_TRANSFEREGOV[corpo.error] ?? "Não foi possível consultar o Transferegov."); return; }
        setResposta(corpo as RespostaDoTransferegov);
      })
      .catch(() => { if (ativo) setErro("Não foi possível consultar o Transferegov."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [prestacaoId]);

  const planos = useMemo<Plano[]>(() => (resposta?.contas ?? []).map(conta => {
    const daPrestacao = contaCorrespondente(conta, contas);
    const existentes = daPrestacao
      ? lancamentos.filter(l => l.conta_id === daPrestacao.id).map(l => ({ chave: l.chave, data: l.data, natureza: l.natureza, valor: Number(l.valor) }))
      : [];
    return { conta, daPrestacao, separacao: separarLancamentosNovos(conta.lancamentos, existentes) };
  }), [resposta, contas, lancamentos]);

  const aImportar = planos.filter(p => !desmarcadas.has(p.conta.id) && p.separacao.novos.length > 0);
  const total = aImportar.reduce((s, p) => s + p.separacao.novos.length, 0);

  function alternar(id: number) {
    setDesmarcadas(atual => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  }

  async function importar() {
    if (!aImportar.length) return;
    setGravando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do extrato ainda não estão no tipo Database
    const db = supabase as any;
    let importados = 0, cadastradas = 0;
    for (const plano of aImportar) {
      let contaId = plano.daPrestacao?.id ?? null;
      if (!contaId) {
        const { data, error } = await db.from("prestacao_contas_bancarias").insert({
          prestacao_id: prestacaoId,
          tipo: plano.conta.tipo ?? "movimento",
          banco: plano.conta.banco,
          agencia: plano.conta.agencia,
          conta: plano.conta.numero,
          apelido: plano.conta.apelido ?? plano.conta.nome,
          data_abertura: plano.conta.abertura,
        }).select("id").single();
        if (error || !data) {
          setGravando(false);
          setErro(mensagemErroPrestacao(error, `Não foi possível cadastrar a ${plano.conta.nome}`));
          return;
        }
        contaId = data.id as string;
        cadastradas += 1;
      }
      const novos = plano.separacao.novos;
      const resumo = resumoDaImportacao(plano.conta, novos);
      const { data, error } = await supabase.rpc("fn_prestacao_extrato_importar" as never, {
        p_conta_id: contaId,
        p_importacao: {
          formato: "transferegov",
          nome_arquivo: `Transferegov · ${plano.conta.nome}${plano.conta.numero ? ` ${plano.conta.numero}` : ""}`,
          periodo_inicio: resumo.periodo_inicio,
          periodo_fim: resumo.periodo_fim,
          saldo_inicial: null,
          saldo_final: resumo.saldo_final,
        },
        p_lancamentos: novos.map(l => ({
          data: l.data,
          natureza: l.natureza,
          valor: l.valor,
          historico: l.historico,
          numero_documento: null,
          numero_normalizado: null,
          id_externo: l.idExterno,
          categoria: l.categoria,
          saldo_apos: null,
          chave: l.chave,
        })),
      } as never);
      if (error && !/extrato_sem_novos/.test(error.message)) {
        setGravando(false);
        setErro(mensagemErroPrestacao(error, `Não foi possível importar o extrato da ${plano.conta.nome}`));
        return;
      }
      importados += (data as { novos?: number } | null)?.novos ?? 0;
    }
    setGravando(false);
    onImported(`${plural(importados, "lançamento importado", "lançamentos importados")} do Transferegov${cadastradas ? `; ${plural(cadastradas, "conta cadastrada", "contas cadastradas")}` : ""}.`);
  }

  const p = resposta?.parceria;

  return (
    <ModalPrestacao
      titulo="Importar do Transferegov"
      subtitulo="O extrato das contas da parceria no Banco do Brasil, pela API pública do Transferegov. O que já está no extrato fica de fora."
      onClose={onClose}
      largura="max-w-[44rem]"
      rodape={<>
        <p className="text-[0.75rem] text-black/50">
          {total > 0 ? <><strong className="tabular-nums text-black/75">{total.toLocaleString("pt-BR")}</strong> {total === 1 ? "lançamento novo" : "lançamentos novos"}</> : carregando ? "Consultando o Transferegov" : "Nada novo para importar"}
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={importar}
            disabled={gravando || carregando || total === 0}
            className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2 text-[0.8125rem] font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {gravando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />}
            Importar
          </button>
        </div>
      </>}
    >
      <div className="space-y-4 px-6 py-5">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}
        {carregando && <div className="space-y-2">{[0, 1].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

        {p && (
          <div className="text-[0.75rem]">
            <p className="font-medium text-black/80">Parceria {p.codigo ?? p.id}{p.situacao ? ` · ${p.situacao}` : ""}</p>
            <p className="text-[0.625rem] text-black/45">
              {[p.processo ? `NUP ${p.processo}` : null, resposta?.atualizadoEm ? `dados do Transferegov de ${dataBr(resposta.atualizadoEm)}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}

        {resposta && planos.length === 0 && (
          <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-black/55" style={BORDA}>A parceria ainda não tem conta aberta no Transferegov.</p>
        )}

        {planos.length > 0 && (
          <ul className="divide-y divide-black/[.05] rounded border" style={BORDA}>
            {planos.map(({ conta, daPrestacao, separacao }) => {
              const novos = separacao.novos.length;
              const marcada = !desmarcadas.has(conta.id);
              const id = `tg-conta-${conta.id}`;
              return (
                <li key={conta.id} className="flex items-start gap-3 px-4 py-3">
                  <input
                    id={id}
                    type="checkbox"
                    checked={marcada && novos > 0}
                    disabled={novos === 0 || gravando}
                    onChange={() => alternar(conta.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#684DB0] disabled:opacity-40"
                  />
                  <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-[0.75rem] font-medium text-black/80">
                      {conta.nome}{conta.numero ? ` · c/c ${conta.numero}` : ""}{conta.agencia ? ` · ag. ${conta.agencia}` : ""}
                    </span>
                    <span className="block text-[0.625rem] text-black/45">
                      {[
                        plural(conta.lancamentos.length, "linha no Transferegov", "linhas no Transferegov"),
                        novos ? plural(novos, "nova", "novas") : "nenhuma nova",
                        separacao.jaImportados ? `${separacao.jaImportados.toLocaleString("pt-BR")} já importadas` : null,
                        separacao.equivalentes ? `${separacao.equivalentes.toLocaleString("pt-BR")} já no extrato do banco` : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-0.5 flex items-start gap-1 text-[0.625rem] text-black/50">
                      {daPrestacao ? (
                        <>Entra em {rotuloDaConta(daPrestacao)}</>
                      ) : (
                        <>
                          <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-px shrink-0 text-[#B07A14]" />
                          A conta ainda não está cadastrada na prestação: ela é cadastrada na importação.
                        </>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {resposta && (
          <p className="text-[0.625rem] text-black/40">
            Aplicação e resgate automáticos entram como lançamentos de aplicação, e os rendimentos ficam na aplicação: o saldo dela vem com a conta. Depósitos na Conta Captação entram como aporte, com o doador no histórico.
          </p>
        )}
      </div>
    </ModalPrestacao>
  );
}
