// Quais notificações pertencem a um módulo. Na Ticketeria o sino e a lista mostram só o que é do módulo: a categoria "ticketeria",
// um evento cujo nome começa por "ticketeria" ou um link que leva a /ingressos. O resto do Jards (editais, propostas, atividades…) fica fora.

export type ModuloDeNotificacao = "ticketeria";
export type NotificacaoParaFiltrar = { categoria?: string | null; tipo?: string | null; event_key?: string | null; link?: string | null };

export function notificacaoDoModulo(n: NotificacaoParaFiltrar, modulo: ModuloDeNotificacao): boolean {
  if (modulo === "ticketeria") {
    const evento = (n.event_key ?? n.tipo ?? "").toLowerCase();
    const link = n.link ?? "";
    return n.categoria === "ticketeria" || evento.startsWith("ticketeria") || link === "/ingressos" || link.startsWith("/ingressos/");
  }
  return false;
}

/** O módulo pedido na URL (?modulo=ticketeria); qualquer outro valor vale como "sem módulo". */
export function moduloDaBusca(busca: string): ModuloDeNotificacao | null {
  return new URLSearchParams(busca).get("modulo") === "ticketeria" ? "ticketeria" : null;
}
