"use client";

// O rascunho da versão seguinte (P6.3): o que muda em relação à publicada,
// se passa no schema do regime, a vigência, as aprovações e a publicação.
// Mudança que toca uma regra de bloqueio pede duas pessoas da equipe; mudar o
// rascunho apaga as aprovações. Também aqui entra a mudança feita à mão.

import { useMemo, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { diferencaEntreVersoes, rotuloDoCaminho } from "@/lib/prestacao/regimes/revisao";
import { validarRegime } from "@/lib/prestacao/regimes/schema";
import { lerCaminho, regimeAchatado, type Operacao } from "@/supabase/functions/_shared/proposta-regime";
import {
  AMBAR, Alerta, BORDA, BOTAO_TEXTO, BOTAO_VERDE, CAMPO, EditorDeValor, Etiqueta, ROTULO, VERDE, VERMELHO,
  chamarRota, dataBr, horaBr, textoEmValor, tipoDoValor, valorEmTexto, type TipoDoValor,
} from "./comum";

export type Rascunho = {
  id: string;
  versao: number;
  parametros: Record<string, unknown>;
  aprovacoes: { usuario: string; em: string }[];
  exige_segunda_aprovacao: boolean;
  regras_de_bloqueio: string[];
  notas: string | null;
  vigente_desde: string | null;
};

/** O valor como aparece no regime achatado, sem as aspas do JSON. */
const semAspas = (valor: string | null) => (valor === null ? "—" : valor.startsWith("\"") ? valor.slice(1, -1) : valor);

function MudancaManual({ codigo, base, onFeito }: { codigo: string; base: Record<string, unknown>; onFeito: (mensagem: string) => void }) {
  const caminhos = useMemo(() => regimeAchatado(base).split("\n").map(l => l.slice(0, l.indexOf(" = "))).filter(c => c && !c.endsWith(".fonte")), [base]);
  const [caminho, setCaminho] = useState("");
  const [operacao, setOperacao] = useState<Operacao>("alterar");
  const [texto, setTexto] = useState("");
  const [documento, setDocumento] = useState("");
  const [dispositivo, setDispositivo] = useState("");
  const [citacao, setCitacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const atual = caminho.trim() ? lerCaminho(base, caminho.trim()) : { existe: false, valor: undefined };
  const tipo: TipoDoValor = operacao === "incluir" ? "json" : atual.existe ? tipoDoValor(atual.valor) : "json";

  function escolherCaminho(novo: string) {
    setCaminho(novo);
    const lido = lerCaminho(base, novo.trim());
    if (lido.existe && operacao === "alterar") setTexto(valorEmTexto(lido.valor, tipoDoValor(lido.valor)));
  }

  async function incluir() {
    const lido = operacao === "remover" ? { ok: true as const, valor: null } : textoEmValor(texto, tipo);
    if (!lido.ok) { setErro(tipo === "json" ? "O valor precisa estar em JSON (texto entre aspas, item entre chaves)." : "O valor não está no formato certo."); setErros([]); return; }
    setEnviando(true);
    setErro("");
    const r = await chamarRota(codigo, {
      acao: "rascunho",
      mudancas: [{ operacao, caminho: caminho.trim(), valor: lido.valor, documento, dispositivo, citacao }],
    });
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); setErros(r.erros); return; }
    setCaminho(""); setTexto(""); setCitacao("");
    onFeito(`Mudança incluída no rascunho da versão ${r.dados.versao}.`);
  }

  return (
    <details className="rounded border px-4 py-3" style={BORDA}>
      <summary className="cursor-pointer rounded text-[0.75rem] text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Incluir uma mudança à mão</summary>
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <label className="block">
            <span className={ROTULO}>Parâmetro (caminho no regime)</span>
            <input value={caminho} onChange={e => escolherCaminho(e.target.value)} list={`caminhos-${codigo}`} placeholder="prazos.prestacaoFinal.quantidade"
              className={`${CAMPO} font-mono text-[0.6875rem]`} />
            <datalist id={`caminhos-${codigo}`}>{caminhos.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <div>
            <span className={ROTULO}>O que fazer</span>
            <Dropdown value={operacao} onChange={v => setOperacao(v as Operacao)} ariaLabel="O que fazer"
              options={[{ value: "alterar", label: "Mudar o valor" }, { value: "incluir", label: "Incluir item" }, { value: "remover", label: "Retirar" }]} />
          </div>
        </div>
        {caminho.trim() && (
          <p className="text-[0.6875rem] text-black/50">
            {atual.existe ? <>{rotuloDoCaminho(base, caminho.trim())} · hoje: <span className="text-black/75">{valorEmTexto(atual.valor, tipoDoValor(atual.valor)).slice(0, 200)}</span></> : "Esse caminho não existe no regime: só dá para incluir uma chave nova ou um item numa lista."}
          </p>
        )}
        {operacao !== "remover" && (
          <div>
            <span className={ROTULO}>{operacao === "incluir" ? "Item que entra (JSON)" : "Valor novo"}</span>
            <EditorDeValor tipo={tipo} texto={texto} onChange={setTexto} rotulo="Valor novo" />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={ROTULO}>Documento</span>
            <input value={documento} onChange={e => setDocumento(e.target.value)} maxLength={300} placeholder="Ex.: IN MinC 40/2026" className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>Dispositivo</span>
            <input value={dispositivo} onChange={e => setDispositivo(e.target.value)} maxLength={300} placeholder="Ex.: art. 1º, que altera o art. 69" className={CAMPO} />
          </label>
        </div>
        <label className="block">
          <span className={ROTULO}>Trecho da norma (opcional)</span>
          <textarea value={citacao} onChange={e => setCitacao(e.target.value)} maxLength={400} rows={2} className={`${CAMPO} h-auto py-2`} />
        </label>
        <Alerta erro={erro} erros={erros} />
        <div className="flex justify-end">
          <button type="button" onClick={incluir} disabled={enviando || !caminho.trim() || !documento.trim() || !dispositivo.trim()} className={BOTAO_VERDE}>
            {enviando ? "Incluindo…" : "Incluir no rascunho"}
          </button>
        </div>
      </div>
    </details>
  );
}

export function RascunhoDoRegime({ codigo, rascunho, publicado, usuarioId, onFeito }: {
  codigo: string;
  rascunho: Rascunho | null;
  publicado: { versao: number; parametros: Record<string, unknown> };
  usuarioId: string | null;
  onFeito: (mensagem: string) => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const diferencas = useMemo(() => (rascunho ? diferencaEntreVersoes(publicado.parametros, rascunho.parametros) : []), [rascunho, publicado]);
  const validacao = useMemo(() => (rascunho ? validarRegime(rascunho.parametros) : null), [rascunho]);
  const [vigencia, setVigencia] = useState(rascunho?.vigente_desde ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<string[]>([]);

  if (!rascunho) {
    return (
      <section className="space-y-2" aria-labelledby="titulo-rascunho">
        <h2 id="titulo-rascunho" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Versão {publicado.versao + 1}</h2>
        <p className="text-[0.75rem] text-black/55">Sem rascunho. Leve uma proposta ou inclua uma mudança à mão para começar a versão seguinte.</p>
        <MudancaManual codigo={codigo} base={publicado.parametros} onFeito={onFeito} />
      </section>
    );
  }

  const aprovouEu = rascunho.aprovacoes.some(a => a.usuario === usuarioId);
  const faltam = rascunho.exige_segunda_aprovacao ? 2 - rascunho.aprovacoes.length : 1 - rascunho.aprovacoes.length;
  const rotuloAprovar = rascunho.exige_segunda_aprovacao
    ? rascunho.aprovacoes.length === 0 ? "Aprovar (1 de 2)" : "Aprovar e publicar (2 de 2)"
    : "Aprovar e publicar";

  async function agir(corpo: Record<string, unknown>, mensagem: (dados: Record<string, unknown>) => string) {
    setEnviando(true);
    setErro("");
    const r = await chamarRota(codigo, corpo);
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); setErros(r.erros); return; }
    onFeito(mensagem(r.dados));
  }

  return (
    <section className="space-y-3 rounded border bg-white px-5 py-4" style={BORDA} aria-labelledby="titulo-rascunho">
      <div className="flex flex-wrap items-center gap-1.5">
        <h2 id="titulo-rascunho" className="text-[0.875rem] font-semibold text-[#0D0D0D]">Rascunho da versão {rascunho.versao}</h2>
        {rascunho.exige_segunda_aprovacao && <Etiqueta texto="Pede duas aprovações" cor={AMBAR} />}
      </div>

      {rascunho.exige_segunda_aprovacao && (
        <p className="text-[0.75rem] text-black/60">
          Muda regra que bloqueia o envio da prestação: {rascunho.regras_de_bloqueio.map(r => rotuloDoCaminho(rascunho.parametros, r)).join("; ")}. Outra pessoa da equipe aprova depois de você.
        </p>
      )}
      {rascunho.notas && <p className="text-[0.75rem] text-black/60">Nota: {rascunho.notas}</p>}

      {diferencas.length === 0 ? (
        <p className="text-[0.75rem] text-black/55">O rascunho ainda é igual à versão publicada.</p>
      ) : (
        <ul className="divide-y divide-black/[.06] border-y" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          {diferencas.map(d => {
            const fonte = d.caminho.endsWith(".fonte");
            return (
              <li key={d.caminho} className="grid gap-1 py-2 text-[0.75rem] md:grid-cols-[1fr_1fr_1fr] md:gap-4">
                <span className="text-black/50">{fonte ? `Fonte de ${rotuloDoCaminho(rascunho.parametros, d.caminho.slice(0, -6))}` : rotuloDoCaminho(rascunho.parametros, d.caminho)}</span>
                <span className="text-black/45 line-through decoration-black/25">{semAspas(d.antes)}</span>
                <span className="font-medium text-[#0D0D0D]">{semAspas(d.depois)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {validacao && (validacao.ok ? (
        <p className="flex items-center gap-1 text-[0.6875rem]" style={{ color: VERDE }}><Check size={12} aria-hidden /> Passa no schema do regime.</p>
      ) : (
        <div className="rounded border bg-white px-3 py-2 text-[0.6875rem]" style={{ borderColor: `${VERMELHO}40`, color: VERMELHO }}>
          <p className="flex items-center gap-1 font-medium"><TriangleAlert size={12} aria-hidden /> Não passa no schema do regime:</p>
          <ul className="mt-1 list-disc pl-4">{validacao.erros.slice(0, 8).map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className={ROTULO}>Vale a partir de</span>
          <input type="date" value={vigencia} onChange={e => setVigencia(e.target.value)} className={`${CAMPO} w-[11rem] tabular-nums`} />
        </label>
        <button type="button" disabled={enviando || vigencia === (rascunho.vigente_desde ?? "")}
          onClick={() => agir({ acao: "rascunho", vigenteDesde: vigencia || null }, () => "Vigência salva no rascunho.")}
          className="h-10 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
          Salvar a vigência
        </button>
      </div>

      <MudancaManual codigo={codigo} base={rascunho.parametros} onFeito={onFeito} />

      {rascunho.aprovacoes.length > 0 && (
        <ul className="space-y-0.5 text-[0.6875rem] text-black/55">
          {rascunho.aprovacoes.map(a => (
            <li key={a.usuario} className="flex items-center gap-1"><Check size={11} style={{ color: VERDE }} aria-hidden />
              Aprovada por {a.usuario === usuarioId ? "você" : "outra pessoa da equipe"} em {horaBr(a.em)}</li>
          ))}
        </ul>
      )}

      <Alerta erro={erro} erros={erros} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <button type="button" disabled={enviando}
          onClick={() => confirmDelete({
            title: "Descartar o rascunho?",
            description: `As mudanças da versão ${rascunho.versao} saem; as propostas levadas a ele voltam para revisar.`,
            confirmLabel: "Descartar",
            onConfirm: () => agir({ acao: "descartar" }, () => "Rascunho descartado."),
          })}
          className={`${BOTAO_TEXTO} text-[#B23B3B] hover:text-[#B23B3B]`}>
          Descartar rascunho
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {rascunho.vigente_desde && <span className="text-[0.6875rem] text-black/45">Vale a partir de {dataBr(rascunho.vigente_desde)}</span>}
          {aprovouEu ? (
            <span className="text-[0.75rem] text-black/55">Aguardando outra pessoa da equipe</span>
          ) : (
            <button type="button" disabled={enviando || !validacao?.ok || diferencas.length === 0 || faltam <= 0}
              onClick={() => agir({ acao: "aprovar" }, dados => dados.situacao === "publicado"
                ? `Versão ${dados.versao} publicada. As prestações continuam na versão que usam até serem passadas para a nova.`
                : `Versão ${dados.versao} aprovada por você. Outra pessoa da equipe foi avisada para a segunda aprovação.`)}
              className={BOTAO_VERDE}>
              {enviando ? "Salvando…" : rotuloAprovar}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
