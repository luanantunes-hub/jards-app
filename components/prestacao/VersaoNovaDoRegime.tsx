"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RegimePublicado } from "@/hooks/useRegimesPublicados";
import { resumoDasMudancas, type ItemDoResumo } from "@/lib/prestacao/regimes/revisao";
import type { PrestacaoContas } from "@/lib/supabase/types";

const dataBr = (data: string | null | undefined) => (data ? data.slice(0, 10).split("-").reverse().join("/") : "sem data");
const AMBAR = "#B07A14";
const MOSTRAR = 5;

const ERROS: Record<string, string> = {
  sem_permissao: "Só o administrador ou o responsável pela prestação passa para a versão nova.",
  versao_invalida: "A versão publicada mudou desde que a página abriu. Atualize a página e confira de novo.",
  prestacao_encerrada: "Prestação aprovada ou arquivada fica na versão em que foi decidida.",
  prestacao_inexistente: "Prestação não encontrada ou sem acesso.",
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
};

function Mudanca({ item }: { item: ItemDoResumo }) {
  return (
    <li className="py-2">
      <p className="text-[0.75rem] text-black/75">
        {item.rotulo}
        {item.tipo !== "mudou" && (
          <span className="ml-1.5 rounded border bg-white px-1.5 py-0.5 align-middle text-[0.625rem] font-medium"
            style={{ borderColor: item.tipo === "entrou" ? "#2E893247" : "#B23B3B47", color: item.tipo === "entrou" ? "#2E8932" : "#B23B3B" }}>
            {item.tipo === "entrou" ? "Entrou" : "Saiu"}
          </span>
        )}
      </p>
      {item.tipo === "mudou" && (
        <p className="mt-0.5 text-[0.75rem] tabular-nums text-black/55">
          {item.antes ?? "—"} <span aria-hidden>→</span><span className="sr-only">passa a ser</span> <span className="text-black/85">{item.depois ?? "—"}</span>
        </p>
      )}
      {item.fonte && <p className="mt-0.5 text-[0.625rem] text-black/40">{item.fonte}</p>}
    </li>
  );
}

/**
 * Aviso de versão nova do regime (P6.4): a prestação em andamento numa
 * versão anterior mostra a versão publicada, o que muda e como fica o prazo
 * final. Quem decide na organização passa a prestação para a versão nova;
 * a troca fica no histórico e o banco recalcula o prazo.
 */
