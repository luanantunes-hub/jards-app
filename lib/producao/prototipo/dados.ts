// Os dados de exemplo dos protótipos da produção (/producoes/prototipo). Inventados e fixos: servem
// para ver como as telas que ainda não existem vão ficar. Nada aqui é lido nem gravado no banco, e os
// nomes, telefones e valores não são de ninguém. Quando a tela de verdade chega, o protótipo dela sai
// (e o que ela usava daqui também).
//
// A história é uma só: a companhia circula com o espetáculo "Mar de Dentro" por seis cidades do
// interior paulista, e a data de Campinas (sábado, 05 de dezembro) é a que aparece em detalhe.

export const TURNE = { titulo: "Circulação Interior Paulista", obra: "Mar de Dentro", praca: "Campinas (SP)" };

export const DATA = {
  titulo: "Apresentação de 05 dez",
  dia: "sáb, 05 dez",
  lugar: "Teatro da Cidade",
  endereco: "Rua das Andorinhas, 120 · Centro · Campinas (SP)",
  contratante: "Secretaria Municipal de Cultura de Campinas",
  anterior: "04 dez · Jundiaí",
  proxima: "06 dez · Sorocaba",
  lugares: 480,
};

export type Bloco = { hora: string; titulo: string; confirmado: boolean; naFolha: boolean };
export const BLOCOS: Bloco[] = [
  { hora: "08:15", titulo: "Chegada da van", confirmado: true, naFolha: true },
  { hora: "09:00–12:00", titulo: "Carga", confirmado: true, naFolha: true },
  { hora: "12:00–17:00", titulo: "Montagem", confirmado: true, naFolha: true },
  { hora: "13:00–14:00", titulo: "Almoço", confirmado: true, naFolha: true },
  { hora: "17:30–18:30", titulo: "Passagem de som", confirmado: true, naFolha: true },
  { hora: "cerca de 19:00", titulo: "Jantar", confirmado: false, naFolha: true },
  { hora: "20:30", titulo: "Abertura da casa", confirmado: true, naFolha: true },
  { hora: "21:00–22:30", titulo: "Sessão", confirmado: true, naFolha: true },
  { hora: "22:45–01:00 (+1)", titulo: "Desmontagem", confirmado: false, naFolha: true },
];

export type Escala = { nome: string; funcao: string; horario: string; resposta: "Confirmou" | "Sem resposta" | "Recusou"; conflito?: string };
export const ESCALAS: Escala[] = [
  { nome: "Bia Santos", funcao: "Motorista", horario: "chamada 06:00 · saída 10:00", resposta: "Confirmou" },
  { nome: "Marina Duarte", funcao: "Direção de palco", horario: "chamada 08:30 · saída 01:30 (+1)", resposta: "Confirmou" },
  { nome: "Rafael Nunes", funcao: "Luz", horario: "chamada 12:00 · saída 01:00 (+1)", resposta: "Confirmou", conflito: "Também em Temporada de dezembro no Teatro Municipal · 05 dez · chamada 19:00 · saída 23:00" },
  { nome: "Joana Prado", funcao: "Som", horario: "chamada 14:00 · saída 23:30", resposta: "Sem resposta" },
  { nome: "Carolina Reis · Carol Reis", funcao: "Atriz", horario: "chamada 18:00 · saída 23:00", resposta: "Confirmou" },
  { nome: "Tiago Lemos", funcao: "Contrarregra", horario: "chamada 12:00 · saída 01:00 (+1)", resposta: "Recusou" },
];

export const VIAGEM = {
  titulo: "Van da companhia",
  saida: "06:30 · Hotel Paulista, São Paulo",
  chegada: "08:15 · Teatro da Cidade (porta de carga, Rua dos Ipês)",
  motorista: "Bia Santos · (11) 90000-0101",
  detalhe: "Van 15 lugares · placa ABC1D23 · 9 pessoas e a carga leve",
};

export const HOSPEDAGEM = {
  titulo: "Hotel Central de Campinas",
  endereco: "Av. Francisco Glicério, 900 · Campinas (SP)",
  periodo: "entrada 05 dez às 14:00 · saída 06 dez às 12:00",
  quartos: "5 quartos (3 duplos, 2 single) · café incluso",
  localizador: "HC-48213",
  arquivo: "voucher-hotel-central.pdf",
};

