// Relatório de Cumprimento do Objeto da LIE em .docx (P8.3).
//
// O RCO 2026 é um documento do Word com os títulos das seções e textos de
// orientação, alguns em vermelho, que o proponente troca pelo conteúdo. Aqui o
// modelo oficial (public/modelos/lie/modelo-rco-2026.docx) é aberto como ZIP e
// cada orientação dá lugar ao que o rascunho do relatório (P4.3,
// relatorio-objeto.ts) já monta: os dados do projeto, o objeto, os resultados,
// as alterações, os locais, a tabela de metas e as considerações finais. O que
// falta sai em vermelho entre colchetes, como as orientações do modelo; a
// lista de documentos, a tabela de aplicação financeira e a autenticação ficam
// como estão. Sem React e sem Supabase.

import { escaparXml, desescaparXml } from "../xlsx-modelo";
import { lerZip, partesDoZip } from "../zip";
import { formatarDocumento } from "./fornecedores";
import type { Paragrafo, RascunhoDoRelatorio, SecaoDoRelatorio } from "./relatorio-objeto";

export type DadosDoRco = {
  etapa: "parcial" | "final";
  projeto: string;
  sli: string | null;
  proponente: string | null;
  cnpj: string | null;
  /** Número do processo no SEI (P8.8). */
  processo?: string | null;
};

// ─── Corpo do documento em blocos ───────────────────────────────────────────

type Segmento = { bloco: boolean; xml: string };

/** Separa o corpo em parágrafos e tabelas de primeiro nível, com o que fica entre eles. */
export function segmentosDoCorpo(corpo: string): Segmento[] {
  const saida: Segmento[] = [];
  const re = /<(\/?)w:(p|tbl)(?=[\s>/])[^>]*?(\/?)>/g;
  let profundidade = 0, inicio = 0, fim = 0;
  for (const m of corpo.matchAll(re)) {
    const i = m.index ?? 0;
    const fecha = m[1] === "/", sozinha = m[3] === "/";
    if (sozinha) {
      if (profundidade === 0) {
        if (i > fim) saida.push({ bloco: false, xml: corpo.slice(fim, i) });
        saida.push({ bloco: true, xml: m[0] });
        fim = i + m[0].length;
      }
      continue;
    }
    if (!fecha) {
      if (profundidade === 0) {
        if (i > fim) saida.push({ bloco: false, xml: corpo.slice(fim, i) });
        inicio = i;
      }
      profundidade++;
    } else {
      profundidade--;
      if (profundidade === 0) {
        fim = i + m[0].length;
        saida.push({ bloco: true, xml: corpo.slice(inicio, fim) });
      }
    }
  }
  if (fim < corpo.length) saida.push({ bloco: false, xml: corpo.slice(fim) });
  return saida;
}

export const textoDoBloco = (xml: string) =>
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => desescaparXml(m[1])).join("").replace(/\s+/g, " ").trim();

// ─── Peças novas ────────────────────────────────────────────────────────────

const VERMELHO = '<w:color w:val="FF0000"/>';

