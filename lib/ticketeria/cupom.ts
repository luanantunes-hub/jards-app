// Os cupons de desconto da Ticketeria: a conta do desconto (a mesma de fn_ticketeria_desconto_do_ingresso, no banco), a leitura do formulário do produtor, as
// frases da tela e o que a página de compra mostra. Só lógica: sem banco, sem tela e sem import de servidor (roda no navegador e nos testes).
// Dinheiro sempre em centavos inteiros. Regras: desconto por ingresso; porcentagem arredondada ao centavo; valor fixo nunca passa do preço; ingresso de preço zero
// não recebe desconto; a taxa do Jards é sobre o preço com desconto (isso o banco calcula).

import { emCentavos, formatarReais, lerValorEmReais } from "@/lib/producao/dinheiro";
import type { TipoDoCupom } from "@/lib/ticketeria/estados";
import { instanteNoFuso } from "@/lib/ticketeria/eventos";
import type { FaixaDePreco } from "@/lib/ticketeria/vitrine";

const FUSO = "America/Sao_Paulo";

/** O código como o banco o guarda: sem espaços nas pontas e em maiúsculas. */
export const normalizarCodigo = (bruto: unknown): string => (typeof bruto === "string" ? bruto.trim().toUpperCase() : "");
export const codigoDoCupomValido = (codigo: string) => /^[A-Z0-9]{3,20}$/.test(codigo);

/** O desconto de UM ingresso de `preco` centavos. */
export function descontoDoIngresso(preco: number, tipo: TipoDoCupom, valor: number): number {
  if (!(preco > 0)) return 0;
  return tipo === "percentual" ? Math.min(preco, Math.round((preco * valor) / 100)) : Math.min(preco, valor);
}

/** O que o banco responde ao conferir um código para uma sessão. */
export type CupomConferido = { codigo: string; tipo: TipoDoCupom; valor: number; ingresso_id: string | null };

/** A resposta de fn_ticketeria_cupom_conferir, conferida; null se veio algo que não se entende. */
export function lerCupomConferido(resposta: unknown): CupomConferido | null {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as Record<string, unknown>;
  if (typeof r.codigo !== "string" || (r.tipo !== "percentual" && r.tipo !== "valor") || typeof r.valor !== "number" || !Number.isInteger(r.valor) || r.valor < 1) return null;
  if (r.ingresso_id !== null && r.ingresso_id !== undefined && typeof r.ingresso_id !== "string") return null;
  return { codigo: r.codigo, tipo: r.tipo, valor: r.valor, ingresso_id: (r.ingresso_id as string | null | undefined) ?? null };
}

/** O desconto de `quantidade` ingressos de um tipo, tirando das faixas de preço em ordem (como o banco tira dos lotes). 0 se não há tantos ou o cupom não vale para o ingresso. */
export function descontoNasFaixas(faixas: readonly FaixaDePreco[], quantidade: number, cupom: Pick<CupomConferido, "tipo" | "valor" | "ingresso_id">, ingressoId: string): number {
  if (cupom.ingresso_id !== null && cupom.ingresso_id !== ingressoId) return 0;
  let falta = quantidade;
  let desconto = 0;
  for (const f of faixas) {
    const tira = Math.min(f.livres, falta);
    desconto += tira * descontoDoIngresso(f.preco_centavos, cupom.tipo, cupom.valor);
    falta -= tira;
    if (falta <= 0) break;
  }
  return falta > 0 ? 0 : desconto;
}

/** "20% de desconto" ou "R$ 10,00 de desconto por ingresso". */
export function descontoEmTexto(tipo: TipoDoCupom, valor: number): string {
  return tipo === "percentual" ? `${valor}% de desconto` : `${formatarReais(valor)} de desconto por ingresso`;
}

/** O erro do banco ao reservar com cupom, numa frase para o comprador; null se o erro não é de cupom. */
export function mensagemDoErroDoCupom(mensagem: string): string | null {
  if (mensagem.includes("cupom_invalido")) return "Esse cupom não existe ou não está mais valendo.";
  if (mensagem.includes("cupom_vencido")) return "Esse cupom venceu.";
  if (mensagem.includes("cupom_esgotado")) return "Esse cupom já foi usado todas as vezes.";
  if (mensagem.includes("cupom_nao_vale")) return "Esse cupom não vale para os ingressos escolhidos.";
  return null;
}