export function VersaoNovaDoRegime({ prestacao, regimes, podeDecidir, onPassou }: {
  prestacao: PrestacaoContas;
  regimes: RegimePublicado[];
  podeDecidir: boolean;
  onPassou: (mensagem: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const atual = regimes.find(r => r.id === prestacao.regime_id) ?? null;
  const nova = atual && !atual.publicado
    ? regimes.find(r => r.publicado && r.regime.codigo === atual.regime.codigo && r.regime.versao > atual.regime.versao) ?? null
    : null;
  const encerrada = prestacao.status === "aprovado" || prestacao.status === "arquivado";
  const resumo = useMemo(() => (atual && nova ? resumoDasMudancas(atual.regime, nova.regime) : []), [atual, nova]);
  const [prazoNovo, setPrazoNovo] = useState<{ regimeId: string; data: string | null } | null>(null);
  const [todas, setTodas] = useState(false);
  const [passando, setPassando] = useState(false);
  const [erro, setErro] = useState("");

  const novaId = nova?.id ?? null;
  useEffect(() => {
    if (!novaId || encerrada) return;
    let ativo = true;
    // O mesmo cálculo do banco, com os feriados e o calendário regulatório.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função fora do tipo Database
    (supabase as any).rpc("prestacao_prazo_final", {
      p_regime_id: novaId,
      p_fim_execucao: prestacao.data_fim_execucao ?? null,
      p_conclusao_objeto: prestacao.data_conclusao_objeto ?? null,
      p_envio: prestacao.data_envio ?? null,
    }).then(({ data, error }: { data: string | null; error: unknown }) => {
      if (ativo && !error) setPrazoNovo({ regimeId: novaId, data: data ?? null });
    });
    return () => { ativo = false; };
  }, [supabase, novaId, encerrada, prestacao.data_fim_execucao, prestacao.data_conclusao_objeto, prestacao.data_envio]);

  if (!atual || !nova || encerrada) return null;

  const previa = prazoNovo?.regimeId === nova.id ? prazoNovo : null;
  const prazoAntes = prestacao.prazo_final ?? null;
  const visiveis = todas ? resumo : resumo.slice(0, MOSTRAR);

  async function passar() {
    if (!nova) return;
    setPassando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, fora do tipo Database
    const { data, error } = await (supabase as any).rpc("fn_prestacao_passar_versao", { p_prestacao_id: prestacao.id, p_regime_id: nova.id });
    setPassando(false);
    if (error) {
      const codigo = Object.keys(ERROS).find(c => error.message?.includes(c));
      setErro(codigo ? ERROS[codigo] : "Não foi possível passar para a versão nova.");
      return;
    }
    const r = data as { versao_nova: number; prazo_final_anterior: string | null; prazo_final_novo: string | null };
    onPassou(`A prestação passou para a versão ${r.versao_nova} do regime.${r.prazo_final_anterior !== r.prazo_final_novo
      ? ` Prazo final pelo regime: ${dataBr(r.prazo_final_anterior)} → ${dataBr(r.prazo_final_novo)}.` : ""}`);
  }

  return (
    <section aria-labelledby="titulo-versao-nova" className="mb-4 rounded border bg-white px-4 py-3.5" style={{ borderColor: `${AMBAR}55` }}>
      <div className="flex items-start gap-2.5">
        <RefreshCw size={14} aria-hidden className="mt-0.5 flex-shrink-0" style={{ color: AMBAR }} />
        <div className="min-w-0 flex-1">
          <h2 id="titulo-versao-nova" className="text-[0.8125rem] font-semibold text-[#282525]">
            Versão {nova.regime.versao} do regime publicada
          </h2>
          <p className="mt-0.5 text-[0.75rem] leading-relaxed text-black/60">
            {nova.regime.nome}. A prestação segue a versão {atual.regime.versao}
            {nova.regime.vigenteDesde ? `; a nova vale desde ${dataBr(nova.regime.vigenteDesde)}` : ""}.
            {" "}Até alguém passar a prestação para a versão nova, as checagens e o prazo continuam pela versão {atual.regime.versao}.
          </p>

          {resumo.length > 0 && (
            <>
              <p className="mt-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">
                O que muda ({resumo.length})
              </p>
              <ul className="divide-y divide-black/[.06]">
                {visiveis.map((item, i) => <Mudanca key={`${item.rotulo}:${i}`} item={item} />)}
              </ul>
              {resumo.length > MOSTRAR && (
                <button type="button" onClick={() => setTodas(t => !t)} aria-expanded={todas}
                  className="mt-1 rounded text-[0.6875rem] text-black/50 underline decoration-black/20 underline-offset-2 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  {todas ? "Mostrar menos" : `Ver as ${resumo.length} mudanças`}
                </button>
              )}
            </>
          )}

          {/* Sem a data do marco, nenhuma das versões calcula o prazo: não há o que comparar. */}
          {!(previa && !previa.data && !prazoAntes) && (
            <p className="mt-3 text-[0.75rem] tabular-nums text-black/60">
              {!previa ? "Calculando o prazo final pela versão nova…"
                : previa.data === prazoAntes ? `O prazo final pelo regime não muda (${dataBr(prazoAntes)}).`
                  : `Prazo final pelo regime: ${dataBr(prazoAntes)} → ${dataBr(previa.data)}.`}
              {previa && prestacao.prazo_final_override ? ` Continua valendo o prazo informado à mão, ${dataBr(prestacao.prazo_final_override)}.` : ""}
            </p>
          )}

          {erro && <p role="alert" className="mt-2 text-[0.75rem] text-[#B23B3B]">{erro}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {podeDecidir ? (
              <>
                <button type="button" onClick={passar} disabled={passando}
                  className="h-10 rounded acao-salvar px-4 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-60">
                  {passando ? "Passando…" : `Passar para a versão ${nova.regime.versao}`}
                </button>
                <span className="text-[0.6875rem] text-black/45">A troca fica no histórico, e as checagens são refeitas.</span>
              </>
            ) : (
              <span className="text-[0.6875rem] text-black/50">
                Só o administrador ou o responsável pela prestação passa para a versão nova.
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
