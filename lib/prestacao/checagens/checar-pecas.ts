// Checagens das peças de divulgação (P3.6), com as marcas, a aprovação prévia
// e o defeso do regime (Rouanet: IN 29/2026, arts. 21 e 69, V):
//
//  * peça veiculada sem a aprovação prévia: não enviada, recusada, aprovada
//    depois de circular ou circulando antes do fim do prazo do órgão (quando o
//    silêncio aprova, a peça pode circular no dia seguinte ao fim do prazo);
//  * marca do regime que a peça não mostra; no defeso, a do Governo Federal
//    não conta, e mostrá-la vira achado próprio (Lei 9.504/1997, art. 73, VI, b);
//  * peça veiculada sem amostra (arquivo ou link) para o relatório final.
// A justificativa escrita na peça vale para os achados dela.

import {
  defesosDaPeca,
  divulgacaoDoRegime,
  FONTE_DO_DEFESO,
  MARCA_FORA_DO_DEFESO,
  marcasEsperadas,
  marcasFaltando,
  situacaoDaAprovacao,
} from "../pecas";
import { definida } from "../regimes";
import { dataBr, novoAchado, severidadeDaChecagem, type Achado, type EstadoDaPrestacao } from "./catalogo";

const hojeIso = (d: Date) => d.toISOString().slice(0, 10);

export function checarPecas(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const pecas = estado.pecas ?? [];
  if (pecas.length === 0) return [];
  const div = divulgacaoDoRegime(regime);
  const defesos = estado.defesos ?? [];
  const hoje = hojeIso(estado.hoje ?? new Date());
  // A amostra das peças no relatório final: o documento de envio do regime, quando há.
  const docDaAmostra = (regime ? definida(regime.envio) : null)?.documentos.find(d => d.codigo === "pecas_divulgacao") ?? null;
  const achados: Achado[] = [];

  for (const p of pecas) {
    const entidade = { tipo: "peca" as const, id: p.id };
    const nome = `"${p.titulo}"`;
    const justificativa = p.justificativa?.trim() || null;
    const veiculada = Boolean(p.veiculacao_inicio && p.veiculacao_inicio <= hoje);
    const noDefeso = defesosDaPeca(p, defesos);

    if (veiculada && div?.aprovacaoPrevia.exigida) {
      const inicio = p.veiculacao_inicio!;
      const naVeiculacao = situacaoDaAprovacao(p, regime, inicio);
      const liberada = naVeiculacao.aprovadaEm !== null && naVeiculacao.aprovadaEm <= inicio;
      if (!liberada) {
        const agora = situacaoDaAprovacao(p, regime, hoje);
        const motivo = p.aprovacao_status === "nao_enviada" ? "sem ter sido enviada para aprovação prévia"
          : p.aprovacao_status === "reprovada" ? `e foi recusada${p.aprovacao_decidida_em ? ` em ${dataBr(p.aprovacao_decidida_em)}` : ""}`
          : agora.aprovadaEm ? `antes da aprovação (${dataBr(agora.aprovadaEm)})`
          : naVeiculacao.vencimento ? `antes do fim do prazo do órgão (${dataBr(naVeiculacao.vencimento)}), sem aprovação`
          : "sem aprovação";
        achados.push(novoAchado(regime, {
          codigo: "PECA_SEM_APROVACAO",
          severidade: severidadeDaChecagem(regime, "PECA_SEM_APROVACAO", "alerta"),
          entidade,
          mensagem: `${nome} circulou a partir de ${dataBr(inicio)} ${motivo}.`,
          dados: { veiculacao: inicio, status: p.aprovacao_status },
          fonte: div.aprovacaoPrevia.fonte,
          justificativa,
        }));
      }
    }

    const faltando = marcasFaltando(p, marcasEsperadas(regime, noDefeso.length > 0));
    if (faltando.length > 0) {
      achados.push(novoAchado(regime, {
        codigo: "PECA_MARCA_FALTANDO",
        severidade: severidadeDaChecagem(regime, "PECA_MARCA_FALTANDO", "alerta"),
        entidade,
        mensagem: `${nome} não mostra ${faltando.length === 1 ? "a marca" : "as marcas"} ${faltando.map(m => `"${m}"`).join(", ")}.`,
        dados: { faltando: faltando.join(", ") },
        justificativa,
      }));
    }

    const proibidas = div?.defeso && noDefeso.length > 0 ? (p.marcas ?? []).filter(m => MARCA_FORA_DO_DEFESO.test(m)) : [];
    if (proibidas.length > 0) {
      const periodo = noDefeso[0];
      achados.push(novoAchado(regime, {
        codigo: "PECA_MARCA_NO_DEFESO",
        severidade: severidadeDaChecagem(regime, "PECA_MARCA_NO_DEFESO", "alerta"),
        entidade,
        mensagem: `${nome} circulou no defeso eleitoral (${dataBr(periodo.inicio)} a ${dataBr(periodo.fim)}) com a marca "${proibidas[0]}"; no período, use a versão de defeso das marcas.`,
        dados: { defeso_inicio: periodo.inicio, defeso_fim: periodo.fim },
        fonte: { ...FONTE_DO_DEFESO, nota: div!.defeso!.descricao },
        justificativa,
      }));
    }

    if (veiculada && !p.storage_path && !p.url) {
      achados.push(novoAchado(regime, {
        codigo: "PECA_SEM_AMOSTRA",
        severidade: severidadeDaChecagem(regime, "PECA_SEM_AMOSTRA", "alerta"),
        entidade,
        mensagem: `${nome} circulou e não tem amostra: anexe o arquivo ou o link da publicação, para o relatório final.`,
        ...(docDaAmostra ? { fonte: { ...docDaAmostra.fonte } } : {}),
      }));
    }
  }
  return achados;
}
