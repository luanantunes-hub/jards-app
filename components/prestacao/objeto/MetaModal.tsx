"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { erroDaMeta, LIMITE_JUSTIFICATIVA_META, numeroDigitado } from "@/lib/prestacao/objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoMeta } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

const textoDoNumero = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

/** Agrupador do orçamento a que a meta pode se ligar (meta, produto, etapa…). */
export type AgrupadorParaMeta = { id: string; rotulo: string };

/** Cria ou edita uma meta: o previsto primeiro; o resultado e a justificativa logo abaixo. */
export function MetaModal({ prestacaoId, meta, agrupadores, onClose, onSaved }: {
  prestacaoId: string;
  meta: PrestacaoMeta | null;
  agrupadores: readonly AgrupadorParaMeta[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [descricao, setDescricao] = useState(meta?.descricao ?? "");
  const [unidade, setUnidade] = useState(meta?.unidade ?? "");
  const [previsto, setPrevisto] = useState(textoDoNumero(meta?.previsto));
  const [realizado, setRealizado] = useState(textoDoNumero(meta?.realizado));
  const [justificativa, setJustificativa] = useState(meta?.justificativa ?? "");
  const [noId, setNoId] = useState(meta?.no_id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const previstoNum = numeroDigitado(previsto);
  const realizadoNum = numeroDigitado(realizado);
  const abaixo = previstoNum !== null && realizadoNum !== null && realizadoNum < previstoNum;
  const mostrarJustificativa = abaixo || justificativa.trim().length > 0;

  async function salvar() {
    const campos = {
      descricao: descricao.trim(),
      unidade: unidade.trim() || null,
      previsto: previstoNum ?? NaN,
      realizado: realizadoNum,
      justificativa: justificativa.trim() || null,
    };
    const problema = erroDaMeta(campos);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do objeto ainda não estão no tipo Database
    const tabela = (supabase as any).from("prestacao_metas");
    const linha = { ...campos, no_id: noId || null };
    const { error } = meta
      ? await tabela.update(linha).eq("id", meta.id)
      : await tabela.insert({ ...linha, prestacao_id: prestacaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a meta")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={meta ? "Editar meta" : "Nova meta"}
      subtitulo="O relatório do objeto compara o previsto com o realizado"
      onClose={onClose}
      largura="max-w-[34rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {meta ? "Salvar" : "Criar meta"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ROTULO}>Meta</span>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ex.: Oficinas de iniciação musical em escolas públicas"
            className={AREA}
            autoFocus
          />
        </label>
        <label>
          <span className={ROTULO}>Previsto</span>
          <input value={previsto} onChange={e => setPrevisto(e.target.value)} inputMode="decimal" placeholder="6" className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Unidade</span>
          <input value={unidade} onChange={e => setUnidade(e.target.value)} maxLength={60} placeholder="oficinas, pessoas, exemplares" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Realizado</span>
          <input value={realizado} onChange={e => setRealizado(e.target.value)} inputMode="decimal" placeholder="Em branco até o resultado" className={`${CAMPO} tabular-nums`} />
        </label>
        {agrupadores.length > 0 && (
          <label>
            <span className={ROTULO}>No orçamento (opcional)</span>
            <Dropdown
              value={noId}
              onChange={setNoId}
              ariaLabel="Agrupador do orçamento"
              options={[{ value: "", label: "Sem ligação" }, ...agrupadores.map(a => ({ value: a.id, label: a.rotulo }))]}
            />
          </label>
        )}
        {mostrarJustificativa && (
          <label className="sm:col-span-2">
            <span className={ROTULO}>
              Justificativa{abaixo ? " — o realizado ficou abaixo do previsto" : ""}
            </span>
            <textarea
              value={justificativa}
              onChange={e => { setJustificativa(e.target.value); setErro(""); }}
              rows={3}
              maxLength={LIMITE_JUSTIFICATIVA_META}
              placeholder="O que aconteceu e o que foi feito no lugar"
              className={AREA}
            />
          </label>
        )}
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
