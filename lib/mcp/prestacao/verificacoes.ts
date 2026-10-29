import { CATALOGO_CHECAGENS, destinoDaChecagem, fonteDaChecagem, severidadeDaChecagem, tituloDaChecagem, type CodigoChecagem, type ResultadoChecagem } from "@/lib/prestacao/checagens";
import { DESTINOS } from "@/lib/prestacao/destino-da-verificacao";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";

/** O que cada tipo de resultado pede da pessoa, nas palavras da tela. */
const O_QUE_FAZER: Record<ResultadoChecagem, string> = {
  nao_conforme: "Descumpre a regra como está: corrija o dado ou o documento.",
  revisar: "Pode estar em desacordo com a regra: confira e corrija, ou escreva a justificativa se estiver certo.",
  nao_calculavel: "Faltam dados para conferir: complete o cadastro e rode a verificação de novo.",
};

export const codigoConhecido = (codigo: string): codigo is CodigoChecagem => Object.prototype.hasOwnProperty.call(CATALOGO_CHECAGENS, codigo);

/** O que uma verificação (um código do catálogo do motor de checagens) quer dizer e onde resolver; com o regime da prestação, a regra e a norma que a sustentam. */
export function explicarVerificacao(codigo: CodigoChecagem, regime: { codigo: string; nome: string; parametros: RegimeNormativo | null } | null, links?: { origem: string; prestacaoId: string }) {
  const entrada = CATALOGO_CHECAGENS[codigo];
  const fonte = fonteDaChecagem(regime?.parametros ?? null, codigo);
  const destino = DESTINOS[destinoDaChecagem(codigo)];
  return {
    codigo,
    titulo: tituloDaChecagem(codigo),
    assunto: entrada.grupo,
    resultado_tipico: entrada.resultado,
    o_que_fazer: O_QUE_FAZER[entrada.resultado],
    onde_resolver: {
      aba: destino.rotulo,
      ...(links ? { url: `${links.origem}/prestacoes/${links.prestacaoId}${destino.caminho}` } : {}),
    },
    regime: regime ? { codigo: regime.codigo, nome: regime.nome } : null,
    regra_do_regime: fonte
      ? {
          ...(fonte.regra ? { codigo: fonte.regra.codigo, descricao: fonte.regra.descricao, severidade: severidadeDaChecagem(regime?.parametros ?? null, codigo, "info") } : {}),
          norma: { documento: fonte.documento, dispositivo: fonte.dispositivo, ...(fonte.citacao ? { citacao: fonte.citacao } : {}), ...(fonte.aConfirmar ? { a_confirmar: true } : {}) },
        }
      : null,
  };
}
