// O bloco "Hoje" da agenda (plano do módulo, PD1.3): além das opções que vencem, o que pede atenção nas licenças das datas e nos
// equipamentos das casas (avariado, manutenção vencida). Sem tela e sem banco.

import { avisosDaLicenca, ROTULO_DO_TIPO_DE_LICENCA, type LicencaDaData } from "@/lib/producao/licencas";
import { pendenciasDaCasa, type EquipamentoParaPendencia, type ManutencaoParaPendencia } from "@/lib/producao/equipamentos";
import { diaEMes } from "@/lib/producao/agenda";
import type { TipoDeLicenca } from "@/lib/producao/estados";

/** Quantos dias antes o Hoje avisa de uma manutenção que vai vencer. */
export const DIAS_DE_ANTECEDENCIA_DA_MANUTENCAO = 7;

export type AvisoDeHoje = { chave: string; rotulo: string; texto: string; href: string };

type LicencaParaHoje = Pick<LicencaDaData, "id" | "situacao" | "prazo_dias" | "validade"> & { data_id: string; tipo: TipoDeLicenca };
type DataParaHoje = { id: string; data: string; situacao: string; temporada_titulo: string | null };

/**
 * Os avisos das licenças: prazo para pedir vencido, resposta que não chegou, validade que acaba antes da data e licença negada.
 * Só das datas que ainda vão acontecer (nem cancelada nem realizada), da mais próxima à mais distante.
 */
export function avisosDeLicencasParaHoje(licencas: readonly LicencaParaHoje[], datas: readonly DataParaHoje[], hoje: string): AvisoDeHoje[] {
  const porId = new Map(datas.map(data => [data.id, data]));
  const itens: { data: string; aviso: AvisoDeHoje }[] = [];
  for (const licenca of licencas) {
    const data = porId.get(licenca.data_id);
    if (!data || data.situacao === "cancelada" || data.situacao === "realizada" || data.data < hoje) continue;
    for (const texto of avisosDaLicenca(licenca, data.data, hoje)) {
      itens.push({ data: data.data, aviso: {
        chave: `licenca-${licenca.id}-${texto}`, rotulo: "Licença", href: `/producoes/datas/${data.id}`,
        texto: `${ROTULO_DO_TIPO_DE_LICENCA[licenca.tipo]} de ${diaEMes(data.data)}${data.temporada_titulo ? ` · ${data.temporada_titulo}` : ""}: ${texto}`,
      } });
    }
  }
  return itens.sort((a, b) => a.data.localeCompare(b.data)).map(item => item.aviso);
}

/** Os avisos dos equipamentos: o avariado, a manutenção que venceu e a que vence nos próximos 7 dias (as mais distantes ficam para a página do espaço). */
export function avisosDeEquipamentosParaHoje(
  equipamentos: readonly (EquipamentoParaPendencia & { espaco_id: string })[], manutencoes: readonly ManutencaoParaPendencia[], hoje: string,
): AvisoDeHoje[] {
  const espacoDo = new Map(equipamentos.map(item => [item.id, item.espaco_id]));
  const { avariados, vencidas, proximas } = pendenciasDaCasa(equipamentos, manutencoes, hoje, DIAS_DE_ANTECEDENCIA_DA_MANUTENCAO);
  return [
    ...avariados.map(item => ({ chave: `avariado-${item.id}`, rotulo: "Equipamento", href: `/producoes/espacos/${espacoDo.get(item.id) ?? ""}`, texto: `${item.nome} está avariado.` })),
    ...vencidas.map(item => ({ chave: `manutencao-${item.id}`, rotulo: "Manutenção", href: `/producoes/espacos/${espacoDo.get(item.equipamento_id) ?? ""}`, texto: `${item.equipamento}, ${item.descricao}: venceu em ${diaEMes(item.prevista_para)}.` })),
    ...proximas.map(item => ({ chave: `manutencao-proxima-${item.id}`, rotulo: "Manutenção", href: `/producoes/espacos/${espacoDo.get(item.equipamento_id) ?? ""}`, texto: `${item.equipamento}, ${item.descricao}: ${item.prevista_para === hoje ? "é hoje" : `vence em ${diaEMes(item.prevista_para)}`}.` })),
  ];
}
