// As licenças e liberações de uma data (plano do módulo, PD4.9): rótulos, a leitura do formulário e os avisos
// (prazo vencido, validade que acaba antes da data, licença negada). Sem tela e sem banco.

import { SITUACOES_DA_LICENCA, TIPOS_DE_LICENCA, type SituacaoDaLicenca, type TipoDeLicenca } from "@/lib/producao/estados";
import { somarDias } from "@/lib/producao/tarefas";

export const ROTULO_DO_TIPO_DE_LICENCA: Record<TipoDeLicenca, string> = {
  alvara: "Alvará", avcb: "AVCB (bombeiros)", ecad: "ECAD", sbat: "SBAT", juizado_menores: "Juizado de Menores", via_publica: "Uso de via pública", filmagem: "Autorização de filmagem", outro: "Outra liberação",
};

export const ROTULO_DA_SITUACAO_DA_LICENCA: Record<SituacaoDaLicenca, string> = {
  a_pedir: "A pedir", pedida: "Pedida", concedida: "Concedida", negada: "Negada", dispensada: "Dispensada",
};

/** Em aberto: a licença ainda não foi resolvida (a pedir ou pedida). */
export const licencaEmAberto = (situacao: SituacaoDaLicenca) => situacao === "a_pedir" || situacao === "pedida";

export type LicencaDaData = {
  id: string; tipo: TipoDeLicenca; situacao: SituacaoDaLicenca; responsavel_pessoa_id: string | null; prazo_dias: number | null;
  validade: string | null; protocolo: string | null; notas: string | null;
};

/** O prazo de pedir em data: a data do evento mais os dias (negativos são antes). */
export function prazoDaLicenca(dataDoEvento: string, prazoDias: number | null): string | null {
  return prazoDias === null ? null : somarDias(dataDoEvento, prazoDias);
}

/** "30 dias antes da data", "no dia da data", "2 dias depois da data". */
export function textoDoPrazo(prazoDias: number | null): string {
  if (prazoDias === null) return "sem prazo";
  if (prazoDias === 0) return "no dia da data";
  const n = Math.abs(prazoDias);
  return `${n} ${n === 1 ? "dia" : "dias"} ${prazoDias < 0 ? "antes" : "depois"} da data`;
}

export type LeituraDaLicenca =
  | { ok: true; licenca: { tipo: TipoDeLicenca; situacao: SituacaoDaLicenca; responsavel_pessoa_id: string | null; prazo_dias: number | null; validade: string | null; protocolo: string | null; notas: string | null } }
  | { ok: false; erro: string };

/**
 * A licença como o banco aceita. O prazo é digitado em "dias antes da data" (número inteiro de 0 a 730; vazio é sem prazo)
 * e guardado como dias relativos (negativo é antes). Protocolo até 100 letras e notas até 500.
 */
export function lerLicenca(campos: { tipo: string; situacao: string; responsavelId: string; diasAntes: string; validade: string; protocolo: string; notas: string }): LeituraDaLicenca {
  if (!(TIPOS_DE_LICENCA as readonly string[]).includes(campos.tipo)) return { ok: false, erro: "Escolha o tipo da licença." };
  if (!(SITUACOES_DA_LICENCA as readonly string[]).includes(campos.situacao)) return { ok: false, erro: "Escolha a situação." };
  let prazoDias: number | null = null;
  const dias = campos.diasAntes.trim();
  if (dias !== "") {
    if (!/^\d{1,3}$/.test(dias) || Number(dias) > 730) return { ok: false, erro: "O prazo é um número de dias antes da data, de 0 a 730." };
    prazoDias = Number(dias) === 0 ? 0 : -Number(dias);
  }
  if (campos.validade !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(campos.validade)) return { ok: false, erro: "Informe a validade como data." };
  const protocolo = campos.protocolo.trim();
  if (protocolo.length > 100) return { ok: false, erro: "O protocolo pode ter até 100 letras." };
  const notas = campos.notas.trim();
  if (notas.length > 500) return { ok: false, erro: "As notas podem ter até 500 letras." };
  return {
    ok: true,
    licenca: {
      tipo: campos.tipo as TipoDeLicenca, situacao: campos.situacao as SituacaoDaLicenca, responsavel_pessoa_id: campos.responsavelId === "" ? null : campos.responsavelId,
      prazo_dias: prazoDias, validade: campos.validade === "" ? null : campos.validade, protocolo: protocolo === "" ? null : protocolo, notas: notas === "" ? null : notas,
    },
  };
}

/**
 * Os avisos de uma licença: o prazo de pedir já passou e ela segue em aberto; a validade acaba antes do dia da data; ou
 * foi negada. Texto pronto para a tela.
 */
export function avisosDaLicenca(licenca: Pick<LicencaDaData, "situacao" | "prazo_dias" | "validade">, dataDoEvento: string, hoje: string): string[] {
  const avisos: string[] = [];
  const prazo = prazoDaLicenca(dataDoEvento, licenca.prazo_dias);
  if (licencaEmAberto(licenca.situacao) && prazo !== null && prazo < hoje) avisos.push(licenca.situacao === "a_pedir" ? "O prazo para pedir já passou." : "O prazo já passou e a resposta não chegou.");
  if (licenca.situacao === "concedida" && licenca.validade !== null && licenca.validade < dataDoEvento) avisos.push("A validade acaba antes do dia da data.");
  if (licenca.situacao === "negada") avisos.push("Negada: resolva antes da data ou mude o plano.");
  return avisos;
}

/** O resumo da data: quantas licenças, quantas em aberto e quantas negadas. */
export function resumoDasLicencas(licencas: readonly Pick<LicencaDaData, "situacao">[]): string {
  if (licencas.length === 0) return "Nenhuma licença cadastrada.";
  const abertas = licencas.filter(licenca => licencaEmAberto(licenca.situacao)).length;
  const negadas = licencas.filter(licenca => licenca.situacao === "negada").length;
  return `${licencas.length} ${licencas.length === 1 ? "licença" : "licenças"}, ${abertas} em aberto${negadas > 0 ? `, ${negadas} ${negadas === 1 ? "negada" : "negadas"}` : ""}.`;
}
