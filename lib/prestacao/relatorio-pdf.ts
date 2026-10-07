// Relatório da prestação em PDF (P4.5), que vai dentro do pacote.
//
// `conteudoDoRelatorio` monta os blocos (identificação, checklist, o que
// falta, resumo financeiro e os arquivos do pacote com o SHA-256);
// `relatorioEmPdf` desenha em A4 com a Helvetica do próprio PDF, quebrando
// linhas e páginas e repetindo o cabeçalho das tabelas. A pdf-lib só carrega
// quando o relatório é gerado.

import { ROTULO_DA_ETAPA, type ChecklistDeEnvio, type LinhaDoChecklist } from "./envio";
import type { DadosDoPacote, LinhaDoManifesto, PlanoDoPacote, TipoDoPacote } from "./pacote";

export type ColunaDoRelatorio = { titulo: string; /** Fração da largura útil. */ largura: number; direita?: boolean };

export type BlocoDoRelatorio =
  | { tipo: "titulo"; texto: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "secao"; texto: string }
  | { tipo: "paragrafo"; texto: string; suave?: boolean }
  | { tipo: "pares"; pares: [string, string][] }
  | { tipo: "lista"; itens: { texto: string; alerta?: boolean }[] }
  | { tipo: "tabela"; colunas: ColunaDoRelatorio[]; linhas: string[][] };

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const tamanho = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const quando = (d: Date) => d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const SITUACAO: Record<LinhaDoChecklist["situacao"], string> = { pronto: "Pronto", pendente: "Pendente", nao_se_aplica: "Não se aplica" };

export type EntradaDoRelatorio = {
  tipo: TipoDoPacote;
  dados: DadosDoPacote;
  plano: PlanoDoPacote;
  /** Os arquivos já com o SHA-256 (sem o próprio relatório). */
  manifesto: readonly LinhaDoManifesto[];
  geradoEm: Date;
  proponente: { nome: string; documento: string | null } | null;
};

function linhasDoChecklist(checklist: ChecklistDeEnvio): string[][] {
  return [...checklist.documentos, ...checklist.condicoes].map(l => [
    `${l.descricao}${l.obrigatorio ? " *" : ""}`,
    l.tipo === "documento" ? "Documento" : "Condição",
    SITUACAO[l.situacao],
    l.detalhe,
  ]);
}

