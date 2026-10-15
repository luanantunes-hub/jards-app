// Tipos de produção e o vocabulário de cada um (plano do módulo de produção, PD0.12).
//
// O motor é um só: obra → temporada → data → dia. O tipo muda os nomes na
// tela, os formatos de temporada que fazem sentido, os modelos de dia (blocos
// sugeridos) e os painéis próprios dele. O nome da temporada vem do formato
// (turnê, circulação, itinerância), e alguns tipos trocam nomes conforme o
// formato (o filme em exibição tem sessões, não diárias). Nenhuma tela escreve
// "Show" ou "Espetáculo" fixo: lê daqui. Mudar o tipo muda os nomes, nunca os dados.

export type TipoProducao =
  | "show"
  | "teatro"
  | "danca"
  | "circo"
  | "concerto"
  | "opera"
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

/** O tipo da data, como em `producao_datas.tipo` (PD0.8). */
export type TipoData = "apresentacao" | "viagem" | "folga" | "ensaio" | "montagem" | "filmagem" | "aula" | "visitacao" | "outro";

export type TipoBloco =
  | "chegada"
  | "carga"
  | "montagem"
  | "ensaio"
  | "preparo"
  | "passagem_som"
  | "abertura_casa"
  | "sessao"
  | "intervalo"
  | "desmontagem"
  | "deslocamento"
  | "hospedagem"
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
  | "obras"
  | "visitacao"
  | "convidados"
  | "publico"
  | "dinheiro"
  | "bordero";

/** Um nome com plural e gênero ("Nova data", "Novo show"). */
export type Termo = { singular: string; plural: string; genero: "m" | "f" };

export type Vocabulario = {
  /** O que se produz: o espetáculo, o show, a exposição, o curso. */
  obra: Termo;
  /** A sequência de datas: turnê, temporada, edição, turma (vem do formato). */
  temporada: Termo;
  /** A data num lugar: apresentação, praça, diária, encontro. */
  data: Termo;
  /** O dia em blocos. */
  dia: Termo;
  /** O bloco principal do dia: sessão, mesa, aula, visitação. */
  sessao: Termo;
};

export type BlocoModelo = { tipo: TipoBloco; titulo: string; duracaoMin: number };

/**
 * Blocos em ordem; os horários saem de um início escolhido na hora de aplicar.
 * O dia de folga não tem blocos.
 */
export type ModeloDia = { id: string; nome: string; tipoData: TipoData; blocos: readonly BlocoModelo[] };

export type TipoNoCatalogo = {
  id: TipoProducao;
  rotulo: string;
  /** Nomes do tipo; a temporada vem do formato. */
  nomes: Omit<Vocabulario, "temporada">;
  /** O primeiro é o padrão ao criar a temporada. */
  formatos: readonly FormatoTemporada[];
  /** Nomes que mudam com o formato. */
  porFormato?: Partial<Record<FormatoTemporada, Partial<Vocabulario>>>;
  modelosDia: readonly ModeloDia[];
  /** Painéis próprios do tipo; os gerais (viagem, convidados, acerto, dinheiro) vêm dos sinais da data. */
  paineis: readonly PainelId[];
  /** Rótulos de painel que mudam no tipo. */
  rotulosDePainel?: Partial<Record<PainelId, string>>;
};

function termo(singular: string, plural: string, genero: "m" | "f"): Termo {
  return { singular, plural, genero };
}

const DIA = termo("Dia", "Dias", "m");
const SESSAO = termo("Sessão", "Sessões", "f");
const APRESENTACAO = termo("Apresentação", "Apresentações", "f");
const ESPETACULO = termo("Espetáculo", "Espetáculos", "m");
const DATA = termo("Data", "Datas", "f");
const ENCONTRO = termo("Encontro", "Encontros", "m");

