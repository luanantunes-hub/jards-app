// Checagens da relação de beneficiados (P8.5), escritas a partir da Lei de
// Incentivo ao Esporte e valendo para todo regime que traga as mesmas regras:
//  * a relação existe, com o sexo de cada um, para o total feminino e o
//    masculino somarem o número listado, e sem a mesma pessoa duas vezes
//    (regra beneficiados, aba BENEFICIADOS do formulário PCP/PCF);
//  * na formação esportiva regular, ao menos 50% dos alunos da rede pública
//    (regra rede_publica, Decreto 12.861/2026, art. 18).

import { nomeComparavel, resumoDosBeneficiados } from "../beneficiarios";
import { execucaoTerminou } from "../objeto";
import { regraDoRegime } from "../regimes";
import { novoAchado, type Achado, type EstadoDaPrestacao } from "./catalogo";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function checarRelacao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "beneficiados");
  if (!regra) return [];
  const lista = estado.beneficiarios ?? [];
  const entidade = { tipo: "prestacao" as const, id: null };
  if (!lista.length) {
    // Antes do fim da execução a relação ainda se forma: só avisa.
    const terminou = execucaoTerminou(estado.prestacao?.data_fim_execucao, estado.hoje ?? new Date());
    return [novoAchado(regime, {
      codigo: "BENEFICIADOS_AUSENTES",
      severidade: terminou ? regra.severidade : "info",
      entidade,
      mensagem: "Cadastre a relação de beneficiados, com o sexo, a idade e os benefícios de cada um: ela vai na aba BENEFICIADOS do formulário da prestação.",
      dados: {},
    })];
  }
  const resumo = resumoDosBeneficiados(lista);
  const achados: Achado[] = [];
  if (resumo.semSexo) {
    achados.push(novoAchado(regime, {
      codigo: "BENEFICIADO_SEM_SEXO",
      severidade: regra.severidade,
      entidade,
      mensagem: `${plural(resumo.semSexo, "beneficiado está", "beneficiados estão")} sem o sexo: o formulário traz o total feminino (${resumo.feminino}) e o masculino (${resumo.masculino}), que precisam somar os ${resumo.total} listados.`,
      dados: { sem_sexo: resumo.semSexo, feminino: resumo.feminino, masculino: resumo.masculino, total: resumo.total },
    }));
  }
  for (const r of resumo.repetidos) {
    achados.push(novoAchado(regime, {
      codigo: "BENEFICIADO_REPETIDO",
      severidade: regra.severidade,
      entidade,
      ref: `${nomeComparavel(r.nome)}|${r.idade ?? ""}`,
      mensagem: `${r.nome}${r.idade !== null ? ` (${r.idade} anos)` : ""} aparece ${r.quantidade} vezes na relação: cada beneficiado conta uma vez nos totais.`,
      dados: { nome: r.nome, idade: r.idade, vezes: r.quantidade },
    }));
  }
  return achados;
}

function checarRedePublica(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "rede_publica");
  const lista = estado.beneficiarios ?? [];
  if (!regra || estado.manifestacaoEsportiva !== "formacao" || !lista.length) return [];
  const percentual = Number(regra.parametros?.percentual ?? 50);
  const resumo = resumoDosBeneficiados(lista);
  const minimo = Math.ceil((resumo.total * percentual) / 100);
  if (resumo.redePublica >= minimo) return [];
  const atual = `${resumo.redePublica} de ${resumo.total} (${pct(resumo.percentualRedePublica ?? 0)})`;
  const dados = { rede_publica: resumo.redePublica, nao_informada: resumo.redeNaoInformada, total: resumo.total, minimo, percentual };
  const base = { codigo: "REDE_PUBLICA_ABAIXO_DO_MINIMO" as const, entidade: { tipo: "prestacao" as const, id: null }, dados };
  // Com a rede de alguns sem informar, o mínimo ainda pode ser atingido: pede a informação antes de bloquear.
  if (resumo.redePublica + resumo.redeNaoInformada >= minimo) {
    return [novoAchado(regime, {
      ...base,
      severidade: "alerta",
      mensagem: `Na formação esportiva regular, ao menos ${pct(percentual)} dos alunos são da rede pública; hoje ${atual} estão marcados, e ${plural(resumo.redeNaoInformada, "beneficiado está", "beneficiados estão")} sem a rede informada. Informe a rede de cada um.`,
    })];
  }
  return [novoAchado(regime, {
    ...base,
    severidade: regra.severidade,
    mensagem: `Na formação esportiva regular, ao menos ${pct(percentual)} dos alunos são da rede pública (${minimo} dos ${resumo.total}); a relação tem ${atual}. Se o projeto não é de atividade regular, justifique.`,
  })];
}

export function checarBeneficiarios(estado: EstadoDaPrestacao): Achado[] {
  return [...checarRelacao(estado), ...checarRedePublica(estado)];
}
