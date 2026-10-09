// A produção no CMD (P9.5). Na saúde, o projeto de serviços
// médico-assistenciais registra a produção só no CMD (regra cmd do regime:
// Anexo LXXXVI-A, art. 74, § 2º; Portaria GM/MS 8.031/2025, art. 3º), e a
// prestação final leva o que foi lançado. Formação e pesquisa ficam de fora.
//  * começada a execução, sem nenhuma produção registrada aqui: aviso; depois
//    do fim, a severidade da regra;
//  * meta ligada à produção com o realizado diferente do registrado no CMD;
//  * competência fora dos meses da execução.

import { competenciasForaDaExecucao, registraCmd, resumoDoCmd, rotuloDaCompetencia } from "../cmd";
import { somarDias } from "../evidencias";
import { execucaoTerminou, quantidade } from "../objeto";
import { regraDoRegime } from "../regimes";
import { dataBr, novoAchado, type Achado, type EstadoDaPrestacao } from "./catalogo";

const numero = (n: number) => n.toLocaleString("pt-BR");

export function checarCmd(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "cmd");
  if (!regra || !registraCmd(estado.modalidadeSaude)) return [];
  const producao = estado.producaoCmd ?? [];
  const hoje = estado.hoje ?? new Date();
  const inicio = estado.prestacao?.data_inicio_execucao ?? null;
  const fim = estado.prestacao?.data_fim_execucao ?? null;
  const achados: Achado[] = [];

  if (producao.length === 0) {
    // Começou quando o início já não é futuro (a mesma conta de execucaoTerminou, com o dia anterior).
    if (!inicio || !execucaoTerminou(somarDias(inicio, -1), hoje)) return [];
    const terminou = execucaoTerminou(fim, hoje);
    return [novoAchado(regime, {
      codigo: "CMD_SEM_PRODUCAO",
      severidade: terminou ? regra.severidade : "info",
      entidade: { tipo: "prestacao", id: null },
      mensagem: terminou
        ? "Registre a produção médico-assistencial lançada no CMD, por competência: a prestação final leva as informações do CMD, e o Ministério confere as metas assistenciais por elas."
        : "Registre a cada mês a produção lançada no CMD, por competência: a prestação final leva essas informações.",
      dados: {},
    })];
  }

  const resumo = resumoDoCmd(producao, estado.metas ?? []);
  for (const { meta, registrado } of resumo.porMeta) {
    if (meta.realizado === null || meta.realizado === undefined || Number(meta.realizado) === registrado) continue;
    achados.push(novoAchado(regime, {
      codigo: "CMD_DIFERE_DA_META",
      severidade: "alerta",
      entidade: { tipo: "meta", id: meta.id },
      mensagem: `A meta "${meta.descricao}" tem ${quantidade(Number(meta.realizado), meta.unidade)} de realizado, e a produção registrada no CMD para ela soma ${quantidade(registrado, meta.unidade)}: o Ministério confere a meta assistencial pelo CMD. Acerte o realizado ou a produção, ou justifique.`,
      dados: { realizado: Number(meta.realizado), cmd: registrado },
    }));
  }

  for (const fora of competenciasForaDaExecucao(producao, estado.prestacao ?? {})) {
    const limite = fora.antes ? inicio : fim;
    achados.push(novoAchado(regime, {
      codigo: "CMD_FORA_DA_EXECUCAO",
      severidade: "alerta",
      entidade: { tipo: "prestacao", id: null },
      ref: fora.competencia,
      mensagem: `A produção de ${rotuloDaCompetencia(fora.competencia)} (${numero(fora.quantidade)}) está ${fora.antes ? "antes do início" : "depois do fim"} da execução${limite ? `, em ${dataBr(limite)}` : ""}: só conta a produção do período do projeto.`,
      dados: { competencia: fora.competencia, quantidade: fora.quantidade },
    }));
  }
  return achados;
}
