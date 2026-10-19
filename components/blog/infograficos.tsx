import InfograficoVertentes from "./InfograficoVertentes";
import InfograficoEscalas from "./InfograficoEscalas";
import InfograficoDoisTempos from "./InfograficoDoisTempos";
import {
  InfograficoConcentracao, InfograficoCrescimento, InfograficoFaixas, InfograficoParticipacao, InfograficoUmaEmpresa,
} from "./InfograficosConcentracao";

// Chave do bloco "infografico" → componente (nomes em lib/blog-infograficos.ts).
export const INFOGRAFICOS: Record<string, () => React.ReactElement> = {
  "tres-vertentes": InfograficoVertentes,
  escalas: InfograficoEscalas,
  "dois-tempos": InfograficoDoisTempos,
  "faixas-2025": InfograficoFaixas,
  "participacao-topo": InfograficoParticipacao,
  "uma-empresa": InfograficoUmaEmpresa,
  "crescimento-faixas": InfograficoCrescimento,
  "numeros-concentracao": InfograficoConcentracao,
};
