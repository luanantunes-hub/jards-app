// Tipos de produção e o vocabulário de cada um (plano do módulo de produção, PD0.12).
//
// O motor é um só: obra → temporada → data → dia. O tipo muda os nomes na
// tela, os formatos de temporada que fazem sentido, os modelos de dia (blocos
// sugeridos) e os painéis sugeridos. Nenhuma tela escreve "Show" ou
// "Espetáculo" fixo: lê daqui. Mudar o tipo muda os nomes, nunca os dados.

export type TipoProducao =
  | "show"
  | "teatro"
  | "danca"
  | "circo"
  | "concerto"
  | "rua"
  | "exposicao"
  | "festival"
  | "literatura"
  | "audiovisual"
  | "formacao"
  | "educativo"
  | "outro";

export type FormatoTemporada =
  | "turne"
  | "circulacao"
  | "temporada"
  | "edicao"
  | "programacao"
  | "itinerancia"
  | "filmagem"
  | "turma"
  | "ciclo"
  | "unica";

export type TipoBloco =
  | "chegada"
  | "carga"
  | "montagem"
  | "ensaio"
  | "passagem_som"
  | "abertura_casa"
  | "sessao"
  | "intervalo"
  | "desmontagem"
  | "deslocamento"
  | "refeicao"
  | "imprensa"
  | "aula"
  | "visitacao"
  | "filmagem"
  | "outro";

export type PainelId =
  | "dia"
  | "equipe"
  | "viagem"
  | "hospedagem"
  | "acerto"
  | "palco"
  | "convidados"
  | "visitacao"
  | "obras"
  | "dinheiro"
  | "bordero";

/** Um nome com plural e gênero ("Nova data", "Novo show"). */
export type Termo = { singular: string; plural: string; genero: "m" | "f" };

export type Vocabulario = {
  /** O que se produz: o espetáculo, o show, a exposição, o curso. */
  obra: Termo;
  /** A sequência de datas: turnê, temporada, edição, turma. */
  temporada: Termo;
  /** A data num lugar: apresentação, diária, aula. */
  data: Termo;
  /** O dia em blocos: dia de show, ordem do dia. */
  dia: Termo;
  /** O bloco principal do dia: sessão, show, aula, visitação. */
  sessao: Termo;
};

export type BlocoModelo = { tipo: TipoBloco; titulo: string; duracaoMin: number };

/** Blocos em ordem; os horários saem de um início escolhido na hora de aplicar. */
export type ModeloDia = { id: string; nome: string; blocos: readonly BlocoModelo[] };

export type TipoNoCatalogo = {
  id: TipoProducao;
  rotulo: string;
  vocabulario: Vocabulario;
  /** O primeiro é o padrão ao criar a temporada. */
  formatos: readonly FormatoTemporada[];
  modelosDia: readonly ModeloDia[];
  paineis: readonly PainelId[];
};

function termo(singular: string, plural: string, genero: "m" | "f"): Termo {
  return { singular, plural, genero };
}

const DIA = termo("Dia", "Dias", "m");
const SESSAO = termo("Sessão", "Sessões", "f");
const APRESENTACAO = termo("Apresentação", "Apresentações", "f");
const ESPETACULO = termo("Espetáculo", "Espetáculos", "m");
const TEMPORADA = termo("Temporada", "Temporadas", "f");

const PAINEIS_DE_PALCO: readonly PainelId[] = ["dia", "equipe", "viagem", "hospedagem", "acerto", "palco", "convidados", "dinheiro", "bordero"];

