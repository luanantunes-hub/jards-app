// O envio dos webhooks (I0, parte 3), sem rede nem banco: as portas e o transporte vêm de fora, para testar tudo sem internet. O fluxo: reivindicar as entregas devidas (o banco já
// as marca "enviando" e conta a tentativa), enviar cada uma assinada, e registrar o resultado (o banco agenda a próxima tentativa ou desiste na sexta).

import { cabecalhosDoAviso, corpoDoAviso, lerEntregas, type EntregaParaEnviar } from "@/lib/ticketeria/webhooks";

export type ResultadoDoTransporte = { status: number };

/** Faz o POST. Devolve o status HTTP, ou lança com o motivo (tempo esgotado, endereço de rede interna, falha de conexão ou de certificado). Nunca segue redirecionamento. */
export type Transporte = (url: string, cabecalhos: Record<string, string>, corpo: string) => Promise<ResultadoDoTransporte>;

export type PortasDoEnvio = {
  /** fn_ticketeria_webhooks_reivindicar. */
  reivindicar(limite: number): Promise<unknown>;
  /** fn_ticketeria_webhooks_registrar. */
  registrar(entrega: string, ok: boolean, status: number | null, erro: string | null): Promise<void>;
};

export type ResumoDoEnvio = { reivindicadas: number; enviadas: number; falhas: number };

/** 2xx é entregue; qualquer outra coisa (inclusive 3xx, que não se segue) é falha e tenta de novo. */
export const entregue = (status: number) => status >= 200 && status < 300;

/** O motivo de uma falha de transporte, numa frase curta e sem segredo (cabe em 300 letras no banco). */
export function motivoDaFalha(erro: unknown): string {
  const m = erro instanceof Error ? erro.message : String(erro);
  if (m === "tempo_esgotado" || m === "endereco_interno") return m;
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return "endereco_nao_encontrado";
  if (/ECONNREFUSED/.test(m)) return "conexao_recusada";
  if (/ECONNRESET|socket hang up/.test(m)) return "conexao_encerrada";
  if (/certificate|CERT_|SSL|TLS/i.test(m)) return "certificado_invalido";
  return "falha_de_conexao";
}

/** Envia uma entrega e registra o resultado. Nunca lança: uma entrega com problema não derruba as outras. */
export async function enviarEntrega(e: EntregaParaEnviar, portas: PortasDoEnvio, transporte: Transporte, agora: () => number = Date.now): Promise<boolean> {
  const corpo = corpoDoAviso(e);
  let ok = false;
  let status: number | null = null;
  let erro: string | null = null;
  try {
    const r = await transporte(e.url, cabecalhosDoAviso(e, corpo, Math.floor(agora() / 1000)), corpo);
    status = r.status;
    ok = entregue(r.status);
    if (!ok) erro = r.status >= 300 && r.status < 400 ? `redirecionamento_${r.status}` : `http_${r.status}`;
  } catch (falha) {
    erro = motivoDaFalha(falha);
  }
  try {
    await portas.registrar(e.entrega, ok, status, erro);
  } catch {
    // Sem registrar, a entrega fica "enviando" e o banco a retoma depois de 5 minutos; no pior caso o aviso sai de novo (o `id` é o mesmo, quem recebe repete sem efeito).
  }
  return ok;
}

/** Uma rodada: até `limite` entregas devidas, enviadas em lotes de `paralelas`. */
export async function enviarDevidas(portas: PortasDoEnvio, transporte: Transporte, limite = 50, paralelas = 5, agora: () => number = Date.now): Promise<ResumoDoEnvio> {
  const entregas = lerEntregas(await portas.reivindicar(limite));
  let enviadas = 0;
  for (let i = 0; i < entregas.length; i += paralelas) {
    const lote = await Promise.all(entregas.slice(i, i + paralelas).map(e => enviarEntrega(e, portas, transporte, agora)));
    enviadas += lote.filter(Boolean).length;
  }
  return { reivindicadas: entregas.length, enviadas, falhas: entregas.length - enviadas };
}
