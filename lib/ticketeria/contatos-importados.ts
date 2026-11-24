// A importação de contatos de uma planilha para o Público: adivinhar as colunas (nome, e-mail, WhatsApp), ler as linhas e separar o que serve do que não serve, e conferir de novo o que
// chega ao servidor. Sem banco e sem imports de servidor: roda no navegador (a folha de importar) e nos testes (tests/ticketeria-contatos-importados.test.ts).
//
// O arquivo é lido NO NAVEGADOR; só os contatos que passaram na conferência (nome, e-mail e, se houver, WhatsApp) vão ao servidor. Contato importado só recebe divulgação se o produtor
// DECLARAR que as pessoas aceitaram receber (a declaração fica gravada, com o texto e a data); sem a declaração, entra no Público como "sem aceite" e não recebe nada.

import { lerWhatsapp } from "@/lib/ticketeria/novidades";

/** O máximo de contatos por importação (o arquivo pode ter mais linhas; o resto fica para a próxima). */
export const MAX_CONTATOS_POR_IMPORTACAO = 5000;
export const MAX_PROBLEMAS_MOSTRADOS = 50;

/** O texto que o produtor aceita ao declarar. TROCAR O TEXTO = trocar a versão: a importação grava a versão que ele viu. */
export const VERSAO_DA_DECLARACAO = "2026-11-21";
export const textoDaDeclaracao = (loja: string) => `Declaro que estas pessoas aceitaram receber novidades e ofertas de ${loja} e que posso enviá-las. Sei que cada e-mail terá um link para sair da lista.`;

/** O mesmo e-mail que o banco aceita (ticketeria_saidas_email_check): até 254 letras, uma @, um ponto depois dela, sem espaços; sempre em minúsculas. */
export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ContatoImportado = { nome: string; email: string; whatsapp: string | null };
export type MapaDeContatos = { nome: number | null; email: number | null; whatsapp: number | null };

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const PALAVRAS: Record<keyof MapaDeContatos, RegExp> = {
  email: /\b(e-?mail|email|mail|correio)\b/,
  whatsapp: /\b(whats(app)?|zap|celular|telefone|fone|tel|phone|mobile)\b/,
  nome: /\b(nome|name|contato|cliente|pessoa|comprador)\b/,
};

/** Chuta quais colunas são quais pelo nome do cabeçalho (o produtor confere e muda). Cada coluna só serve a um campo; o e-mail vem primeiro, para "e-mail do contato" não virar nome. */
export function adivinharColunasDeContatos(cabecalho: string[]): MapaDeContatos {
  const mapa: MapaDeContatos = { nome: null, email: null, whatsapp: null };
  const usadas = new Set<number>();
  for (const campo of ["email", "whatsapp", "nome"] as const) {
    const i = cabecalho.findIndex((c, idx) => !usadas.has(idx) && PALAVRAS[campo].test(sem(c)));
    if (i >= 0) { mapa[campo] = i; usadas.add(i); }
  }
  return mapa;
}

export type Problema = { linha: number; motivo: "sem_email" | "email_invalido" };
export type ContatosLidos = {
  contatos: ContatoImportado[];
  /** Quantas linhas tinham algo e quantas foram usadas, repetidas (mesmo e-mail) e sem utilidade. */
  lidas: number; repetidos: number; whatsapp_invalidos: number;
  problemas: Problema[]; problemas_total: number;
  /** Sobraram contatos além do limite por importação. */
  passou_do_limite: boolean;
};

const textoDe = (linha: string[], i: number | null) => (i === null ? "" : (linha[i] ?? "").trim());

/** O nome limpo (espaços juntos, até 120 letras); sem nome, a parte do e-mail antes do @. */
export function nomeDoContato(nome: string, email: string): string {
  const limpo = nome.replace(/\s+/g, " ").trim().slice(0, 120);
  return limpo !== "" ? limpo : (email.split("@")[0] || email).slice(0, 120);
}

/** Lê as linhas com o mapa de colunas: e-mail válido e único (o primeiro vale), nome limpo e WhatsApp do Brasil (número torto vira "sem WhatsApp", a pessoa entra do mesmo jeito). */
export function lerContatos(linhas: string[][], mapa: MapaDeContatos): ContatosLidos {
  const saida: ContatosLidos = { contatos: [], lidas: 0, repetidos: 0, whatsapp_invalidos: 0, problemas: [], problemas_total: 0, passou_do_limite: false };
  if (mapa.email === null) return saida;
  const vistos = new Set<string>();
  linhas.forEach((linha, i) => {
    if (linha.every(c => c.trim() === "")) return;
    saida.lidas++;
    const email = textoDe(linha, mapa.email).toLowerCase();
    const falha = (motivo: Problema["motivo"]) => { saida.problemas_total++; if (saida.problemas.length < MAX_PROBLEMAS_MOSTRADOS) saida.problemas.push({ linha: i + 2, motivo }); };
    if (email === "") { falha("sem_email"); return; }
    if (email.length > 254 || !EMAIL_VALIDO.test(email)) { falha("email_invalido"); return; }
    if (vistos.has(email)) { saida.repetidos++; return; }
    vistos.add(email);
    if (saida.contatos.length >= MAX_CONTATOS_POR_IMPORTACAO) { saida.passou_do_limite = true; return; }
    const bruto = textoDe(linha, mapa.whatsapp);
    const whatsapp = bruto === "" ? null : lerWhatsapp(bruto);
    if (bruto !== "" && whatsapp === null) saida.whatsapp_invalidos++;
    saida.contatos.push({ nome: nomeDoContato(textoDe(linha, mapa.nome), email), email, whatsapp });
  });
  return saida;
}

export type CorpoDaImportacaoDeContatos = { arquivo: string; declaro: boolean; contatos: ContatoImportado[] };

/** O corpo do pedido HTTP, conferido de novo no servidor: nada que chega é confiável. */
export function lerCorpoDaImportacaoDeContatos(entrada: unknown): { ok: true; corpo: CorpoDaImportacaoDeContatos } | { ok: false; problema: string } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  if (!Array.isArray(e.contatos) || e.contatos.length === 0 || e.contatos.length > MAX_CONTATOS_POR_IMPORTACAO) return { ok: false, problema: "contatos" };
  const vistos = new Set<string>();
  const contatos: ContatoImportado[] = [];
  for (const bruto of e.contatos) {
    const c = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
    const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
    if (email === "" || email.length > 254 || !EMAIL_VALIDO.test(email)) return { ok: false, problema: "e-mail" };
    if (vistos.has(email)) continue;
    vistos.add(email);
    const whatsapp = typeof c.whatsapp === "string" && c.whatsapp !== "" ? lerWhatsapp(c.whatsapp) : null;
    contatos.push({ nome: nomeDoContato(typeof c.nome === "string" ? c.nome : "", email), email, whatsapp });
  }
  const arquivo = (typeof e.arquivo === "string" ? e.arquivo : "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return { ok: true, corpo: { arquivo: arquivo === "" ? "planilha" : arquivo, declaro: e.declaro === true, contatos } };
}

/** O modelo de CSV para o produtor baixar. */
export const MODELO_DE_CONTATOS = "Nome;E-mail;WhatsApp\nRita Almeida;rita@email.com;(15) 99712-4410\nCarlos Menezes;carlos@email.com;\n";
