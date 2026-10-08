"use client";

// Propostas da IA para um documento que afeta regimes (P6.2): por regime, o
// que muda, com o valor atual e o proposto, o dispositivo e o trecho da norma
// conferido no texto guardado; as mudanças que caíram na conferência e por
// quê; regras que pediriam uma checagem nova; vigência, transição e quantas
// prestações usam o regime. O schema do regime confere a versão proposta aqui
// mesmo. A proposta não publica nada.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, RefreshCw, TriangleAlert } from "lucide-react";
import { rotuloDoCaminho, valorLegivel } from "@/lib/prestacao/regimes/revisao";
import { validarRegime } from "@/lib/prestacao/regimes/schema";
import type { ChecagemNova, MudancaConferida, MudancaDescartada } from "@/supabase/functions/_shared/proposta-regime";

export type Proposta = {
  id: string;
  documento_id: string;
  regime_codigo: string;
  classificacao: "irrelevante" | "informativo" | "altera_regra";
  resumo: string | null;
  mudancas: MudancaConferida[];
  descartadas: MudancaDescartada[];
  checagens_novas: ChecagemNova[];
  regime_proposto: Record<string, unknown> | null;
  vigencia_proposta: string | null;
  transicao: { aplicaEmAndamento?: boolean | null; explicacao?: string };
  prestacoes_afetadas: number;
  organizacoes_afetadas: number;
  status: string;
  created_at: string;
};

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const AMBAR = "#B07A14";
const VERDE = "#2E8932";
const VERMELHO = "#B23B3B";

const CLASSIFICACAO: Record<Proposta["classificacao"], { texto: string; cor: string }> = {
  altera_regra: { texto: "Muda regras", cor: AMBAR },
  informativo: { texto: "Informativo", cor: "#2D72B0" },
  irrelevante: { texto: "Sem relação", cor: "#6B6B6B" },
};
const OPERACAO: Record<string, string> = { alterar: "Muda", incluir: "Inclui", remover: "Retira" };

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function Etiqueta({ texto, cor = "rgba(13,13,13,.6)" }: { texto: string; cor?: string }) {
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: cor.startsWith("#") ? `${cor}47` : "rgba(13,13,13,.12)", color: cor }}>
      {texto}
    </span>
  );
}

function Mudanca({ m, regimeAtual }: { m: MudancaConferida; regimeAtual: unknown }) {
  return (
    <li className="space-y-1 py-2.5">
      <p className="text-[0.6875rem] text-black/45">{OPERACAO[m.operacao] ?? m.operacao} · {rotuloDoCaminho(regimeAtual, m.caminho)}</p>
      <p className="text-[0.8125rem] text-[#0D0D0D]">
        {m.operacao === "alterar" ? (
          <>
            <span className="text-black/45 line-through decoration-black/30">{valorLegivel(m.valorAtual)}</span>
            <span aria-hidden className="mx-1.5 text-black/35">→</span>
            <span className="sr-only"> passa a ser </span>
            <strong className="font-semibold">{valorLegivel(m.valorProposto)}</strong>
          </>
        ) : m.operacao === "remover" ? (
          <span className="text-black/60 line-through decoration-black/30">{valorLegivel(m.valorAtual)}</span>
        ) : (
          <strong className="font-semibold">{valorLegivel(m.valorProposto)}</strong>
        )}
        {m.aConfirmar && <span className="ml-2 align-middle"><Etiqueta texto="A confirmar" cor={AMBAR} /></span>}
      </p>
      {m.explicacao && <p className="text-[0.75rem] text-black/60">{m.explicacao}</p>}
      <blockquote className="border-l-2 pl-3 text-[0.75rem] leading-relaxed text-black/70" style={{ borderColor: VERDE }}>
        <span className="mb-0.5 flex items-center gap-1 text-[0.625rem] font-medium" style={{ color: VERDE }}>
          <Check size={11} aria-hidden /> {m.dispositivo || "Dispositivo não indicado"} · trecho conferido no texto
        </span>
        “{m.citacao}”
      </blockquote>
    </li>
  );
}