export const TIPOS_DE_PRODUCAO: readonly TipoNoCatalogo[] = [
  {
    id: "show",
    rotulo: "Show",
    vocabulario: { obra: termo("Show", "Shows", "m"), temporada: termo("Turnê", "Turnês", "f"), data: termo("Data", "Datas", "f"), dia: termo("Dia de show", "Dias de show", "m"), sessao: termo("Show", "Shows", "m") },
    formatos: ["turne", "unica", "temporada"],
    modelosDia: [{
      id: "show-padrao", nome: "Dia de show",
      blocos: [
        { tipo: "chegada", titulo: "Chegada da equipe técnica", duracaoMin: 30 },
        { tipo: "montagem", titulo: "Montagem de som e luz", duracaoMin: 180 },
        { tipo: "passagem_som", titulo: "Passagem de som", duracaoMin: 90 },
        { tipo: "refeicao", titulo: "Jantar", duracaoMin: 60 },
        { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 60 },
        { tipo: "sessao", titulo: "Show", duracaoMin: 90 },
        { tipo: "desmontagem", titulo: "Desmontagem e carga", duracaoMin: 120 },
      ],
    }],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "teatro",
    rotulo: "Teatro",
    vocabulario: { obra: ESPETACULO, temporada: TEMPORADA, data: APRESENTACAO, dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "circulacao", "unica"],
    modelosDia: [
      {
        id: "teatro-estreia", nome: "Montagem e estreia",
        blocos: [
          { tipo: "carga", titulo: "Descarga do cenário", duracaoMin: 60 },
          { tipo: "montagem", titulo: "Montagem de cenário", duracaoMin: 240 },
          { tipo: "montagem", titulo: "Montagem e afinação de luz", duracaoMin: 180 },
          { tipo: "ensaio", titulo: "Ensaio geral", duracaoMin: 120 },
          { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Sessão", duracaoMin: 90 },
        ],
      },
      {
        id: "teatro-sessao", nome: "Dia de sessão",
        blocos: [
          { tipo: "chegada", titulo: "Chegada do elenco", duracaoMin: 60 },
          { tipo: "ensaio", titulo: "Aquecimento", duracaoMin: 45 },
          { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Sessão", duracaoMin: 90 },
        ],
      },
    ],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "danca",
    rotulo: "Dança",
    vocabulario: { obra: ESPETACULO, temporada: TEMPORADA, data: APRESENTACAO, dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "circulacao", "unica"],
    modelosDia: [{
      id: "danca-padrao", nome: "Dia de apresentação",
      blocos: [
        { tipo: "montagem", titulo: "Montagem de linóleo e luz", duracaoMin: 180 },
        { tipo: "ensaio", titulo: "Aula e aquecimento", duracaoMin: 60 },
        { tipo: "ensaio", titulo: "Ensaio de marcação", duracaoMin: 60 },
        { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 30 },
        { tipo: "sessao", titulo: "Sessão", duracaoMin: 60 },
      ],
    }],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "circo",
    rotulo: "Circo",
    vocabulario: { obra: ESPETACULO, temporada: TEMPORADA, data: APRESENTACAO, dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "circulacao", "unica"],
    modelosDia: [
      {
        id: "circo-lona", nome: "Montagem da lona",
        blocos: [
          { tipo: "carga", titulo: "Chegada e descarga da lona", duracaoMin: 120 },
          { tipo: "montagem", titulo: "Montagem da lona e da arquibancada", duracaoMin: 480 },
          { tipo: "montagem", titulo: "Montagem de aparelhos e rigging", duracaoMin: 240 },
        ],
      },
      {
        id: "circo-sessao", nome: "Dia de sessão",
        blocos: [
          { tipo: "ensaio", titulo: "Checagem dos aparelhos", duracaoMin: 60 },
          { tipo: "ensaio", titulo: "Aquecimento", duracaoMin: 60 },
          { tipo: "abertura_casa", titulo: "Abertura da lona", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Sessão", duracaoMin: 90 },
        ],
      },
    ],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "concerto",
    rotulo: "Concerto e ópera",
    vocabulario: { obra: termo("Programa", "Programas", "m"), temporada: TEMPORADA, data: termo("Concerto", "Concertos", "m"), dia: DIA, sessao: termo("Concerto", "Concertos", "m") },
    formatos: ["temporada", "turne", "unica"],
    modelosDia: [{
      id: "concerto-padrao", nome: "Dia de concerto",
      blocos: [
        { tipo: "montagem", titulo: "Montagem do palco e das estantes", duracaoMin: 120 },
        { tipo: "ensaio", titulo: "Ensaio geral", duracaoMin: 150 },
        { tipo: "intervalo", titulo: "Intervalo da orquestra", duracaoMin: 90 },
        { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 30 },
        { tipo: "sessao", titulo: "Concerto", duracaoMin: 120 },
      ],
    }],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "rua",
    rotulo: "Rua e cultura popular",
    vocabulario: { obra: ESPETACULO, temporada: termo("Circulação", "Circulações", "f"), data: APRESENTACAO, dia: DIA, sessao: APRESENTACAO },
    formatos: ["circulacao", "unica"],
    modelosDia: [{
      id: "rua-padrao", nome: "Dia de apresentação",
      blocos: [
        { tipo: "chegada", titulo: "Chegada ao local", duracaoMin: 30 },
        { tipo: "montagem", titulo: "Montagem do espaço", duracaoMin: 60 },
        { tipo: "sessao", titulo: "Cortejo ou apresentação", duracaoMin: 90 },
        { tipo: "desmontagem", titulo: "Desmontagem", duracaoMin: 45 },
      ],
    }],
    paineis: ["dia", "equipe", "viagem", "hospedagem", "dinheiro"],
  },
  {
    id: "exposicao",
    rotulo: "Exposição",
    vocabulario: { obra: termo("Exposição", "Exposições", "f"), temporada: termo("Itinerância", "Itinerâncias", "f"), data: termo("Período", "Períodos", "m"), dia: termo("Dia de visitação", "Dias de visitação", "m"), sessao: termo("Visitação", "Visitações", "f") },
    formatos: ["itinerancia", "unica"],
    modelosDia: [
      {
        id: "exposicao-montagem", nome: "Montagem",
        blocos: [
          { tipo: "carga", titulo: "Chegada das obras e conferência", duracaoMin: 120 },
          { tipo: "montagem", titulo: "Montagem expográfica", duracaoMin: 360 },
          { tipo: "montagem", titulo: "Iluminação", duracaoMin: 120 },
        ],
      },
      {
        id: "exposicao-abertura", nome: "Abertura",
        blocos: [
          { tipo: "imprensa", titulo: "Visita para a imprensa", duracaoMin: 60 },
          { tipo: "sessao", titulo: "Abertura", duracaoMin: 180 },
        ],
      },
      {
        id: "exposicao-visitacao", nome: "Dia de visitação",
        blocos: [
          { tipo: "abertura_casa", titulo: "Abertura das portas", duracaoMin: 15 },
          { tipo: "visitacao", titulo: "Visitação", duracaoMin: 420 },
          { tipo: "visitacao", titulo: "Visita mediada", duracaoMin: 60 },
        ],
      },
    ],
    paineis: ["dia", "equipe", "viagem", "acerto", "obras", "visitacao", "dinheiro"],
  },
  {
    id: "festival",
    rotulo: "Festival",
    vocabulario: { obra: termo("Atração", "Atrações", "f"), temporada: termo("Edição", "Edições", "f"), data: APRESENTACAO, dia: termo("Dia de festival", "Dias de festival", "m"), sessao: SESSAO },
    formatos: ["edicao"],
    modelosDia: [{
      id: "festival-palco", nome: "Dia de palco",
      blocos: [
        { tipo: "montagem", titulo: "Troca de palco", duracaoMin: 45 },
        { tipo: "passagem_som", titulo: "Line check", duracaoMin: 30 },
        { tipo: "sessao", titulo: "Apresentação", duracaoMin: 60 },
        { tipo: "desmontagem", titulo: "Saída de palco", duracaoMin: 30 },
      ],
    }],
    paineis: ["dia", "equipe", "viagem", "hospedagem", "acerto", "palco", "convidados", "dinheiro", "bordero"],
  },
  {
    id: "literatura",
    rotulo: "Literatura e feiras",
    vocabulario: { obra: termo("Evento", "Eventos", "m"), temporada: termo("Edição", "Edições", "f"), data: termo("Data", "Datas", "f"), dia: DIA, sessao: termo("Mesa", "Mesas", "f") },
    formatos: ["edicao", "unica", "circulacao"],
    modelosDia: [{
      id: "literatura-padrao", nome: "Dia de programação",
      blocos: [
        { tipo: "montagem", titulo: "Montagem dos estandes e do auditório", duracaoMin: 180 },
        { tipo: "sessao", titulo: "Mesa", duracaoMin: 60 },
        { tipo: "sessao", titulo: "Sessão de autógrafos", duracaoMin: 60 },
      ],
    }],
    paineis: ["dia", "equipe", "viagem", "hospedagem", "convidados", "dinheiro"],
  },
  {
    id: "audiovisual",
    rotulo: "Audiovisual",
    vocabulario: { obra: termo("Filme", "Filmes", "m"), temporada: termo("Filmagem", "Filmagens", "f"), data: termo("Diária", "Diárias", "f"), dia: termo("Ordem do dia", "Ordens do dia", "f"), sessao: termo("Exibição", "Exibições", "f") },
    formatos: ["filmagem", "circulacao", "unica"],
    modelosDia: [{
      id: "audiovisual-diaria", nome: "Diária de filmagem",
      blocos: [
        { tipo: "chegada", titulo: "Chamada da equipe", duracaoMin: 30 },
        { tipo: "montagem", titulo: "Montagem do set", duracaoMin: 90 },
        { tipo: "filmagem", titulo: "Filmagem", duracaoMin: 240 },
        { tipo: "refeicao", titulo: "Almoço", duracaoMin: 60 },
        { tipo: "filmagem", titulo: "Filmagem", duracaoMin: 240 },
        { tipo: "desmontagem", titulo: "Desprodução", duracaoMin: 60 },
      ],
    }],
    paineis: ["dia", "equipe", "viagem", "hospedagem", "dinheiro"],
  },
  {
    id: "formacao",
    rotulo: "Formação",
    vocabulario: { obra: termo("Curso", "Cursos", "m"), temporada: termo("Turma", "Turmas", "f"), data: termo("Aula", "Aulas", "f"), dia: termo("Dia de aula", "Dias de aula", "m"), sessao: termo("Aula", "Aulas", "f") },
    formatos: ["turma", "ciclo"],
    modelosDia: [{
      id: "formacao-aula", nome: "Dia de aula",
      blocos: [
        { tipo: "montagem", titulo: "Preparação da sala", duracaoMin: 30 },
        { tipo: "aula", titulo: "Aula", duracaoMin: 120 },
      ],
    }],
    paineis: ["dia", "equipe", "dinheiro"],
  },
  {
    id: "educativo",
    rotulo: "Educativo",
    vocabulario: { obra: termo("Ação educativa", "Ações educativas", "f"), temporada: termo("Ciclo", "Ciclos", "m"), data: termo("Encontro", "Encontros", "m"), dia: DIA, sessao: termo("Visita", "Visitas", "f") },
    formatos: ["ciclo", "programacao"],
    modelosDia: [{
      id: "educativo-visita", nome: "Dia de visitas mediadas",
      blocos: [
        { tipo: "visitacao", titulo: "Visita mediada", duracaoMin: 60 },
        { tipo: "aula", titulo: "Oficina", duracaoMin: 90 },
      ],
    }],
    paineis: ["dia", "equipe", "visitacao", "dinheiro"],
  },
  {
    id: "outro",
    rotulo: "Outro",
    vocabulario: { obra: termo("Obra", "Obras", "f"), temporada: TEMPORADA, data: termo("Data", "Datas", "f"), dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "unica", "programacao"],
    modelosDia: [{
      id: "outro-padrao", nome: "Dia",
      blocos: [
        { tipo: "montagem", titulo: "Montagem", duracaoMin: 120 },
        { tipo: "sessao", titulo: "Sessão", duracaoMin: 90 },
        { tipo: "desmontagem", titulo: "Desmontagem", duracaoMin: 60 },
      ],
    }],
    paineis: ["dia", "equipe", "dinheiro"],
  },
];

export const ROTULO_DO_FORMATO: Record<FormatoTemporada, string> = {
  turne: "Turnê",
  circulacao: "Circulação",
  temporada: "Temporada fixa",
  edicao: "Edição de festival",
  programacao: "Programação",
  itinerancia: "Itinerância",
  filmagem: "Filmagem",
  turma: "Turma",
  ciclo: "Ciclo",
  unica: "Data única",
};

export function tipoDeProducao(id: TipoProducao): TipoNoCatalogo {
  return TIPOS_DE_PRODUCAO.find(tipo => tipo.id === id) ?? TIPOS_DE_PRODUCAO[TIPOS_DE_PRODUCAO.length - 1];
}

export function vocabularioDe(id: TipoProducao): Vocabulario {
  return tipoDeProducao(id).vocabulario;
}

/** "Nova data", "Novo show", "Nova turnê". */
export function rotuloNovo(t: Termo): string {
  return `${t.genero === "f" ? "Nova" : "Novo"} ${t.singular.toLowerCase()}`;
}

/** Duração total de um modelo de dia, em minutos. */
export function duracaoDoModelo(modelo: ModeloDia): number {
  return modelo.blocos.reduce((total, bloco) => total + bloco.duracaoMin, 0);
}
