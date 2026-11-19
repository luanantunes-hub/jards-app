import type { Conversa } from "./conversas";

/** Os recortes da caixa de entrada do Jards. */
export type FiltroDaCaixa = "todas" | "aguardando" | "sem-contato" | "so-eu";

export const FILTROS_DA_CAIXA: ReadonlyArray<{ value: FiltroDaCaixa; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "aguardando", label: "Aguardando resposta" },
  { value: "sem-contato", label: "Sem contato" },
  { value: "so-eu", label: "Só eu vejo" },
];

/** A conversa passa no filtro? "Sem contato" são as que ainda não viraram contato (a triagem cuida delas). */
export function conversaNoFiltro(conversa: Conversa, filtro: FiltroDaCaixa): boolean {
  switch (filtro) {
    case "aguardando":
      return conversa.situacao?.tipo === "aguardando";
    case "sem-contato":
      return conversa.contatoIds.length === 0;
    case "so-eu":
      return conversa.privada;
    default:
      return true;
  }
}

/** Quantas conversas cada filtro mostra, para as etiquetas dos botões. */
export function contagemPorFiltro(conversas: readonly Conversa[]): Record<FiltroDaCaixa, number> {
  return {
    todas: conversas.length,
    aguardando: conversas.filter((conversa) => conversaNoFiltro(conversa, "aguardando")).length,
    "sem-contato": conversas.filter((conversa) => conversaNoFiltro(conversa, "sem-contato")).length,
    "so-eu": conversas.filter((conversa) => conversaNoFiltro(conversa, "so-eu")).length,
  };
}

/**
 * Com quem é a conversa: os contatos, quando existem; senão o "outro lado" da última mensagem
 * (quem enviou, ou o primeiro destinatário quando foi a pessoa quem escreveu por último).
 */
export function quemDaConversa(conversa: Conversa, nomesDosContatos: readonly string[]): string[] {
  if (nomesDosContatos.length > 0) return [...nomesDosContatos];
  const { ultima } = conversa;
  const outro = ultima.direction === "outbound"
    ? (ultima.to_emails ?? [])[0]
    : ultima.from_name?.trim() || ultima.from_email;
  return outro ? [outro] : [];
}
