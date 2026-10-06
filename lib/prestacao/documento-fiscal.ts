// Leitura de documento v2 (P2.10): o XML da NF-e, da NFC-e e da NFS-e é lido
// sem IA. Entram a NF-e e a NFC-e (modelos 55 e 65), a NFS-e do padrão
// nacional, a NFS-e no padrão ABRASF (versões 1 e 2, a da maioria das
// prefeituras antes do padrão nacional) e a Nota Paulistana de São Paulo.
//
// lerDocumentoFiscal devolve os campos do documento: emitente, tomador,
// número, série, chave, emissão, valor, retenções, descrição e situação.
// despesaDoDocumento transforma a leitura nos campos da despesa e nos avisos
// para a pessoa conferir antes de salvar (nota cancelada, emitente fora dos
// fornecedores, tomador que não é o proponente, número do projeto ausente,
// nota repetida). Nada é gravado sem a pessoa confirmar. Sem React e sem
// Supabase.

import { formatarDocumento, limparDocumento } from "./fornecedores";
import type { PrestacaoFornecedor } from "@/lib/supabase/types";

// ─── XML ────────────────────────────────────────────────────────────────────

export type NoXml = { nome: string; atributos: Record<string, string>; filhos: NoXml[]; texto: string };

const LIMITE_XML = 5 * 1024 * 1024;

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Só as entidades do XML e as numéricas; DOCTYPE e entidades declaradas são ignorados. */
function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, nome: string) => {
    if (nome[0] === "#") {
      const codigo = nome[1].toLowerCase() === "x" ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : inteira;
    }
    return ENTIDADES[nome] ?? inteira;
  });
}

const semPrefixo = (nome: string) => nome.slice(nome.indexOf(":") + 1);

/**
 * Lê um XML bem formado numa árvore com os nomes sem prefixo de namespace.
 * Devolve null quando o texto não é XML ou as tags não fecham.
 */
