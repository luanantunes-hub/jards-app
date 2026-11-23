// Os provedores de mídia (de onde o Jards lê o gasto) atrás de uma interface só: o resto (rotas, leitura, tela) fala com o adaptador e não sabe se é Meta ou Google. Sem banco e sem
// imports de servidor: o `fetch` entra por parâmetro e roda nos testes (tests/ticketeria-provedores.test.ts).

import { lerVisitasDoGa4, listarPropriedadesDoGa4, urlDeLoginDoGa4, type VisitaDiaria } from "@/lib/ticketeria/midia/ga4";
import { configDoGoogle, lerGastoDoGoogleAds, lerGastoPorCampanhaDoGoogleAds, listarContasDoGoogleAds, trocarCodigoDoGoogle, urlDeLoginDoGoogle } from "@/lib/ticketeria/midia/google-ads";
import { configDaMeta, lerGastoDiario, lerGastoPorCampanhaDaMeta, listarContasDaMeta, trocarCodigoPeloToken, urlDeLoginDaMeta, type BuscarHttp, type ContaDeAnuncios, type DiaDeCampanha, type DiaDeMidia } from "@/lib/ticketeria/midia/meta";

export type ProvedorDeMidia = "meta" | "google_ads" | "ga4";
export const PROVEDORES_DE_MIDIA: readonly ProvedorDeMidia[] = ["meta", "google_ads", "ga4"];

/** O pedaço do endereço das rotas (`/conexoes/{pedaco}/…`) de cada provedor. O do Meta é o que está cadastrado como retorno do login no app da Meta. */
export const PEDACO_NA_URL: Record<ProvedorDeMidia, string> = { meta: "meta", google_ads: "google", ga4: "ga4" };
export const provedorDaUrl = (pedaco: string): ProvedorDeMidia | null => PROVEDORES_DE_MIDIA.find(p => PEDACO_NA_URL[p] === pedaco) ?? null;

/** O que uma leitura traz: gasto por dia (anúncios) ou visitas por dia e origem (Analytics). */
export type DadosLidos = { gasto: DiaDeMidia[]; visitas?: undefined; /** O gasto por campanha (para separar marca de evento); ausente se a plataforma não devolveu. */ campanhas?: DiaDeCampanha[] } | { visitas: VisitaDiaria[]; gasto?: undefined; campanhas?: undefined };

/** Lê as campanhas sem deixar a falha delas derrubar a leitura do gasto da conta (que é o que o modelo precisa para funcionar). */
async function campanhasOuNada(ler: () => Promise<DiaDeCampanha[]>): Promise<DiaDeCampanha[] | undefined> {
  try { return await ler(); } catch { return undefined; }
}

export type AdaptadorDeMidia = {
  provedor: ProvedorDeMidia;
  /** `gasto` (anúncios: só conta em real) ou `visitas` (Analytics: sem moeda). */
  tipo: "gasto" | "visitas";
  /** O nome do cartão ("Meta Ads"). */
  nome: string;
  /** O nome nas frases de erro ("Meta", "Google Ads"). */
  fonte: string;
  urlDeLogin(state: string): string;
  /** O código do login vira o que se guarda no Vault (Meta: token longo; Google: token de renovação) e quando vence (null se não vence). */
  trocarCodigo(codigo: string): Promise<{ token: string; expira_em: string | null }>;
  listarContas(token: string): Promise<ContaDeAnuncios[]>;
  ler(token: string, conta: string, de: string, ate: string, gerente: string | null): Promise<DadosLidos>;
};

/** O adaptador do provedor, ou null se as credenciais dele não estão no servidor (o conector fica "Em breve"). */
export function adaptadorDeMidia(provedor: ProvedorDeMidia, env: Record<string, string | undefined>, origem: string, buscar: BuscarHttp): AdaptadorDeMidia | null {
  if (provedor === "meta") {
    const c = configDaMeta(env, origem);
    if (!c) return null;
    return {
      provedor, tipo: "gasto", nome: "Meta Ads", fonte: "Meta",
      urlDeLogin: state => urlDeLoginDaMeta(c, state),
      trocarCodigo: codigo => trocarCodigoPeloToken(c, codigo, buscar),
      listarContas: token => listarContasDaMeta(c, token, buscar),
      ler: async (token, conta, de, ate) => ({ gasto: await lerGastoDiario(c, token, conta, de, ate, buscar), campanhas: await campanhasOuNada(() => lerGastoPorCampanhaDaMeta(c, token, conta, de, ate, buscar)) }),
    };
  }
  const g = configDoGoogle(env, origem);
  if (!g) return null;
  if (provedor === "ga4") {
    return {
      provedor, tipo: "visitas", nome: "Google Analytics 4", fonte: "Google Analytics",
      urlDeLogin: state => urlDeLoginDoGa4(g, state),
      trocarCodigo: codigo => trocarCodigoDoGoogle(g, codigo, buscar),
      listarContas: token => listarPropriedadesDoGa4(g, token, buscar),
      ler: async (token, conta, de, ate) => ({ visitas: await lerVisitasDoGa4(g, token, conta, de, ate, buscar) }),
    };
  }
  return {
    provedor, tipo: "gasto", nome: "Google Ads", fonte: "Google Ads",
    urlDeLogin: state => urlDeLoginDoGoogle(g, state),
    trocarCodigo: codigo => trocarCodigoDoGoogle(g, codigo, buscar),
    listarContas: token => listarContasDoGoogleAds(g, token, buscar),
    ler: async (token, conta, de, ate, gerente) => ({ gasto: await lerGastoDoGoogleAds(g, token, conta, de, ate, gerente, buscar), campanhas: await campanhasOuNada(() => lerGastoPorCampanhaDoGoogleAds(g, token, conta, de, ate, gerente, buscar)) }),
  };
}