export function conteudoDoRelatorio(e: EntradaDoRelatorio): BlocoDoRelatorio[] {
  const { dados, plano, checklist } = { ...e, checklist: e.dados.checklist };
  const regime = dados.regime;
  const blocos: BlocoDoRelatorio[] = [
    { tipo: "titulo", texto: "Relatório da prestação de contas" },
  ];
  if (e.tipo === "pre-pacote") {
    blocos.push({ tipo: "aviso", texto: "Pré-pacote: mostra o que já está pronto e o que falta. Não é o envio." });
  }
  blocos.push({
    tipo: "pares",
    pares: [
      ["Prestação", dados.prestacao.titulo],
      ["Identificador oficial", dados.prestacao.identificador_oficial || "Não informado"],
      ["Proponente", e.proponente ? [e.proponente.nome, e.proponente.documento].filter(Boolean).join(", ") : "Não informado"],
      ["Regime", regime ? `${regime.nome} (versão ${regime.versao})` : "Sem regime"],
      ["Sistema de destino", checklist.sistema ?? regime?.sistemaOficial ?? "Não definido"],
      ["Etapa", ROTULO_DA_ETAPA[dados.etapa]],
      ["Gerado em", quando(e.geradoEm)],
    ],
  });

  // Checklist
  blocos.push({ tipo: "secao", texto: "Checklist do envio" });
  if (checklist.semChecklist) {
    blocos.push({ tipo: "paragrafo", texto: checklist.semChecklist });
  } else {
    const r = checklist.resumo;
    blocos.push({ tipo: "paragrafo", texto: `${r.resolvidos} de ${r.total} itens prontos${r.obrigatoriosPendentes ? `; ${r.obrigatoriosPendentes} obrigatório${r.obrigatoriosPendentes === 1 ? "" : "s"} pendente${r.obrigatoriosPendentes === 1 ? "" : "s"}` : ""}. Obrigatórios marcados com *.`, suave: true });
    blocos.push({
      tipo: "tabela",
      colunas: [{ titulo: "Item", largura: 0.36 }, { titulo: "Tipo", largura: 0.11 }, { titulo: "Situação", largura: 0.12 }, { titulo: "Detalhe", largura: 0.41 }],
      linhas: linhasDoChecklist(checklist),
    });
  }

  // O que falta
  const comProblema = plano.itens.filter(i => i.problemas.length);
  if (plano.faltas.length || comProblema.length) {
    blocos.push({ tipo: "secao", texto: "O que falta" });
    blocos.push({ tipo: "lista", itens: plano.faltas.map(f => ({ texto: `${f.obrigatorio ? "Obrigatório: " : ""}${f.texto}`, alerta: f.obrigatorio })) });
    if (comProblema.length) {
      blocos.push({ tipo: "paragrafo", texto: `Arquivos fora da regra do regime${plano.regra ? ` (${plano.regra.descricao})` : ""}:` });
      blocos.push({ tipo: "lista", itens: comProblema.map(i => ({ texto: `${i.caminho}: ${i.problemas.join(" ")}`, alerta: true })) });
    }
  }

  // Resumo financeiro
  const despesas = dados.estado.despesas.filter(d => d.status !== "rejeitado");
  const comprovado = despesas.reduce((s, d) => s + centavos(d.valor_extraido), 0);
  const pago = dados.estado.pagamentos.filter(p => despesas.some(d => d.id === p.despesa_id)).reduce((s, p) => s + centavos(p.valor), 0);
  const devolvido = dados.devolucoes.filter(d => d.situacao === "paga").reduce((s, d) => s + centavos(d.valor_pago), 0);
  const aDevolver = dados.devolucoes.filter(d => d.situacao !== "paga").reduce((s, d) => s + centavos(d.valor_atualizado ?? d.valor_principal), 0);
  blocos.push({ tipo: "secao", texto: "Resumo financeiro" });
  blocos.push({
    tipo: "pares",
    pares: [
      ["Despesas", `${despesas.length} comprovante${despesas.length === 1 ? "" : "s"}, ${reais(comprovado)}`],
      ["Pagamentos ligados", reais(pago)],
      ["Devoluções pagas", reais(devolvido)],
      ...(aDevolver ? [["Devoluções a pagar", reais(aDevolver)] as [string, string]] : []),
    ],
  });

  // Arquivos do pacote
  blocos.push({ tipo: "secao", texto: "Arquivos do pacote" });
  const total = e.manifesto.reduce((s, l) => s + l.tamanho, 0);
  blocos.push({
    tipo: "paragrafo",
    suave: true,
    texto: e.manifesto.length
      ? `${e.manifesto.length} arquivo${e.manifesto.length === 1 ? "" : "s"}, ${tamanho(total)}. O SHA-256 completo de cada um está em manifesto.csv; aqui, os 16 primeiros caracteres.`
      : "Nenhum arquivo anexado ainda.",
  });
  if (e.manifesto.length) {
    blocos.push({
      tipo: "tabela",
      colunas: [{ titulo: "Arquivo", largura: 0.3 }, { titulo: "Origem", largura: 0.4 }, { titulo: "Tamanho", largura: 0.1, direita: true }, { titulo: "SHA-256", largura: 0.2 }],
      linhas: e.manifesto.map(l => [l.arquivo, l.origem + (l.observacao ? ` (${l.observacao})` : ""), tamanho(l.tamanho), `${l.sha256.slice(0, 16)}…`]),
    });
  }
  return blocos;
}

// ─── Desenho ────────────────────────────────────────────────────────────────

/** Só o que a Helvetica do PDF (WinAnsi) escreve; o resto vira equivalente ou "?". */
export function paraWinAnsi(texto: string): string {
  return texto.normalize("NFC")
    .replace(/[\u00a0\u2007\u202f\t]/g, " ")
    .replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/→/g, "->").replace(/←/g, "<-")
    .replace(/[^\n\u0020-\u007e\u00a1-\u00ff\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]/gu, "?");
}

type Medidor = { largura: (texto: string, tamanho: number) => number };

/** Quebra o texto na largura, por palavra; palavra maior que a linha é cortada. */
export function quebrarLinhas(texto: string, largura: number, tamanhoFonte: number, m: Medidor): string[] {
  const saida: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let linha = "";
    for (const palavra of paragrafo.split(/ +/)) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (m.largura(tentativa, tamanhoFonte) <= largura) { linha = tentativa; continue; }
      if (linha) saida.push(linha);
      let resto = palavra;
      while (m.largura(resto, tamanhoFonte) > largura && resto.length > 1) {
        let corte = resto.length - 1;
        while (corte > 1 && m.largura(resto.slice(0, corte), tamanhoFonte) > largura) corte--;
        saida.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      linha = resto;
    }
    saida.push(linha);
  }
  return saida;
}

