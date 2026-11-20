// Um PDF simples de texto (título, seções com linhas, rodapé) e, quando a seção tem uma, o desenho da planta,
// feito no navegador com pdf-lib e as fontes padrão do PDF. Serve ao rider, à lista de canais, à energia e à
// ficha técnica do espaço. Sem rede e sem banco.

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from "pdf-lib";
import { desenhoDaPlanta, medidaDaPlanta, type PlantaParaPdf } from "@/lib/producao/planta-desenho";

export type SecaoDoPdf = { titulo: string; linhas: string[]; planta?: PlantaParaPdf };
/** A imagem do topo (o logo de quem manda a ficha): os bytes e o formato, que o PDF só desenha em PNG ou JPEG. */
export type LogoDoPdf = { bytes: Uint8Array; tipo: "png" | "jpg" };
export type DocumentoDoPdf = { titulo: string; subtitulo?: string; secoes: SecaoDoPdf[]; rodape: string; logoUrl?: string };

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;
const SUBSTITUICOES: Record<string, string> = { "≈": "~", "≥": ">=", "≤": "<=", "→": "->", "…": "...", "•": "-", "’": "'", "‘": "'", "“": '"', "”": '"' };

/** O texto só com o que a fonte do PDF sabe escrever (acentos do português valem; o resto vira o parecido ou some). */
export function textoSeguro(texto: string, fonte: PDFFont): string {
  const conhecidos = new Set(fonte.getCharacterSet());
  return Array.from(texto.replace(/\s+/g, " ").trim()).map(c => (conhecidos.has(c.codePointAt(0) ?? 0) ? c : SUBSTITUICOES[c] ?? "")).join("");
}

/** Quebra o texto em linhas que cabem em `largura` pontos. */
export function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura || !atual) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);
  return linhas.length > 0 ? linhas : [""];
}

/** A altura máxima da planta desenhada, em pontos (meia página útil). */
const ALTURA_DA_PLANTA = 330;

/** A altura máxima do logo no topo, em pontos (a largura segue a proporção da imagem). */
const ALTURA_DO_LOGO = 40;

/** Monta o PDF (A4, margens de 56 pt, quebra de página e rodapé com a página). O logo, quando vem, abre a primeira página. */
export async function montarPdf(documento: DocumentoDoPdf, logo?: LogoDoPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const larguraUtil = A4.largura - MARGEM * 2;
  let pagina = pdf.addPage([A4.largura, A4.altura]);
  let y = A4.altura - MARGEM;

  const garantir = (altura: number) => {
    if (y - altura >= MARGEM + 20) return;
    pagina = pdf.addPage([A4.largura, A4.altura]);
    y = A4.altura - MARGEM;
  };
  const escrever = (texto: string, fonte: PDFFont, tamanho: number, opcoes: { recuo?: number; cor?: [number, number, number]; espaco?: number } = {}) => {
    const recuo = opcoes.recuo ?? 0;
    const entrelinha = tamanho * 1.35;
    for (const linha of quebrar(textoSeguro(texto, fonte), fonte, tamanho, larguraUtil - recuo)) {
      garantir(entrelinha);
      y -= entrelinha;
      pagina.drawText(linha, { x: MARGEM + recuo, y, size: tamanho, font: fonte, color: rgb(...(opcoes.cor ?? [0.157, 0.145, 0.145])) });
    }
    y -= opcoes.espaco ?? 0;
  };

  if (logo) {
    // Imagem quebrada não derruba o PDF: sem o logo, o documento sai igual.
    try {
      const imagem = logo.tipo === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
      const { width, height } = imagem.scaleToFit(larguraUtil, ALTURA_DO_LOGO);
      y -= height;
      pagina.drawImage(imagem, { x: MARGEM, y, width, height });
      y -= 14;
    } catch { /* segue sem o logo */ }
  }

  /** O desenho da planta: a caixa da sala, cada objeto (girado, se for o caso) e o rótulo que couber dentro dele. */
  const desenharPlanta = (planta: PlantaParaPdf) => {
    const desenho = desenhoDaPlanta(planta, larguraUtil, ALTURA_DA_PLANTA);
    garantir(desenho.altura + 26);
    y -= 8 + desenho.altura;
    const base = { x: MARGEM, y };
    pagina.drawRectangle({ ...base, width: desenho.largura, height: desenho.altura, borderWidth: 1, borderColor: rgb(0.72, 0.72, 0.72), color: rgb(0.985, 0.985, 0.985) });
    for (const forma of desenho.formas) {
      pagina.drawRectangle({
        x: base.x + forma.x, y: base.y + forma.y, width: forma.largura, height: forma.altura, rotate: degrees(forma.rotacao),
        borderWidth: 0.75, borderColor: rgb(0.45, 0.42, 0.52), color: rgb(0.89, 0.87, 0.93), opacity: 0.85, borderOpacity: 1,
      });
    }
    for (const forma of desenho.formas) {
      const rotulo = textoSeguro(forma.rotulo, normal);
      const tamanho = 6.5;
      const largura = normal.widthOfTextAtSize(rotulo, tamanho);
      // Rótulo que não cabe no objeto fica de fora: o desenho não vira uma mancha de letras.
      if (largura > Math.max(forma.largura, forma.altura) - 2) continue;
      pagina.drawText(rotulo, { x: base.x + forma.centroX - largura / 2, y: base.y + forma.centroY - tamanho / 3, size: tamanho, font: normal, color: rgb(0.2, 0.18, 0.24) });
    }
    y -= 2;
    escrever(`${planta.nome} · ${medidaDaPlanta(planta)}`, normal, 8.5, { cor: [0.55, 0.55, 0.55], espaco: 2 });
  };

  escrever(documento.titulo, negrito, 18, { espaco: 4 });
  if (documento.subtitulo) escrever(documento.subtitulo, normal, 10, { cor: [0.4, 0.4, 0.4], espaco: 10 });
  for (const secao of documento.secoes) {
    garantir(40);
    y -= 10;
    escrever(secao.titulo.toUpperCase(), negrito, 9.5, { cor: [0.35, 0.35, 0.35], espaco: 3 });
    pagina.drawLine({ start: { x: MARGEM, y: y + 2 }, end: { x: A4.largura - MARGEM, y: y + 2 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 4;
    if (secao.linhas.length === 0 && !secao.planta) escrever("—", normal, 10.5, { cor: [0.55, 0.55, 0.55] });
    for (const linha of secao.linhas) escrever(linha, normal, 10.5, { espaco: 1.5 });
    if (secao.planta) desenharPlanta(secao.planta);
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, indice) => {
    const texto = textoSeguro(`${documento.rodape} · página ${indice + 1} de ${paginas.length}`, normal);
    p.drawText(texto, { x: MARGEM, y: MARGEM - 24, size: 8, font: normal, color: rgb(0.55, 0.55, 0.55) });
  });
  return pdf.save();
}
