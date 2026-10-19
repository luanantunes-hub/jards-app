import InfograficoVertentes from "./InfograficoVertentes";
import InfograficoEscalas from "./InfograficoEscalas";
import InfograficoDoisTempos from "./InfograficoDoisTempos";

// Chave do bloco "infografico" → componente (nomes em lib/blog-infograficos.ts).
export const INFOGRAFICOS: Record<string, () => React.ReactElement> = {
  "tres-vertentes": InfograficoVertentes,
  escalas: InfograficoEscalas,
  "dois-tempos": InfograficoDoisTempos,
};
