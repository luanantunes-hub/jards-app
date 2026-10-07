// Checagens do plano de distribuição (P3.4), por produto, com os limites e a
// fonte das regras do regime (Rouanet: IN 29/2026, arts. 41 a 43 e 76):
//
//  * cotas do art. 41 fora do limite, com o percentual calculado: no plano ou,
//    quando todas as linhas do produto têm o realizado, no que foi distribuído;
//  * ingresso de preço popular acima do teto, preço médio da venda livre acima
//    do limite, meia-entrada abaixo do mínimo e receita prevista acima do
//    valor do projeto;
//  * depois do fim da execução, linha sem o realizado; realizado diferente do
//    plano pede justificativa; cota social ou educativa entregue sem dizer a
//    que entidade ou escola (art. 43).
// Sem regras de distribuição no regime, só as três últimas valem.

import {
  categoriaDistribuicao,
  cotasDoProduto,
  formatarPercentual,
  limitesDoRegime,
  linhaAlterada,
  resumosPorProduto,
  rotuloDaCategoria,
} from "../distribuicao";
import { execucaoTerminou } from "../objeto";
import { centavos, novoAchado, reais, severidadeDaChecagem, type Achado, type EstadoDaPrestacao } from "./catalogo";

const inteiro = (n: number) => n.toLocaleString("pt-BR");