export async function relatorioEmPdf(blocos: readonly BlocoDoRelatorio[], rodape: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(paraWinAnsi(rodape));
  pdf.setCreator("Jards");
  pdf.setProducer("Jards");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const TINTA = rgb(0.05, 0.05, 0.05);
  const SUAVE = rgb(0.42, 0.42, 0.42);
  const ALERTA = rgb(0.69, 0.48, 0.08);
  const REGRA = rgb(0.85, 0.85, 0.85);
  const FUNDO = rgb(0.96, 0.96, 0.96);
  const [L, A] = [595.28, 841.89];
  const MARGEM = 48;
  const UTIL = L - 2 * MARGEM;
  const BASE = MARGEM + 24;

  let pagina = pdf.addPage([L, A]);
  let y = A - MARGEM;
  const novaPagina = () => { pagina = pdf.addPage([L, A]); y = A - MARGEM; };
  const caber = (altura: number) => { if (y - altura < BASE) novaPagina(); };
  const medir = (f: typeof normal): Medidor => ({ largura: (t, s) => f.widthOfTextAtSize(paraWinAnsi(t), s) });
  const escrever = (texto: string, x: number, yy: number, tam: number, f = normal, cor = TINTA) =>
    pagina.drawText(paraWinAnsi(texto), { x, y: yy, size: tam, font: f, color: cor });

  function paragrafo(texto: string, tam: number, f = normal, cor = TINTA, recuo = 0, depois = 6) {
    const linhas = quebrarLinhas(texto, UTIL - recuo, tam, medir(f));
    const altura = tam * 1.35;
    for (const linha of linhas) {
      caber(altura);
      y -= altura;
      escrever(linha, MARGEM + recuo, y + tam * 0.3, tam, f, cor);
    }
    y -= depois;
  }

  function tabela(colunas: ColunaDoRelatorio[], linhas: string[][]) {
    const tam = 7.5;
    const alturaLinha = tam * 1.3;
    const pad = 4;
    const larguras = colunas.map(c => c.largura * UTIL);
    const desenharCabecalho = () => {
      const alturaCab = alturaLinha + 2 * pad;
      caber(alturaCab + alturaLinha + 2 * pad);
      pagina.drawRectangle({ x: MARGEM, y: y - alturaCab, width: UTIL, height: alturaCab, color: FUNDO });
      let x = MARGEM;
      colunas.forEach((c, i) => { escrever(c.titulo.toUpperCase(), x + pad, y - pad - tam, 6.5, negrito, SUAVE); x += larguras[i]; });
      y -= alturaCab;
    };
    desenharCabecalho();
    for (const celulas of linhas) {
      const quebradas = celulas.map((c, i) => quebrarLinhas(c ?? "", larguras[i] - 2 * pad, tam, medir(normal)));
      const altura = Math.max(...quebradas.map(q => q.length)) * alturaLinha + 2 * pad;
      if (y - altura < BASE) { novaPagina(); desenharCabecalho(); }
      let x = MARGEM;
      quebradas.forEach((q, i) => {
        q.forEach((linha, j) => {
          const largura = colunas[i].direita ? normal.widthOfTextAtSize(paraWinAnsi(linha), tam) : 0;
          const xx = colunas[i].direita ? x + larguras[i] - pad - largura : x + pad;
          escrever(linha, xx, y - pad - tam - j * alturaLinha, tam);
        });
        x += larguras[i];
      });
      y -= altura;
      pagina.drawLine({ start: { x: MARGEM, y }, end: { x: MARGEM + UTIL, y }, thickness: 0.5, color: REGRA });
    }
    y -= 10;
  }

  for (const b of blocos) {
    if (b.tipo === "titulo") paragrafo(b.texto, 16, negrito, TINTA, 0, 8);
    else if (b.tipo === "aviso") paragrafo(b.texto, 10, negrito, ALERTA, 0, 8);
    else if (b.tipo === "secao") { caber(40); y -= 8; paragrafo(b.texto, 11.5, negrito, TINTA, 0, 4); }
    else if (b.tipo === "paragrafo") paragrafo(b.texto, 8.5, normal, b.suave ? SUAVE : TINTA);
    else if (b.tipo === "lista") { for (const i of b.itens) paragrafo(`•  ${i.texto}`, 8.5, normal, i.alerta ? ALERTA : TINTA, 0, 2); y -= 4; }
    else if (b.tipo === "pares") {
      for (const [rotulo, valor] of b.pares) {
        const linhas = quebrarLinhas(valor, UTIL - 130, 9, medir(normal));
        caber(linhas.length * 12.5);
        escrever(rotulo, MARGEM, y - 9, 8.5, normal, SUAVE);
        linhas.forEach((l, i) => escrever(l, MARGEM + 130, y - 9 - i * 12.5, 9));
        y -= linhas.length * 12.5 + 2;
      }
      y -= 6;
    } else if (b.tipo === "tabela") tabela(b.colunas, b.linhas);
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    const texto = paraWinAnsi(`${rodape} · página ${i + 1} de ${paginas.length}`);
    p.drawText(texto, { x: MARGEM, y: MARGEM - 8, size: 7, font: normal, color: SUAVE });
  });
  return pdf.save();
}