function CartaoDaProposta({ p, nomeDoRegime, regimeAtual }: { p: Proposta; nomeDoRegime: string; regimeAtual: unknown }) {
  const validacao = useMemo(() => (p.regime_proposto ? validarRegime(p.regime_proposto) : null), [p.regime_proposto]);
  const c = CLASSIFICACAO[p.classificacao];
  const versao = p.regime_proposto?.versao;
  return (
    <div className="rounded border bg-white px-4 py-3" style={BORDA}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.8125rem] font-medium text-[#0D0D0D]">{nomeDoRegime}</span>
        <Etiqueta texto={c.texto} cor={c.cor} />
        {typeof versao === "number" && <Etiqueta texto={`Proposta da versão ${versao}`} />}
        <span className="ml-auto text-[0.6875rem] text-black/40">
          {p.prestacoes_afetadas === 0 ? "Nenhuma prestação em andamento usa o regime"
            : `${p.prestacoes_afetadas} ${p.prestacoes_afetadas === 1 ? "prestação" : "prestações"} em andamento, de ${p.organizacoes_afetadas} ${p.organizacoes_afetadas === 1 ? "organização" : "organizações"}`}
        </span>
      </div>
      {p.resumo && <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-black/70">{p.resumo}</p>}

      {p.mudancas.length > 0 && (
        <ul className="mt-1 divide-y divide-black/[.06]">
          {p.mudancas.map((m, i) => <Mudanca key={`${m.caminho}:${i}`} m={m} regimeAtual={regimeAtual} />)}
        </ul>
      )}

      {(p.vigencia_proposta || p.transicao?.explicacao) && (
        <p className="mt-2 text-[0.75rem] text-black/60">
          {p.vigencia_proposta && <>Vale a partir de <span className="tabular-nums">{dataBr(p.vigencia_proposta)}</span>. </>}
          {p.transicao?.aplicaEmAndamento === true && "Vale para projetos em andamento. "}
          {p.transicao?.aplicaEmAndamento === false && "Não vale para projetos em andamento. "}
          {p.transicao?.explicacao}
        </p>
      )}

      {validacao && (
        validacao.ok ? (
          <p className="mt-2 flex items-center gap-1 text-[0.6875rem]" style={{ color: VERDE }}>
            <Check size={12} aria-hidden /> A versão proposta passa no schema do regime.
          </p>
        ) : (
          <div className="mt-2 rounded border bg-white px-3 py-2 text-[0.6875rem]" style={{ borderColor: `${VERMELHO}40`, color: VERMELHO }}>
            <p className="flex items-center gap-1 font-medium"><TriangleAlert size={12} aria-hidden /> A versão proposta não passa no schema do regime:</p>
            <ul className="mt-1 list-disc pl-4">{validacao.erros.slice(0, 5).map(e => <li key={e}>{e}</li>)}</ul>
          </div>
        )
      )}

      {p.checagens_novas.length > 0 && (
        <div className="mt-2">
          <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Pediriam uma checagem nova no sistema</p>
          <ul className="mt-1 space-y-1">
            {p.checagens_novas.map((ch, i) => (
              <li key={i} className="text-[0.75rem] text-black/70">
                {ch.descricao} <span className="text-black/45">({ch.dispositivo}{ch.citacaoConferida ? ", trecho conferido" : ", trecho não encontrado no texto"})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(p.status === "nova" || p.status === "em_revisao" || p.status === "aceita") && (
        <Link href={`/admin/regimes/${p.regime_codigo}`}
          className="mt-2 inline-flex items-center gap-1 rounded text-[0.75rem] font-medium text-[#7259B5] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
          {p.status === "aceita" ? "Ver no rascunho do regime" : "Revisar e publicar em Regimes"} <ChevronRight size={13} aria-hidden />
        </Link>
      )}

      {p.descartadas.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer rounded text-[0.6875rem] text-black/50 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            {p.descartadas.length === 1 ? "1 mudança descartada na conferência" : `${p.descartadas.length} mudanças descartadas na conferência`}
          </summary>
          <ul className="mt-1 space-y-1.5">
            {p.descartadas.map((d, i) => (
              <li key={i} className="text-[0.75rem] text-black/60">
                <span className="text-black/80">{rotuloDoCaminho(regimeAtual, d.caminho)}</span>: {d.motivo}.
                {d.citacao && <span className="block text-black/45">Citado: “{d.citacao.slice(0, 240)}{d.citacao.length > 240 ? "…" : ""}”</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PropostasDoDocumento({ propostas, nomes, regimesAtuais, lendo, onLer }: {
  propostas: Proposta[];
  nomes: Record<string, string>;
  /** Parâmetros publicados de cada regime, para dar nome aos caminhos. */
  regimesAtuais: Record<string, unknown>;
  lendo: boolean;
  onLer: () => void;
}) {
  const [aberto, setAberto] = useState(true);
  const botao = "flex h-9 items-center gap-1.5 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

  if (propostas.length === 0) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-dashed px-4 py-3" style={BORDA}>
        <p className="text-[0.75rem] text-black/55">
          {lendo ? "A IA está lendo o documento e comparando com cada regime…" : "Ainda sem proposta. A IA lê o documento e diz o que muda em cada regime, com o trecho da norma."}
        </p>
        <button type="button" onClick={onLer} disabled={lendo} className={botao}>
          <RefreshCw size={13} className={lendo ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
          {lendo ? "Lendo…" : "Propor mudanças"}
        </button>
      </div>
    );
  }

  return (
    <section className="mt-3 space-y-2" aria-label="Propostas da IA">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto}
          className="rounded text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
          Propostas da IA ({propostas.length}) {aberto ? "▾" : "▸"}
        </button>
        <button type="button" onClick={onLer} disabled={lendo} className={botao}>
          <RefreshCw size={13} className={lendo ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
          {lendo ? "Lendo…" : "Ler de novo"}
        </button>
      </div>
      {aberto && propostas.map(p => (
        <CartaoDaProposta key={p.id} p={p} nomeDoRegime={nomes[p.regime_codigo] ?? p.regime_codigo} regimeAtual={regimesAtuais[p.regime_codigo]} />
      ))}
    </section>
  );
}