export function checarDistribuicao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const linhas = estado.distribuicao ?? [];
  if (linhas.length === 0) return [];
  const limites = limitesDoRegime(regime);
  const achados: Achado[] = [];

  if (limites) {
    for (const resumo of resumosPorProduto(linhas, limites)) {
      const onde = resumo.base === "realizado" ? "na distribuição realizada" : "no plano";
      for (const cota of cotasDoProduto(resumo, limites)) {
        if (cota.dentro) continue;
        achados.push(novoAchado(regime, {
          codigo: "DISTRIBUICAO_COTA",
          severidade: severidadeDaChecagem(regime, "DISTRIBUICAO_COTA", "bloqueio"),
          entidade: { tipo: "prestacao", id: null },
          ref: `${resumo.chave}:${cota.cota}`,
          mensagem: `"${resumo.produto}": cota ${cota.rotulo.toLowerCase()} com ${formatarPercentual(cota.percentual)} ${onde} (${inteiro(cota.quantidade)} de ${inteiro(resumo.total)}); ${cota.sentido === "max" ? "o máximo" : "o mínimo"} é ${formatarPercentual(cota.limite)} (${cota.dispositivo}).`,
          dados: { produto: resumo.produto, cota: cota.cota, quantidade: cota.quantidade, total: resumo.total, percentual: cota.percentual, limite: cota.limite, base: resumo.base },
        }));
      }

      if (limites.precoPopular !== null) {
        for (const l of resumo.linhas) {
          if (l.categoria !== "popular" || Number(l.preco) <= limites.precoPopular) continue;
          achados.push(novoAchado(regime, {
            codigo: "DISTRIBUICAO_PRECO_POPULAR",
            severidade: severidadeDaChecagem(regime, "DISTRIBUICAO_PRECO_POPULAR", "bloqueio"),
            entidade: { tipo: "distribuicao", id: l.id },
            mensagem: `"${resumo.produto}": o preço popular de ${reais(centavos(l.preco))} passa do teto de ${reais(centavos(limites.precoPopular))}; esses ingressos não contam na cota popular.`,
            dados: { preco: Number(l.preco), teto: limites.precoPopular },
          }));
        }
      }

      if (limites.precoMedioMax !== null && resumo.precoMedio !== null && resumo.precoMedio > limites.precoMedioMax) {
        achados.push(novoAchado(regime, {
          codigo: "DISTRIBUICAO_PRECO_MEDIO",
          severidade: severidadeDaChecagem(regime, "DISTRIBUICAO_PRECO_MEDIO", "bloqueio"),
          entidade: { tipo: "prestacao", id: null },
          ref: resumo.chave,
          mensagem: `"${resumo.produto}": o preço médio do ingresso inteiro na venda livre é ${reais(centavos(resumo.precoMedio))}; o limite é ${reais(centavos(limites.precoMedioMax))}.`,
          dados: { produto: resumo.produto, preco_medio: resumo.precoMedio, limite: limites.precoMedioMax },
        }));
      }

      if (limites.meiaMin !== null && resumo.vendidos > 0 && resumo.meias * 100 < limites.meiaMin * resumo.vendidos) {
        const p = Math.round((resumo.meias / resumo.vendidos) * 1000) / 10;
        achados.push(novoAchado(regime, {
          codigo: "DISTRIBUICAO_MEIA_ENTRADA",
          severidade: severidadeDaChecagem(regime, "DISTRIBUICAO_MEIA_ENTRADA", "alerta"),
          entidade: { tipo: "prestacao", id: null },
          ref: resumo.chave,
          mensagem: `"${resumo.produto}": ${inteiro(resumo.meias)} meias em ${inteiro(resumo.vendidos)} ingressos vendidos (${formatarPercentual(p)}); a meia para estudantes vale em ao menos ${formatarPercentual(limites.meiaMin)} dos vendidos.`,
          dados: { produto: resumo.produto, meias: resumo.meias, vendidos: resumo.vendidos, limite: limites.meiaMin },
        }));
      }
    }

    const valor = estado.valorAprovado ?? null;
    if (limites.receitaAteOValor && valor !== null && valor > 0) {
      const receita = resumosPorProduto(linhas, limites).reduce((s, r) => s + centavos(r.receita), 0);
      if (receita > centavos(valor)) {
        achados.push(novoAchado(regime, {
          codigo: "DISTRIBUICAO_RECEITA",
          severidade: severidadeDaChecagem(regime, "DISTRIBUICAO_RECEITA", "bloqueio"),
          entidade: { tipo: "prestacao", id: null },
          mensagem: `A receita prevista com ingressos e produtos (${reais(receita)}) passa do valor do projeto (${reais(centavos(valor))}).`,
          dados: { receita: receita / 100, valor },
        }));
      }
    }
  }

  const terminou = execucaoTerminou(estado.prestacao?.data_fim_execucao ?? null, estado.hoje ?? new Date());
  for (const l of linhas) {
    const entidade = { tipo: "distribuicao" as const, id: l.id };
    const nome = `"${l.produto.trim()}" · ${rotuloDaCategoria(l.categoria)}`;
    if (l.quantidade_realizada === null || l.quantidade_realizada === undefined) {
      if (!terminou) continue;
      achados.push(novoAchado(regime, {
        codigo: "DISTRIBUICAO_SEM_REALIZADO",
        severidade: "alerta",
        entidade,
        mensagem: `${nome}: a execução terminou; informe quantos foram distribuídos ou vendidos.`,
        dados: { previsto: l.quantidade },
      }));
      continue;
    }
    if (linhaAlterada(l)) {
      achados.push(novoAchado(regime, {
        codigo: "DISTRIBUICAO_ALTERADA",
        severidade: "justificativa",
        entidade,
        mensagem: `${nome}: ${inteiro(l.quantidade_realizada)} de ${inteiro(l.quantidade)} previstos. Explique a mudança no plano na própria linha.`,
        dados: { previsto: l.quantidade, realizado: l.quantidade_realizada },
        justificativa: l.justificativa?.trim() || null,
      }));
    }
    if (categoriaDistribuicao(l.categoria)?.pedeBeneficiario && l.quantidade_realizada > 0 && !l.beneficiario?.trim()) {
      achados.push(novoAchado(regime, {
        codigo: "DISTRIBUICAO_SEM_BENEFICIARIO",
        severidade: "alerta",
        entidade,
        mensagem: `${nome}: diga a que entidade ou escola os ${inteiro(l.quantidade_realizada)} foram entregues; a declaração de quem recebeu comprova a gratuidade.`,
      }));
    }
  }

  return achados;
}

