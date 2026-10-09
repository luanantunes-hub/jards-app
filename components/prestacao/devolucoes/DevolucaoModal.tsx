"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import {
  atualizacaoContinuaValida,
  competenciaDe,
  devolucaoDoRegime,
  erroDaDevolucao,
  MOTIVOS_DEVOLUCAO,
  ROTULO_DO_INDICE,
  indiceDoMotivo,
  type GuiaDoRegime,
  type IndiceDevolucao,
  type MotivoDevolucao,
} from "@/lib/prestacao/devolucoes";
import { numeroDigitado } from "@/lib/prestacao/objeto";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoDevolucao } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const BOTAO_SECUNDARIO = "flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40";

const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const hojeIso = () => new Date().toLocaleDateString("sv-SE");

/** Como abrir o formulário: devolução nova (com sugestão) ou edição; "pagar" já abre no pagamento. */
export type InicioDaDevolucao = { motivo?: MotivoDevolucao; valor?: number | null; pagar?: boolean };

/**
 * Registra ou edita uma devolução: o motivo e o valor, a guia (com os campos
 * do regime já preenchidos), a atualização e, quando paga, a data, o valor e
 * o comprovante.
 */
export function DevolucaoModal({ prestacaoId, organizationId, regime, guias, referencia, devolucao, inicio, onClose, onSaved }: {
  prestacaoId: string;
  organizationId: string | null;
  regime: RegimeNormativo | null;
  guias: readonly GuiaDoRegime[];
  /** Número de referência sugerido (o identificador oficial só com letras e algarismos). */
  referencia: string | null;
  devolucao: PrestacaoDevolucao | null;
  inicio?: InicioDaDevolucao;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const motivoInicial = devolucao?.motivo ?? inicio?.motivo ?? "saldo";
  const guiaInicial = guias[0] ?? null;
  const [motivo, setMotivo] = useState<MotivoDevolucao>(motivoInicial);
  const [valor, setValor] = useState(texto(devolucao?.valor_principal ?? inicio?.valor ?? null));
  const [indice, setIndice] = useState<IndiceDevolucao>(devolucao?.indice ?? indiceDoMotivo(regime, motivoInicial));
  const [dataBase, setDataBase] = useState(devolucao?.data_base ?? "");
  const [valorAtualizado, setValorAtualizado] = useState(devolucao && devolucao.indice !== "poupanca" ? texto(devolucao.valor_atualizado) : "");
  const [atualizadoAte, setAtualizadoAte] = useState(devolucao && devolucao.indice !== "poupanca" ? devolucao.atualizado_ate ?? "" : "");
  const [ug, setUg] = useState(devolucao ? devolucao.gru_unidade_gestora ?? "" : guiaInicial?.unidadeGestora ?? "");
  const [gestao, setGestao] = useState(devolucao ? devolucao.gru_gestao ?? "" : guiaInicial?.gestao ?? "");
  const [codigo, setCodigo] = useState(devolucao ? devolucao.gru_codigo ?? "" : guiaInicial?.codigo ?? "");
  const [numeroReferencia, setNumeroReferencia] = useState(devolucao ? devolucao.gru_referencia ?? "" : referencia ?? "");
  const [competencia, setCompetencia] = useState(devolucao ? devolucao.competencia ?? "" : competenciaDe(hojeIso()));
  const [vencimento, setVencimento] = useState(devolucao?.vencimento ?? "");
  const [paga, setPaga] = useState(devolucao?.situacao === "paga" || Boolean(inicio?.pagar));
  const total = devolucao?.valor_atualizado ?? devolucao?.valor_principal ?? null;
  const [pagoEm, setPagoEm] = useState(devolucao?.pago_em ?? (inicio?.pagar ? hojeIso() : ""));
  const [valorPago, setValorPago] = useState(texto(devolucao?.valor_pago ?? (inicio?.pagar ? total : null)));
  const [comprovante, setComprovante] = useState<{ path: string | null; nome: string | null; novo: File | null }>({ path: devolucao?.storage_path ?? null, nome: devolucao?.nome_arquivo ?? null, novo: null });
  const [descricao, setDescricao] = useState(devolucao?.descricao ?? "");
  const [observacoes, setObservacoes] = useState(devolucao?.observacoes ?? "");
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(devolucao?.descricao || devolucao?.observacoes));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  const guiaEscolhida = guias.findIndex(g => g.unidadeGestora === ug && g.codigo === codigo && (g.gestao ?? "") === gestao);
  const aConfirmar = guias.some(g => g.fonte.aConfirmar);
  const atualizacaoDoRegime = devolucaoDoRegime(regime)?.atualizacao ?? null;

  function escolherMotivo(m: MotivoDevolucao) {
    setMotivo(m);
    setIndice(indiceDoMotivo(regime, m));
  }

  function escolherGuia(i: number) {
    const g = guias[i];
    if (!g) return;
    setUg(g.unidadeGestora);
    setGestao(g.gestao ?? "");
    setCodigo(g.codigo);
  }

  async function abrir(path: string) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o comprovante${error ? `: ${error.message}` : ""}.`);
  }

  async function salvar() {
    const principal = numeroDigitado(valor);
    const comIndice = indice !== "nenhum";
    const campos = {
      motivo,
      descricao: descricao.trim() || null,
      valor_principal: principal ?? NaN,
      indice,
      data_base: comIndice ? dataBase || null : null,
      competencia: competencia.trim() || null,
      vencimento: vencimento || null,
      situacao: paga ? "paga" as const : "a_pagar" as const,
      pago_em: paga ? pagoEm || null : null,
      valor_pago: paga ? numeroDigitado(valorPago) : null,
      observacoes: observacoes.trim() || null,
    };
    const problema = erroDaDevolucao(campos);
    if (problema) { setErro(problema); return; }

    // Atualização: a da poupança vem do botão na lista e vale enquanto principal,
    // índice e data-base não mudam; SELIC e outros índices são informados aqui.
    let atualizacao: Pick<PrestacaoDevolucao, "atualizado_ate" | "fator" | "valor_atualizado"> = { atualizado_ate: null, fator: null, valor_atualizado: null };
    if (indice === "poupanca" && devolucao && atualizacaoContinuaValida(devolucao, campos)) {
      atualizacao = { atualizado_ate: devolucao.atualizado_ate, fator: devolucao.fator, valor_atualizado: devolucao.valor_atualizado };
    } else if (comIndice && indice !== "poupanca" && valorAtualizado.trim()) {
      const atualizado = numeroDigitado(valorAtualizado);
      if (atualizado === null || !Number.isFinite(atualizado)) { setErro("Confira o valor atualizado: use só números, como 1.532,10."); return; }
      if (Math.round(atualizado * 100) < Math.round(campos.valor_principal * 100)) { setErro("O valor atualizado não fica abaixo do principal."); return; }
      if (!atualizadoAte) { setErro("Informe até quando o valor foi atualizado."); return; }
      if (campos.data_base && atualizadoAte < campos.data_base) { setErro("A atualização não vem antes da data-base."); return; }
      atualizacao = { atualizado_ate: atualizadoAte, fator: Number((atualizado / campos.valor_principal).toFixed(10)), valor_atualizado: atualizado };
    }

    if (comprovante.novo && !organizationId) { setErro("Aguarde: a organização da prestação ainda está carregando."); return; }
    setSalvando(true);
    setErro("");
    let enviado: string | null = null;
    try {
      let arquivo = { storage_path: comprovante.path, nome_arquivo: comprovante.nome, mime_type: comprovante.path ? devolucao?.mime_type ?? null : null };
      if (comprovante.novo) {
        const caminho = montarCaminhoPrestacao({ organizationId: organizationId!, prestacaoId, pasta: { tipo: "devolucoes" }, nomeOriginal: comprovante.novo.name });
        const { error } = await supabase.storage.from("documentos").upload(caminho, comprovante.novo, { upsert: false, contentType: comprovante.novo.type || undefined });
        if (error) throw new Error(`Não foi possível enviar "${comprovante.novo.name}": ${error.message}`);
        enviado = caminho;
        arquivo = { storage_path: caminho, nome_arquivo: comprovante.novo.name, mime_type: comprovante.novo.type || null };
      }
      const linha = {
        ...campos,
        ...atualizacao,
        ...arquivo,
        gru_unidade_gestora: ug.trim() || null,
        gru_gestao: gestao.trim() || null,
        gru_codigo: codigo.trim() || null,
        gru_referencia: numeroReferencia.trim() || null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_devolucoes ainda não está no tipo Database
      const tabela = (supabase as any).from("prestacao_devolucoes");
      const { error } = devolucao
        ? await tabela.update(linha).eq("id", devolucao.id)
        : await tabela.insert({ ...linha, prestacao_id: prestacaoId });
      if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível salvar a devolução"));
      // Gravado: o comprovante trocado ou tirado deixa o bucket.
      if (devolucao?.storage_path && devolucao.storage_path !== linha.storage_path) await supabase.storage.from("documentos").remove([devolucao.storage_path]);
      setSalvando(false);
      onSaved();
    } catch (e) {
      if (enviado) await supabase.storage.from("documentos").remove([enviado]);
      setSalvando(false);
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a devolução.");
    }
  }

  const nomeDoComprovante = comprovante.novo?.name ?? comprovante.nome;

  return (
    <ModalPrestacao
      titulo={devolucao ? "Editar devolução" : "Nova devolução"}
      subtitulo="Guia de recolhimento, atualização e pagamento"
      onClose={onClose}
      largura="max-w-[40rem]"
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
            {devolucao ? "Salvar" : "Registrar devolução"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div>
          <span className={ROTULO}>Motivo</span>
          <Dropdown value={motivo} onChange={v => escolherMotivo(v as MotivoDevolucao)} ariaLabel="Motivo" options={MOTIVOS_DEVOLUCAO.map(m => ({ value: m.id, label: m.rotulo }))} />
        </div>
        <label>
          <span className={ROTULO}>Valor a devolver (R$)</span>
          <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${CAMPO} tabular-nums`} autoFocus={!devolucao && !inicio?.valor} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Guia</legend>
          {guias.length > 1 && (
            <div className="mb-3">
              <Dropdown
                value={guiaEscolhida >= 0 ? String(guiaEscolhida) : ""}
                onChange={v => escolherGuia(Number(v))}
                ariaLabel="Guia do regime"
                placeholder="Outra guia"
                options={guias.map((g, i) => ({ value: String(i), label: `${g.codigo} · ${g.fonte.nota ?? g.referencia}` }))}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label>
              <span className={ROTULO}>Unidade gestora</span>
              <input value={ug} onChange={e => setUg(e.target.value)} maxLength={20} className={`${CAMPO} tabular-nums`} />
            </label>
            <label>
              <span className={ROTULO}>Gestão</span>
              <input value={gestao} onChange={e => setGestao(e.target.value)} maxLength={20} placeholder="—" className={`${CAMPO} tabular-nums`} />
            </label>
            <label>
              <span className={ROTULO}>Código</span>
              <input value={codigo} onChange={e => setCodigo(e.target.value)} maxLength={20} className={`${CAMPO} tabular-nums`} />
            </label>
            <label>
              <span className={ROTULO}>Referência</span>
              <input value={numeroReferencia} onChange={e => setNumeroReferencia(e.target.value)} maxLength={60} className={`${CAMPO} tabular-nums`} />
            </label>
          </div>
          {aConfirmar && (
            <p className="mt-2 text-[0.6875rem] text-[#B07A14]">A unidade gestora e o código deste regime ainda estão a confirmar com o órgão: confira antes de emitir.</p>
          )}
          {guias.length === 0 && (
            <p className="mt-2 text-[0.6875rem] text-black/45">O regime não fixa a guia: use os campos que o órgão informar.</p>
          )}
        </fieldset>

        <label>
          <span className={ROTULO}>Competência (MM/AAAA)</span>
          <input value={competencia} onChange={e => setCompetencia(e.target.value)} maxLength={7} placeholder="10/2026" className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Vencimento</span>
          <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Atualização</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Dropdown value={indice} onChange={v => setIndice(v as IndiceDevolucao)} ariaLabel="Índice de atualização" options={(Object.keys(ROTULO_DO_INDICE) as IndiceDevolucao[]).map(i => ({ value: i, label: ROTULO_DO_INDICE[i] }))} />
            {indice !== "nenhum" && (
              <label>
                <span className="sr-only">Data-base</span>
                <input type="date" value={dataBase} onChange={e => setDataBase(e.target.value)} aria-label="Data-base" className={`${CAMPO} tabular-nums`} />
              </label>
            )}
          </div>
          {indice !== "nenhum" && atualizacaoDoRegime && <p className="mt-2 text-[0.6875rem] text-black/45">No regime: {atualizacaoDoRegime}</p>}
          {indice === "poupanca" && <p className="mt-1 text-[0.6875rem] text-black/45">O valor atualizado sai da série do Banco Central, em &quot;Atualizar até hoje&quot; na lista.</p>}
          {indice !== "nenhum" && indice !== "poupanca" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label>
                <span className={ROTULO}>Valor atualizado (R$)</span>
                <input value={valorAtualizado} onChange={e => setValorAtualizado(e.target.value)} inputMode="decimal" placeholder="Pela calculadora do órgão" className={`${CAMPO} tabular-nums`} />
              </label>
              <label>
                <span className={ROTULO}>Atualizado até</span>
                <input type="date" value={atualizadoAte} onChange={e => setAtualizadoAte(e.target.value)} className={`${CAMPO} tabular-nums`} />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Pagamento</legend>
          <div role="radiogroup" aria-label="Situação da guia" className="inline-flex rounded border bg-white p-0.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {[{ v: false, r: "A pagar" }, { v: true, r: "Paga" }].map(o => (
              <button
                key={o.r}
                type="button"
                role="radio"
                aria-checked={paga === o.v}
                onClick={() => {
                  setPaga(o.v);
                  if (o.v && !pagoEm) setPagoEm(hojeIso());
                  if (o.v && !valorPago.trim()) {
                    const atualizado = indice !== "nenhum" && indice !== "poupanca" ? numeroDigitado(valorAtualizado) : devolucao?.valor_atualizado ?? null;
                    setValorPago(texto(atualizado ?? numeroDigitado(valor)));
                  }
                }}
                className="h-8 rounded px-3 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                style={paga === o.v ? { background: "#684DB0", color: "#fff" } : { color: "rgba(13,13,13,.6)" }}
              >
                {o.r}
              </button>
            ))}
          </div>
          {paga && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label>
                <span className={ROTULO}>Pago em</span>
                <input type="date" value={pagoEm} onChange={e => setPagoEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
              </label>
              <label>
                <span className={ROTULO}>Valor pago (R$)</span>
                <input value={valorPago} onChange={e => setValorPago(e.target.value)} inputMode="decimal" className={`${CAMPO} tabular-nums`} />
              </label>
              <div>
                <span className={ROTULO}>Comprovante</span>
                <input
                  ref={entrada}
                  type="file"
                  accept="application/pdf,image/*"
                  className="sr-only"
                  aria-label="Comprovante do pagamento"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setComprovante(c => ({ ...c, novo: f })); e.target.value = ""; }}
                />
                {nomeDoComprovante ? (
                  <div className="flex h-10 min-w-0 items-center gap-1.5">
                    {comprovante.path && !comprovante.novo
                      ? <button type="button" onClick={() => abrir(comprovante.path!)} className="min-w-0 truncate text-left text-[0.6875rem] text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]">{nomeDoComprovante}</button>
                      : <span className="min-w-0 truncate text-[0.6875rem] text-black/65">{nomeDoComprovante}</span>}
                    <button type="button" onClick={() => setComprovante({ path: null, nome: null, novo: null })} aria-label="Tirar comprovante" className="shrink-0 rounded p-1 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => entrada.current?.click()} className={`${BOTAO_SECUNDARIO} h-10`} style={{ borderColor: "rgba(13,13,13,.14)" }}>
                    <Paperclip size={12} aria-hidden /> Anexar
                  </button>
                )}
              </div>
            </div>
          )}
        </fieldset>

        <div className="sm:col-span-2">
          <button
            type="button"
            aria-expanded={maisDetalhes}
            onClick={() => setMaisDetalhes(v => !v)}
            className="flex items-center gap-1 rounded text-[0.6875rem] text-black/55 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
          >
            <ChevronDown size={12} className={`transition-transform motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} aria-hidden /> Mais detalhes
          </button>
          {maisDetalhes && (
            <div className="mt-3 grid gap-3">
              <label>
                <span className={ROTULO}>Descrição</span>
                <input value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={500} placeholder="Ex.: saldo da conta de movimentação no encerramento" className={CAMPO} />
              </label>
              <label>
                <span className={ROTULO}>Observações</span>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} maxLength={1000} rows={3} className={AREA} />
              </label>
            </div>
          )}
        </div>

        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
