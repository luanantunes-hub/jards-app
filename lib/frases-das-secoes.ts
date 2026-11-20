import { PACOTE_ATIVO, type PacoteDeIlustracoes } from "@/lib/pacotes-de-ilustracoes";
// Frase do topo de cada seção, na voz do Jards (como a saudação do painel). "{, nome}" vira ", Ana"
// ou some; "{org}" só entra quando a organização tem nome próprio (senão a frase é descartada).
// A escolha é fixa por pessoa, dia e seção (escolherFrase em lib/saudacao.ts).

export const FRASES_DAS_SECOES = {
  atividades: ["O que tem na agenda hoje{, nome}?", "Um follow-up por dia mantém o pipeline vivo.", "Sua semana, hora a hora."],
  negociacoes: ["Quem está perto de fechar{, nome}?", "Cada etapa, um passo mais perto do patrocínio.", "Que negociação merece atenção hoje?"],
  empresas: ["Quem você ainda não procurou{, nome}?", "As empresas que podem apoiar seus projetos."],
  contatos: ["As pessoas por trás de cada empresa{, nome}.", "Com quem foi a última boa conversa?"],
  patrocinadores: ["Quem já investe no que você faz{, nome}?", "Cada empresa aqui já disse sim a alguém.", "O que cada patrocinador costuma apoiar, antes do primeiro contato."],
  clientes: ["Patrocínio fechado é relação que começa.", "Como estão seus parceiros{, nome}?"],
  projetos: ["Qual projeto está mais perto de fechar{, nome}?", "O que cada projeto ainda precisa para encontrar quem o apoie."],
  editais: ["Edital fecha às 23h59 de um dia que sempre chega antes{, nome}.", "O que abriu desde a última vez que você passou por aqui."],
  inscricoes: ["Qual inscrição ainda pede um anexo{, nome}?", "Quantas esperam resultado esta semana?"],
  proponentes: ["Quem está por trás de cada projeto{, nome}.", "Cada proponente e os projetos que confiou a você."],
  captadores: ["Quem está levando os projetos adiante.", "Como está a carteira de cada captador?"],
  prestacoes: ["Conta bem prestada, próximo projeto aprovado.", "O que falta para enviar{, nome}?"],
  fornecedores: ["Quem fornece, com nota e comprovante em ordem."],
  producao: ["Do ensaio à última sessão.", "Como está a temporada{, nome}?"],
  notificacoes: ["O que mudou enquanto você estava fora.", "Tudo lido{, nome}?"],
  publicacoes: ["O que o Jards tem a dizer hoje?"],
  // Ficam no fim de propósito: a ordem das chaves decide o tamanduá do dia de cada seção.
  conversas: ["Com quem foi a última boa conversa{, nome}?", "Tudo o que foi dito, num lugar só.", "Quem está esperando sua resposta hoje?"],
  comparativo: ["Quem tem espaço de investimento na lei do seu projeto{, nome}?", "Lado a lado, a escolha fica mais clara.", "Compare antes de escrever o primeiro e-mail."],
} as const satisfies Record<string, readonly string[]>;

export type SecaoComFrase = keyof typeof FRASES_DAS_SECOES;

function mdc(a: number, b: number): number {
  return b === 0 ? a : mdc(b, a % b);
}

/** O menor passo, a partir de `preferido`, sem divisor comum com `total`: assim, andar de passo em passo percorre o pacote inteiro. */
export function passoCoprimo(total: number, preferido: number): number {
  let passo = preferido;
  while (mdc(passo, total) !== 1) passo++;
  return passo;
}

const ORDEM_DAS_SECOES: (SecaoComFrase | "painel")[] = ["painel", ...(Object.keys(FRASES_DAS_SECOES) as SecaoComFrase[])];

/**
 * Qual dos desenhos do pacote a seção mostra hoje (de 1 ao total do pacote). O sorteio é sempre dentro de um
 * pacote (lib/pacotes-de-ilustracoes.ts). Muda todo dia e, no mesmo dia, as seções não repetem a de outra
 * enquanto houver desenho sobrando: o passo entre seções não tem divisor comum com o total do pacote (ver
 * `passoCoprimo`), então as primeiras posições, até o total, não colidem. Com mais seções que desenhos, só as
 * últimas repetem uma das primeiras, e elas nunca aparecem juntas na tela.
 */
export function ilustracaoDoDia(secao: SecaoComFrase | "painel", agora: Date, pacote: PacoteDeIlustracoes = PACOTE_ATIVO): number {
  const dia = Math.floor(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86_400_000);
  const posicao = Math.max(0, ORDEM_DAS_SECOES.indexOf(secao));
  return ((dia * passoCoprimo(pacote.total, 7) + posicao * passoCoprimo(pacote.total, 5)) % pacote.total) + 1;
}