export const ROTULO_DO_FORMATO: Record<FormatoTemporada, string> = {
  turne: "Turnê",
  circulacao: "Circulação",
  temporada: "Temporada fixa",
  edicao: "Edição",
  programacao: "Programação",
  itinerancia: "Itinerância",
  filmagem: "Filmagem",
  turma: "Turma",
  ciclo: "Ciclo",
  unica: "Um só lugar",
};

/** Nome da temporada em cada formato. */
const TERMO_DO_FORMATO: Record<FormatoTemporada, Termo> = {
  turne: termo("Turnê", "Turnês", "f"),
  circulacao: termo("Circulação", "Circulações", "f"),
  temporada: termo("Temporada", "Temporadas", "f"),
  edicao: termo("Edição", "Edições", "f"),
  programacao: termo("Programação", "Programações", "f"),
  itinerancia: termo("Itinerância", "Itinerâncias", "f"),
  filmagem: termo("Período de filmagem", "Períodos de filmagem", "m"),
  turma: termo("Turma", "Turmas", "f"),
  ciclo: termo("Ciclo", "Ciclos", "m"),
  unica: termo("Evento avulso", "Eventos avulsos", "m"),
};

export const ROTULO_DO_PAINEL: Record<PainelId, string> = {
  dia: "O dia",
  equipe: "Equipe",
  viagem: "Viagem",
  hospedagem: "Hospedagem",
  acerto: "Acerto técnico",
  palco: "Palco",
  obras: "Obras",
  visitacao: "Visitação",
  convidados: "Convidados",
  publico: "Público",
  dinheiro: "Dinheiro",
  bordero: "Borderô",
};

/** Formatos em que a equipe se desloca: o tipo ganha os dias de viagem e de folga. */
const FORMATOS_QUE_CIRCULAM: readonly FormatoTemporada[] = ["turne", "circulacao", "itinerancia"];

/** Dias que toda produção que circula tem, seja qual for o gênero. */
export const MODELOS_DE_ESTRADA: readonly ModeloDia[] = [
  {
    id: "estrada-viagem", nome: "Dia de viagem", tipoData: "viagem",
    blocos: [
      { tipo: "hospedagem", titulo: "Saída do hotel", duracaoMin: 30 },
      { tipo: "deslocamento", titulo: "Deslocamento", duracaoMin: 360 },
      { tipo: "chegada", titulo: "Chegada e entrada no hotel", duracaoMin: 60 },
    ],
  },
  { id: "estrada-folga", nome: "Folga", tipoData: "folga", blocos: [] },
];

const PAINEIS_DE_PALCO: readonly PainelId[] = ["palco", "publico", "bordero"];

