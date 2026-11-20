// Preenchimento de modelos .xlsx sem dependência (P8.2).
//
// O SheetJS da comunidade grava .xls sem estilos nem fórmulas, o que serve ao
// STR (P7.3), que lê a planilha por máquina, mas não a um formulário que um
// analista lê, como o PCP/PCF da LIE. Aqui o modelo oficial, convertido uma vez
// para .xlsx, é aberto como ZIP e editado no XML: o valor entra na célula e o
// estilo dela fica; linhas novas copiam o estilo, as mesclagens e as fórmulas
// relativas de uma linha do modelo; as fórmulas da planilha, as mesclagens, a
// formatação condicional e a área de impressão acompanham o deslocamento; e os
// totais são recalculados (SUM, + - * / e parênteses), para qualquer leitor
// mostrar o valor certo, com o Excel recalculando de novo ao abrir.
//
// O XML é o que o LibreOffice grava (sem fórmulas compartilhadas nem spans);
// outra origem pode precisar de mais casos.

import { lerZip, partesDoZip } from "./zip";

export type ValorDaCelula = string | number | null;

type Celula = { col: number; linha: number; attrs: string; interno: string };
type Linha = { r: number; attrs: string; celulas: Celula[] };

// ─── Referências ────────────────────────────────────────────────────────────

export function numeroDaColuna(letras: string): number {
  let n = 0;
  for (const c of letras.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}

export function letrasDaColuna(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export function lerReferencia(ref: string): { col: number; linha: number } {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref.trim());
  if (!m) throw new Error(`Referência inválida: ${ref}`);
  return { col: numeroDaColuna(m[1]), linha: Number(m[2]) };
}

const referencia = (col: number, linha: number) => `${letrasDaColuna(col)}${linha}`;

// ─── XML ────────────────────────────────────────────────────────────────────

export const escaparXml = (t: string) =>
  t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const desescaparXml = (t: string) =>
  t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()];
  });

const textoDosT = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map(m => desescaparXml(m[1] ?? "")).join("");

const semAtributo = (attrs: string, nome: string) => attrs.replace(new RegExp(`\\s+${nome}="[^"]*"`), "");

// ─── Fórmulas ───────────────────────────────────────────────────────────────

// Uma referência A1 fora de texto entre aspas: aspas, ou [planilha!]$COL$LINHA.
const REF_NA_FORMULA = /("(?:[^"]|"")*")|((?:'(?:[^']|'')+'|[A-Za-z_][\w.]*)!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g;

/** O trecho é parte de um nome maior (XABC12, LOG10): a letra ou o ponto vem colado antes. Sem lookbehind, que o Safari antigo não tem. */
const colado = (offset: number, texto: string) => offset > 0 && /[\w.]/.test(texto[offset - 1]);

const nomeDoPrefixo = (prefixo: string) => prefixo.slice(0, -1).replace(/^'(.*)'$/, "$1").replace(/''/g, "'");

/** Desloca as linhas a partir de `antesDe` em `n`, nas referências desta planilha (sem prefixo ou com o nome dela). */
export function deslocarFormula(formula: string, antesDe: number, n: number, planilha?: string): string {
  return formula.replace(REF_NA_FORMULA, (todo, texto, prefixo, dc, col, dl, linha, offset: number, inteira: string) => {
    if (texto || colado(offset, inteira)) return todo;
    if (prefixo && (!planilha || nomeDoPrefixo(prefixo) !== planilha)) return todo;
    const l = Number(linha);
    return `${prefixo ?? ""}${dc}${col}${dl}${l >= antesDe ? l + n : l}`;
  });
}

/** A fórmula copiada `delta` linhas abaixo: as linhas relativas andam, as com $ ficam. */
export function copiarFormula(formula: string, delta: number): string {
  return formula.replace(REF_NA_FORMULA, (todo, texto, prefixo, dc, col, dl, linha, offset: number, inteira: string) =>
    texto || colado(offset, inteira) ? todo : `${prefixo ?? ""}${dc}${col}${dl}${dl ? linha : Number(linha) + delta}`);
}

