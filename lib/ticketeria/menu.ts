// As abas da Ticketeria. O menu lateral tem seis itens e, dentro de Programação, Financeiro, Marketing e Configurações, uma barra de abas leva às páginas que
// antes eram itens soltos. Vendas não tem abas: é uma página de caixas, uma por forma de vender (lib/ticketeria/vender.ts), e as páginas de cada caixa
// (a Bilheteria, a Loja online) têm um "← Vendas" no lugar da barra. O espaço de trabalho se ajusta ao que o produtor faz (migration
// ticketeria_canais_da_loja): os Espaços só aparecem em Programação para quem trabalha com um espaço, e o que falta aparece como um "+" na própria barra.
// Pedidos e o Controle de entrada ficam em Financeiro, para todos. Puro (sem imports de servidor): roda nos testes (tests/ticketeria-menu.test.ts).

export type Canal = "porta" | "online";

/** O que a loja escolheu. NULL em um campo = "ainda não escolheu": tudo aparece e nenhum "+" é oferecido (é o caso das lojas que já existem). */
export type EscolhasDaLoja = { canais: string[] | null; usaEspacos: boolean | null };

export type Aba = { rotulo: string; href: string; /** Só esta rota acende a aba (a lista de eventos, não a página de um evento). */ exata?: boolean };

/** O que um "+" faz: a escolha que ele grava na loja e a página para onde leva em seguida. */
export type Adicao = { rotulo: string; href: string; grava: { canal: Canal } | { usaEspacos: true } };

export type GrupoId = "programacao" | "financeiro" | "divulgacao" | "configuracoes";

/** Um trecho da barra: as abas e, logo depois delas, os "+" do que a loja ainda pode acrescentar ali. */
export type Secao = { abas: Aba[]; mais: Adicao[] };

/** As abas de um grupo, em seções (uma linha fina separa uma seção da outra). */
export type BarraDeAbas = { grupo: GrupoId; secoes: Secao[]; ativa: Aba };

const EVENTOS: Aba = { rotulo: "Eventos", href: "/ingressos/eventos", exata: true };
const ESPACOS: Aba = { rotulo: "Espaços", href: "/ingressos/locais" };
const RECEBIMENTOS: Aba = { rotulo: "Recebimentos", href: "/ingressos/recebimentos" };
const PEDIDOS: Aba = { rotulo: "Pedidos", href: "/ingressos/vendas" };
const ENTRADA: Aba = { rotulo: "Controle de entrada", href: "/ingressos/porta" };

const DIVULGACAO: Aba[] = [
  { rotulo: "Campanhas", href: "/ingressos/divulgacao" },
  { rotulo: "Cupons", href: "/ingressos/cupons" },
  { rotulo: "Lista de espera", href: "/ingressos/espera" },
  { rotulo: "Público", href: "/ingressos/publico" },
];
const INTEGRACOES: Aba = { rotulo: "Integrações", href: "/ingressos/integracoes" };

const casa = (path: string, aba: Aba) => (aba.exata ? path === aba.href : path === aba.href || path.startsWith(aba.href + "/"));

const comEspacos = (loja: EscolhasDaLoja) => loja.usaEspacos === null || loja.usaEspacos;

/** Toda aba que existe, por grupo, para achar a página aberta mesmo quando a loja não escolheu aquela aba (quem chega por um endereço antigo a vê). */
const TODAS: Record<GrupoId, Aba[]> = {
  programacao: [EVENTOS, ESPACOS],
  financeiro: [RECEBIMENTOS, PEDIDOS, ENTRADA],
  divulgacao: DIVULGACAO,
  configuracoes: [INTEGRACOES],
};

/** As abas e os "+" de um grupo para esta loja. */
export function barraDoGrupo(grupo: GrupoId, loja: EscolhasDaLoja, ativa: Aba): BarraDeAbas {
  const noMenu = (aba: Aba) => aba === ativa; // a aba da página aberta fica sempre à vista
  if (grupo === "programacao") {
    const espacos = comEspacos(loja) || noMenu(ESPACOS);
    return {
      grupo, ativa,
      secoes: [{ abas: [EVENTOS, ...(espacos ? [ESPACOS] : [])], mais: espacos ? [] : [{ rotulo: "Espaços", href: ESPACOS.href, grava: { usaEspacos: true } }] }],
    };
  }
  return { grupo, ativa, secoes: [{ abas: TODAS[grupo], mais: [] }] };
}

/** O grupo de abas da página aberta e a aba acesa; null nas páginas que não pertencem a um grupo (Início, Começar, a página de um evento). */
export function abasDaRota(path: string, loja: EscolhasDaLoja = { canais: null, usaEspacos: null }): BarraDeAbas | null {
  for (const grupo of Object.keys(TODAS) as GrupoId[]) {
    const ativa = TODAS[grupo].find(aba => casa(path, aba));
    if (ativa) return barraDoGrupo(grupo, loja, ativa);
  }
  return null;
}

/** A barra só aparece com mais de uma aba ou com algum "+": uma barra de uma aba só não leva a lugar nenhum. */
export const barraTemOQueMostrar = (barra: BarraDeAbas) => barra.secoes.reduce((soma, secao) => soma + secao.abas.length, 0) > 1 || barra.secoes.some(secao => secao.mais.length > 0);

/** As escolhas da loja depois de tocar num "+": o canal entra na lista (sem repetir) e os espaços ficam ligados. */
export function depoisDeAdicionar(loja: EscolhasDaLoja, adicao: Adicao): EscolhasDaLoja {
  if ("usaEspacos" in adicao.grava) return { ...loja, usaEspacos: true };
  const canais = loja.canais ?? [];
  return { ...loja, canais: canais.includes(adicao.grava.canal) ? [...canais] : [...canais, adicao.grava.canal] };
}

/**
 * O que o Começar grava na loja depois de criar o evento. A primeira vez (nada escolhido ainda) vale a resposta; nas seguintes, soma-se ao que já estava
 * (quem vendia na porta e agora também online passa a ter os dois; ninguém perde um canal por criar outro evento).
 */
export function escolhasDoComecar(atual: EscolhasDaLoja, respondeu: { canais: readonly Canal[]; temEspaco: boolean }): EscolhasDaLoja {
  const canais = atual.canais === null ? [...respondeu.canais] : [...new Set([...atual.canais, ...respondeu.canais])];
  return { canais, usaEspacos: atual.usaEspacos === null ? respondeu.temEspaco : atual.usaEspacos || respondeu.temEspaco };
}

/** As páginas de cada caixa de Vendas (a Bilheteria, a Loja online) não têm barra de abas: têm um "← Vendas" que leva de volta à página de caixas. */
const PAGINAS_DAS_CAIXAS = ["/ingressos/bilheteria", "/ingressos/site"];
export function voltaDaRota(path: string): { rotulo: string; href: string } | null {
  return PAGINAS_DAS_CAIXAS.some(rota => path === rota || path.startsWith(rota + "/")) ? { rotulo: "Vendas", href: "/ingressos/vender" } : null;
}
