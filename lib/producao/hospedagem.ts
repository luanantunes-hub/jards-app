// A hospedagem da temporada (plano do módulo, PD6.7): conferência do formulário com as regras do banco, as vagas de cada
// quarto e a lista de quartos (rooming list) em texto. Sem tela e sem banco.

import { diaEMes } from "@/lib/producao/agenda";
import { CAMAS_DO_QUARTO, type CamaDoQuarto } from "@/lib/producao/estados";

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

const ROTULOS_DA_CAMA: Record<CamaDoQuarto, string> = {
  casal: "Cama de casal", solteiro: "Cama de solteiro", duas_solteiro: "Duas camas de solteiro", casal_e_solteiro: "Casal e solteiro", beliche: "Beliche",
};

/** O nome da cama como se lê na tela e na lista ("Cama de casal"); sem cama dita, vazio. */
export function rotuloDaCama(cama: string | null | undefined): string {
  return cama && cama in ROTULOS_DA_CAMA ? ROTULOS_DA_CAMA[cama as CamaDoQuarto] : "";
}

export type QuartoLido = { nome: string; capacidade: number; cama: CamaDoQuarto | null };
export type LeituraDoQuarto = { ok: true; quarto: QuartoLido } | { ok: false; erro: string };

/** O quarto como o banco aceita (nome até 100; capacidade inteira de 1 a 12; cama da lista fechada ou nenhuma). */
export function lerQuarto(c: { nome: string; capacidade: string; cama?: string }): LeituraDoQuarto {
  const nome = c.nome.trim();
  if (nome === "") return { ok: false, erro: "Dê um nome ao quarto, como \"101\"." };
  if (nome.length > 100) return { ok: false, erro: "O nome do quarto pode ter até 100 letras." };
  const capacidade = Number(c.capacidade.trim() === "" ? "2" : c.capacidade.trim());
  if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 12) return { ok: false, erro: "A capacidade é um número inteiro de 1 a 12." };
  const cama = (c.cama ?? "").trim();
  if (cama !== "" && !(CAMAS_DO_QUARTO as readonly string[]).includes(cama)) return { ok: false, erro: "Escolha uma das camas da lista." };
  return { ok: true, quarto: { nome, capacidade, cama: cama === "" ? null : (cama as CamaDoQuarto) } };
}

type QuartoParaLista = { id: string; nome: string; capacidade: number; cama?: string | null };
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

export type MovimentoDeQuarto = { ok: true; acao: "tirar" | "pôr" | "trocar" | "nada" } | { ok: false; motivo: string };

/**
 * Se a pessoa pode ir para o quarto (ou sair de todos, com destino nulo): o quarto de destino precisa ter vaga; a mesma pessoa no
 * mesmo quarto, ou sem quarto indo para "sem quarto", não muda nada. Devolve o que fazer ou o motivo.
 */
export function movimentoDeQuarto(
  quartos: readonly QuartoParaLista[], ocupantes: readonly OcupanteParaLista[], pessoaId: string, destinoId: string | null,
): MovimentoDeQuarto {
  const atual = ocupantes.find(ocupante => ocupante.pessoa_id === pessoaId)?.quarto_id ?? null;
  if (destinoId === atual) return { ok: true, acao: "nada" };
  if (destinoId === null) return { ok: true, acao: "tirar" };
  const quarto = quartos.find(item => item.id === destinoId);
  if (!quarto) return { ok: false, motivo: "O quarto não existe mais. Recarregue a página." };
  if (vagasDoQuarto(quarto, ocupantes) <= 0) return { ok: false, motivo: `O quarto ${quarto.nome} está completo.` };
  return { ok: true, acao: atual === null ? "pôr" : "trocar" };
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
    const cama = rotuloDaCama(quarto.cama).toLowerCase();
    linhas.push(`Quarto ${quarto.nome} (${quarto.capacidade} ${quarto.capacidade === 1 ? "lugar" : "lugares"}${cama ? `, ${cama}` : ""}): ${nomesDoQuarto.length > 0 ? nomesDoQuarto.join(", ") : "vago"}`);
  }
  return linhas.join("\n");
}
