"use client";

// Revisão de uma proposta da IA (P6.3): a equipe escolhe quais mudanças levar
// ao rascunho, corrige o valor quando a IA errou, ajusta a vigência e leva;
// ou rejeita a proposta inteira, com o motivo. O trecho da norma de cada
// mudança foi conferido no texto na leitura (P6.2).

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { rotuloDoCaminho, valorLegivel } from "@/lib/prestacao/regimes/revisao";
import type { MudancaConferida } from "@/supabase/functions/_shared/proposta-regime";
import {
  AMBAR, Alerta, BORDA, BOTAO_TEXTO, BOTAO_VERDE, CAMPO, EditorDeValor, Etiqueta, ROTULO, VERDE,
  chamarRota, dataBr, textoEmValor, tipoDoValor, valorEmTexto,
} from "./comum";

export type PropostaParaRevisar = {
  id: string;
  classificacao: "irrelevante" | "informativo" | "altera_regra";
  resumo: string | null;
  mudancas: MudancaConferida[];
  vigencia_proposta: string | null;
  transicao: { aplicaEmAndamento?: boolean | null; explicacao?: string };
  prestacoes_afetadas: number;
  created_at: string;
  documento: { titulo: string | null; url: string | null; tipo_ato: string | null; publicado_em: string } | null;
};

const CLASSIFICACAO = {
  altera_regra: { texto: "Muda regras", cor: AMBAR },
  informativo: { texto: "Informativo", cor: "#2D72B0" },
  irrelevante: { texto: "Sem relação", cor: "#6B6B6B" },
} as const;