function run(texto: string, opcoes: { negrito?: boolean; vermelho?: boolean; tamanho?: number; semNegrito?: boolean } = {}): string {
  const rPr = [
    opcoes.negrito ? "<w:b/><w:bCs/>" : opcoes.semNegrito ? '<w:b w:val="0"/><w:bCs w:val="0"/>' : "",
    opcoes.vermelho ? VERMELHO : "",
    opcoes.tamanho ? `<w:sz w:val="${opcoes.tamanho}"/><w:szCs w:val="${opcoes.tamanho}"/>` : "",
  ].join("");
  const partes = texto.split("\n").map(p => `<w:t xml:space="preserve">${escaparXml(p)}</w:t>`).join("<w:br/>");
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}${partes}</w:r>`;
}

const lacunaEmRun = (texto: string, tamanho?: number) => run(`[${texto}]`, { vermelho: true, tamanho });

function runsDoParagrafo(p: Paragrafo, tamanho?: number): string {
  return p.map(t => (t.tipo === "lacuna" ? lacunaEmRun(t.texto, tamanho) : run(t.texto, { tamanho }))).join("");
}

function paragrafo(runs: string, recuo = true): string {
  return `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/>${recuo ? '<w:ind w:firstLine="709"/>' : ""}<w:jc w:val="both"/></w:pPr>${runs}</w:p>`;
}

const BORDA = (lado: string) => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;

function tabela(colunas: readonly string[], linhas: readonly Paragrafo[][]): string {
  const largura = Math.floor(9000 / Math.max(colunas.length, 1));
  const celula = (conteudo: string, cabecalho: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${cabecalho ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : ""}</w:tcPr>`
    + `<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${conteudo}</w:p></w:tc>`;
  const cabecalho = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${colunas.map(c => celula(run(c, { negrito: true, tamanho: 18 }), true)).join("")}</w:tr>`;
  const corpo = linhas.map(l => `<w:tr>${colunas.map((_, i) => celula(runsDoParagrafo(l[i] ?? [], 18), false)).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(BORDA).join("")}</w:tblBorders>`
    + `<w:tblLayout w:type="autofit"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${colunas.map(() => `<w:gridCol w:w="${largura}"/>`).join("")}</w:tblGrid>${cabecalho}${corpo}</w:tbl>`;
}

/** O texto da pessoa em parágrafos; vazio e obrigatório vira lacuna. */
function paragrafosDoComplemento(s: SecaoDoRelatorio | undefined): string[] {
  const c = s?.complemento;
  if (!c) return [];
  const linhas = c.valor.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (linhas.length) return linhas.map(l => paragrafo(run(l)));
  return c.obrigatorio ? [paragrafo(lacunaEmRun(`preencher: ${c.rotulo.toLowerCase()}`))] : [];
}

/** Parágrafos, tabela e texto da pessoa de uma seção, nessa ordem. */
function blocosDaSecao(s: SecaoDoRelatorio | undefined): string[] {
  if (!s) return [];
  return [
    ...(s.tabela ? [tabela(s.tabela.colunas, s.tabela.linhas)] : []),
    ...s.paragrafos.map(p => paragrafo(runsDoParagrafo(p))),
    ...paragrafosDoComplemento(s),
  ];
}

// ─── Edições no modelo ──────────────────────────────────────────────────────

const pPrDe = (xml: string) => /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(xml)?.[0] ?? "";
const rPrDoPrimeiroRun = (xml: string) => /<w:r(?:\s[^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(xml)?.[1] ?? "";

/** O parágrafo com o texto trocado, mantendo o estilo do parágrafo e do primeiro trecho. */
function comTexto(xml: string, texto: string): string {
  return `<w:p>${pPrDe(xml)}<w:r>${rPrDoPrimeiroRun(xml)}<w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r></w:p>`;
}

/** Acrescenta trechos ao fim do parágrafo. */
const acrescentar = (xml: string, runs: string) => xml.replace(/<\/w:p>\s*$/, `${runs}</w:p>`);

/** Troca os trechos em vermelho do parágrafo por um texto comum. */
function semVermelho(xml: string, texto: string): string {
  let primeiro = true;
  return xml.replace(/<w:r(?:\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<w:color w:val="FF0000"\/>[\s\S]*?<\/w:r>/g, () => {
    if (!primeiro) return "";
    primeiro = false;
    return run(texto);
  });
}

export async function gravarRco(modelo: Uint8Array, r: RascunhoDoRelatorio, dados: DadosDoRco): Promise<Uint8Array> {
  const arquivos = await lerZip(modelo);
  const bytes = arquivos.get("word/document.xml");
  if (!bytes) throw new Error("O modelo do RCO não tem word/document.xml.");
  const doc = new TextDecoder().decode(bytes);
  const abre = doc.indexOf("<w:body>") + "<w:body>".length;
  const fecha = doc.lastIndexOf("</w:body>");
  const segmentos = segmentosDoCorpo(doc.slice(abre, fecha));
  const secao = (id: string) => r.secoes.find(s => s.id === id);

  const achar = (prefixo: string) => segmentos.findIndex(s => s.bloco && textoDoBloco(s.xml).toUpperCase().startsWith(prefixo.toUpperCase()));
  const trocar = (indice: number, blocos: string[]) => {
    if (indice >= 0) segmentos.splice(indice, 1, ...blocos.map(xml => ({ bloco: true, xml })));
  };
  const editar = (prefixo: string, f: (xml: string) => string) => {
    const i = achar(prefixo);
    if (i >= 0) segmentos[i] = { bloco: true, xml: f(segmentos[i].xml) };
  };

  // Título e dados do projeto.
  editar("PRESTAÇÃO DE CONTAS", xml => comTexto(xml, `PRESTAÇÃO DE CONTAS ${dados.etapa === "parcial" ? "PARCIAL" : "FINAL"}`));
  const dadosDoProjeto = secao("dados");
  const temComplemento = Boolean(dadosDoProjeto?.complemento?.valor.trim());
  const campo = (rotulo: string, valor: string | null, lacuna = "preencher") =>
    editar(rotulo, xml => acrescentar(xml, valor ? run(` ${valor}`, { semNegrito: true }) : run(` [${lacuna}]`, { vermelho: true, semNegrito: true })));
  campo("PROCESSO Nº:", dados.processo?.trim() || null);
  campo("SLIE/SLI:", dados.sli);
  campo("PROPONENTE:", dados.proponente);
  campo("PROJETO:", dados.projeto);
  campo("CNPJ:", dados.cnpj ? formatarDocumento(dados.cnpj) : null);
  if (!temComplemento) for (const rotulo of ["MANIFESTAÇÃO DESPORTIVA:", "MODALIDADES:", "RESPONSÁVEL LEGAL:"]) campo(rotulo, null);
  else {
    const i = achar("RESPONSÁVEL LEGAL:");
    if (i >= 0) segmentos.splice(i + 1, 0, ...paragrafosDoComplemento(dadosDoProjeto).map(xml => ({ bloco: true, xml })));
  }

  // Consecução do objeto.
  if (dados.proponente) editar("A execução do projeto desportivo", xml => semVermelho(xml, `a entidade “${dados.proponente}`));
  const objeto = secao("objeto")?.complemento?.valor.trim();
  if (objeto) editar("Constitui-se como objeto do projeto", xml => semVermelho(xml, objeto));
  trocar(achar("Relatar os resultados esperados"), blocosDaSecao(secao("resultados")));
  trocar(achar("Em caso de alterações ao longo"), blocosDaSecao(secao("alteracoes")));
  trocar(achar("Informar o local de execução"), blocosDaSecao(secao("locais")));

  // Metas: as orientações saem e a tabela entra.
  const deMetas = achar("Neste tópico, deverá conter");
  const ateMetas = achar("ATENÇÃO: Atentar-se");
  if (deMetas >= 0 && ateMetas >= deMetas) {
    segmentos.splice(deMetas, ateMetas - deMetas + 1, ...blocosDaSecao(secao("metas")).map(xml => ({ bloco: true, xml })));
  }

  // Aplicação financeira, quando a pessoa escreveu.
  const aplicacao = paragrafosDoComplemento(secao("aplicacao"));
  if (aplicacao.length) trocar(achar("*Informar em quais ações"), aplicacao);

  // Considerações finais: o texto da pessoa e a frase de cumprimento (ou a lacuna).
  const consideracoes = secao("consideracoes");
  const iRessalta = achar("Ressalta-se que foi atingido");
  if (iRessalta >= 0) segmentos.splice(iRessalta, 1);
  trocar(achar("Apresentar neste campo as considerações"), [
    ...paragrafosDoComplemento(consideracoes),
    ...(consideracoes?.paragrafos ?? []).map(p => paragrafo(runsDoParagrafo(p))),
  ]);

  const saida = new Map(arquivos);
  saida.set("word/document.xml", new TextEncoder().encode(doc.slice(0, abre) + segmentos.map(s => s.xml).join("") + doc.slice(fecha)));
  const ordem = ["[Content_Types].xml", ...[...saida.keys()].filter(k => k !== "[Content_Types].xml")];
  const partes = partesDoZip(ordem.filter(k => saida.has(k)).map(nome => ({ nome, dados: saida.get(nome)!, data: new Date(2026, 0, 1) })));
  const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of partes) { total.set(p, i); i += p.length; }
  return total;
}

export const nomeDoRco = (d: Pick<DadosDoRco, "etapa" | "sli" | "projeto">) =>
  `RCO_${d.etapa === "parcial" ? "PCP" : "PCF"}_${(d.sli || d.projeto).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "projeto"}.docx`;
