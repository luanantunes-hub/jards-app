// Abastecimento e quilometragem do motorista (plano do módulo, PD6.4, primeiro corte): conferência do que ele digita na folha,
// os motivos que o banco devolve em texto e as contas de distância e consumo. Sem tela e sem banco.

import { COMBUSTIVEIS_DO_VEICULO, type CombustivelDoVeiculo } from "@/lib/producao/estados";

export const LIMITE_DO_ODOMETRO_KM = 9_999_999;

export type RegistroDaViagem = {
  p_odometro_saida: number | null; p_odometro_chegada: number | null; p_litros: number | null; p_combustivel: CombustivelDoVeiculo | null; p_posto: string | null;
};
export type LeituraDoRegistro = { ok: true; args: RegistroDaViagem } | { ok: false; erro: string };

const vazio = (texto: string) => texto.trim() === "";

/** Número inteiro de quilômetros ("10.412", "10412"); nulo se vazio; "invalido" se não for inteiro de 0 ao limite. */
export function lerOdometro(texto: string): number | null | "invalido" {
  if (vazio(texto)) return null;
  const limpo = texto.trim().replace(/\./g, "");
  if (!/^\d+$/.test(limpo)) return "invalido";
  const km = Number(limpo);
  return km <= LIMITE_DO_ODOMETRO_KM ? km : "invalido";
}

/** Litros com vírgula ou ponto ("45,3"); nulo se vazio; "invalido" fora de 0,1 a 9.999 (duas casas no máximo). */
function lerLitros(texto: string): number | null | "invalido" {
  if (vazio(texto)) return null;
  const normal = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return "invalido";
  const litros = Number(normal);
  return litros >= 0.1 && litros <= 9999 ? litros : "invalido";
}

/**
 * O que o motorista digitou, como a função do banco aceita: odômetros inteiros, litros com até duas casas, combustível da lista
 * (obrigatório quando há litros). Ao menos um valor; a chegada não vem antes da saída (vale também contra o que já estava gravado).
 */
export function lerRegistroDaViagem(
  c: { odometroSaida: string; odometroChegada: string; litros: string; combustivel: string; posto: string },
  jaGravado: { saida: number | null; chegada: number | null } = { saida: null, chegada: null },
): LeituraDoRegistro {
  const saida = lerOdometro(c.odometroSaida), chegada = lerOdometro(c.odometroChegada), litros = lerLitros(c.litros);
  if (saida === "invalido") return { ok: false, erro: "O odômetro da saída é um número inteiro de quilômetros." };
  if (chegada === "invalido") return { ok: false, erro: "O odômetro da chegada é um número inteiro de quilômetros." };
  if (litros === "invalido") return { ok: false, erro: "Os litros são um número de 0,1 a 9.999 (até duas casas, como 45,3)." };
  if (saida === null && chegada === null && litros === null) return { ok: false, erro: "Preencha o odômetro ou o abastecimento." };
  const saidaFinal = saida ?? jaGravado.saida, chegadaFinal = chegada ?? jaGravado.chegada;
  if (saidaFinal !== null && chegadaFinal !== null && chegadaFinal < saidaFinal) return { ok: false, erro: "O odômetro da chegada não pode ser menor que o da saída." };
  let combustivel: CombustivelDoVeiculo | null = null;
  if (litros !== null) {
    if (!(COMBUSTIVEIS_DO_VEICULO as readonly string[]).includes(c.combustivel)) return { ok: false, erro: "Escolha o combustível do abastecimento." };
    combustivel = c.combustivel as CombustivelDoVeiculo;
  }
  const posto = c.posto.trim();
  if (posto.length > 200) return { ok: false, erro: "O nome do posto pode ter até 200 letras." };
  return { ok: true, args: { p_odometro_saida: saida, p_odometro_chegada: chegada, p_litros: litros, p_combustivel: combustivel, p_posto: posto === "" ? null : posto } };
}

/** O que cada motivo devolvido pela função do banco quer dizer, para a pessoa. */
export const TEXTO_DO_MOTIVO: Record<string, string> = {
  sem_acesso: "Seu acesso a esta data não está ativo. Fale com a produção.",
  nao_e_motorista: "Só quem dirige este deslocamento registra a viagem.",
  data_cancelada: "Esta data foi cancelada.",
  odometro_invalido: "Confira o odômetro: a chegada não pode ser menor que a saída.",
  litros_invalidos: "Confira os litros (de 0,1 a 9.999).",
  combustivel_invalido: "Escolha o combustível do abastecimento.",
  nada_a_registrar: "Preencha o odômetro ou o abastecimento.",
};

/** Os quilômetros rodados (chegada menos saída); nulo se falta um dos dois ou se a conta não fecha. */
export function kmRodados(saida: number | null, chegada: number | null): number | null {
  if (saida === null || chegada === null || chegada < saida) return null;
  return chegada - saida;
}

/** O consumo real em km por litro (uma casa); nulo sem distância ou sem litros. */
export function consumoReal(km: number | null, litros: number): number | null {
  if (km === null || km <= 0 || litros <= 0) return null;
  return Math.round((km / litros) * 10) / 10;
}

const numero = (n: number, casas: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

/** "412 km rodados · 45,3 L · 9,1 km/l", só com o que existe; vazio se não há nada. */
export function textoDaViagem(v: { odometro_saida_km: number | null; odometro_chegada_km: number | null; litros: number }): string {
  const km = kmRodados(v.odometro_saida_km, v.odometro_chegada_km);
  const partes: string[] = [];
  if (km !== null) partes.push(`${numero(km, 0)} km rodados`);
  if (v.litros > 0) partes.push(`${numero(v.litros, 2)} L`);
  const consumo = consumoReal(km, v.litros);
  if (consumo !== null) partes.push(`${numero(consumo, 1)} km/l`);
  return partes.join(" · ");
}
