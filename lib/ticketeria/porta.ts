// A porta (passo C5 da T5): o que a conferência de ingressos devolve do banco, em frases e horas para a tela. Só a conta, sem banco e sem imports de servidor: roda no
// navegador e nos testes (tests/ticketeria-porta.test.ts). O banco decide tudo (fn_ticketeria_conferir_ingresso); aqui só se lê e se formata.

import type { IngressoAchado, LinkDaEquipe, RelatorioDaSessao } from "@/components/ticketeria/PortaExtrasView";
import type { EntradaRecente, ResultadoDaConferencia } from "@/components/ticketeria/PortaView";
import { diaEHoraDoEvento } from "@/lib/ticketeria/pagamento/ingressos";

/** O código lido do QR Code ou digitado: sem espaços e traços, em maiúsculas; se vier dentro de um endereço ou de um texto, acha as 10 letras e números do ingresso. */
export function normalizarCodigo(texto: string): string {
  const bruto = (texto ?? "").toUpperCase();
  const achado = /(?:^|[^A-Z0-9])([A-HJ-NP-Z2-9]{10})(?:[^A-Z0-9]|$)/.exec(bruto);
  if (achado) return achado[1];
  return bruto.replace(/[^A-Z0-9]/g, "");
}

/** "19:58", no fuso do local. */
export function horaNoFuso(iso: string, fuso: string): string {
  try { return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); } catch { return iso; }
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** A resposta do banco como a tela mostra; null se veio algo que não se entende (a tela diz "tente de novo", nunca "pode entrar"). */
export function resultadoDaConferencia(bruto: unknown, fusoDaSessao: string): ResultadoDaConferencia | null {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const codigo = texto(r.codigo);
  switch (r.tipo) {
    case "pode_entrar":
      return typeof r.restantes === "number" ? { tipo: "pode_entrar", ingresso: texto(r.ingresso), assento: texto(r.assento) || null, comprador: texto(r.comprador), codigo, restantes: r.restantes } : null;
    case "ja_usado":
      return { tipo: "ja_usado", ingresso: texto(r.ingresso), assento: texto(r.assento) || null, comprador: texto(r.comprador), codigo, usado_em: horaNoFuso(texto(r.usado_em), texto(r.fuso) || fusoDaSessao) };
    case "outra_sessao": {
      const quando = texto(r.sessao_inicio) ? diaEHoraDoEvento(texto(r.sessao_inicio), texto(r.sessao_fuso) || fusoDaSessao) : "";
      return { tipo: "outra_sessao", ingresso: texto(r.ingresso), sessao_do_ingresso: [texto(r.evento), quando].filter(Boolean).join(", "), codigo };
    }
    case "cancelado": return { tipo: "cancelado", ingresso: texto(r.ingresso), codigo };
    case "nao_encontrado": return { tipo: "nao_encontrado", codigo };
    default: return null;
  }
}

export type ResumoDaPorta = { validos: number; entraram: number; recentes: EntradaRecente[] };

export function resumoDaPorta(bruto: unknown): ResumoDaPorta | null {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  if (typeof r.validos !== "number" || typeof r.entraram !== "number" || !Array.isArray(r.recentes)) return null;
  const fuso = texto(r.fuso) || "America/Sao_Paulo";
  return {
    validos: r.validos, entraram: r.entraram,
    recentes: r.recentes.map(x => { const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>; return { codigo: texto(e.codigo), ingresso: texto(e.ingresso), assento: texto(e.assento) || null, comprador: texto(e.comprador), hora: horaNoFuso(texto(e.usado_em), fuso) }; }),
  };
}

// ─── A porta melhor: buscar pelo nome, desfazer uma entrada, o relatório e a lista ──

const registro = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** A resposta de fn_ticketeria_porta_buscar como a tela mostra; null se veio algo que não se entende. */
export function resultadoDaBusca(bruto: unknown): { achados: IngressoAchado[]; mais: boolean } | null {
  const r = registro(bruto);
  if (!Array.isArray(r.achados)) return null;
  const fuso = texto(r.fuso) || "America/Sao_Paulo";
  const achados: IngressoAchado[] = [];
  for (const x of r.achados) {
    const a = registro(x);
    if (a.situacao !== "nao_entrou" && a.situacao !== "entrou" && a.situacao !== "cancelado") return null;
    achados.push({ codigo: texto(a.codigo), ingresso: texto(a.ingresso), assento: texto(a.assento) || null, comprador: texto(a.comprador), situacao: a.situacao, hora: a.situacao === "entrou" && texto(a.usado_em) ? horaNoFuso(texto(a.usado_em), fuso) : null });
  }
  return { achados, mais: r.mais === true };
}

export type ResultadoDoDesfazer = { tipo: "desfeita"; ingresso: string; comprador: string; restantes: number } | { tipo: "nao_usado" | "cancelado" | "outra_sessao" | "nao_encontrado" };

/** A resposta de fn_ticketeria_porta_desfazer; null se veio algo que não se entende (a tela diz "tente de novo", nunca "desfeita"). */
export function resultadoDoDesfazer(bruto: unknown): ResultadoDoDesfazer | null {
  const r = registro(bruto);
  if (r.tipo === "desfeita") return typeof r.restantes === "number" ? { tipo: "desfeita", ingresso: texto(r.ingresso), comprador: texto(r.comprador), restantes: r.restantes } : null;
  return r.tipo === "nao_usado" || r.tipo === "cancelado" || r.tipo === "outra_sessao" || r.tipo === "nao_encontrado" ? { tipo: r.tipo } : null;
}

