// A leitura de uma conexão de mídia (gasto ou visitas): que dias ler, ler em partes, gravar e marcar o resultado. Sem banco e sem rede: as portas entram por parâmetro (tests/ticketeria-sincronizar.test.ts).
// A primeira leitura traz o último ano (o modelo precisa de histórico); as seguintes refazem os últimos 7 dias, porque a Meta ajusta os números recentes.

import { frasePedindoNovaConexao, fraseDoErro } from "@/lib/ticketeria/midia/erro";

export const DIAS_DA_PRIMEIRA_LEITURA = 365;
export const DIAS_REFEITOS_NA_LEITURA = 7;
export const DIAS_POR_PEDIDO = 90;

const somaDias = (dia: string, n: number): string => { const d = new Date(`${dia}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** O período a ler: o último ano na primeira vez; depois, desde 7 dias antes da última leitura. `hoje` é AAAA-MM-DD. */
export function janelaDeLeitura(ultimaLeitura: string | null, hoje: string): { de: string; ate: string } {
  if (!ultimaLeitura) return { de: somaDias(hoje, -DIAS_DA_PRIMEIRA_LEITURA), ate: hoje };
  const dia = ultimaLeitura.slice(0, 10);
  const de = somaDias(dia, -DIAS_REFEITOS_NA_LEITURA);
  return { de: de > hoje ? hoje : de, ate: hoje };
}

/** Pedaços de até `max` dias, na ordem. */
export function emPartes(de: string, ate: string, max: number = DIAS_POR_PEDIDO): { de: string; ate: string }[] {
  const partes: { de: string; ate: string }[] = [];
  for (let inicio = de; inicio <= ate; inicio = somaDias(inicio, max)) {
    const fim = somaDias(inicio, max - 1);
    partes.push({ de: inicio, ate: fim > ate ? ate : fim });
  }
  return partes;
}

export type ConexaoParaLer = { id: string; conta_externa_id: string; ultima_leitura_em: string | null; /** A conta gerente por onde se chega à conta (Google Ads), se houver. */ gerente?: string | null };

export type PortasDaLeitura = {
  token(conexao: string): Promise<string | null>;
  /** Lê um pedaço do período na plataforma e grava o que veio (gasto por dia ou visitas por dia e origem). Devolve quantas linhas leu. */
  lerPeriodo(token: string, conta: string, de: string, ate: string, gerente: string | null, conexao: string): Promise<number>;
  marcar(conexao: string, resultado: { ok: true; lido_desde: string } | { ok: false; erro: string; token_invalido: boolean }): Promise<void>;
};

export type ResultadoDaLeitura = { ok: true; dias: number } | { ok: false; erro: string; token_invalido: boolean };

/** `fonte` é o nome que o produtor conhece ("Meta", "Google Ads"): entra nas frases de erro. */
export async function lerConexao(portas: PortasDaLeitura, conexao: ConexaoParaLer, hoje: string, fonte: string = "Meta"): Promise<ResultadoDaLeitura> {
  const falhou = async (erro: unknown): Promise<ResultadoDaLeitura> => {
    const { frase, tokenInvalido } = fraseDoErro(erro, fonte);
    try { await portas.marcar(conexao.id, { ok: false, erro: frase, token_invalido: tokenInvalido }); } catch { /* o erro principal é o que vale */ }
    return { ok: false, erro: frase, token_invalido: tokenInvalido };
  };
  let token: string | null;
  try { token = await portas.token(conexao.id); } catch (erro) { return falhou(erro); }
  if (!token) {
    const frase = frasePedindoNovaConexao(fonte);
    try { await portas.marcar(conexao.id, { ok: false, erro: frase, token_invalido: true }); } catch { /* idem */ }
    return { ok: false, erro: frase, token_invalido: true };
  }
  const janela = janelaDeLeitura(conexao.ultima_leitura_em, hoje);
  let total = 0;
  try {
    for (const parte of emPartes(janela.de, janela.ate)) {
      total += await portas.lerPeriodo(token, conexao.conta_externa_id, parte.de, parte.ate, conexao.gerente ?? null, conexao.id);
    }
    await portas.marcar(conexao.id, { ok: true, lido_desde: janela.de });
  } catch (erro) {
    return falhou(erro);
  }
  return { ok: true, dias: total };
}
