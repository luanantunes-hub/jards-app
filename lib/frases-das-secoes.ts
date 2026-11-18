// Frase do topo de cada seção, na voz do Jards (como a saudação do painel). "{, nome}" vira ", Ana"
// ou some; "{org}" só entra quando a organização tem nome próprio (senão a frase é descartada).
// A escolha é fixa por pessoa, dia e seção (escolherFrase em lib/saudacao.ts).

export const FRASES_DAS_SECOES = {
  atividades: ["O que tem na agenda hoje{, nome}?", "Um follow-up por dia mantém o pipeline vivo.", "Sua semana, hora a hora."],
  negociacoes: ["Quem está perto de fechar{, nome}?", "Cada etapa, um passo mais perto do patrocínio.", "Que negociação merece atenção hoje?"],
  empresas: ["Quem você ainda não procurou{, nome}?", "As empresas que podem apoiar seus projetos."],
  contatos: ["As pessoas por trás de cada empresa{, nome}.", "Com quem foi a última boa conversa?"],
  patrocinadores: ["Quem já apostou num projeto e pode apostar no seu{, nome}.", "O que cada patrocinador costuma apoiar, antes do primeiro contato."],
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
} as const satisfies Record<string, readonly string[]>;

export type SecaoComFrase = keyof typeof FRASES_DAS_SECOES;
