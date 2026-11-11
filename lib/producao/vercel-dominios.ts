import "server-only";
import { resolveTxt } from "node:dns/promises";
import { nomeDaProva, provaConfere } from "@/lib/producao/site";

// O domínio da pessoa na Vercel (PD12.1b): cadastra o domínio no projeto do Jards, confere se o DNS já aponta para ele e se a
// pessoa controla o DNS (TXT com o código). A Vercel também emite e renova o certificado HTTPS sozinha. Precisa de
// VERCEL_API_TOKEN, VERCEL_PROJECT_ID e (se o projeto é de um time) VERCEL_TEAM_ID no ambiente do servidor; sem isso o painel
// avisa que a conexão de domínios ainda não foi configurada.

const API = "https://api.vercel.com";

export type ConfigDaVercel = { token: string; projeto: string; time: string | null };

export function configDaVercel(): ConfigDaVercel | null {
  const token = process.env.VERCEL_API_TOKEN, projeto = process.env.VERCEL_PROJECT_ID;
  return token && projeto ? { token, projeto, time: process.env.VERCEL_TEAM_ID || null } : null;
}

type Resposta = { status: number; corpo: Record<string, unknown> };

async function chamar(config: ConfigDaVercel, metodo: "GET" | "POST" | "DELETE", caminho: string, corpo?: object): Promise<Resposta> {
  const url = new URL(`${API}${caminho}`);
  if (config.time) url.searchParams.set("teamId", config.time);
  const resposta = await fetch(url, {
    method: metodo,
    headers: { authorization: `Bearer ${config.token}`, ...(corpo ? { "content-type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json: unknown = await resposta.json().catch(() => ({}));
  return { status: resposta.status, corpo: json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {} };
}

const projeto = (config: ConfigDaVercel, dominio: string) => `/v9/projects/${encodeURIComponent(config.projeto)}/domains/${encodeURIComponent(dominio)}`;

/** Cadastra o domínio no projeto (ou aceita que já está cadastrado). Não confere o DNS. */
export async function cadastrarDominioNaVercel(config: ConfigDaVercel, dominio: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const resposta = await chamar(config, "POST", `/v10/projects/${encodeURIComponent(config.projeto)}/domains`, { name: dominio });
  if (resposta.status >= 200 && resposta.status < 300) return { ok: true };
  const codigo = String((resposta.corpo.error as { code?: unknown } | undefined)?.code ?? "");
  if (codigo === "domain_already_in_use" || codigo === "domain_already_exists") {
    // Já está no nosso projeto? Então tudo bem. Se está em outro projeto ou conta, não é nosso.
    const existente = await chamar(config, "GET", projeto(config, dominio));
    return existente.status === 200 ? { ok: true } : { ok: false, erro: "Este domínio já está ligado a outro projeto na Vercel. Fale com o suporte do Jards." };
  }
  return { ok: false, erro: "Não foi possível cadastrar o domínio agora. Tente de novo em instantes." };
}

export type SituacaoNaVercel = { cadastrado: boolean; verificado: boolean; apontando: boolean; apontar: { a?: string; cname?: string } };

const textoOuNada = (valor: unknown) => (typeof valor === "string" && valor.length > 0 ? valor.replace(/\.$/, "") : undefined);

/** Lê a configuração que a Vercel recomenda para o domínio: o IP (A) e o CNAME de melhor ordem. */
function recomendado(corpo: Record<string, unknown>): { a?: string; cname?: string } {
  const melhor = (lista: unknown): unknown => (Array.isArray(lista) ? [...lista].sort((x, y) => Number((x as { rank?: number }).rank ?? 99) - Number((y as { rank?: number }).rank ?? 99))[0] : undefined);
  const ipv4 = (melhor(corpo.recommendedIPv4) as { value?: unknown } | undefined)?.value;
  const cname = (melhor(corpo.recommendedCNAME) as { value?: unknown } | undefined)?.value;
  return { a: textoOuNada(Array.isArray(ipv4) ? ipv4[0] : ipv4), cname: textoOuNada(cname) };
}

/** O domínio está cadastrado e verificado, e o DNS dele já aponta para a Vercel? */
export async function situacaoNaVercel(config: ConfigDaVercel, dominio: string): Promise<SituacaoNaVercel> {
  const [dominioNoProjeto, configuracao] = await Promise.all([
    chamar(config, "GET", projeto(config, dominio)),
    chamar(config, "GET", `/v6/domains/${encodeURIComponent(dominio)}/config`),
  ]);
  const cadastrado = dominioNoProjeto.status === 200;
  return {
    cadastrado,
    verificado: cadastrado && dominioNoProjeto.corpo.verified === true,
    apontando: configuracao.status === 200 && configuracao.corpo.misconfigured === false,
    apontar: configuracao.status === 200 ? recomendado(configuracao.corpo) : {},
  };
}

/** Tira o domínio do projeto (ao desativar ou apagar o site). Domínio que já não está lá conta como removido. */
export async function removerDominioDaVercel(config: ConfigDaVercel, dominio: string): Promise<boolean> {
  const resposta = await chamar(config, "DELETE", projeto(config, dominio));
  return (resposta.status >= 200 && resposta.status < 300) || resposta.status === 404;
}

/** A pessoa criou o TXT de posse no DNS do domínio? */
export async function provaDeposseNoDns(dominio: string, token: string): Promise<boolean> {
  try {
    return provaConfere(await resolveTxt(nomeDaProva(dominio)), token);
  } catch {
    return false;
  }
}

/** O que falta, em linguagem simples, para o domínio ficar no ar. */
export function pendenciasDoDominio(situacao: SituacaoNaVercel, prova: boolean): string[] {
  const falta: string[] = [];
  if (!prova) falta.push("Falta o registro TXT que prova que o domínio é seu (ou o DNS ainda não atualizou).");
  if (!situacao.apontando) falta.push("O domínio ainda não aponta para o Jards: falta o registro A ou CNAME (ou o DNS ainda não atualizou).");
  if (!situacao.cadastrado) falta.push("O domínio não está cadastrado no servidor. Tente remover e cadastrar de novo.");
  return falta;
}