function deslocarIntervalo(intervalo: string, antesDe: number, n: number): string {
  return intervalo.split(":").map(parte => {
    const m = /^(\$?[A-Z]{1,3}\$?)(\d+)$/i.exec(parte);
    if (!m) return parte;
    const l = Number(m[2]);
    return `${m[1]}${l >= antesDe ? l + n : l}`;
  }).join(":");
}

type Token = { tipo: "num"; v: number } | { tipo: "ref"; col: number; linha: number } | { tipo: "faixa"; de: { col: number; linha: number }; ate: { col: number; linha: number } }
  | { tipo: "fn"; nome: string } | { tipo: "op"; v: string };

function tokens(formula: string): Token[] {
  const saida: Token[] = [];
  const re = /\s+|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?(?![\w(])|([A-Z][A-Z0-9.]*)\(|([-+*/(),;])/gy;
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < formula.length) {
    re.lastIndex = pos;
    m = re.exec(formula);
    if (!m) throw new Error(`Fórmula sem suporte: ${formula}`);
    pos = re.lastIndex;
    if (m[1]) saida.push({ tipo: "num", v: Number(m[1]) });
    else if (m[2] && m[3]) saida.push({ tipo: "faixa", de: lerReferencia(m[2]), ate: lerReferencia(m[3]) });
    else if (m[2]) saida.push({ tipo: "ref", ...lerReferencia(m[2]) });
    else if (m[4]) saida.push({ tipo: "fn", nome: m[4].toUpperCase() });
    else if (m[5]) saida.push({ tipo: "op", v: m[5] });
  }
  return saida;
}

// ─── Planilha ───────────────────────────────────────────────────────────────

export class Planilha {
  readonly nome: string;
  private antes: string;
  private depois: string;
  private linhas = new Map<number, Linha>();
  private merges: string[];
  private readonly compartilhadas: readonly string[];

  constructor(nome: string, xml: string, compartilhadas: readonly string[]) {
    this.nome = nome;
    this.compartilhadas = compartilhadas;
    const abre = xml.search(/<sheetData\s*\/?>/);
    if (abre < 0) throw new Error(`A planilha ${nome} não tem sheetData.`);
    const vazia = /^<sheetData\s*\/>/.test(xml.slice(abre));
    const inicio = xml.indexOf(">", abre) + 1;
    const fecha = vazia ? inicio : xml.indexOf("</sheetData>", inicio);
    this.antes = xml.slice(0, abre) + "<sheetData>";
    this.depois = "</sheetData>" + xml.slice(vazia ? inicio : fecha + "</sheetData>".length);
    const dados = vazia ? "" : xml.slice(inicio, fecha);
    for (const r of dados.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const numero = Number(/\sr="(\d+)"/.exec(r[1])?.[1]);
      const celulas: Celula[] = [];
      for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = lerReferencia(/\sr="([^"]+)"/.exec(c[1])?.[1] ?? "");
        celulas.push({ col: ref.col, linha: numero, attrs: semAtributo(c[1], "r"), interno: c[2] ?? "" });
      }
      this.linhas.set(numero, { r: numero, attrs: semAtributo(semAtributo(r[1], "r"), "spans"), celulas });
    }
    this.merges = [...this.depois.matchAll(/<mergeCell\s+ref="([^"]+)"\s*\/>/g)].map(m => m[1]);
  }

  private celula(ref: string, criar: true): Celula;
  private celula(ref: string, criar?: false): Celula | undefined;
  private celula(ref: string, criar = false): Celula | undefined {
    const { col, linha } = lerReferencia(ref);
    let l = this.linhas.get(linha);
    if (!l) {
      if (!criar) return undefined;
      l = { r: linha, attrs: "", celulas: [] };
      this.linhas.set(linha, l);
    }
    let c = l.celulas.find(x => x.col === col);
    if (!c && criar) {
      c = { col, linha, attrs: "", interno: "" };
      l.celulas.push(c);
      l.celulas.sort((a, b) => a.col - b.col);
    }
    return c;
  }

  /** Valor da célula: número, texto (compartilhado ou na célula) ou null. Fórmula devolve o valor guardado. */
  ler(ref: string): ValorDaCelula {
    const c = this.celula(ref);
    if (!c) return null;
    const tipo = /\st="([^"]+)"/.exec(c.attrs)?.[1];
    if (tipo === "inlineStr") return textoDosT(/<is>([\s\S]*?)<\/is>/.exec(c.interno)?.[1] ?? "");
    const v = /<v>([\s\S]*?)<\/v>/.exec(c.interno)?.[1];
    if (v === undefined) return null;
    if (tipo === "s") return this.compartilhadas[Number(v)] ?? null;
    if (tipo === "str" || tipo === "e") return desescaparXml(v);
    if (tipo === "b") return v === "1" ? 1 : 0;
    return Number(v);
  }

  formula(ref: string): string | null {
    const f = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(this.celula(ref)?.interno ?? "");
    return f ? desescaparXml(f[1]) : null;
  }

  /** Grava o valor e mantém o estilo da célula; texto vai na própria célula. Tira a fórmula que houver. */
  escrever(ref: string, valor: ValorDaCelula): void {
    const c = this.celula(ref, true);
    const attrs = semAtributo(c.attrs, "t");
    if (valor === null || valor === "") { c.attrs = attrs; c.interno = ""; return; }
    if (typeof valor === "number") {
      if (!Number.isFinite(valor)) throw new Error(`Número inválido em ${this.nome}!${ref}.`);
      c.attrs = `${attrs} t="n"`;
      c.interno = `<v>${valor}</v>`;
      return;
    }
    c.attrs = `${attrs} t="inlineStr"`;
    c.interno = `<is><t xml:space="preserve">${escaparXml(valor)}</t></is>`;
  }

  /** Acrescenta o texto ao rótulo que já está na célula ("1 – NOME DO PROJETO: " + nome). */
  completar(ref: string, texto: string | null | undefined): void {
    const t = (texto ?? "").trim();
    if (!t) return;
    const rotulo = String(this.ler(ref) ?? "").replace(/\s+$/, "");
    this.escrever(ref, rotulo ? `${rotulo} ${t}` : t);
  }

  /** Esvazia as células do intervalo (valores e fórmulas), mantendo os estilos. */
  limpar(intervalo: string): void {
    const [a, b] = intervalo.split(":");
    const de = lerReferencia(a), ate = lerReferencia(b ?? a);
    for (const [r, l] of this.linhas) {
      if (r < de.linha || r > ate.linha) continue;
      for (const c of l.celulas) if (c.col >= de.col && c.col <= ate.col) { c.attrs = semAtributo(c.attrs, "t"); c.interno = ""; }
    }
  }

  /**
   * Insere `n` linhas na posição `antesDe`, com o estilo, as mesclagens de uma
   * linha e as fórmulas (relativas) da linha `modelo`. O que estava em
   * `antesDe` e abaixo desce; as fórmulas, mesclagens e intervalos acompanham.
   * Para um SUM(X7:X30) crescer, insira antes da última linha do intervalo.
   */
  inserirLinhas(antesDe: number, n: number, modelo: number): void {
    if (n <= 0) return;
    const desloca = (l: number) => (l >= antesDe ? l + n : l);
    const novas = new Map<number, Linha>();
    for (const l of this.linhas.values()) {
      l.r = desloca(l.r);
      for (const c of l.celulas) {
        c.linha = l.r;
        c.interno = c.interno.replace(/<f(\s[^>]*)?>([\s\S]*?)<\/f>/, (_, a = "", f: string) =>
          `<f${a}>${escaparXml(deslocarFormula(desescaparXml(f), antesDe, n, this.nome))}</f>`);
      }
      novas.set(l.r, l);
    }
    const linhaModelo = desloca(modelo);
    const base = novas.get(linhaModelo);
    for (let i = 0; i < n; i++) {
      const r = antesDe + i;
      novas.set(r, {
        r,
        attrs: base?.attrs ?? "",
        celulas: (base?.celulas ?? []).map(c => {
          const f = /<f(\s[^>]*)?>([\s\S]*?)<\/f>/.exec(c.interno);
          return {
            col: c.col, linha: r,
            attrs: semAtributo(c.attrs, "t"),
            interno: f ? `<f${f[1] ?? ""}>${escaparXml(copiarFormula(desescaparXml(f[2]), r - linhaModelo))}</f>` : "",
          };
        }),
      });
    }
    this.linhas = novas;

    const merges = this.merges.map(m => deslocarIntervalo(m, antesDe, n));
    for (const m of merges.filter(m => { const [a, b] = m.split(":"); return lerReferencia(a).linha === linhaModelo && lerReferencia(b ?? a).linha === linhaModelo; })) {
      const [a, b] = m.split(":");
      for (let i = 0; i < n; i++) merges.push(`${referencia(lerReferencia(a).col, antesDe + i)}:${referencia(lerReferencia(b).col, antesDe + i)}`);
    }
    this.merges = merges;

    const deslocaAtributo = (xml: string) => xml
      .replace(/(<dimension\s+ref=")([^"]+)"/, (_, a, r) => `${a}${deslocarIntervalo(r, antesDe, n)}"`)
      .replace(/(<(?:conditionalFormatting|dataValidation)\b[^>]*\ssqref=")([^"]+)"/g, (_, a, s: string) => `${a}${s.split(/\s+/).map(r => deslocarIntervalo(r, antesDe, n)).join(" ")}"`)
      .replace(/<formula>([\s\S]*?)<\/formula>/g, (_, f: string) => `<formula>${escaparXml(deslocarFormula(desescaparXml(f), antesDe, n, this.nome))}</formula>`);
    this.antes = deslocaAtributo(this.antes);
    this.depois = deslocaAtributo(this.depois);
  }

  /**
   * Repete as linhas `de` a `ate` (valores, estilos, mesclagens e fórmulas
   * relativas) na posição `antesDe`, como um bloco que se copia e se insere
   * no Excel. O que estava em `antesDe` e abaixo desce.
   */
  copiarLinhas(de: number, ate: number, antesDe: number): void {
    const n = ate - de + 1;
    if (n <= 0) return;
    // Cópia antes de inserir: inserirLinhas desloca as linhas e as fórmulas no lugar.
    const origem = Array.from({ length: n }, (_, i) => {
      const l = this.linhas.get(de + i);
      return l && { attrs: l.attrs, celulas: l.celulas.map(c => ({ ...c })) };
    });
    const mesclagens = this.merges.filter(m => {
      const [a, b] = m.split(":");
      const [la, lb] = [lerReferencia(a).linha, lerReferencia(b ?? a).linha];
      return la >= de && lb <= ate;
    });
    this.inserirLinhas(antesDe, n, de);
    const novas = (m: string) => {
      const [a, b] = m.split(":");
      const [la, lb] = [lerReferencia(a).linha, lerReferencia(b ?? a).linha];
      return la >= antesDe && lb < antesDe + n;
    };
    for (let i = 0; i < n; i++) {
      const r = antesDe + i;
      const base = origem[i];
      this.linhas.set(r, {
        r,
        attrs: base?.attrs ?? "",
        celulas: (base?.celulas ?? []).map(c => ({
          col: c.col, linha: r, attrs: c.attrs,
          interno: c.interno.replace(/<f(\s[^>]*)?>([\s\S]*?)<\/f>/, (_, a = "", f: string) =>
            `<f${a}>${escaparXml(copiarFormula(desescaparXml(f), r - (de + i)))}</f>`),
        })),
      });
    }
    const delta = antesDe - de;
    this.merges = [
      ...this.merges.filter(m => !novas(m)),
      ...mesclagens.map(m => m.split(":").map(x => { const { col, linha } = lerReferencia(x); return referencia(col, linha + delta); }).join(":")),
    ];
  }

  /** Recalcula as fórmulas e guarda o valor em cada uma; o que não sabe calcular fica sem valor guardado. */
  recalcular(): void {
    const memo = new Map<string, number>();
    const emCurso = new Set<string>();
    const valorDe = (col: number, linha: number): number => {
      const ref = referencia(col, linha);
      const guardado = memo.get(ref);
      if (guardado !== undefined) return guardado;
      const f = this.formula(ref);
      let v: number;
      if (f === null) {
        const x = this.ler(ref);
        v = typeof x === "number" ? x : 0;
      } else {
        if (emCurso.has(ref)) return NaN;
        emCurso.add(ref);
        try { v = avaliar(f); } catch { v = NaN; }
        emCurso.delete(ref);
      }
      memo.set(ref, v);
      return v;
    };
    const numerica = (col: number, linha: number) => this.formula(referencia(col, linha)) !== null || typeof this.ler(referencia(col, linha)) === "number";
    const avaliar = (formula: string): number => {
      const t = tokens(formula.replace(/^=/, ""));
      let i = 0;
      const op = (v: string) => t[i]?.tipo === "op" && (t[i] as { v: string }).v === v;
      const expressao = (): number => {
        let v = termo();
        while (op("+") || op("-")) { const s = (t[i++] as { v: string }).v; const d = termo(); v = s === "+" ? v + d : v - d; }
        return v;
      };
      const termo = (): number => {
        let v = fator();
        while (op("*") || op("/")) { const s = (t[i++] as { v: string }).v; const d = fator(); v = s === "*" ? v * d : v / d; }
        return v;
      };
      const fator = (): number => {
        const k = t[i++];
        if (!k) throw new Error("fim");
        if (k.tipo === "op" && (k.v === "+" || k.v === "-")) return k.v === "-" ? -fator() : fator();
        if (k.tipo === "num") return k.v;
        if (k.tipo === "ref") return valorDe(k.col, k.linha);
        if (k.tipo === "op" && k.v === "(") { const v = expressao(); if (!op(")")) throw new Error(")"); i++; return v; }
        if (k.tipo === "fn") {
          if (k.nome !== "SUM") throw new Error(k.nome);
          let soma = 0;
          while (!op(")")) {
            const a = t[i];
            if (a?.tipo === "faixa" && (t[i + 1]?.tipo !== "op" || [",", ";", ")"].includes((t[i + 1] as { v: string }).v))) {
              i++;
              for (let l = Math.min(a.de.linha, a.ate.linha); l <= Math.max(a.de.linha, a.ate.linha); l++)
                for (let c = Math.min(a.de.col, a.ate.col); c <= Math.max(a.de.col, a.ate.col); c++)
                  if (numerica(c, l)) soma += valorDe(c, l);
            } else soma += expressao();
            if (op(",") || op(";")) i++;
            else if (!op(")")) throw new Error("argumento");
          }
          i++;
          return soma;
        }
        throw new Error("token");
      };
      const v = expressao();
      if (i !== t.length) throw new Error("sobra");
      return v;
    };
    for (const l of this.linhas.values()) {
      for (const c of l.celulas) {
        const f = /<f(\s[^>]*)?>([\s\S]*?)<\/f>/.exec(c.interno);
        if (!f) continue;
        const v = valorDe(c.col, c.linha);
        const arredondado = Math.round(v * 1e9) / 1e9;
        c.attrs = `${semAtributo(c.attrs, "t")} t="n"`;
        c.interno = `<f${f[1] ?? ""}>${f[2]}</f>${Number.isFinite(arredondado) ? `<v>${arredondado}</v>` : ""}`;
      }
    }
  }

  xml(): string {
    const linhas = [...this.linhas.values()].sort((a, b) => a.r - b.r).map(l => {
      const celulas = [...l.celulas].sort((a, b) => a.col - b.col)
        .map(c => `<c r="${referencia(c.col, l.r)}"${c.attrs}${c.interno ? `>${c.interno}</c>` : "/>"}`).join("");
      return `<row r="${l.r}"${l.attrs}${celulas ? `>${celulas}</row>` : "/>"}`;
    }).join("");
    const merges = this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
    const depois = /<mergeCells\b[\s\S]*?<\/mergeCells>/.test(this.depois)
      ? this.depois.replace(/<mergeCells\b[\s\S]*?<\/mergeCells>/, merges)
      : this.depois.replace("</sheetData>", `</sheetData>${merges}`);
    return `${this.antes}${linhas}${depois}`;
  }
}