/** A frase para a pessoa da porta quando desfazer não deu. */
export function frasesDoDesfazer(r: ResultadoDoDesfazer): string | null {
  if (r.tipo === "desfeita") return null;
  if (r.tipo === "nao_usado") return "Este ingresso não estava marcado como usado.";
  if (r.tipo === "cancelado") return "Este ingresso foi cancelado (compra reembolsada).";
  if (r.tipo === "outra_sessao") return "Este ingresso é de outra sessão.";
  return "Ingresso não encontrado.";
}

/** A resposta de fn_ticketeria_porta_relatorio; null se veio algo que não se entende. */
export function relatorioDaSessao(bruto: unknown): RelatorioDaSessao | null {
  const r = registro(bruto);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const [validos, entraram, cancelados] = [n(r.validos), n(r.entraram), n(r.cancelados)];
  if (validos === null || entraram === null || cancelados === null || !Array.isArray(r.por_ingresso) || !Array.isArray(r.por_horario)) return null;
  const porIngresso = r.por_ingresso.map(x => { const i = registro(x); return { nome: texto(i.nome), validos: n(i.validos) ?? 0, entraram: n(i.entraram) ?? 0 }; });
  const porHorario = r.por_horario.map(x => { const h = registro(x); return { faixa: texto(h.faixa), entradas: n(h.entradas) ?? 0 }; });
  return { validos, entraram, cancelados, porIngresso, porHorario };
}

const SITUACAO_DO_CSV: Record<string, string> = { entrou: "Entrou", nao_entrou: "Não entrou", cancelado: "Cancelado" };

/** Uma célula do CSV: entre aspas se preciso, e sem poder virar fórmula na planilha (= + - @ no começo ganham um apóstrofo). */
export function celulaDoCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** A lista da sessão em CSV (ponto e vírgula, como o Excel em português lê; com BOM para os acentos). Dado pessoal: quem chama já conferiu quem pode. */
export function csvDaLista(bruto: unknown): string | null {
  const r = registro(bruto);
  if (!Array.isArray(r.ingressos)) return null;
  const fuso = texto(r.fuso) || "America/Sao_Paulo";
  const dataHora = (iso: string) => {
    try { return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(", ", " "); } catch { return iso; }
  };
  const linhas = [["Comprador", "Ingresso", "Lugar", "Situação", "Entrou em"]];
  for (const x of r.ingressos) {
    const i = registro(x);
    linhas.push([texto(i.comprador), texto(i.ingresso), texto(i.assento), SITUACAO_DO_CSV[texto(i.situacao)] ?? "", i.situacao === "entrou" && texto(i.usado_em) ? dataHora(texto(i.usado_em)) : ""]);
  }
  return "\uFEFF" + linhas.map(l => l.map(celulaDoCsv).join(";")).join("\r\n") + "\r\n";
}

// ─── O link da equipe da porta ──────────────────────────────────────────────

/** O segredo do link: 64 letras minúsculas e números. */
export const TOKEN_DO_LINK = /^[a-f0-9]{64}$/;

/** "dom., 30/11 às 20:00", no fuso do local. */
export function validadeDoLink(iso: string, fuso: string): string {
  try {
    const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(iso)).replace(",", "");
    const partes = dia.split(" ");
    return `${partes[0]}${partes.length > 1 ? ", " + partes.slice(1).join(" ") : ""} às ${horaNoFuso(iso, fuso)}`;
  } catch { return iso; }
}

/** A lista de links de uma sessão como a folha a mostra: o endereço leva o segredo e a origem do app. */
export function linksDaEquipe(bruto: unknown, origem: string): LinkDaEquipe[] | null {
  const r = registro(bruto);
  if (!Array.isArray(r.links)) return null;
  const fuso = texto(r.fuso) || "America/Sao_Paulo";
  const links: LinkDaEquipe[] = [];
  for (const x of r.links) {
    const l = registro(x);
    if (!TOKEN_DO_LINK.test(texto(l.token)) || !texto(l.id)) return null;
    links.push({ id: texto(l.id), rotulo: texto(l.rotulo), endereco: `${origem.replace(/\/+$/, "")}/porta/${texto(l.token)}`, valido_ate: validadeDoLink(texto(l.valido_ate), fuso), ativo: l.ativo === true });
  }
  return links;
}

/** O próximo nome de link: "Porta 1", "Porta 2"... (o primeiro que ainda não existe). */
export function proximoNomeDeLink(existentes: readonly string[]): string {
  const usados = new Set(existentes.map(n => n.trim().toLowerCase()));
  let n = 1;
  while (usados.has(`porta ${n}`)) n++;
  return `Porta ${n}`;
}

export type ResumoDaEquipe = { evento: string; quando: string; link: string; resumo: ResumoDaPorta };

/** O resumo que a equipe vê pelo link: o evento, o dia da sessão, o nome do link e a contagem. */
export function resumoDaEquipe(bruto: unknown): ResumoDaEquipe | null {
  const resumo = resumoDaPorta(bruto);
  if (!resumo) return null;
  const r = registro(bruto);
  const fuso = texto(r.fuso) || "America/Sao_Paulo";
  const inicio = texto(r.inicio);
  return { evento: texto(r.evento), quando: inicio ? validadeDoLink(inicio, fuso) : "", link: texto(r.link), resumo };
}