// ─── A tela do produtor ─────────────────────────────────────────────────────

export type SituacaoDoCupom = "ativo" | "esgotado" | "vencido" | "desativado";

/** A situação de um cupom: desativado, vencido, esgotado (usos no limite) ou ativo. */
export function situacaoDoCupom(c: { ativo: boolean; valido_ate: string | null; limite_usos: number | null; usos: number }, agora: number = Date.now()): SituacaoDoCupom {
  if (!c.ativo) return "desativado";
  if (c.valido_ate && Date.parse(c.valido_ate) <= agora) return "vencido";
  if (c.limite_usos !== null && c.usos >= c.limite_usos) return "esgotado";
  return "ativo";
}

/** O dia da validade em dd/mm/aaaa, no fuso de Brasília. */
export function validadeEmTexto(iso: string | null): string | null {
  if (!iso) return null;
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  return partes;
}

/** O dia da validade como o campo de data o quer (aaaa-mm-dd), no fuso de Brasília. */
export function validadeParaCampo(iso: string | null): string {
  if (!iso) return "";
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return d;
}

export type CamposDoCupom = { codigo: string; tipo: TipoDoCupom; valor: string; limite: string; ate: string };
export type LeituraDoCupom =
  | { ok: true; valor: { codigo: string; tipo: TipoDoCupom; valor: number; limite_usos: number | null; valido_ate: string | null } }
  | { ok: false; erro: string };

/** Lê o que a pessoa digitou no formulário do cupom. */
export function lerCupom(campos: CamposDoCupom): LeituraDoCupom {
  const codigo = normalizarCodigo(campos.codigo);
  if (!codigoDoCupomValido(codigo)) return { ok: false, erro: "O código leva de 3 a 20 letras e números, sem espaços nem acentos." };
  let valor: number;
  if (campos.tipo === "percentual") {
    const bruto = campos.valor.trim().replace(/%$/, "").trim();
    valor = /^\d{1,3}$/.test(bruto) ? Number(bruto) : Number.NaN;
    if (!Number.isInteger(valor) || valor < 1 || valor > 100) return { ok: false, erro: "A porcentagem vai de 1 a 100." };
  } else {
    const reais = lerValorEmReais(campos.valor);
    if (reais === null || reais <= 0) return { ok: false, erro: "Escreva o valor em reais, como 10 ou 7,50." };
    if (reais > 100000) return { ok: false, erro: "O valor vai até R$ 100.000 por ingresso." };
    valor = emCentavos(reais);
  }
  let limite_usos: number | null = null;
  if (campos.limite.trim() !== "") {
    const bruto = campos.limite.trim().replace(/\./g, "");
    limite_usos = /^\d+$/.test(bruto) ? Number(bruto) : Number.NaN;
    if (!Number.isInteger(limite_usos) || (limite_usos as number) < 1 || (limite_usos as number) > 1000000) return { ok: false, erro: "O limite de usos vai de 1 a 1.000.000 (ou deixe em branco)." };
  }
  let valido_ate: string | null = null;
  if (campos.ate.trim() !== "") {
    valido_ate = instanteNoFuso(campos.ate.trim(), "23:59", FUSO);
    if (!valido_ate) return { ok: false, erro: "Esse dia não existe." };
  }
  return { ok: true, valor: { codigo, tipo: campos.tipo, valor, limite_usos, valido_ate } };
}

/** O valor do cupom como o formulário o mostra: "20" ou "10,00". */
export function valorParaCampo(tipo: TipoDoCupom, valor: number): string {
  return tipo === "percentual" ? String(valor) : (valor / 100).toFixed(2).replace(".", ",");
}

/** O erro do banco ao gravar um cupom, numa frase. */
export function mensagemDoErroDeGravarCupom(erro: { code?: string; message?: string }): string {
  const m = erro.message ?? "";
  if (erro.code === "42501") return "Você não pode mudar a Ticketeria desta organização.";
  if (erro.code === "23505" || m.includes("ticketeria_cupons_evento_codigo_key")) return "Já existe um cupom com esse código neste evento.";
  if (m.includes("cupom_ingresso_de_outro_evento")) return "Esse ingresso não é deste evento.";
  return "Não foi possível salvar o cupom. Tente de novo.";
}
