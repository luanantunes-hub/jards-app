// Os provedores de mídia (de onde o Jards lê o gasto) atrás de uma interface só: o resto (rotas, leitura, tela) fala com o adaptador e não sabe se é Meta ou Google. Sem banco e sem
// imports de servidor: o `fetch` entra por parâmetro e roda nos testes (tests/ticketeria-provedores.test.ts).

import { configDoGoogle, lerGastoDoGoogleAds, listarContasDoGoogleAds, trocarCodigoDoGoogle, urlDeLoginDoGoogle } from "@/lib/ticketeria/midia/google-ads";
import { configDaMeta, lerGastoDiario, listarContasDaMeta, trocarCodigoPeloToken, urlDeLoginDaMeta, type BuscarHttp, type ContaDeAnuncios, type DiaDeMidia } from "@/lib/ticketeria/midia/meta";

export type ProvedorDeMidia = "meta" | "google_ads";
export const PROVEDORES_DE_MIDIA: readonly ProvedorDeMidia[] = ["meta", "google_ads"];

/** O pedaço do endereço das rotas (`/conexoes/{pedaco}/…`) de cada provedor. O do Meta é o que está cadastrado como retorno do login no app da Meta. */
export const PEDACO_NA_URL: Record<ProvedorDeMidia, string> = { meta: "meta", google_ads: "google" };
export const provedorDaUrl = (pedaco: string): ProvedorDeMidia | null => PROVEDORES_DE_MIDIA.find(p => PEDACO_NA_URL[p] === pedaco) ?? null;

export type AdaptadorDeMidia = {
  provedor: ProvedorDeMidia;
  /** O nome do cartão ("Meta Ads"). */
  nome: string;
  /** O nome nas frases de erro ("Meta", "Google Ads"). */
  fonte: string;
  urlDeLogin(state: string): string;
  /** O código do login vira o que se guarda no Vault (Meta: token longo; Google: token de renovação) e quando vence (null se não vence). */
  trocarCodigo(codigo: string): Promise<{ token: string; expira_em: string | null }>;
  listarContas(token: string): Promise<ContaDeAnuncios[]>;
  lerGasto(token: string, conta: string, de: string, ate: string, gerente: string | null): Promise<DiaDeMidia[]>;
};

/** O adaptador do provedor, ou null se as credenciais dele não estão no servidor (o conector fica "Em breve"). */
export function adaptadorDeMidia(provedor: ProvedorDeMidia, env: Record<string, string | undefined>, origem: string, buscar: BuscarHttp): AdaptadorDeMidia | null {
  if (provedor === "meta") {
    const c = configDaMeta(env, origem);
    if (!c) return null;
    return {
      provedor, nome: "Meta Ads", fonte: "Meta",
      urlDeLogin: state => urlDeLoginDaMeta(c, state),
      trocarCodigo: codigo => trocarCodigoPeloToken(c, codigo, buscar),
      listarContas: token => listarContasDaMeta(c, token, buscar),
      lerGasto: (token, conta, de, ate) => lerGastoDiario(c, token, conta, de, ate, buscar),
    };
  }
  const g = configDoGoogle(env, origem);
  if (!g) return null;
  return {
    provedor, nome: "Google Ads", fonte: "Google Ads",
    urlDeLogin: state => urlDeLoginDoGoogle(g, state),
    trocarCodigo: codigo => trocarCodigoDoGoogle(g, codigo, buscar),
    listarContas: token => listarContasDoGoogleAds(g, token, buscar),
    lerGasto: (token, conta, de, ate, gerente) => lerGastoDoGoogleAds(g, token, conta, de, ate, gerente, buscar),
  };
}