export type Tarefa = {
  titulo: string; data: string; prazo: string; responsavel: string;
  situacao: "feita" | "aberta" | "atrasada"; grupo: "Atrasadas" | "Esta semana" | "Depois" | "Feitas";
};
export const TAREFAS: Tarefa[] = [
  { titulo: "Confirmar o hotel e mandar a lista de quartos", data: "05 dez · Campinas", prazo: "15 dias antes · 20 nov", responsavel: "Produção · Marina", situacao: "atrasada", grupo: "Atrasadas" },
  { titulo: "Pedir a autorização do juizado (menor em cena)", data: "06 dez · Sorocaba", prazo: "20 dias antes · 16 nov", responsavel: "Produção · Marina", situacao: "atrasada", grupo: "Atrasadas" },
  { titulo: "Mandar o rider técnico à casa", data: "12 dez · Ribeirão Preto", prazo: "30 dias antes · 12 nov", responsavel: "Direção técnica · Rafael", situacao: "aberta", grupo: "Esta semana" },
  { titulo: "Conferir o mapa de palco com a ficha da sala", data: "12 dez · Ribeirão Preto", prazo: "21 dias antes · 21 nov", responsavel: "Direção técnica · Rafael", situacao: "aberta", grupo: "Esta semana" },
  { titulo: "Enviar a arte para a divulgação da casa", data: "13 dez · São Carlos", prazo: "21 dias antes · 22 nov", responsavel: "Comunicação · Helena", situacao: "aberta", grupo: "Esta semana" },
  { titulo: "Mandar a folha do dia para a equipe", data: "05 dez · Campinas", prazo: "2 dias antes · 03 dez", responsavel: "Produção · Marina", situacao: "aberta", grupo: "Depois" },
  { titulo: "Separar o borderô assinado", data: "05 dez · Campinas", prazo: "1 dia depois · 06 dez", responsavel: "Produção · Marina", situacao: "aberta", grupo: "Depois" },
  { titulo: "Prestar contas da diária da equipe", data: "05 dez · Campinas", prazo: "7 dias depois · 12 dez", responsavel: "Financeiro · André", situacao: "aberta", grupo: "Depois" },
  { titulo: "Mandar o rider técnico à casa", data: "05 dez · Campinas", prazo: "30 dias antes · 05 nov", responsavel: "Direção técnica · Rafael", situacao: "feita", grupo: "Feitas" },
  { titulo: "Assinar o contrato com a Secretaria de Cultura", data: "05 dez · Campinas", prazo: "45 dias antes · 21 out", responsavel: "Produção · Marina", situacao: "feita", grupo: "Feitas" },
];

export const ARQUIVOS = [
  { nome: "Rider técnico — Mar de Dentro.pdf", pasta: "Documentos", tamanho: "1,2 MB", quando: "12 out" },
  { nome: "Mapa de palco — versão sala média.pdf", pasta: "Plantas", tamanho: "640 KB", quando: "28 out" },
  { nome: "Contrato assinado — Secretaria de Cultura.pdf", pasta: "Acordos", tamanho: "380 KB", quando: "29 out" },
  { nome: "voucher-hotel-central.pdf", pasta: "Hospedagem", tamanho: "96 KB", quando: "02 nov" },
  { nome: "Ficha técnica do Teatro da Cidade.pdf", pasta: "Recebidos", tamanho: "2,4 MB", quando: "03 nov" },
];

export const NOTAS = [
  { autor: "Rafael Nunes", quando: "ontem, 18:40", texto: "A casa tem 24 canais de dimmer, não 36. Vou adaptar o mapa de luz para a sala média. @Marina, pode avisar a direção?" },
  { autor: "Marina Duarte", quando: "ontem, 19:05", texto: "Avisado. A carga entra pela Rua dos Ipês, portão 2: o técnico da casa espera às 09:00." },
  { autor: "Joana Prado", quando: "hoje, 09:12", texto: "Levo dois microfones sem fio extras: o teatro só tem dois funcionando." },
];

export const HISTORICO = [
  { quem: "Marina Duarte", quando: "hoje, 10:20", o_que: "mudou a passagem de som de 17:00 para 17:30" },
  { quem: "Rafael Nunes", quando: "ontem, 18:42", o_que: "anexou Mapa de palco — versão sala média.pdf" },
  { quem: "Marina Duarte", quando: "02 nov, 11:03", o_que: "escalou Tiago Lemos como contrarregra" },
  { quem: "Marina Duarte", quando: "29 out, 16:47", o_que: "mudou a situação de opção para confirmada" },
  { quem: "André Costa", quando: "29 out, 16:40", o_que: "ligou o acordo com a Secretaria Municipal de Cultura" },
];