export function RevisaoDaProposta({ codigo, proposta, regimeBase, temRascunho, onFeito }: {
  codigo: string;
  proposta: PropostaParaRevisar;
  /** O regime sobre o qual as mudanças entram (o rascunho, se houver, ou o publicado). */
  regimeBase: unknown;
  temRascunho: boolean;
  onFeito: (mensagem: string) => void;
}) {
  const tipos = proposta.mudancas.map(m => tipoDoValor(m.operacao === "remover" ? m.valorAtual : m.valorProposto));
  const [incluir, setIncluir] = useState(() => proposta.mudancas.map(() => true));
  const [textos, setTextos] = useState(() => proposta.mudancas.map((m, i) => valorEmTexto(m.valorProposto, tipos[i])));
  const [vigencia, setVigencia] = useState(proposta.vigencia_proposta ?? "");
  const [nota, setNota] = useState("");
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState(proposta.classificacao === "altera_regra" ? "" : "Nada muda nas regras do regime.");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const c = CLASSIFICACAO[proposta.classificacao];
  const documento = proposta.documento?.titulo ?? "Documento sem título";
  const escolhidas = incluir.filter(Boolean).length;

  async function levar() {
    const mudancas = [];
    for (const [i, m] of proposta.mudancas.entries()) {
      if (!incluir[i]) continue;
      const lido = m.operacao === "remover" ? { ok: true as const, valor: null } : textoEmValor(textos[i], tipos[i]);
      if (!lido.ok) { setErro(`O valor de "${rotuloDoCaminho(regimeBase, m.caminho)}" não está no formato certo.`); setErros([]); return; }
      mudancas.push({
        operacao: m.operacao, caminho: m.caminho, valor: lido.valor, documento, dispositivo: m.dispositivo,
        citacao: m.citacao, aConfirmar: m.aConfirmar,
      });
    }
    setEnviando(true);
    setErro("");
    const r = await chamarRota(codigo, {
      acao: "rascunho", propostaId: proposta.id, mudancas,
      ...(vigencia ? { vigenteDesde: vigencia } : {}), ...(nota.trim() ? { notas: nota.trim() } : {}),
    });
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); setErros(r.erros); return; }
    const regras = (r.dados.regrasDeBloqueio as string[] | undefined) ?? [];
    onFeito(`${escolhidas === 1 ? "A mudança foi" : `${escolhidas} mudanças foram`} para o rascunho da versão ${r.dados.versao}.${regras.length ? " Ela muda regra que bloqueia o envio: a publicação pede duas pessoas." : ""}`);
  }

  async function rejeitar() {
    setEnviando(true);
    setErro("");
    const r = await chamarRota(codigo, { acao: "rejeitar", propostaId: proposta.id, motivo });
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); setErros(r.erros); return; }
    onFeito(proposta.classificacao === "altera_regra" ? "Proposta rejeitada." : "Proposta arquivada.");
  }

  return (
    <article className="rounded border bg-white px-5 py-4" style={BORDA}>
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-[0.8125rem] font-semibold text-[#0D0D0D]">{documento}</h3>
        <Etiqueta texto={c.texto} cor={c.cor} />
        {proposta.documento?.url && (
          <a href={proposta.documento.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/50 underline decoration-black/20 underline-offset-2 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Abrir a norma <ExternalLink size={11} aria-hidden />
          </a>
        )}
        <span className="ml-auto text-[0.6875rem] text-black/40">
          {proposta.documento ? `${proposta.documento.tipo_ato ?? "Documento"} de ${dataBr(proposta.documento.publicado_em)} · ` : ""}lida em {dataBr(proposta.created_at)}
        </span>
      </div>
      {proposta.resumo && <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-black/70">{proposta.resumo}</p>}

      {proposta.mudancas.length > 0 && (
        <ul className="mt-2 divide-y divide-black/[.06] border-y" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          {proposta.mudancas.map((m, i) => (
            <li key={`${m.caminho}:${i}`} className="grid gap-3 py-3 md:grid-cols-[auto_1fr_16rem]">
              <label className="flex items-start gap-2 pt-0.5">
                <input type="checkbox" checked={incluir[i]} onChange={e => setIncluir(atual => atual.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="mt-0.5 h-4 w-4 accent-[#7259B5]" aria-label={`Levar ao rascunho: ${rotuloDoCaminho(regimeBase, m.caminho)}`} />
              </label>
              <div className="min-w-0 space-y-1">
                <p className="text-[0.6875rem] text-black/45">{rotuloDoCaminho(regimeBase, m.caminho)}</p>
                <p className="text-[0.75rem] text-black/60">
                  Hoje: <span className="text-black/80">{valorLegivel(m.valorAtual)}</span>
                  {m.aConfirmar && <span className="ml-2 align-middle"><Etiqueta texto="A confirmar" cor={AMBAR} /></span>}
                </p>
                {m.explicacao && <p className="text-[0.75rem] text-black/60">{m.explicacao}</p>}
                <blockquote className="border-l-2 pl-3 text-[0.75rem] leading-relaxed text-black/70" style={{ borderColor: VERDE }}>
                  <span className="mb-0.5 flex items-center gap-1 text-[0.625rem] font-medium" style={{ color: VERDE }}>
                    <Check size={11} aria-hidden /> {m.dispositivo || "Dispositivo não indicado"} · trecho conferido no texto
                  </span>
                  “{m.citacao}”
                </blockquote>
              </div>
              <div className={incluir[i] ? "" : "opacity-50"}>
                {m.operacao === "remover" ? (
                  <p className="text-[0.75rem] text-black/60">Sai do regime.</p>
                ) : (
                  <>
                    <span className={ROTULO}>{m.operacao === "incluir" ? "Item que entra" : "Passa a ser"}</span>
                    <EditorDeValor tipo={tipos[i]} texto={textos[i]} rotulo={`Valor novo de ${rotuloDoCaminho(regimeBase, m.caminho)}`}
                      onChange={t => setTextos(atual => atual.map((v, j) => (j === i ? t : v)))} />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(proposta.transicao?.explicacao || proposta.prestacoes_afetadas > 0) && (
        <p className="mt-2 text-[0.75rem] text-black/60">
          {proposta.transicao?.explicacao}{" "}
          {proposta.prestacoes_afetadas > 0 && `${proposta.prestacoes_afetadas} ${proposta.prestacoes_afetadas === 1 ? "prestação em andamento usa" : "prestações em andamento usam"} o regime.`}
        </p>
      )}

      {proposta.mudancas.length > 0 && !rejeitando && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]">
          <label className="block">
            <span className={ROTULO}>Vale a partir de</span>
            <input type="date" value={vigencia} onChange={e => setVigencia(e.target.value)} className={`${CAMPO} tabular-nums`} />
          </label>
          <label className="block">
            <span className={ROTULO}>Nota da revisão (opcional)</span>
            <input value={nota} onChange={e => setNota(e.target.value)} maxLength={2000} placeholder="O que foi corrigido e por quê" className={CAMPO} />
          </label>
        </div>
      )}

      {rejeitando && (
        <label className="mt-3 block">
          <span className={ROTULO}>{proposta.classificacao === "altera_regra" ? "Por que rejeitar" : "Por que arquivar"}</span>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={2000} placeholder="Ex.: a portaria trata de emendas, não da lei de incentivo" className={CAMPO} autoFocus />
        </label>
      )}

      <div className="mt-3 space-y-2">
        <Alerta erro={erro} erros={erros} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {rejeitando ? (
            <>
              <button type="button" onClick={() => setRejeitando(false)} disabled={enviando} className={BOTAO_TEXTO}>Voltar</button>
              <button type="button" onClick={rejeitar} disabled={enviando || motivo.trim().length < 5}
                className="h-10 rounded border border-[#B23B3B]/40 bg-white px-4 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-[#B23B3B]/[.04] focus-visible:outline-2 focus-visible:outline-[#B23B3B] disabled:opacity-50">
                {proposta.classificacao === "altera_regra" ? "Rejeitar a proposta" : "Arquivar"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setRejeitando(true)} disabled={enviando} className={BOTAO_TEXTO}>
                {proposta.classificacao === "altera_regra" ? "Rejeitar" : "Arquivar"}
              </button>
              {proposta.mudancas.length > 0 && (
                <button type="button" onClick={levar} disabled={enviando || escolhidas === 0} className={BOTAO_VERDE}>
                  {enviando ? "Levando…" : temRascunho ? "Levar ao rascunho" : "Começar o rascunho"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