export const TIPOS_DE_PRODUCAO: readonly TipoNoCatalogo[] = [
  {
    id: "show",
    rotulo: "Show",
    nomes: { obra: termo("Show", "Shows", "m"), data: DATA, dia: DIA, sessao: SESSAO },
    formatos: ["turne", "temporada", "unica"],
    modelosDia: [{
      id: "show-padrao", nome: "Dia de show", tipoData: "apresentacao",
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
    nomes: { obra: ESPETACULO, data: APRESENTACAO, dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "circulacao", "unica"],
    modelosDia: [
      {
        id: "teatro-estreia", nome: "Montagem e estreia", tipoData: "montagem",
        blocos: [
          { tipo: "carga", titulo: "Descarga do cenário", duracaoMin: 60 },
          { tipo: "montagem", titulo: "Montagem de cenário", duracaoMin: 240 },
          { tipo: "refeicao", titulo: "Almoço", duracaoMin: 60 },
          { tipo: "montagem", titulo: "Montagem e afinação de luz", duracaoMin: 180 },
          { tipo: "ensaio", titulo: "Ensaio geral", duracaoMin: 120 },
          { tipo: "refeicao", titulo: "Jantar", duracaoMin: 45 },
          { tipo: "preparo", titulo: "Maquiagem, figurino e preset do palco", duracaoMin: 60 },
          { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Sessão", duracaoMin: 90 },
        ],
      },
      {
        id: "teatro-sessao", nome: "Dia de sessão", tipoData: "apresentacao",
        blocos: [
          { tipo: "chegada", titulo: "Chegada do elenco", duracaoMin: 30 },
          { tipo: "ensaio", titulo: "Aquecimento", duracaoMin: 45 },
          { tipo: "preparo", titulo: "Maquiagem, figurino e preset do palco", duracaoMin: 45 },
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
    nomes: { obra: ESPETACULO, data: APRESENTACAO, dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "circulacao", "unica"],
    modelosDia: [{
      id: "danca-padrao", nome: "Dia de apresentação", tipoData: "apresentacao",
      blocos: [
        { tipo: "montagem", titulo: "Montagem de linóleo e luz", duracaoMin: 180 },
        { tipo: "refeicao", titulo: "Almoço", duracaoMin: 60 },
        { tipo: "ensaio", titulo: "Aula e aquecimento", duracaoMin: 60 },
        { tipo: "ensaio", titulo: "Ensaio de marcação", duracaoMin: 60 },
        { tipo: "preparo", titulo: "Maquiagem e figurino", duracaoMin: 45 },
        { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 30 },
        { tipo: "sessao", titulo: "Sessão", duracaoMin: 60 },
      ],
    }],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "circo",
    rotulo: "Circo",
    nomes: { obra: ESPETACULO, data: APRESENTACAO, dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "circulacao", "unica"],
    modelosDia: [
      {
        id: "circo-lona", nome: "Montagem da lona", tipoData: "montagem",
        blocos: [
          { tipo: "carga", titulo: "Chegada e descarga da lona", duracaoMin: 120 },
          { tipo: "montagem", titulo: "Montagem da lona e da arquibancada", duracaoMin: 300 },
          { tipo: "refeicao", titulo: "Almoço", duracaoMin: 60 },
          { tipo: "montagem", titulo: "Montagem de aparelhos e rigging", duracaoMin: 240 },
        ],
      },
      {
        id: "circo-sessao", nome: "Dia de sessão", tipoData: "apresentacao",
        blocos: [
          { tipo: "ensaio", titulo: "Checagem dos aparelhos", duracaoMin: 60 },
          { tipo: "ensaio", titulo: "Aquecimento", duracaoMin: 60 },
          { tipo: "preparo", titulo: "Maquiagem e figurino", duracaoMin: 45 },
          { tipo: "abertura_casa", titulo: "Abertura da lona", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Sessão", duracaoMin: 90 },
        ],
      },
    ],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "concerto",
    rotulo: "Concerto",
    nomes: { obra: termo("Programa", "Programas", "m"), data: termo("Concerto", "Concertos", "m"), dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "turne", "unica"],
    modelosDia: [{
      id: "concerto-padrao", nome: "Dia de concerto", tipoData: "apresentacao",
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
    id: "opera",
    rotulo: "Ópera",
    nomes: { obra: termo("Ópera", "Óperas", "f"), data: termo("Récita", "Récitas", "f"), dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "circulacao", "unica"],
    modelosDia: [
      {
        id: "opera-montagem", nome: "Montagem", tipoData: "montagem",
        blocos: [
          { tipo: "carga", titulo: "Descarga do cenário", duracaoMin: 90 },
          { tipo: "montagem", titulo: "Montagem de cenário", duracaoMin: 240 },
          { tipo: "refeicao", titulo: "Almoço", duracaoMin: 60 },
          { tipo: "montagem", titulo: "Afinação de luz", duracaoMin: 180 },
          { tipo: "ensaio", titulo: "Ensaio de palco com piano", duracaoMin: 180 },
        ],
      },
      {
        id: "opera-recita", nome: "Dia de récita", tipoData: "apresentacao",
        blocos: [
          { tipo: "chegada", titulo: "Chegada dos solistas e do coro", duracaoMin: 30 },
          { tipo: "preparo", titulo: "Maquiagem, perucas e figurino", duracaoMin: 90 },
          { tipo: "ensaio", titulo: "Aquecimento vocal", duracaoMin: 30 },
          { tipo: "abertura_casa", titulo: "Abertura da casa", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Récita", duracaoMin: 180 },
        ],
      },
    ],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "rua",
    rotulo: "Rua e cultura popular",
    nomes: { obra: ESPETACULO, data: termo("Praça", "Praças", "f"), dia: DIA, sessao: APRESENTACAO },
    formatos: ["circulacao", "ciclo", "temporada", "unica"],
    modelosDia: [{
      id: "rua-padrao", nome: "Dia de apresentação", tipoData: "apresentacao",
      blocos: [
        { tipo: "chegada", titulo: "Chegada ao local", duracaoMin: 30 },
        { tipo: "montagem", titulo: "Montagem do espaço", duracaoMin: 60 },
        { tipo: "preparo", titulo: "Concentração", duracaoMin: 45 },
        { tipo: "sessao", titulo: "Cortejo ou apresentação", duracaoMin: 90 },
        { tipo: "desmontagem", titulo: "Desmontagem", duracaoMin: 45 },
      ],
    }],
    paineis: ["publico"],
  },
  {
    id: "exposicao",
    rotulo: "Exposição",
    nomes: { obra: termo("Exposição", "Exposições", "f"), data: termo("Etapa", "Etapas", "f"), dia: DIA, sessao: termo("Visitação", "Visitações", "f") },
    formatos: ["unica", "itinerancia"],
    porFormato: { unica: { temporada: termo("Período expositivo", "Períodos expositivos", "m") } },
    modelosDia: [
      {
        id: "exposicao-montagem", nome: "Montagem", tipoData: "montagem",
        blocos: [
          { tipo: "carga", titulo: "Chegada das obras e conferência", duracaoMin: 120 },
          { tipo: "montagem", titulo: "Montagem expográfica", duracaoMin: 240 },
          { tipo: "refeicao", titulo: "Almoço", duracaoMin: 60 },
          { tipo: "montagem", titulo: "Montagem expográfica e iluminação", duracaoMin: 240 },
        ],
      },
      {
        id: "exposicao-abertura", nome: "Abertura", tipoData: "apresentacao",
        blocos: [
          { tipo: "imprensa", titulo: "Visita para a imprensa", duracaoMin: 60 },
          { tipo: "sessao", titulo: "Abertura", duracaoMin: 180 },
        ],
      },
      {
        id: "exposicao-visitacao", nome: "Dia de visitação", tipoData: "visitacao",
        blocos: [
          { tipo: "abertura_casa", titulo: "Abertura das portas", duracaoMin: 15 },
          { tipo: "visitacao", titulo: "Visitação", duracaoMin: 180 },
          { tipo: "visitacao", titulo: "Visita mediada", duracaoMin: 60 },
          { tipo: "visitacao", titulo: "Visitação", duracaoMin: 180 },
        ],
      },
    ],
    paineis: ["obras", "visitacao", "publico", "bordero"],
  },
  {
    id: "festival",
    rotulo: "Festival",
    nomes: { obra: termo("Atração", "Atrações", "f"), data: termo("Dia de festival", "Dias de festival", "m"), dia: termo("Roteiro do dia", "Roteiros do dia", "m"), sessao: APRESENTACAO },
    formatos: ["edicao"],
    modelosDia: [
      {
        id: "festival-dia", nome: "Dia de festival", tipoData: "apresentacao",
        blocos: [
          { tipo: "montagem", titulo: "Checagem de palco e estrutura", duracaoMin: 120 },
          { tipo: "refeicao", titulo: "Refeição da equipe", duracaoMin: 45 },
          { tipo: "abertura_casa", titulo: "Abertura dos portões", duracaoMin: 60 },
          { tipo: "sessao", titulo: "Apresentação", duracaoMin: 60 },
          { tipo: "montagem", titulo: "Troca de palco", duracaoMin: 45 },
          { tipo: "sessao", titulo: "Apresentação", duracaoMin: 75 },
          { tipo: "montagem", titulo: "Troca de palco", duracaoMin: 45 },
          { tipo: "sessao", titulo: "Apresentação", duracaoMin: 90 },
          { tipo: "desmontagem", titulo: "Encerramento e saída do público", duracaoMin: 60 },
        ],
      },
      {
        id: "festival-horario", nome: "Horário de palco de uma atração", tipoData: "apresentacao",
        blocos: [
          { tipo: "montagem", titulo: "Troca de palco", duracaoMin: 45 },
          { tipo: "passagem_som", titulo: "Line check", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Apresentação", duracaoMin: 60 },
          { tipo: "desmontagem", titulo: "Saída de palco", duracaoMin: 30 },
        ],
      },
    ],
    paineis: PAINEIS_DE_PALCO,
  },
  {
    id: "literatura",
    rotulo: "Literatura e feiras",
    nomes: { obra: termo("Evento literário", "Eventos literários", "m"), data: DATA, dia: DIA, sessao: termo("Mesa", "Mesas", "f") },
    formatos: ["edicao", "unica", "circulacao"],
    modelosDia: [{
      id: "literatura-padrao", nome: "Dia de programação", tipoData: "apresentacao",
      blocos: [
        { tipo: "montagem", titulo: "Montagem dos estandes e do auditório", duracaoMin: 180 },
        { tipo: "sessao", titulo: "Mesa", duracaoMin: 60 },
        { tipo: "sessao", titulo: "Sessão de autógrafos", duracaoMin: 60 },
      ],
    }],
    paineis: ["publico"],
    // Na literatura, "convidados" são os autores das mesas; o painel é o das cortesias.
    rotulosDePainel: { convidados: "Cortesias" },
  },
  {
    id: "audiovisual",
    rotulo: "Audiovisual",
    nomes: { obra: termo("Filme", "Filmes", "m"), data: termo("Diária", "Diárias", "f"), dia: termo("Ordem do dia", "Ordens do dia", "f"), sessao: termo("Filmagem", "Filmagens", "f") },
    formatos: ["filmagem", "circulacao", "unica"],
    // O filme pronto que circula tem exibições e sessões, não diárias.
    porFormato: {
      circulacao: { data: termo("Exibição", "Exibições", "f"), dia: DIA, sessao: SESSAO },
      unica: { data: termo("Exibição", "Exibições", "f"), dia: DIA, sessao: SESSAO },
    },
    modelosDia: [
      {
        id: "audiovisual-diaria", nome: "Diária de filmagem", tipoData: "filmagem",
        blocos: [
          { tipo: "chegada", titulo: "Chamada da equipe", duracaoMin: 30 },
          { tipo: "montagem", titulo: "Montagem do set", duracaoMin: 90 },
          { tipo: "filmagem", titulo: "Filmagem", duracaoMin: 240 },
          { tipo: "refeicao", titulo: "Almoço", duracaoMin: 60 },
          { tipo: "filmagem", titulo: "Filmagem", duracaoMin: 240 },
          { tipo: "desmontagem", titulo: "Desprodução", duracaoMin: 60 },
        ],
      },
      {
        id: "audiovisual-exibicao", nome: "Exibição", tipoData: "apresentacao",
        blocos: [
          { tipo: "montagem", titulo: "Teste de projeção e som", duracaoMin: 60 },
          { tipo: "abertura_casa", titulo: "Abertura da sala", duracaoMin: 30 },
          { tipo: "sessao", titulo: "Sessão", duracaoMin: 120 },
          { tipo: "sessao", titulo: "Debate", duracaoMin: 45 },
        ],
      },
    ],
    paineis: ["publico", "bordero"],
  },
  {
    id: "formacao",
    rotulo: "Formação",
    nomes: { obra: termo("Curso", "Cursos", "m"), data: ENCONTRO, dia: DIA, sessao: termo("Aula", "Aulas", "f") },
    formatos: ["turma", "ciclo", "circulacao"],
    modelosDia: [{
      id: "formacao-aula", nome: "Dia de aula", tipoData: "aula",
      blocos: [
        { tipo: "montagem", titulo: "Preparação da sala", duracaoMin: 30 },
        { tipo: "aula", titulo: "Aula", duracaoMin: 120 },
      ],
    }],
    paineis: ["publico"],
  },
  {
    id: "educativo",
    rotulo: "Educativo",
    nomes: { obra: termo("Ação educativa", "Ações educativas", "f"), data: ENCONTRO, dia: DIA, sessao: termo("Visita", "Visitas", "f") },
    formatos: ["ciclo", "programacao"],
    modelosDia: [{
      id: "educativo-visita", nome: "Dia de visitas mediadas", tipoData: "visitacao",
      blocos: [
        { tipo: "visitacao", titulo: "Visita mediada", duracaoMin: 60 },
        { tipo: "aula", titulo: "Oficina", duracaoMin: 90 },
      ],
    }],
    paineis: ["visitacao", "publico"],
  },
  {
    id: "outro",
    rotulo: "Outro",
    nomes: { obra: termo("Obra", "Obras", "f"), data: DATA, dia: DIA, sessao: SESSAO },
    formatos: ["temporada", "unica", "programacao", "circulacao"],
    modelosDia: [{
      id: "outro-padrao", nome: "Dia", tipoData: "apresentacao",
      blocos: [
        { tipo: "montagem", titulo: "Montagem", duracaoMin: 120 },
        { tipo: "sessao", titulo: "Sessão", duracaoMin: 90 },
        { tipo: "desmontagem", titulo: "Desmontagem", duracaoMin: 60 },
      ],
    }],
    paineis: ["publico"],
  },
];

export function tipoDeProducao(id: TipoProducao): TipoNoCatalogo {
  return TIPOS_DE_PRODUCAO.find(tipo => tipo.id === id) ?? TIPOS_DE_PRODUCAO[TIPOS_DE_PRODUCAO.length - 1];
}

/** Os nomes do tipo no formato da temporada (o padrão é o primeiro formato do tipo). */
export function vocabularioDe(id: TipoProducao, formato?: FormatoTemporada): Vocabulario {
  const tipo = tipoDeProducao(id);
  const doFormato = formato && tipo.formatos.includes(formato) ? formato : tipo.formatos[0];
  return { ...tipo.nomes, temporada: TERMO_DO_FORMATO[doFormato], ...tipo.porFormato?.[doFormato] };
}

/** Modelos de dia do tipo; quem circula ganha também o dia de viagem e a folga. */
export function modelosDeDia(id: TipoProducao): ModeloDia[] {
  const tipo = tipoDeProducao(id);
  const circula = tipo.formatos.some(formato => FORMATOS_QUE_CIRCULAM.includes(formato));
  return circula ? [...tipo.modelosDia, ...MODELOS_DE_ESTRADA] : [...tipo.modelosDia];
}

export function rotuloDoPainel(id: TipoProducao, painel: PainelId): string {
  return tipoDeProducao(id).rotulosDePainel?.[painel] ?? ROTULO_DO_PAINEL[painel];
}

/** "Nova data", "Novo show", "Nova turnê". */
export function rotuloNovo(t: Termo): string {
  return `${t.genero === "f" ? "Nova" : "Novo"} ${t.singular.toLowerCase()}`;
}

/** Duração total de um modelo de dia, em minutos. */
export function duracaoDoModelo(modelo: ModeloDia): number {
  return modelo.blocos.reduce((total, bloco) => total + bloco.duracaoMin, 0);
}
