// Folha de carimbos e atestos das notas (P8.8), em PDF.
//
// Um bloco por nota, em A4: a identificação da nota (documento, fornecedor,
// emissão e valor) e, lado a lado, o carimbo da frente e o atesto do verso
// com o texto do modelo da DPPIE. Serve de etiqueta para colar na nota ou de
// conferência antes de carimbar. Sem React e sem Supabase.

import { frenteDoCarimbo, versoDoCarimbo } from "./carimbo";
import { paraWinAnsi } from "./relatorio-pdf";

export type NotaDaFolha = {
  documento: string;
  fornecedor: string;
  emissao: string | null;
  valor: string | null;
  atestadoEm: string | null;
};

export type DadosDaFolha = { projeto: string; sli: string | null; lei: string | null; notas: readonly NotaDaFolha[] };

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 36;
const ALTURA_DO_BLOCO = 118;
const ESPACO = 10;

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export async function gerarFolhaDeCarimbos(d: DadosDaFolha): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(paraWinAnsi(`Carimbos e atestos · ${d.projeto}`));
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const TINTA = rgb(0.05, 0.05, 0.05);
  const SUAVE = rgb(0.45, 0.45, 0.45);
  const BORDA = rgb(0.75, 0.75, 0.75);

  const largura = A4[0] - 2 * MARGEM;
  const porPagina = Math.floor((A4[1] - 2 * MARGEM - 28 + ESPACO) / (ALTURA_DO_BLOCO + ESPACO));
  const frente = frenteDoCarimbo(d.sli, d.lei);
  const notas = d.notas.length ? d.notas : [{ documento: "", fornecedor: "", emissao: null, valor: null, atestadoEm: null }];
  const paginas = Math.ceil(notas.length / porPagina);

  const texto = (p: ReturnType<typeof pdf.addPage>, t: string, x: number, y: number, tam: number, fonte = normal, cor = TINTA, max?: number) => {
    let s = paraWinAnsi(t);
    if (max) while (s.length > 1 && fonte.widthOfTextAtSize(s, tam) > max) s = `${s.slice(0, -2)}…`;
    p.drawText(paraWinAnsi(s), { x, y, size: tam, font: fonte, color: cor });
  };
  const centrado = (p: ReturnType<typeof pdf.addPage>, t: string, cx: number, y: number, tam: number, fonte = normal) => {
    const s = paraWinAnsi(t);
    p.drawText(s, { x: cx - fonte.widthOfTextAtSize(s, tam) / 2, y, size: tam, font: fonte, color: TINTA });
  };

  for (let pg = 0; pg < paginas; pg++) {
    const p = pdf.addPage(A4);
    let y = A4[1] - MARGEM;
    texto(p, "Carimbos e atestos das notas", MARGEM, y - 12, 12, negrito);
    texto(p, `${d.projeto}${d.sli ? ` · SLI ${d.sli}` : ""} · página ${pg + 1} de ${paginas}`, MARGEM, y - 24, 8, normal, SUAVE, largura);
    y -= 28 + ESPACO;

    for (const n of notas.slice(pg * porPagina, (pg + 1) * porPagina)) {
      const topo = y;
      // Identificação da nota.
      const ident = [n.documento, n.fornecedor, n.emissao ? `emissão ${dataBr(n.emissao)}` : "", n.valor ?? ""].filter(Boolean).join(" · ");
      texto(p, ident || "Nota", MARGEM, topo - 10, 8, negrito, TINTA, largura);
      // Dois quadros: frente e verso.
      const meio = largura / 2;
      const alturaDoQuadro = ALTURA_DO_BLOCO - 18;
      for (const [i, linhas, titulo] of [[0, frente, "FRENTE"], [1, versoDoCarimbo(n.atestadoEm), "VERSO"]] as const) {
        const x = MARGEM + i * (meio + 4);
        const w = meio - 4;
        p.drawRectangle({ x, y: topo - 16 - alturaDoQuadro, width: w, height: alturaDoQuadro, borderColor: BORDA, borderWidth: 0.75 });
        texto(p, titulo, x + 6, topo - 26, 6, normal, SUAVE);
        const cx = x + w / 2;
        let ly = topo - 16 - (alturaDoQuadro - linhas.length * 14) / 2 - 10;
        for (const l of linhas) {
          centrado(p, l, cx, ly, i === 1 && l.startsWith("ATESTO") ? 8 : 9.5, l === linhas[0] || l === "ASSINATURA" ? negrito : normal);
          ly -= 14;
        }
      }
      y -= ALTURA_DO_BLOCO + ESPACO;
    }
  }
  return pdf.save();
}
