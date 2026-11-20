"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, ROTULO } from "@/components/ticketeria/FolhasDosEventos";
import {
  MAX_BYTES_DO_ARQUIVO, ROTULO_DO_TIPO, adivinharColunas, consolidarGastos, consolidarVendas, importacoesQueSeSobrepoem, lerCsv, modeloDeCsv,
  type CorpoDaImportacao, type ImportacaoDaLista, type MapaDeColunas, type TipoDeHistorico,
} from "@/lib/ticketeria/historico";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// A aba Histórico da Divulgação: as planilhas importadas (vendas e gastos de eventos antigos) e a folha de importar. Só desenho: os dados e as ações chegam por props. O arquivo é lido e
// somado AQUI, no navegador: o que sai é só o total por dia e canal. Segue o DESIGN.md da Ticketeria: rótulos pequenos em caixa alta, cantos de 12px.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const TEXTO = "rounded-xl px-3 py-2 text-[0.75rem] font-normal text-black/40 transition hover:text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded-xl acao-salvar px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const dataBr = (dia: string) => { const [a, m, d] = dia.split("-"); return `${d}/${m}/${a}`; };
const numero = (n: number) => n.toLocaleString("pt-BR");

/** As importações, o aviso de quantas semanas o modelo já tem e o vazio. `semanas` é por tipo (do primeiro ao último dia importado). */
export function HistoricoDaLoja({ importacoes, semanas, onDesfazer, onImportar, desfazendo = null }: {
  importacoes: ImportacaoDaLista[]; semanas: Record<TipoDeHistorico, number>; onDesfazer?: (id: string) => void; onImportar?: () => void; desfazendo?: string | null;
}) {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[0.8125rem] text-black/55">Traga vendas e gastos de eventos antigos (Sympla, Eventbrite, planilha própria). Eles dão ao modelo o histórico que o Jards ainda não tem. Só os totais por dia entram: nomes e e-mails da planilha nunca saem do seu computador.</p>
      {importacoes.length === 0 ? (
        <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <Upload size={28} className="mb-3 text-black/15" aria-hidden="true" />
            <p className="text-[0.875rem] font-medium text-black/55">Nenhuma planilha importada</p>
            <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">Importe as vendas e os gastos de eventos antigos para o modelo começar com história.</p>
            <button type="button" onClick={onImportar} className="mt-4 rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: BORDA }}>Importar planilha</button>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
            <table className="w-full min-w-[44rem] border-collapse">
              <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Importação</th><th className={CABECALHO}>O que é</th><th className={CABECALHO}>Período</th><th className={`${CABECALHO} text-right`}>Linhas</th><th className={`${CABECALHO} text-right`}>Total</th><th className={CABECALHO}><span className="sr-only">Ações</span></th></tr></thead>
              <tbody className="divide-y divide-black/[.08]">
                {importacoes.map(i => (
                  <tr key={i.id}>
                    <td className={CELULA}>{i.arquivo}<span className="block text-[0.6875rem] text-black/40">importada em {new Intl.DateTimeFormat("pt-BR").format(new Date(i.created_at))}</span></td>
                    <td className={CELULA}>{ROTULO_DO_TIPO[i.tipo]}</td>
                    <td className={`${CELULA} tabular-nums text-black/70`}>{dataBr(i.periodo_inicio)} a {dataBr(i.periodo_fim)}</td>
                    <td className={`${CELULA} text-right tabular-nums`}>{numero(i.linhas)}</td>
                    <td className={`${CELULA} text-right tabular-nums`}>{i.tipo === "vendas" ? `${numero(i.total_ingressos)} ingressos${i.total_valor_centavos > 0 ? ` · ${formatarMoeda(i.total_valor_centavos)}` : ""}` : formatarMoeda(i.total_valor_centavos)}</td>
                    <td className={`${CELULA} text-right`}><button type="button" onClick={() => onDesfazer?.(i.id)} disabled={desfazendo === i.id} className={TEXTO}>{desfazendo === i.id ? "Desfazendo…" : "Desfazer"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
            <p className="max-w-2xl text-[0.8125rem] text-black/60">Com este histórico, o modelo já tem <span className="text-[#282525]">{semanas.vendas} {semanas.vendas === 1 ? "semana" : "semanas"}</span> de vendas e <span className="text-[#282525]">{semanas.gasto} {semanas.gasto === 1 ? "semana" : "semanas"}</span> de gasto. O ideal são 104.</p>
            <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: "rgba(176,122,20,.28)", color: "#B07A14" }}>{Math.min(semanas.vendas, semanas.gasto) > 0 ? Math.min(semanas.vendas, semanas.gasto) : Math.max(semanas.vendas, semanas.gasto)} de 104 semanas</span>
          </div>
        </>
      )}
    </div>
  );
}

const NENHUMA = "-1";

type ArquivoLido = { nome: string; cabecalho: string[]; linhas: string[][]; separador: string; truncado: boolean };

/** Lê o arquivo como UTF-8; se não for (o Excel em português costuma salvar em Windows-1252), lê como Windows-1252. */
export async function lerTextoDoArquivo(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return new TextDecoder("windows-1252").decode(bytes); }
}