export const FOLHA = {
  enviadaPara: 9,
  abriram: 6,
  confirmaram: 4,
  pessoa: { nome: "Rafael Nunes", funcao: "Luz", horario: "chamada 12:00 · saída 01:00 (+1)", quarto: "Quarto 304, com Tiago Lemos" },
  agora: { titulo: "Montagem", ate: "até 17:00" },
  proximo: { titulo: "Passagem de som", as: "17:30" },
  contatos: [
    { papel: "Produção", nome: "Marina Duarte", telefone: "(11) 90000-0102" },
    { papel: "Técnico da casa", nome: "Paulo Mendes", telefone: "(19) 90000-0103" },
  ],
  avisos: ["Carga pela Rua dos Ipês, portão 2.", "Jantar no camarim, às 19:00, por conta da casa."],
  salvaAs: "14:32",
};

export type SituacaoDaPauta = "Confirmada" | "Pré-reserva 1ª" | "Pré-reserva 2ª" | "Consulta";
export type Pauta = { sala: string; dia: number; titulo: string; quem: string; horario: string; situacao: SituacaoDaPauta; aviso?: string };
export const ESPACO = {
  nome: "Teatro da Cidade",
  semana: "30 nov a 06 dez",
  dias: ["seg 30", "ter 01", "qua 02", "qui 03", "sex 04", "sáb 05", "dom 06"],
  salas: [
    { nome: "Sala principal", lugares: 480 },
    { nome: "Sala experimental", lugares: 90 },
    { nome: "Foyer", lugares: 120 },
  ],
};
export const PAUTAS: Pauta[] = [
  { sala: "Sala principal", dia: 0, titulo: "Manutenção da vara de luz", quem: "Equipe da casa", horario: "09:00–17:00", situacao: "Confirmada" },
  { sala: "Sala principal", dia: 2, titulo: "Orquestra Jovem", quem: "Escola de Música", horario: "20:00", situacao: "Confirmada" },
  { sala: "Sala principal", dia: 3, titulo: "Formatura do Colégio Horizonte", quem: "Colégio Horizonte", horario: "19:00", situacao: "Pré-reserva 1ª", aviso: "vence em 2 dias" },
  { sala: "Sala principal", dia: 3, titulo: "Show de lançamento", quem: "Selo Bairro Alto", horario: "21:00", situacao: "Pré-reserva 2ª" },
  { sala: "Sala principal", dia: 5, titulo: "Mar de Dentro", quem: "Companhia Mar Aberto", horario: "21:00", situacao: "Confirmada" },
  { sala: "Sala principal", dia: 6, titulo: "Mar de Dentro (matinê)", quem: "Companhia Mar Aberto", horario: "16:00", situacao: "Consulta" },
  { sala: "Sala experimental", dia: 1, titulo: "Oficina de iluminação", quem: "Núcleo de Formação", horario: "14:00–18:00", situacao: "Confirmada" },
  { sala: "Sala experimental", dia: 3, titulo: "Leitura dramática", quem: "Grupo Galpão Novo", horario: "20:00", situacao: "Confirmada", aviso: "duas confirmações na mesma sala" },
  { sala: "Sala experimental", dia: 3, titulo: "Ensaio aberto", quem: "Cia. Passo Largo", horario: "19:30", situacao: "Confirmada", aviso: "duas confirmações na mesma sala" },
  { sala: "Sala experimental", dia: 4, titulo: "Stand-up", quem: "Produtora Riso Solto", horario: "21:00", situacao: "Consulta" },
  { sala: "Foyer", dia: 5, titulo: "Exposição de fotos da turnê", quem: "Companhia Mar Aberto", horario: "18:00–23:00", situacao: "Pré-reserva 1ª" },
];

