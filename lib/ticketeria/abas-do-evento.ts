// As subabas da página do evento (Ticketeria > Programação > um evento): Sessões, Ingressos e Precificação. Só lógica, sem banco e sem imports de servidor: roda na tela e nos testes
// (tests/ticketeria-abas-do-evento.test.ts). A aba aberta vive no endereço (#ingressos), como nas abas da temporada, para recarregar ou mandar o link e cair no mesmo lugar.

export type AbaDoEvento = "sessoes" | "ingressos" | "precificacao";

const TODAS: readonly { id: AbaDoEvento; rotulo: string }[] = [
  { id: "sessoes", rotulo: "Sessões" },
  { id: "ingressos", rotulo: "Ingressos" },
  { id: "precificacao", rotulo: "Precificação" },
];

/** As abas que a pessoa vê: a Precificação (leitura de vendas e preço dinâmico) é só de quem edita a Ticketeria. */
export function abasDoEvento(podeEditar: boolean): readonly { id: AbaDoEvento; rotulo: string }[] {
  return podeEditar ? TODAS : TODAS.filter(aba => aba.id !== "precificacao");
}

/** A aba pedida no endereço (`#ingressos`); o que não existe, ou que a pessoa não pode ver, cai em Sessões. */
export function abaDoEndereco(hash: string, podeEditar: boolean): AbaDoEvento {
  const pedida = hash.replace(/^#/, "");
  return abasDoEvento(podeEditar).find(aba => aba.id === pedida)?.id ?? "sessoes";
}