/** Quanto sobrou do arquivo depois de lido: o que a folha mostra e o que ela envia. */
export function prepararImportacao(arquivo: ArquivoLido, tipo: TipoDeHistorico, mapa: MapaDeColunas) {
  return tipo === "vendas" ? consolidarVendas(arquivo.linhas, mapa) : consolidarGastos(arquivo.linhas, mapa);
}

/** A folha de importar: o tipo, o arquivo, onde está cada coisa, a prévia e o total. `existentes` serve ao aviso de período repetido. */
export function ImportarPlanilhaSheet({ existentes, erro, importando, arquivoInicial = null, tipoInicial = "vendas", mapaInicial, onClose, onImportar }: {
  existentes: ImportacaoDaLista[]; erro?: string | null; importando?: boolean; arquivoInicial?: ArquivoLido | null; tipoInicial?: TipoDeHistorico; mapaInicial?: MapaDeColunas;
  onClose: () => void; onImportar?: (corpo: CorpoDaImportacao) => void;
}) {
  const [tipo, setTipo] = useState<TipoDeHistorico>(tipoInicial);
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(arquivoInicial);
  const [mapa, setMapa] = useState<MapaDeColunas>(mapaInicial ?? (arquivoInicial ? adivinharColunas(arquivoInicial.cabecalho) : { dia: null, ingressos: null, valor: null, canal: null }));
  const [aviso, setAviso] = useState<string | null>(null);

  async function escolher(f: File | undefined) {
    setAviso(null);
    if (!f) return;
    if (f.size > MAX_BYTES_DO_ARQUIVO) { setAviso("O arquivo passa de 5 MB. Divida em partes menores."); return; }
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text\/plain/.test(f.type)) { setAviso("Use um arquivo CSV. No Excel: Arquivo > Salvar como > CSV."); return; }
    const csv = lerCsv(await lerTextoDoArquivo(f));
    if (csv.cabecalho.length < 2 || csv.linhas.length === 0) { setAviso("Não encontrei linhas nesse arquivo. Confira se a primeira linha é o cabeçalho."); return; }
    setArquivo({ nome: f.name, cabecalho: csv.cabecalho, linhas: csv.linhas, separador: csv.separador, truncado: csv.truncado });
    setMapa(adivinharColunas(csv.cabecalho));
  }

  const resumo = useMemo(() => (arquivo && mapa.dia !== null && (tipo === "vendas" || mapa.valor !== null) ? prepararImportacao(arquivo, tipo, mapa) : null), [arquivo, tipo, mapa]);
  const sobrepostas = resumo ? importacoesQueSeSobrepoem(existentes, tipo, resumo.inicio, resumo.fim) : [];
  const colunas = arquivo ? [{ value: NENHUMA, label: "Não tem" }, ...arquivo.cabecalho.map((c, i) => ({ value: String(i), label: c || `Coluna ${i + 1}` }))] : [];
  const campo = (rotulo: string, chave: keyof MapaDeColunas, obrigatorio: boolean) => (
    <>
      <span className="text-[0.8125rem] text-black/70">{rotulo}{obrigatorio ? "" : " (opcional)"}</span>
      <Dropdown ariaLabel={rotulo} value={mapa[chave] === null ? NENHUMA : String(mapa[chave])} onChange={v => setMapa(m => ({ ...m, [chave]: v === NENHUMA ? null : Number(v) }))} options={obrigatorio ? colunas.slice(1) : colunas} placeholder="Escolher a coluna" />
    </>
  );
  const pode = !!resumo && resumo.linhas.length > 0 && !importando;
  const corpo = (): CorpoDaImportacao | null => (resumo && arquivo ? { tipo, arquivo: arquivo.nome, linhas: resumo.linhas } : null);

  return (
    <TopSheet titulo="Importar planilha" onClose={onClose} largura="38rem" footer={fechar => (
      <>
        <button type="button" onClick={fechar} disabled={importando} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={() => { const c = corpo(); if (c) onImportar?.(c); }} disabled={!pode} className={SALVAR}>{importando ? "Importando…" : resumo && resumo.linhas.length > 0 ? `Importar ${numero(resumo.linhas.length)} ${resumo.linhas.length === 1 ? "linha" : "linhas"}` : "Importar"}</button>
      </>
    )}>
      <div className="space-y-4">
        <p className="text-[0.8125rem] text-black/55">O arquivo é lido aqui, no seu navegador. Só os totais por dia são enviados.</p>
        {erro && <Aviso texto={erro} />}
        {aviso && <Aviso texto={aviso} />}
        <div>
          <span className={ROTULO}>O que a planilha tem</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="O que a planilha tem">
            {([["vendas", "Vendas de ingressos"], ["gasto", "Gastos de divulgação"]] as const).map(([v, r]) => (
              <button key={v} type="button" onClick={() => setTipo(v)} disabled={importando} aria-pressed={tipo === v}
                className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${tipo === v ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.03]"}`}
                style={tipo === v ? undefined : { borderColor: BORDA }}>{r}</button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-dashed bg-[#FBFAFD] px-4 py-4 text-center" style={{ borderColor: "rgba(13,13,13,.18)" }}>
          {arquivo ? <p className="text-[0.8125rem] text-black/60"><span className="text-[#282525]">{arquivo.nome}</span> · {numero(arquivo.linhas.length)} linhas · separador “{arquivo.separador === "\t" ? "tab" : arquivo.separador}”{arquivo.truncado ? " · só as primeiras 20.000 linhas" : ""}</p> : <p className="text-[0.8125rem] text-black/45">Escolha o arquivo CSV da planilha.</p>}
          <label className="mt-2 inline-block cursor-pointer rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#7259B5]" style={{ borderColor: BORDA }}>
            {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" disabled={importando} onChange={e => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <p className="mt-2 text-[0.6875rem] text-black/40">Arquivo do Excel? Salve como CSV (Arquivo &gt; Salvar como). <a className="underline underline-offset-2" href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${modeloDeCsv(tipo)}`)}`} download={`modelo-${tipo === "vendas" ? "vendas" : "gastos"}.csv`}>Baixar modelo</a></p>
        </div>
        {arquivo && (
          <>
            <div>
              <span className={ROTULO}>Onde está cada coisa</span>
              <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[1fr_1.3fr]">
                {campo(tipo === "vendas" ? "Dia da venda" : "Dia do gasto", "dia", true)}
                {tipo === "vendas" ? campo("Quantidade de ingressos", "ingressos", false) : null}
                {campo(tipo === "vendas" ? "Valor" : "Valor gasto", "valor", tipo === "gasto")}
                {campo("Origem ou canal", "canal", false)}
              </div>
              {tipo === "vendas" && mapa.ingressos === null && <p className="mt-2 text-[0.6875rem] text-black/40">Sem coluna de quantidade, cada linha vale 1 ingresso.</p>}
            </div>
            {resumo && resumo.linhas.length > 0 && (
              <div>
                <table className="w-full border-collapse text-[0.75rem]">
                  <thead><tr>{(tipo === "vendas" ? ["Dia", "Ingressos", "Valor", "Canal"] : ["Dia", "Gasto", "Canal"]).map(h => <th key={h} className="py-1.5 pr-3 text-left text-[0.5625rem] font-normal uppercase tracking-[.08em] text-black/35">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-black/[.08]">
                    {resumo.linhas.slice(0, 3).map((l, i) => (
                      <tr key={i} className="tabular-nums text-[#282525]">
                        <td className="py-1.5 pr-3">{dataBr(l.dia)}</td>
                        {"ingressos" in l ? <><td className="py-1.5 pr-3">{numero(l.ingressos)}</td><td className="py-1.5 pr-3">{formatarMoeda(l.valor_centavos)}</td></> : <td className="py-1.5 pr-3">{formatarMoeda(l.gasto_centavos)}</td>}
                        <td className="py-1.5 pr-3 text-black/60">{l.canal === "sem-origem" ? "sem origem" : l.canal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[0.75rem] text-black/50">
                  Total: {tipo === "vendas" ? `${numero(resumo.totalIngressos)} ingressos${resumo.totalCentavos > 0 ? ` (${formatarMoeda(resumo.totalCentavos)})` : ""}` : formatarMoeda(resumo.totalCentavos)} em {numero(resumo.lidas)} {resumo.lidas === 1 ? "linha" : "linhas"}, de {resumo.inicio ? dataBr(resumo.inicio) : "—"} a {resumo.fim ? dataBr(resumo.fim) : "—"}.
                  {resumo.problemas.length === 0 ? " Nenhuma linha com problema." : ` ${resumo.problemas.length}${resumo.problemas.length >= 50 ? "+" : ""} ${resumo.problemas.length === 1 ? "linha ficou" : "linhas ficaram"} de fora (a primeira: linha ${resumo.problemas[0].linha}, ${resumo.problemas[0].motivo}).`}
                </p>
              </div>
            )}
            {resumo && resumo.linhas.length === 0 && <p className="text-[0.75rem] text-[#B23B3B]" role="alert">Nenhuma linha deu para ler com essas colunas. Confira onde está o dia{tipo === "gasto" ? " e o valor" : ""}.</p>}
            {sobrepostas.length > 0 && (
              <p role="alert" className="rounded-xl border px-3 py-2 text-[0.75rem] text-black/60" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
                Atenção: já existe {sobrepostas.length === 1 ? "uma importação" : "importações"} de {tipo === "vendas" ? "vendas" : "gastos"} neste período ({sobrepostas.map(s => s.arquivo).join(", ")}). Importar de novo pode contar duas vezes; se for o mesmo arquivo, desfaça a anterior antes.
              </p>
            )}
          </>
        )}
      </div>
    </TopSheet>
  );
}
