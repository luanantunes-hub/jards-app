// O abastecimento digitado pela produção (plano do módulo, PD6.4, segundo corte): conferência do formulário com as regras do banco
// (litros de 0,1 a 9.999, combustível da lista, posto até 200 letras, valor de 0 a 99.999,99) e as contas do trajeto: litros, total
// gasto e preço médio do litro. Sem tela e sem banco.

import { COMBUSTIVEIS_DO_VEICULO, type CombustivelDoVeiculo } from "@/lib/producao/estados";
import { lerLitros } from "@/lib/producao/viagem-motorista";

export type AbastecimentoLido = { litros: number; combustivel: CombustivelDoVeiculo; posto: string | null; valor: number | null };
export type LeituraDoAbastecimento = { ok: true; abastecimento: AbastecimentoLido } | { ok: false; erro: string };

/** O abastecimento como o banco aceita. `lerValor` é o leitor de reais da tela ("59,90" → 59.9; inválido → nulo). */
export function lerAbastecimento(
  c: { litros: string; combustivel: string; posto: string; valor: string },
  lerValor: (texto: string) => number | null,
): LeituraDoAbastecimento {
  const litros = lerLitros(c.litros);
  if (litros === null || litros === "invalido") return { ok: false, erro: "Os litros são um número de 0,1 a 9.999 (até duas casas, como 45,3)." };
  if (!(COMBUSTIVEIS_DO_VEICULO as readonly string[]).includes(c.combustivel)) return { ok: false, erro: "Escolha o combustível." };
  const posto = c.posto.trim();
  if (posto.length > 200) return { ok: false, erro: "O nome do posto pode ter até 200 letras." };
  let valor: number | null = null;
  if (c.valor.trim() !== "") {
    valor = lerValor(c.valor);
    if (valor === null || valor > 99999.99) return { ok: false, erro: "O valor é em reais, de 0 a 99.999,99 (como 280,50)." };
  }
  return { ok: true, abastecimento: { litros, combustivel: c.combustivel as CombustivelDoVeiculo, posto: posto === "" ? null : posto, valor } };
}

export type ResumoDosAbastecimentos = {
  quantidade: number; litros: number; valorCentavos: number;
  /** Preço médio do litro, só com os abastecimentos que têm valor; nulo quando nenhum tem. */
  precoDoLitroCentavos: number | null;
  semValor: number;
};

/** O trajeto somado: litros, total gasto e preço médio do litro (os abastecimentos sem valor ficam fora da média e são contados). */
export function resumoDosAbastecimentos(linhas: readonly { litros: number; valor: number | null }[]): ResumoDosAbastecimentos {
  let litros = 0, litrosComValor = 0, valorCentavos = 0, semValor = 0;
  for (const linha of linhas) {
    litros += Number(linha.litros);
    if (linha.valor === null || linha.valor === undefined) { semValor += 1; continue; }
    litrosComValor += Number(linha.litros);
    valorCentavos += Math.round(Number(linha.valor) * 100);
  }
  return {
    quantidade: linhas.length, litros: Math.round(litros * 100) / 100, valorCentavos,
    precoDoLitroCentavos: litrosComValor > 0 && valorCentavos > 0 ? Math.round(valorCentavos / litrosComValor) : null, semValor,
  };
}
