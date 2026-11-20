// Os textos e as contas da tela dos webhooks (Integrações): a frase do que cada endereço recebe, a linha de cada aviso com a hora e o resultado, e a leitura das respostas das rotas. Sem
// banco, sem rede e sem servidor (roda no navegador e nos testes). Desenhos aprovados pelo dono em 20/11/2026.

import { EVENTOS_DO_WEBHOOK, MAX_TENTATIVAS, ROTULO_DO_EVENTO, type EventoDoWebhook } from "@/lib/ticketeria/webhooks";

const FUSO = "America/Sao_Paulo";

export type WebhookDaLista = { id: string; url: string; eventos: EventoDoWebhook[]; ativo: boolean };

/** A lista da rota GET, conferida: só os endereços bem formados, com os eventos que a tela conhece. */
export function lerWebhooks(resposta: unknown): WebhookDaLista[] {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as { webhooks?: unknown };
  if (!Array.isArray(r.webhooks)) return [];
  const lista: WebhookDaLista[] = [];
  for (const x of r.webhooks) {
    const w = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof w.id !== "string" || typeof w.url !== "string" || typeof w.ativo !== "boolean" || !Array.isArray(w.eventos)) continue;
    lista.push({ id: w.id, url: w.url, ativo: w.ativo, eventos: EVENTOS_DO_WEBHOOK.filter(e => (w.eventos as unknown[]).includes(e)) });
  }
  return lista;
}

/** "Venda paga · Reembolso · Ingresso lido": na ordem fixa da lista, não na ordem em que foram marcados. */
export const eventosEmTexto = (eventos: readonly EventoDoWebhook[]): string => EVENTOS_DO_WEBHOOK.filter(e => eventos.includes(e)).map(e => ROTULO_DO_EVENTO[e]).join(" · ");

/** O endereço como cabe na lista: sem o https://, e cortado no meio se for longo (o inteiro fica no título). */
export function enderecoCurto(url: string, max = 48): string {
  const sem = url.replace(/^https:\/\//, "");
  return sem.length <= max ? sem : `${sem.slice(0, Math.ceil((max - 1) * 0.6))}…${sem.slice(sem.length - Math.floor((max - 1) * 0.4))}`;
}

export const MOTIVOS_DA_FALHA: Record<string, string> = {
  tempo_esgotado: "o endereço demorou demais para responder", endereco_interno: "o endereço aponta para uma rede interna", endereco_nao_encontrado: "o endereço não foi encontrado",
  conexao_recusada: "conexão recusada", conexao_encerrada: "conexão encerrada", certificado_invalido: "certificado do site inválido", falha_de_conexao: "falha de conexão",
};

/** O motivo gravado no banco (`http_500`, `redirecionamento_302`, `conexao_recusada`...) numa frase curta. */
export function motivoEmTexto(erro: string | null): string {
  if (!erro) return "";
  const http = /^http_(\d{3})$/.exec(erro);
  if (http) return `o endereço respondeu ${http[1]}`;
  const redirecionamento = /^redirecionamento_(\d{3})$/.exec(erro);
  if (redirecionamento) return `o endereço mandou para outro lugar (${redirecionamento[1]}), e o Jards não segue`;
  return MOTIVOS_DA_FALHA[erro] ?? "falha ao enviar";
}

export type EntregaDaLista = { id: string; tipo: string; estado: string; tentativas: number; ultimo_status: number | null; ultimo_erro: string | null; enviada_em: string | null; created_at: string };

export function lerEntregasDaLista(resposta: unknown): EntregaDaLista[] {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as { entregas?: unknown };
  if (!Array.isArray(r.entregas)) return [];
  const lista: EntregaDaLista[] = [];
  for (const x of r.entregas) {
    const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.tipo !== "string" || typeof e.estado !== "string" || typeof e.tentativas !== "number" || typeof e.created_at !== "string") continue;
    lista.push({ id: e.id, tipo: e.tipo, estado: e.estado, tentativas: e.tentativas, ultimo_status: typeof e.ultimo_status === "number" ? e.ultimo_status : null, ultimo_erro: typeof e.ultimo_erro === "string" ? e.ultimo_erro : null, enviada_em: typeof e.enviada_em === "string" ? e.enviada_em : null, created_at: e.created_at });
  }
  return lista;
}

/** "hoje 14:02", "ontem 19:15" ou "18/11 10:00", no fuso de Brasília. */
export function quandoEmTexto(iso: string, agora: number = Date.now()): string {
  const dia = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const d = dia(Date.parse(iso));
  if (d === dia(agora)) return `hoje ${hora}`;
  if (d === dia(agora - 86_400_000)) return `ontem ${hora}`;
  const [, mes, diaDoMes] = d.split("-");
  return `${diaDoMes}/${mes} ${hora}`;
}

export type LinhaDoAviso = { titulo: string; resultado: string; cor: "verde" | "ambar" | "vermelho" | "cinza" };

/** Uma linha da folha "Últimos avisos": o que foi, quando, e como terminou (enviado, tentando de novo, falhou ou na fila). */
export function linhaDoAviso(e: EntregaDaLista, agora: number = Date.now()): LinhaDoAviso {
  const rotulo = e.tipo === "teste" ? "Teste" : ROTULO_DO_EVENTO[e.tipo as EventoDoWebhook] ?? e.tipo;
  const titulo = `${rotulo} · ${quandoEmTexto(e.created_at, agora)}`;
  switch (e.estado) {
    case "enviada": return { titulo, resultado: e.ultimo_status ? `Enviado (${e.ultimo_status})` : "Enviado", cor: "verde" };
    case "falhou": return { titulo, resultado: `Falhou: ${motivoEmTexto(e.ultimo_erro) || "sem resposta"}`, cor: "vermelho" };
    case "enviando": return { titulo, resultado: "Enviando…", cor: "cinza" };
    default: return e.tentativas === 0
      ? { titulo, resultado: "Na fila", cor: "cinza" }
      : { titulo, resultado: `Tentando de novo (${e.ultimo_status ?? motivoEmTexto(e.ultimo_erro)}), ${e.tentativas + 1}ª vez de ${MAX_TENTATIVAS}`, cor: "ambar" };
  }
}

/** O erro de uma rota do produtor numa frase: a mensagem que o servidor mandou, ou uma geral. */
export function frasesDoErroDeRota(status: number, corpo: unknown): string {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as { mensagem?: unknown };
  if (typeof c.mensagem === "string" && c.mensagem !== "") return c.mensagem;
  if (status === 403) return "Você não pode mudar a Ticketeria desta organização.";
  if (status === 429) return "Muitas tentativas. Espere um pouco e tente de novo.";
  return "Não foi possível salvar. Tente de novo.";
}

export const AVISO_DOS_DADOS_DO_COMPRADOR = "Os avisos de venda trazem o nome e o e-mail de quem comprou. Mande só para sistemas seus ou de confiança.";
export const AVISO_DO_SEGREDO = "Ele serve para conferir que o aviso veio do Jards. Não aparece de novo: se perder, gere outro em Editar.";
