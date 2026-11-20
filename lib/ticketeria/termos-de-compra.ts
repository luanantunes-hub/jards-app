// Os Termos de compra de ingressos (passo C, parte final): o texto que o comprador lê e aceita antes de gerar o Pix. Só o texto e a versão, sem imports de servidor: a página
// pública (/termos-de-compra) e a tela de compra usam os mesmos números, e o aceite grava a versão (fn_ticketeria_registrar_aceite). TROCAR O TEXTO = trocar a versão.
//
// Segue as decisões do plano (docs/acoes-futuras/estudos/plano-modulo-ticketeria.md): D1 (o organizador vende; o Jards é a plataforma), D5 e D15 (devolução e reembolso por e-mail),
// D6 e D17 (dados), D14 (o preço é o que se paga). Em português simples, sem rodeios.

/** A versão do texto abaixo. Muda toda vez que o texto muda; o pedido guarda a versão que o comprador aceitou. */
export const VERSAO_DOS_TERMOS_DE_COMPRA = "2026-11-19";
export const ATUALIZADO_EM_DOS_TERMOS_DE_COMPRA = "19 de novembro de 2026";

export type SecaoDosTermos = { id: string; titulo: string; paragrafos: string[] };

/** As seções. `{email}` vira o endereço de reembolso configurado (TICKETERIA_EMAIL_DE_REEMBOLSO). */
export const SECOES_DOS_TERMOS_DE_COMPRA: SecaoDosTermos[] = [
  {
    id: "quem-vende", titulo: "Quem vende e quem é o Jards",
    paragrafos: [
      "O ingresso é vendido pelo organizador do evento, que aparece no alto da página de compra. É ele quem realiza o evento e responde por ele: data, horário, local, programação, classificação indicativa e atendimento.",
      "O Jards é a plataforma que registra a sua compra, recebe o pagamento por Pix e emite os ingressos. O Jards não organiza o evento.",
    ],
  },
  {
    id: "preco", titulo: "O preço",
    paragrafos: [
      "O preço do ingresso é o valor que você paga. Não somamos taxa de conveniência nem de serviço por cima.",
      "Na meia-entrada e em outros ingressos com direito próprio, leve o comprovante: ele pode ser pedido na entrada, conforme a lei e a regra do organizador.",
    ],
  },
  {
    id: "reserva", titulo: "Reserva e pagamento",
    paragrafos: [
      "O pagamento é feito por Pix. Quando você gera o código, os lugares ficam reservados por 15 minutos. Se o Pix não for pago nesse prazo, a reserva vence e os lugares voltam à venda.",
      "Se o pagamento cair depois de a reserva vencer e os lugares já tiverem sido vendidos a outra pessoa, o valor é devolvido a você.",
      "Para gerar o Pix, o provedor de pagamento exige o seu CPF ou CNPJ.",
    ],
  },
  {
    id: "ingresso", titulo: "Seu ingresso",
    paragrafos: [
      "Depois que o pagamento é confirmado, os ingressos aparecem na página do seu pedido e chegam por e-mail, cada um com um QR Code e um código.",
      "Cada ingresso vale uma entrada, na sessão que você comprou. Depois de lido na entrada, ele não vale de novo. Quem apresentar o QR Code ou o código primeiro entra: cuide do link do pedido e não o divulgue.",
    ],
  },
  {
    id: "desistir", titulo: "Desistir da compra",
    paragrafos: [
      "Você pode desistir de uma compra feita pela internet em até 7 dias corridos, contados da hora em que o seu pedido de reembolso chegar até nós, desde que a compra tenha sido feita há no máximo 7 dias (art. 49 do Código de Defesa do Consumidor).",
      "Para pedir, envie um e-mail para {email} com o assunto \"reembolso - código do ingresso\", trocando \"código do ingresso\" pelo código que aparece no seu ingresso. Escreva a partir do mesmo e-mail que você usou na compra.",
      "Pedidos feitos dentro do prazo e a partir do e-mail da compra são atendidos automaticamente: devolvemos o valor total pelo mesmo Pix, e os ingressos do pedido deixam de valer. O tempo para o dinheiro aparecer na sua conta depende do seu banco.",
      "Pedidos de outro endereço de e-mail não são atendidos automaticamente: ficam para uma conferência nossa. O mesmo vale se algum ingresso do pedido já tiver sido usado na entrada.",
      "Depois de 7 dias da compra, não há devolução por desistência. Cancelamento e adiamento do evento seguem a regra da seção seguinte.",
    ],
  },
  {
    id: "cancelado", titulo: "Evento cancelado ou adiado",
    paragrafos: [
      "Se o evento ou a sessão for cancelado, devolvemos o valor de todos os ingressos, sem você precisar pedir. Se for adiado, você tem direito ao reembolso e pode pedi-lo pelo mesmo e-mail da seção anterior.",
      "A devolução é de responsabilidade do organizador do evento e é feita pela plataforma.",
    ],
  },
  {
    id: "dados", titulo: "Seus dados",
    paragrafos: [
      "Pedimos o seu nome e o seu e-mail para emitir e entregar os ingressos e para atender pedidos de reembolso. Eles ficam guardados com o pedido por 12 meses.",
      "O CPF ou CNPJ é enviado ao provedor de pagamento só para gerar o Pix e não fica guardado pelo Jards.",
      "O organizador do evento é o responsável pelos dados da venda, e o Jards os trata em nome dele. Para saber mais ou pedir a exclusão, veja a Política de Privacidade.",
    ],
  },
  {
    id: "contato", titulo: "Dúvidas",
    paragrafos: [
      "Dúvidas sobre o evento: fale com o organizador. Dúvidas sobre a compra, o pagamento ou o ingresso: escreva para {email}.",
    ],
  },
];

/** O texto de uma seção com o endereço de e-mail no lugar. */
export const comEmail = (texto: string, email: string) => texto.replaceAll("{email}", email);
