// A hospedagem da temporada (plano do módulo, PD6.7): conferência do formulário com as regras do banco, as vagas de cada
// quarto e a lista de quartos (rooming list) em texto. Sem tela e sem banco.

import { diaEMes } from "@/lib/producao/agenda";

export type HospedagemLida = { hotel: string; endereco: string | null; entrada: string | null; saida: string | null; localizador: string | null; notas: string | null };
export type LeituraDaHospedagem = { ok: true; hospedagem: HospedagemLida } | { ok: false; erro: string };

const texto = (valor: string) => (valor.trim() === "" ? null : valor.trim());
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** A hospedagem como o banco aceita (hotel até 200, endereço até 300, localizador até 80, notas até 2.000; saída só com entrada, e não antes dela). */
export function lerHospedagem(c: { hotel: string; endereco: string; entrada: string; saida: string; localizador: string; notas: string }): LeituraDaHospedagem {
  const hotel = c.hotel.trim();
  if (hotel === "") return { ok: false, erro: "Informe o nome do hotel." };
  if (hotel.length > 200) return { ok: false, erro: "O nome do hotel pode ter até 200 letras." };
  const endereco = texto(c.endereco), localizador = texto(c.localizador), notas = texto(c.notas);
  if (endereco && endereco.length > 300) return { ok: false, erro: "O endereço pode ter até 300 letras." };
  if (localizador && localizador.length > 80) return { ok: false, erro: "O localizador pode ter até 80 letras." };
  if (notas && notas.length > 2000) return { ok: false, erro: "As notas podem ter até 2.000 letras." };
  const entrada = texto(c.entrada), saida = texto(c.saida);
  if ((entrada && !DATA.test(entrada)) || (saida && !DATA.test(saida))) return { ok: false, erro: "A entrada e a saída são datas." };
  if (saida && !entrada) return { ok: false, erro: "Informe a entrada antes da saída." };
  if (entrada && saida && saida < entrada) return { ok: false, erro: "A saída vem antes da entrada." };
  return { ok: true, hospedagem: { hotel, endereco, entrada, saida, localizador, notas } };
}

export type QuartoLido = { nome: string; capacidade: number };
export type LeituraDoQuarto = { ok: true; quarto: QuartoLido } | { ok: false; erro: string };

/** O quarto como o banco aceita (nome até 100; capacidade inteira de 1 a 12). */
export function lerQuarto(c: { nome: string; capacidade: string }): LeituraDoQuarto {
  const nome = c.nome.trim();
  if (nome === "") return { ok: false, erro: "Dê um nome ao quarto, como \"101\"." };
  if (nome.length > 100) return { ok: false, erro: "O nome do quarto pode ter até 100 letras." };
  const capacidade = Number(c.capacidade.trim() === "" ? "2" : c.capacidade.trim());
  if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 12) return { ok: false, erro: "A capacidade é um número inteiro de 1 a 12." };
  return { ok: true, quarto: { nome, capacidade } };
}

type QuartoParaLista = { id: string; nome: string; capacidade: number };
type OcupanteParaLista = { quarto_id: string; pessoa_id: string };

/** Quantas vagas faltam no quarto. */
export function vagasDoQuarto(quarto: QuartoParaLista, ocupantes: readonly OcupanteParaLista[]): number {
  return Math.max(0, quarto.capacidade - ocupantes.filter(ocupante => ocupante.quarto_id === quarto.id).length);
}

/** As pessoas que ainda não têm quarto nesta hospedagem (a ordem de entrada é mantida). */
export function pessoasSemQuarto<T extends { id: string }>(pessoas: readonly T[], ocupantes: readonly OcupanteParaLista[]): T[] {
  const comQuarto = new Set(ocupantes.map(ocupante => ocupante.pessoa_id));
  return pessoas.filter(pessoa => !comQuarto.has(pessoa.id));
}

/** O período "04 dez a 06 dez", "a partir de 04 dez" ou "" sem datas. */
export function periodoDaHospedagem(entrada: string | null, saida: string | null): string {
  if (!entrada) return "";
  return saida && saida !== entrada ? `${diaEMes(entrada)} a ${diaEMes(saida)}` : `a partir de ${diaEMes(entrada)}`;
}

/**
 * A lista de quartos em texto, pronta para colar numa mensagem ao hotel: o hotel e o período, depois cada quarto com quem
 * dorme nele (quarto vazio aparece "vago"), e no fim quem ainda está sem quarto.
 */
export function listaDeQuartos(
  hospedagem: { hotel: string; entrada: string | null; saida: string | null },
  quartos: readonly QuartoParaLista[], ocupantes: readonly OcupanteParaLista[], nomes: ReadonlyMap<string, string>,
): string {
  const periodo = periodoDaHospedagem(hospedagem.entrada, hospedagem.saida);
  const linhas = [`${hospedagem.hotel}${periodo ? ` (${periodo})` : ""}`];
  const ordenados = [...quartos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  for (const quarto of ordenados) {
    const nomesDoQuarto = ocupantes.filter(ocupante => ocupante.quarto_id === quarto.id).map(ocupante => nomes.get(ocupante.pessoa_id) ?? "Pessoa").sort((a, b) => a.localeCompare(b, "pt-BR"));
    linhas.push(`Quarto ${quarto.nome} (${quarto.capacidade} ${quarto.capacidade === 1 ? "lugar" : "lugares"}): ${nomesDoQuarto.length > 0 ? nomesDoQuarto.join(", ") : "vago"}`);
  }
  return linhas.join("\n");
}
