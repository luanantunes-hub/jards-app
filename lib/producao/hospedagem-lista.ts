// A lista de quartos como o hotel recebe (PD8.6): só o que ele precisa para receber o grupo. Sem banco e sem tela: quem chama
// (a página pública do link) entrega as linhas já lidas. Nunca entra contato, documento, nota ou dinheiro: a função só copia os
// campos abaixo e o nome de cada pessoa.

import { periodoDaHospedagem, rotuloDaCama } from "@/lib/producao/hospedagem";

export type QuartoDoHotel = { nome: string; capacidade: number; cama: string; hospedes: string[]; vagas: number };
export type ListaParaOHotel = {
  hotel: string; endereco: string | null; periodo: string; localizador: string | null;
  quartos: QuartoDoHotel[]; hospedes: number;
};

type HospedagemLida = { hotel: string; endereco: string | null; entrada: string | null; saida: string | null; localizador: string | null };

/** Quartos em ordem natural ("2" antes de "10"), cada um com os nomes (em ordem alfabética) e as vagas que sobram. */
export function quartosParaOHotel(
  hospedagem: HospedagemLida,
  quartos: readonly { id: string; nome: string; capacidade: number; cama?: string | null }[],
  ocupantes: readonly { quarto_id: string; pessoa_id: string }[],
  pessoas: readonly { id: string; nome: string }[],
): ListaParaOHotel {
  const nomes = new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome]));
  const lista = [...quartos]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }))
    .map(quarto => {
      const hospedes = ocupantes
        .filter(ocupante => ocupante.quarto_id === quarto.id)
        .map(ocupante => nomes.get(ocupante.pessoa_id) ?? "Hóspede")
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      return { nome: quarto.nome, capacidade: quarto.capacidade, cama: rotuloDaCama(quarto.cama), hospedes, vagas: Math.max(0, quarto.capacidade - hospedes.length) };
    });
  return {
    hotel: hospedagem.hotel,
    endereco: hospedagem.endereco,
    periodo: periodoDaHospedagem(hospedagem.entrada, hospedagem.saida),
    localizador: hospedagem.localizador,
    quartos: lista,
    hospedes: lista.reduce((soma, quarto) => soma + quarto.hospedes.length, 0),
  };
}