// ─── Pasta de trabalho ──────────────────────────────────────────────────────

export class PastaDeTrabalho {
  private arquivos: Map<string, Uint8Array>;
  private workbook: string;
  private planilhas = new Map<string, { caminho: string; indice: number; planilha: Planilha }>();

  private constructor(arquivos: Map<string, Uint8Array>) {
    this.arquivos = arquivos;
    const ler = (nome: string) => {
      const dados = arquivos.get(nome);
      if (!dados) throw new Error(`O modelo não tem ${nome}.`);
      return new TextDecoder().decode(dados);
    };
    this.workbook = ler("xl/workbook.xml");
    const rels = ler("xl/_rels/workbook.xml.rels");
    const alvos = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => [/\sId="([^"]+)"/.exec(m[0])?.[1], /\sTarget="([^"]+)"/.exec(m[0])?.[1]]));
    const compartilhadas = arquivos.has("xl/sharedStrings.xml")
      ? [...ler("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textoDosT(m[1]))
      : [];
    [...this.workbook.matchAll(/<sheet\b[^>]*>/g)].forEach((m, indice) => {
      const nome = desescaparXml(/\sname="([^"]+)"/.exec(m[0])?.[1] ?? "");
      const alvo = alvos.get(/\sr:id="([^"]+)"/.exec(m[0])?.[1]) ?? "";
      const caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo}`;
      this.planilhas.set(nome, { caminho, indice, planilha: new Planilha(nome, ler(caminho), compartilhadas) });
    });
  }

  static async abrir(xlsx: Uint8Array): Promise<PastaDeTrabalho> {
    return new PastaDeTrabalho(await lerZip(xlsx));
  }

  get nomes(): string[] {
    return [...this.planilhas.keys()];
  }

  planilha(nome: string): Planilha {
    const p = this.planilhas.get(nome);
    if (!p) throw new Error(`O modelo não tem a aba ${nome}.`);
    return p.planilha;
  }

  /** Insere linhas na aba e desloca a área de impressão dela. */
  inserirLinhas(nome: string, antesDe: number, n: number, modelo: number): void {
    if (n <= 0) return;
    this.aba(nome).planilha.inserirLinhas(antesDe, n, modelo);
    this.deslocarNomes(nome, antesDe, n);
  }

  /** Repete um bloco de linhas da aba (ver Planilha.copiarLinhas) e desloca a área de impressão. */
  copiarLinhas(nome: string, de: number, ate: number, antesDe: number): void {
    if (ate < de) return;
    this.aba(nome).planilha.copiarLinhas(de, ate, antesDe);
    this.deslocarNomes(nome, antesDe, ate - de + 1);
  }

  private aba(nome: string) {
    const p = this.planilhas.get(nome);
    if (!p) throw new Error(`O modelo não tem a aba ${nome}.`);
    return p;
  }

  private deslocarNomes(nome: string, antesDe: number, n: number): void {
    const p = this.aba(nome);
    this.workbook = this.workbook.replace(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g, (todo, attrs: string, ref: string) => {
      const local = /\slocalSheetId="(\d+)"/.exec(attrs)?.[1];
      if (local === undefined || Number(local) !== p.indice) return todo;
      return `<definedName${attrs}>${escaparXml(deslocarFormula(desescaparXml(ref), antesDe, n, nome))}</definedName>`;
    });
  }

  /** O .xlsx com as abas recalculadas; o Excel recalcula de novo ao abrir. */
  gravar(): Uint8Array {
    const utf8 = new TextEncoder();
    const saida = new Map(this.arquivos);
    for (const { caminho, planilha } of this.planilhas.values()) {
      planilha.recalcular();
      saida.set(caminho, utf8.encode(planilha.xml()));
    }
    const workbook = /<calcPr\b[^>]*\/>/.test(this.workbook)
      ? this.workbook.replace(/<calcPr\b([^>]*?)\s*\/>/, (_, a: string) => `<calcPr${semAtributo(a, "fullCalcOnLoad")} fullCalcOnLoad="1"/>`)
      : this.workbook.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
    saida.set("xl/workbook.xml", utf8.encode(workbook));
    const ordem = ["[Content_Types].xml", ...[...saida.keys()].filter(k => k !== "[Content_Types].xml")];
    const partes = partesDoZip(ordem.filter(k => saida.has(k)).map(nome => ({ nome, dados: saida.get(nome)!, data: new Date(2026, 0, 1) })));
    const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
    let i = 0;
    for (const p of partes) { total.set(p, i); i += p.length; }
    return total;
  }
}