export function lerXml(texto: string): NoXml | null {
  if (!texto || texto.length > LIMITE_XML) return null;
  const fonte = texto.replace(/^﻿/, "");
  const raiz: NoXml = { nome: "#documento", atributos: {}, filhos: [], texto: "" };
  const pilha: NoXml[] = [raiz];
  let i = 0;
  while (i < fonte.length) {
    const abre = fonte.indexOf("<", i);
    const atual = pilha[pilha.length - 1];
    if (abre === -1) {
      atual.texto += decodificar(fonte.slice(i));
      break;
    }
    if (abre > i) atual.texto += decodificar(fonte.slice(i, abre));
    if (fonte.startsWith("<!--", abre)) {
      const fim = fonte.indexOf("-->", abre + 4);
      if (fim === -1) return null;
      i = fim + 3;
    } else if (fonte.startsWith("<![CDATA[", abre)) {
      const fim = fonte.indexOf("]]>", abre + 9);
      if (fim === -1) return null;
      atual.texto += fonte.slice(abre + 9, fim);
      i = fim + 3;
    } else if (fonte.startsWith("<?", abre)) {
      const fim = fonte.indexOf("?>", abre + 2);
      if (fim === -1) return null;
      i = fim + 2;
    } else if (fonte.startsWith("<!", abre)) {
      // DOCTYPE: pulado inteiro, com o subconjunto interno, sem expandir nada.
      let profundidade = 0;
      let j = abre + 2;
      for (; j < fonte.length; j++) {
        if (fonte[j] === "[") profundidade++;
        else if (fonte[j] === "]") profundidade--;
        else if (fonte[j] === ">" && profundidade <= 0) break;
      }
      if (j >= fonte.length) return null;
      i = j + 1;
    } else if (fonte[abre + 1] === "/") {
      const fim = fonte.indexOf(">", abre);
      if (fim === -1) return null;
      const nome = semPrefixo(fonte.slice(abre + 2, fim).trim());
      if (pilha.length < 2 || atual.nome !== nome) return null;
      atual.texto = atual.texto.trim();
      pilha.pop();
      i = fim + 1;
    } else {
      const tag = /^<([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/.exec(fonte.slice(abre, abre + 4096));
      if (!tag) return null;
      const atributos: Record<string, string> = {};
      for (const a of tag[2].matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        atributos[semPrefixo(a[1])] = decodificar(a[2] ?? a[3] ?? "");
      }
      const no: NoXml = { nome: semPrefixo(tag[1]), atributos, filhos: [], texto: "" };
      atual.filhos.push(no);
      if (!tag[3]) pilha.push(no);
      i = abre + tag[0].length;
    }
  }
  if (pilha.length !== 1) return null;
  const elementos = raiz.filhos;
  return elementos.length === 1 ? elementos[0] : null;
}

/** Filho direto pelo nome; com "a/b", segue o caminho. */
export function filho(no: NoXml | null | undefined, caminho: string): NoXml | null {
  let atual = no ?? null;
  for (const nome of caminho.split("/")) {
    atual = atual?.filhos.find(f => f.nome === nome) ?? null;
    if (!atual) return null;
  }
  return atual;
}

/** Primeiro descendente com o nome, em profundidade. */
export function buscar(no: NoXml | null | undefined, nome: string): NoXml | null {
  if (!no) return null;
  for (const f of no.filhos) {
    if (f.nome === nome) return f;
    const achado = buscar(f, nome);
    if (achado) return achado;
  }
  return null;
}

function todos(no: NoXml | null | undefined, nome: string, saida: NoXml[] = []): NoXml[] {
  for (const f of no?.filhos ?? []) {
    if (f.nome === nome) saida.push(f);
    todos(f, nome, saida);
  }
  return saida;
}

const texto = (no: NoXml | null | undefined): string | null => (no?.texto ? no.texto : null);
const textoDe = (no: NoXml | null | undefined, caminho: string) => texto(filho(no, caminho));

/** Valor do XML: ponto decimal no padrão; "1.500,00" aceito nas prefeituras que usam vírgula. */
function valor(bruto: string | null): number | null {
  if (!bruto) return null;
  const limpo = bruto.trim();
  const normal = /,\d{1,2}$/.test(limpo) ? limpo.replace(/\./g, "").replace(",", ".") : limpo.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const somaDe = (...valores: (number | null)[]) => Math.round(valores.reduce<number>((s, v) => s + (v ?? 0), 0) * 100) / 100;

/** AAAA-MM-DD de "2026-03-15T10:00:00-03:00", "2026-03-15" ou "15/03/2026". */
function data(bruto: string | null): string | null {
  if (!bruto) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(bruto.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(bruto.trim());
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

// ─── Documento fiscal ───────────────────────────────────────────────────────

export type FormatoFiscal = "nfe" | "nfse_nacional" | "nfse_abrasf" | "nfse_sp";


export type ParteDoDocumento = { documento: string | null; nome: string | null };

export type DocumentoFiscalLido = {
  formato: FormatoFiscal;
  /** Tipo de comprovante: a NFC-e (modelo 65) é cupom. */
  tipo: "nfe" | "nfse" | "cupom";
  modelo: string | null;
  numero: string | null;
  serie: string | null;
  chave: string | null;
  emissao: string | null;
  /** Valor bruto do documento. */
  valor: number | null;
  /** Líquido que o próprio XML informa, quando informa. */
  liquidoInformado: number | null;
  retencoes: { iss: number; inss: number; irrf: number; outras: number };
  emitente: ParteDoDocumento;
  tomador: ParteDoDocumento;
  descricao: string | null;
  /** Descrição e informações complementares: onde o número do projeto costuma aparecer. */
  textos: string[];
  /** false quando cancelada ou não autorizada; null quando o XML não traz a situação. */
  autorizada: boolean | null;
  situacao: string | null;
};

/** desconhecido: XML válido de outro formato, que ainda pode ir para a leitura por IA. */
const ROTULO_DO_FORMATO: Record<FormatoFiscal, string> = {
  nfe: "NF-e",
  nfse_nacional: "NFS-e nacional",
  nfse_abrasf: "NFS-e no padrão ABRASF",
  nfse_sp: "NFS-e de São Paulo",
};

/** "NF-e", "NFC-e", "NFS-e nacional"… */
export function rotuloDoDocumento(doc: Pick<DocumentoFiscalLido, "formato" | "modelo">): string {
  return doc.formato === "nfe" && doc.modelo === "65" ? "NFC-e" : ROTULO_DO_FORMATO[doc.formato];
}

export type LeituraFiscal =
  | { ok: true; documento: DocumentoFiscalLido }
  | { ok: false; codigo: "invalido" | "evento" | "varias" | "desconhecido"; motivo: string };

function parte(no: NoXml | null, nomes: { documento: string[]; nome: string[] }, nomeAParte: string | null = null): ParteDoDocumento {
  const doc = nomes.documento.map(n => texto(buscar(no, n))).find(Boolean) ?? null;
  const nome = nomes.nome.map(n => texto(buscar(no, n))).find(Boolean) ?? nomeAParte;
  return { documento: doc ? limparDocumento(doc) : null, nome };
}

function descricaoDosItens(itens: string[]): string | null {
  const unicos = [...new Set(itens.filter(Boolean))];
  if (!unicos.length) return null;
  if (unicos.length <= 3) return unicos.join("; ");
  return `${unicos.slice(0, 3).join("; ")} e mais ${unicos.length - 3} ${unicos.length - 3 === 1 ? "item" : "itens"}`;
}

const SITUACOES_NFE: Record<string, string> = {
  "101": "cancelada",
  "110": "denegada",
  "135": "cancelada",
  "151": "cancelada",
  "155": "cancelada",
  "205": "denegada",
  "301": "denegada",
  "302": "denegada",
  "303": "denegada",
};

function lerNfe(raiz: NoXml, inf: NoXml): DocumentoFiscalLido {
  const ide = filho(inf, "ide");
  const modelo = textoDe(ide, "mod");
  const total = filho(inf, "total/ICMSTot");
  const retTrib = filho(inf, "total/retTrib");
  const issqn = filho(inf, "total/ISSQNtot");
  const chave = (inf.atributos.Id ?? "").replace(/^NFe/i, "") || texto(buscar(raiz, "chNFe"));
  const cStat = texto(buscar(buscar(raiz, "protNFe"), "cStat"));
  const autorizada = cStat === null ? null : cStat === "100" || cStat === "150";
  const textos = [
    ...todos(inf, "xProd").map(texto),
    textoDe(inf, "infAdic/infCpl"),
    textoDe(inf, "infAdic/infAdFisco"),
  ].filter((t): t is string => Boolean(t));
  return {
    formato: "nfe",
    tipo: modelo === "65" ? "cupom" : "nfe",
    modelo,
    numero: textoDe(ide, "nNF"),
    serie: textoDe(ide, "serie"),
    chave: chave ? limparDocumento(chave) : null,
    emissao: data(textoDe(ide, "dhEmi") ?? textoDe(ide, "dEmi")),
    valor: valor(textoDe(total, "vNF")),
    liquidoInformado: null,
    retencoes: {
      iss: valor(textoDe(issqn, "vISSRet")) ?? 0,
      inss: valor(textoDe(retTrib, "vRetPrev")) ?? 0,
      irrf: valor(textoDe(retTrib, "vIRRF")) ?? 0,
      outras: somaDe(valor(textoDe(retTrib, "vRetPIS")), valor(textoDe(retTrib, "vRetCOFINS")), valor(textoDe(retTrib, "vRetCSLL"))),
    },
    emitente: parte(filho(inf, "emit"), { documento: ["CNPJ", "CPF"], nome: ["xNome"] }),
    tomador: parte(filho(inf, "dest"), { documento: ["CNPJ", "CPF", "idEstrangeiro"], nome: ["xNome"] }),
    descricao: descricaoDosItens(todos(inf, "xProd").map(n => n.texto)),
    textos,
    autorizada,
    situacao: cStat === null ? null : autorizada ? "autorizada" : `${SITUACOES_NFE[cStat] ?? "não autorizada"} (código ${cStat})`,
  };
}

function lerNfseNacional(inf: NoXml): DocumentoFiscalLido {
  const dps = buscar(inf, "infDPS");
  const valores = filho(inf, "valores");
  const tribMun = filho(dps, "valores/trib/tribMun");
  const tribFed = filho(dps, "valores/trib/tribFed");
  const pisCofins = filho(tribFed, "piscofins");
  // tpRetISSQN: 1 não retido, 2 retido pelo tomador, 3 retido pelo intermediário.
  const issRetido = ["2", "3"].includes(textoDe(tribMun, "tpRetISSQN") ?? "");
  // tpRetPisCofins: 1 retido, 2 não retido.
  const pisCofinsRetido = textoDe(pisCofins, "tpRetPisCofins") === "1";
  const descricao = texto(buscar(dps, "xDescServ"));
  const cStat = textoDe(inf, "cStat");
  const chave = (inf.atributos.Id ?? "").replace(/^NFS/i, "");
  return {
    formato: "nfse_nacional",
    tipo: "nfse",
    modelo: null,
    numero: textoDe(inf, "nNFSe"),
    serie: null,
    chave: chave ? limparDocumento(chave) : null,
    emissao: data(textoDe(dps, "dhEmi") ?? textoDe(dps, "dCompet") ?? textoDe(inf, "dhProc")),
    valor: valor(textoDe(dps, "valores/vServPrest/vServ")),
    liquidoInformado: valor(textoDe(valores, "vLiq")),
    retencoes: {
      iss: issRetido ? valor(textoDe(valores, "vISSQN")) ?? valor(textoDe(tribMun, "vISSQN")) ?? 0 : 0,
      inss: valor(textoDe(tribFed, "vRetCP")) ?? 0,
      irrf: valor(textoDe(tribFed, "vRetIRRF")) ?? 0,
      outras: somaDe(
        valor(textoDe(tribFed, "vRetCSLL")),
        pisCofinsRetido ? valor(textoDe(pisCofins, "vPis")) : null,
        pisCofinsRetido ? valor(textoDe(pisCofins, "vCofins")) : null,
      ),
    },
    emitente: parte(filho(inf, "emit"), { documento: ["CNPJ", "CPF"], nome: ["xNome"] }),
    tomador: parte(filho(dps, "toma"), { documento: ["CNPJ", "CPF", "NIF"], nome: ["xNome"] }),
    descricao,
    textos: [descricao, texto(buscar(dps, "xInfComp"))].filter((t): t is string => Boolean(t)),
    // 100 gerada, 101 de substituição, 102 por decisão judicial, 103 avulsa; o cancelamento vem por evento.
    autorizada: cStat === null ? null : ["100", "101", "102", "103"].includes(cStat),
    situacao: cStat === null ? null : ["100", "101", "102", "103"].includes(cStat) ? "autorizada" : `não autorizada (código ${cStat})`,
  };
}

function lerNfseAbrasf(raiz: NoXml, inf: NoXml): DocumentoFiscalLido {
  const servico = buscar(inf, "Servico");
  const valores = filho(servico, "Valores");
  const v = (nome: string) => valor(texto(filho(valores, nome)));
  // IssRetido: 1 sim, 2 não (fica em Valores na versão 1 e em Servico na 2).
  const issRetido = (texto(filho(valores, "IssRetido")) ?? texto(filho(servico, "IssRetido"))) === "1";
  const descricao = texto(filho(servico, "Discriminacao"));
  const cancelada = Boolean(buscar(raiz, "NfseCancelamento") ?? buscar(raiz, "Cancelamento"));
  const prestador = buscar(inf, "PrestadorServico") ?? buscar(inf, "Prestador");
  const tomador = buscar(inf, "TomadorServico") ?? buscar(inf, "Tomador");
  return {
    formato: "nfse_abrasf",
    tipo: "nfse",
    modelo: null,
    numero: textoDe(inf, "Numero"),
    serie: null,
    chave: null,
    emissao: data(textoDe(inf, "DataEmissao") ?? texto(buscar(inf, "Competencia"))),
    valor: v("ValorServicos"),
    liquidoInformado: valor(texto(buscar(inf, "ValorLiquidoNfse"))),
    retencoes: {
      iss: issRetido ? v("ValorIssRetido") ?? v("ValorIss") ?? valor(texto(buscar(inf, "ValorIss"))) ?? 0 : 0,
      inss: v("ValorInss") ?? 0,
      irrf: v("ValorIr") ?? 0,
      outras: somaDe(v("ValorPis"), v("ValorCofins"), v("ValorCsll"), v("OutrasRetencoes")),
    },
    emitente: parte(prestador, { documento: ["Cnpj", "Cpf"], nome: ["RazaoSocial", "NomeFantasia"] }),
    tomador: parte(tomador, { documento: ["Cnpj", "Cpf"], nome: ["RazaoSocial"] }),
    descricao,
    textos: [descricao, texto(buscar(inf, "OutrasInformacoes"))].filter((t): t is string => Boolean(t)),
    autorizada: cancelada ? false : null,
    situacao: cancelada ? "cancelada" : null,
  };
}

function lerNfseSp(no: NoXml): DocumentoFiscalLido {
  const t = (nome: string) => texto(filho(no, nome));
  const v = (nome: string) => valor(t(nome));
  const issRetido = (t("ISSRetido") ?? "").toLowerCase() === "true";
  // StatusNFe: N normal, C cancelada, E extraviada.
  const status = t("StatusNFe");
  const descricao = t("Discriminacao");
  return {
    formato: "nfse_sp",
    tipo: "nfse",
    modelo: null,
    numero: textoDe(no, "ChaveNFe/NumeroNFe"),
    serie: null,
    chave: null,
    emissao: data(t("DataEmissaoNFe") ?? t("DataEmissaoRPS")),
    valor: v("ValorServicos"),
    liquidoInformado: null,
    retencoes: {
      iss: issRetido ? v("ValorISS") ?? 0 : 0,
      inss: v("ValorINSS") ?? 0,
      irrf: v("ValorIR") ?? 0,
      outras: somaDe(v("ValorPIS"), v("ValorCOFINS"), v("ValorCSLL")),
    },
    emitente: parte(filho(no, "CPFCNPJPrestador"), { documento: ["CNPJ", "CPF"], nome: [] }, t("RazaoSocialPrestador")),
    tomador: parte(filho(no, "CPFCNPJTomador"), { documento: ["CNPJ", "CPF"], nome: [] }, t("RazaoSocialTomador")),
    descricao,
    textos: [descricao].filter((x): x is string => Boolean(x)),
    autorizada: status === null ? null : status === "N",
    situacao: status === null ? null : status === "N" ? "autorizada" : status === "C" ? "cancelada" : "extraviada",
  };
}

/** Lê o XML da NF-e, NFC-e ou NFS-e. Sem IA: o que o XML não traz fica vazio. */
export function lerDocumentoFiscal(xml: string): LeituraFiscal {
  const raiz = lerXml(xml);
  if (!raiz) return { ok: false, codigo: "invalido", motivo: "O arquivo não é um XML válido." };
  if (/^(procEventoNFe|evento|envEvento|procEventoNFSe|pedRegEvento)$/i.test(raiz.nome) || buscar(raiz, "infEvento")) {
    return { ok: false, codigo: "evento", motivo: "Este XML é um evento (cancelamento ou carta de correção), não a nota." };
  }
  const infNFe = raiz.nome === "infNFe" ? raiz : buscar(raiz, "infNFe");
  if (infNFe) return { ok: true, documento: lerNfe(raiz, infNFe) };
  const infNFSe = raiz.nome === "infNFSe" ? raiz : buscar(raiz, "infNFSe");
  if (infNFSe) return { ok: true, documento: lerNfseNacional(infNFSe) };
  const infAbrasf = raiz.nome === "InfNfse" ? raiz : buscar(raiz, "InfNfse");
  if (infAbrasf) return { ok: true, documento: lerNfseAbrasf(raiz, infAbrasf) };
  // Nota Paulistana: o elemento NFe com ChaveNFe, solto ou dentro do retorno da consulta.
  const paulistanas = filho(raiz, "ChaveNFe") ? [raiz] : todos(raiz, "NFe").filter(n => filho(n, "ChaveNFe"));
  if (paulistanas.length > 1) return { ok: false, codigo: "varias", motivo: `O XML traz ${paulistanas.length} notas; envie uma de cada vez.` };
  if (paulistanas.length === 1 && filho(paulistanas[0], "ValorServicos")) return { ok: true, documento: lerNfseSp(paulistanas[0]) };
  return { ok: false, codigo: "desconhecido", motivo: "O XML não é de NF-e, NFC-e nem NFS-e num formato conhecido." };
}

export function ehXml(arquivo: { name: string; type: string }): boolean {
  return /\.xml$/i.test(arquivo.name) || /[/+]xml$/i.test(arquivo.type);
}

// ─── Despesa a partir do documento ──────────────────────────────────────────

export type AvisoDoDocumento = { nivel: "alerta" | "info"; texto: string };

export type DespesaSugerida = {
  campos: {
    tipo: DocumentoFiscalLido["tipo"];
    valor_extraido: number | null;
    data_doc: string | null;
    descricao_servico: string | null;
    numero_documento: string | null;
    serie: string | null;
    chave_acesso: string | null;
    iss: number;
    inss: number;
    irrf: number;
    outras_retencoes: number;
    identificacao_projeto: "presente" | null;
  };
  fornecedorId: string | null;
  avisos: AvisoDoDocumento[];
};

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function quem(p: ParteDoDocumento): string {
  const doc = p.documento ? formatarDocumento(p.documento) : null;
  return [p.nome, doc ? `(${doc})` : null].filter(Boolean).join(" ") || "sem identificação";
}

/**
 * O identificador do projeto (PRONAC, número do processo) aparece no texto,
 * com ou sem pontos, barras e espaços, e não grudado em outros algarismos.
 */
export function identificadorNoTexto(identificador: string | null | undefined, textos: readonly string[]): boolean {
  const limpo = String(identificador ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (limpo.length < 4) return false;
  const padrao = new RegExp(`(?<![0-9A-Z])${[...limpo].join("[\\s./-]?")}(?![0-9A-Z])`, "i");
  return textos.some(t => padrao.test(t));
}

/** Os campos da despesa e o que conferir antes de salvar. */
export function despesaDoDocumento(doc: DocumentoFiscalLido, contexto: {
  fornecedores: readonly Pick<PrestacaoFornecedor, "id" | "documento">[];
  proponente: ParteDoDocumento | null;
  identificador: string | null;
  /** Chaves já usadas na prestação, com o nome do arquivo. */
  chavesUsadas: readonly { chave: string; nome: string }[];
}): DespesaSugerida {
  const avisos: AvisoDoDocumento[] = [];
  if (doc.autorizada === false) {
    avisos.push({ nivel: "alerta", texto: `A nota está ${doc.situacao ?? "sem autorização"}: não serve como comprovante.` });
  } else if (doc.autorizada === null && doc.formato === "nfe") {
    avisos.push({ nivel: "info", texto: "O XML não traz o protocolo de autorização; confira a nota no portal da SEFAZ." });
  }
  if (doc.valor === null) avisos.push({ nivel: "alerta", texto: "O XML não traz o valor da nota; preencha à mão." });

  const repetida = doc.chave ? contexto.chavesUsadas.find(c => limparDocumento(c.chave) === doc.chave) : null;
  if (repetida) avisos.push({ nivel: "alerta", texto: `Esta nota já está na prestação, em "${repetida.nome}".` });

  const emitente = doc.emitente.documento ? limparDocumento(doc.emitente.documento) : null;
  const fornecedor = emitente ? contexto.fornecedores.find(f => limparDocumento(f.documento) === emitente) ?? null : null;
  if (emitente && !fornecedor) {
    avisos.push({ nivel: "info", texto: `O emitente ${quem(doc.emitente)} não está nos fornecedores da organização. Cadastre-o em Fornecedores para ligar à despesa.` });
  }

  const proponente = contexto.proponente?.documento ? limparDocumento(contexto.proponente.documento) : null;
  const tomador = doc.tomador.documento ? limparDocumento(doc.tomador.documento) : null;
  if (proponente && tomador && proponente !== tomador) {
    avisos.push({ nivel: "alerta", texto: `A nota foi emitida para ${quem(doc.tomador)}, e não para o proponente ${quem(contexto.proponente!)}.` });
  } else if (proponente && !tomador && doc.tipo !== "cupom") {
    avisos.push({ nivel: "info", texto: "A nota não identifica o tomador; o comprovante tem de estar em nome do proponente." });
  }

  const presente = identificadorNoTexto(contexto.identificador, doc.textos);
  if (contexto.identificador && !presente) {
    avisos.push({ nivel: "info", texto: `O número do projeto (${contexto.identificador}) não aparece na nota.` });
  }

  const retido = somaDe(doc.retencoes.iss, doc.retencoes.inss, doc.retencoes.irrf, doc.retencoes.outras);
  if (doc.valor !== null && doc.liquidoInformado !== null && Math.abs(doc.valor - retido - doc.liquidoInformado) > 0.01) {
    avisos.push({ nivel: "info", texto: `O líquido da nota (${reais(doc.liquidoInformado)}) difere do valor menos as retenções (${reais(Math.round((doc.valor - retido) * 100) / 100)}); confira descontos e retenções.` });
  }

  return {
    campos: {
      tipo: doc.tipo,
      valor_extraido: doc.valor,
      data_doc: doc.emissao,
      descricao_servico: doc.descricao,
      numero_documento: doc.numero,
      serie: doc.serie,
      // Só a chave no formato que o banco aceita (44 ou 50 posições); outra fica de fora.
      chave_acesso: doc.chave && /^([0-9A-Z]{44}|[0-9A-Z]{50})$/.test(doc.chave) ? doc.chave : null,
      iss: doc.retencoes.iss,
      inss: doc.retencoes.inss,
      irrf: doc.retencoes.irrf,
      outras_retencoes: doc.retencoes.outras,
      identificacao_projeto: presente ? "presente" : null,
    },
    fornecedorId: fornecedor?.id ?? null,
    avisos,
  };
}
