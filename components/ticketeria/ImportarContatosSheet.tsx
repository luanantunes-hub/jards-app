"use client";

import { useMemo, useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { MAX_BYTES_DO_ARQUIVO, lerCsv } from "@/lib/ticketeria/historico";
import { lerPlanilhaDoExcel, type AbaLida } from "@/lib/ticketeria/historico-xlsx";
import { MAX_CONTATOS_POR_IMPORTACAO, MODELO_DE_CONTATOS, adivinharColunasDeContatos, lerContatos, textoDaDeclaracao, type CorpoDaImportacaoDeContatos, type MapaDeContatos } from "@/lib/ticketeria/contatos-importados";
import { lerTextoDoArquivo } from "@/components/ticketeria/HistoricoView";
import { Aviso, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// A folha de importar contatos para o Público: o arquivo (CSV ou Excel), onde está cada coisa, a prévia e a declaração de que as pessoas aceitaram receber novidades. O arquivo é lido aqui,
// no navegador; só os contatos já conferidos são enviados. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const FINAL = "rounded-xl acao-principal px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const NENHUMA = "-1";
const EXCEL = /\.(xlsx|xls)$/i;
const numero = (n: number) => n.toLocaleString("pt-BR");

export type ArquivoDeContatos = { nome: string; cabecalho: string[]; linhas: string[][]; truncado: boolean; abas?: AbaLida[]; aba?: number };

/** A aba que mais parece a de contatos: a que tem coluna de e-mail; em empate, a com mais linhas. -1 se não há aba. */
function escolherAbaDeContatos(abas: AbaLida[]): number {
  let melhor = -1;
  let pontos = -1;
  abas.forEach((a, i) => {
    const p = (adivinharColunasDeContatos(a.cabecalho).email !== null ? 100000 : 0) + Math.min(a.linhas.length, 99999);
    if (p > pontos) { pontos = p; melhor = i; }
  });
  return melhor;
}

export function ImportarContatosSheet({ loja, erro, importando, arquivoInicial = null, declaroInicial = false, onClose, onImportar }: {
  loja: string; erro?: string | null; importando?: boolean; arquivoInicial?: ArquivoDeContatos | null; declaroInicial?: boolean; onClose: () => void; onImportar?: (corpo: CorpoDaImportacaoDeContatos) => void;
}) {
  const [arquivo, setArquivo] = useState<ArquivoDeContatos | null>(arquivoInicial);
  const [mapa, setMapa] = useState<MapaDeContatos>(arquivoInicial ? adivinharColunasDeContatos(arquivoInicial.cabecalho) : { nome: null, email: null, whatsapp: null });
  const [declaro, setDeclaro] = useState(declaroInicial);
  const [aviso, setAviso] = useState<string | null>(null);

  async function escolher(f: File | undefined) {
    setAviso(null);
    if (!f) return;
    if (f.size > MAX_BYTES_DO_ARQUIVO) { setAviso("O arquivo passa de 5 MB. Divida em partes menores."); return; }
    if (EXCEL.test(f.name)) {
      let abas: AbaLida[];
      try {
        const X = await import("xlsx");
        abas = lerPlanilhaDoExcel(X, await f.arrayBuffer());
      } catch { setAviso("Não consegui abrir esse arquivo do Excel. Salve de novo como .xlsx ou como CSV."); return; }
      const i = escolherAbaDeContatos(abas);
      if (i < 0) { setAviso("Não encontrei linhas nesse arquivo. Confira se a primeira linha de alguma aba é o cabeçalho."); return; }
      usarAba({ nome: f.name, cabecalho: [], linhas: [], truncado: false, abas, aba: i }, i);
      return;
    }
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text\/plain/.test(f.type)) { setAviso("Use um arquivo do Excel (.xlsx) ou CSV."); return; }
    const csv = lerCsv(await lerTextoDoArquivo(f));
    if (csv.cabecalho.length < 1 || csv.linhas.length === 0) { setAviso("Não encontrei linhas nesse arquivo. Confira se a primeira linha é o cabeçalho."); return; }
    setArquivo({ nome: f.name, cabecalho: csv.cabecalho, linhas: csv.linhas, truncado: csv.truncado });
    setMapa(adivinharColunasDeContatos(csv.cabecalho));
  }

  function usarAba(a: ArquivoDeContatos, i: number) {
    const aba = (a.abas ?? [])[i];
    if (!aba) return;
    setArquivo({ ...a, aba: i, cabecalho: aba.cabecalho, linhas: aba.linhas, truncado: aba.truncado });
    setMapa(adivinharColunasDeContatos(aba.cabecalho));
  }

  const lido = useMemo(() => (arquivo && mapa.email !== null ? lerContatos(arquivo.linhas, mapa) : null), [arquivo, mapa]);
  const colunas = arquivo ? [{ value: NENHUMA, label: "Não tem" }, ...arquivo.cabecalho.map((c, i) => ({ value: String(i), label: c || `Coluna ${i + 1}` }))] : [];
  const campo = (rotulo: string, chave: keyof MapaDeContatos, obrigatorio: boolean) => (
    <>
      <span className="text-[0.8125rem] text-black/70">{rotulo}{obrigatorio ? "" : " (opcional)"}</span>
      <Dropdown ariaLabel={rotulo} value={mapa[chave] === null ? NENHUMA : String(mapa[chave])} onChange={v => setMapa(m => ({ ...m, [chave]: v === NENHUMA ? null : Number(v) }))} options={obrigatorio ? colunas.slice(1) : colunas} placeholder="Escolher a coluna" disabled={importando} />
    </>
  );
  const total = lido?.contatos.length ?? 0;
  const pode = !!lido && total > 0 && !importando;

  return (
    <TopSheet titulo="Importar planilha" onClose={onClose} largura="38rem" footer={fechar => (
      <>
        <button type="button" onClick={fechar} disabled={importando} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={() => { if (lido && arquivo) onImportar?.({ arquivo: arquivo.nome, declaro, contatos: lido.contatos }); }} disabled={!pode} className={FINAL}>{importando ? "Importando…" : total > 0 ? `Importar ${numero(total)} ${total === 1 ? "contato" : "contatos"}` : "Importar"}</button>
      </>
    )}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {aviso && <Aviso texto={aviso} />}
        <div className="rounded-xl border border-dashed bg-[#FBFAFD] px-4 py-4 text-center" style={{ borderColor: "rgba(13,13,13,.18)" }}>
          {arquivo ? <p className="text-[0.8125rem] text-black/60"><span className="text-[#282525]">{arquivo.nome}</span> · {arquivo.abas ? "Excel" : "CSV"} · {numero(arquivo.linhas.length)} {arquivo.linhas.length === 1 ? "linha" : "linhas"}{arquivo.truncado ? " (só as primeiras)" : ""}</p> : <p className="text-[0.8125rem] text-black/60">Nome, e-mail e, se tiver, WhatsApp.</p>}
          <label className="mt-2 inline-block cursor-pointer rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#7259B5]" style={{ borderColor: BORDA }}>
            {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
            <input type="file" accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="sr-only" disabled={importando} onChange={e => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <p className="mt-2 text-[0.6875rem] text-black/40">Aceita Excel (.xlsx) e CSV. <a className="underline underline-offset-2" href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${MODELO_DE_CONTATOS}`)}`} download="modelo-contatos.csv">Baixar o modelo</a></p>
        </div>
        {arquivo && (
          <>
            {arquivo.abas && arquivo.abas.length > 1 && (
              <div>
                <span className={ROTULO}>Qual aba usar</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Qual aba usar">
                  {arquivo.abas.map((a, i) => (
                    <button key={a.nome} type="button" onClick={() => usarAba(arquivo, i)} aria-pressed={arquivo.aba === i}
                      className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${arquivo.aba === i ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.04]"}`}
                      style={arquivo.aba === i ? undefined : { borderColor: BORDA }}>{a.nome}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className={ROTULO}>Onde está cada coisa</span>
              <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[1fr_1.3fr]">
                {campo("E-mail", "email", true)}
                {campo("Nome", "nome", false)}
                {campo("WhatsApp", "whatsapp", false)}
              </div>
            </div>
            {lido && total > 0 && (
              <div>
                <table className="w-full border-collapse text-[0.75rem]">
                  <thead><tr>{["Nome", "E-mail", "WhatsApp"].map(h => <th key={h} className="py-1.5 pr-3 text-left text-[0.5625rem] font-normal uppercase tracking-[.08em] text-black/35">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-black/[.08]">
                    {lido.contatos.slice(0, 3).map(c => (
                      <tr key={c.email} className="text-[#282525]"><td className="py-1.5 pr-3">{c.nome}</td><td className="py-1.5 pr-3">{c.email}</td><td className="py-1.5 pr-3 tabular-nums text-black/60">{c.whatsapp ? `+${c.whatsapp}` : "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[0.75rem] text-black/50">
                  {numero(total)} {total === 1 ? "contato para importar" : "contatos para importar"}.
                  {lido.repetidos > 0 ? ` ${numero(lido.repetidos)} ${lido.repetidos === 1 ? "repetido" : "repetidos"} na planilha.` : ""}
                  {lido.problemas_total > 0 ? ` ${numero(lido.problemas_total)} ${lido.problemas_total === 1 ? "linha ficou" : "linhas ficaram"} de fora por e-mail ausente ou inválido.` : ""}
                  {lido.whatsapp_invalidos > 0 ? ` ${numero(lido.whatsapp_invalidos)} ${lido.whatsapp_invalidos === 1 ? "WhatsApp" : "WhatsApps"} fora do formato entram sem o número.` : ""}
                  {lido.passou_do_limite ? ` Só os primeiros ${numero(MAX_CONTATOS_POR_IMPORTACAO)} entram; importe o resto em outra planilha.` : ""}
                </p>
              </div>
            )}
            {lido && total === 0 && <p className="text-[0.75rem] text-[#B23B3B]" role="alert">Nenhuma linha deu para ler com essa coluna de e-mail. Confira qual coluna tem os e-mails.</p>}
            {!lido && <p className="text-[0.75rem] text-[#B23B3B]" role="alert">Escolha qual coluna tem os e-mails.</p>}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-[0.8125rem] leading-snug" style={{ borderColor: BORDA }}>
              <input type="checkbox" checked={declaro} onChange={e => setDeclaro(e.target.checked)} disabled={importando} className="mt-0.5 h-5 w-5 shrink-0 accent-[#282525]" />
              <span>{textoDaDeclaracao(loja)}</span>
            </label>
            {!declaro && <p className="text-[0.6875rem] text-black/45">Sem a declaração, as pessoas entram no Público, mas não recebem nenhum envio.</p>}
          </>
        )}
      </div>
    </TopSheet>
  );
}