export type SituacaoDoAcordo = "Rascunho" | "Em revisão" | "Para assinatura" | "Assinado" | "Encerrado";
export const ETAPAS_DO_ACORDO: SituacaoDoAcordo[] = ["Rascunho", "Em revisão", "Para assinatura", "Assinado", "Encerrado"];
export type Acordo = {
  id: string; contraparte: string; tipo: string; datas: string; resumo: string; situacao: SituacaoDoAcordo;
  garantia: number; percentual: string; bonus: string; despesas: { item: string; quem: string }[]; retencoes: string;
  signatarios: { nome: string; papel: string; estado: string }[]; arquivo: string | null;
};
export const ACORDOS: Acordo[] = [
  {
    id: "campinas", contraparte: "Secretaria Municipal de Cultura de Campinas", tipo: "Venda de espetáculo", datas: "05 dez · Campinas",
    resumo: "Garantia ou 70% da bilheteria", situacao: "Assinado", garantia: 18000, percentual: "70% da bilheteria líquida, o que for maior que a garantia",
    bonus: "R$ 2.000 acima de 400 pagantes",
    despesas: [
      { item: "Hospedagem", quem: "Contratante" }, { item: "Alimentação (até 12 pessoas)", quem: "Contratante" },
      { item: "Transporte", quem: "Companhia" }, { item: "Som e luz da casa", quem: "Contratante" }, { item: "ECAD e direitos", quem: "Companhia" },
    ],
    retencoes: "ISS 5% retido na fonte",
    signatarios: [
      { nome: "Marina Duarte", papel: "Companhia", estado: "Assinou em 28 out" },
      { nome: "Secretário de Cultura", papel: "Contratante", estado: "Assinou em 29 out" },
    ],
    arquivo: "Contrato assinado — Secretaria de Cultura.pdf",
  },
  {
    id: "sorocaba", contraparte: "Teatro Municipal de Sorocaba", tipo: "Coprodução com a casa", datas: "06 dez · Sorocaba",
    resumo: "60% da bilheteria para a companhia", situacao: "Para assinatura", garantia: 0, percentual: "60% da bilheteria líquida para a companhia, 40% para a casa",
    bonus: "Sem bônus",
    despesas: [{ item: "Hospedagem", quem: "Companhia" }, { item: "Divulgação", quem: "Casa" }, { item: "Transporte", quem: "Companhia" }],
    retencoes: "ISS 2%",
    signatarios: [
      { nome: "Marina Duarte", papel: "Companhia", estado: "Assinou em 03 nov" },
      { nome: "Diretora do teatro", papel: "Casa", estado: "Aguardando" },
    ],
    arquivo: "Minuta — Teatro Municipal de Sorocaba.pdf",
  },
  {
    id: "ribeirao", contraparte: "Festival de Artes Cênicas de Ribeirão Preto", tipo: "Cachê fixo de festival", datas: "12 e 13 dez · Ribeirão Preto",
    resumo: "Cachê fixo por duas sessões", situacao: "Em revisão", garantia: 32000, percentual: "Sem percentual",
    bonus: "Sem bônus",
    despesas: [{ item: "Hospedagem", quem: "Festival" }, { item: "Alimentação", quem: "Festival" }, { item: "Transporte", quem: "Festival" }],
    retencoes: "ISS 5% e INSS sobre cachês de pessoa física",
    signatarios: [],
    arquivo: null,
  },
  {
    id: "saocarlos", contraparte: "Centro Cultural de São Carlos", tipo: "Venda de espetáculo", datas: "14 dez · São Carlos",
    resumo: "Garantia de R$ 9.000", situacao: "Rascunho", garantia: 9000, percentual: "Sem percentual",
    bonus: "Sem bônus", despesas: [{ item: "Hospedagem", quem: "A definir" }], retencoes: "A definir", signatarios: [], arquivo: null,
  },
];

export type LinhaDoOrcamento = { categoria: string; orcado: number; comprometido: number; realizado: number; porPraca: boolean };
export const ORCAMENTO: LinhaDoOrcamento[] = [
  { categoria: "Cachês da equipe", orcado: 84000, comprometido: 78000, realizado: 39000, porPraca: true },
  { categoria: "Hospedagem", orcado: 21600, comprometido: 14400, realizado: 7200, porPraca: true },
  { categoria: "Alimentação e diárias", orcado: 16200, comprometido: 10800, realizado: 6100, porPraca: true },
  { categoria: "Transporte e van", orcado: 12600, comprometido: 12600, realizado: 4200, porPraca: true },
  { categoria: "Combustível", orcado: 5400, comprometido: 0, realizado: 2650, porPraca: true },
  { categoria: "Frete da cenografia", orcado: 9000, comprometido: 9800, realizado: 4900, porPraca: true },
  { categoria: "Som e luz locados", orcado: 7200, comprometido: 3600, realizado: 0, porPraca: true },
  { categoria: "Cenografia e figurino", orcado: 18000, comprometido: 18000, realizado: 18000, porPraca: false },
  { categoria: "Divulgação", orcado: 8000, comprometido: 5200, realizado: 3100, porPraca: false },
  { categoria: "Direitos (SBAT e ECAD)", orcado: 4800, comprometido: 2400, realizado: 1200, porPraca: true },
  { categoria: "Seguro", orcado: 2400, comprometido: 2400, realizado: 2400, porPraca: false },
];
/** O que os acordos já garantem receber, nas seis praças. */
export const A_RECEBER = 59000;
