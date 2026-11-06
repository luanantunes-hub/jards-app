// Saudação do topo do painel: muda com a hora, o dia da semana e as datas
// especiais, chama a pessoa pelo primeiro nome e às vezes fala da organização.
// A escolha entre as frases possíveis é fixa por pessoa, dia e período, para
// a frase não trocar a cada vez que a página recarrega.

export type Periodo = "madrugada" | "manha" | "tarde" | "noite";

export interface EntradaSaudacao {
  /** Nome completo ou primeiro nome; vazio quando a pessoa não informou. */
  nome?: string | null;
  /** Nome da organização atual. */
  organizacao?: string | null;
  /** Momento local da pessoa. */
  agora: Date;
  /** Algo estável da pessoa (o id), para variar a frase entre pessoas. */
  semente?: string | null;
}

// Sem "bom dia"/"boa tarde": a hora aparece no assunto da frase. "{, nome}"
// vira ", Ana" ou some quando não há nome; "{org}" só nas frases da organização.
const FRASES: Record<Periodo, string[]> = {
  madrugada: [
    "Madrugada de trabalho{, nome}? O Jards guarda tudo para amanhã.",
    "Ainda por aqui{, nome}? Lembre de descansar.",
  ],
  manha: [
    "Vamos ver o que avançou{, nome}?",
    "Café pronto{, nome}? As prioridades também.",
    "Que tal começar por um follow-up{, nome}?",
    "Por onde começamos hoje{, nome}?",
  ],
  tarde: [
    "Como estão as negociações{, nome}?",
    "Ainda dá tempo de um follow-up{, nome}.",
    "Metade do dia já foi{, nome}. Como está o pipeline?",
  ],
  noite: [
    "Fechando o dia{, nome}?",
    "O que ficou para amanhã fica guardado aqui{, nome}.",
    "Fim de expediente{, nome}? O pipeline espera por você amanhã.",
  ],
};

const FRASES_ORGANIZACAO = [
  "Tudo em ordem no time {org}{, nome}?",
  "Aqui está o resumo do time {org}{, nome}.",
];

// 0 = domingo … 6 = sábado.
function frasesDoDia(diaSemana: number, periodo: Periodo): string[] {
  if (diaSemana === 1 && periodo === "manha") {
    return ["Semana nova{, nome}. Por onde começamos?", "Segunda-feira{, nome}. Que tal começar pelas prioridades?"];
  }
  if (diaSemana === 5 && (periodo === "tarde" || periodo === "noite")) {
    return ["Sexta-feira{, nome}. Dá para deixar os follow-ups em dia antes do fim de semana.", "Última reta da semana{, nome}. Algum follow-up pendente?"];
  }
  if (diaSemana === 6 && periodo !== "madrugada") return ["Sábado de captação{, nome}?", "Até no sábado{, nome}? O pipeline agradece."];
  if (diaSemana === 0 && periodo !== "madrugada") return ["Domingo{, nome}? Só uma espiada no pipeline.", "Planejando a semana{, nome}?"];
  return [];
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function diasEntre(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

// Feriados nacionais de data fixa em que "Bom feriado" cabe (Finados fica de fora).
const FERIADOS_FIXOS = new Set(["4-21", "9-7", "10-12", "11-15", "11-20"]);

/** Frases de datas especiais; quando existem, substituem as do dia comum. */
export function frasesDaData(agora: Date): string[] {
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const dia = agora.getDate();
  const chave = `${mes}-${dia}`;

  if (chave === "1-1") return [`Feliz ${ano}{, nome}.`];
  if (mes === 1 && dia <= 7) return [`Bom começo de ${ano}{, nome}.`];
  if (chave === "12-24" || chave === "12-25") return ["Feliz Natal{, nome}."];
  if (chave === "12-31") return [`Que ${ano + 1} venha com muitos patrocínios{, nome}.`];
  if (mes === 12 && dia >= 26) return ["Boas festas{, nome}."];
  if (chave === "5-1") return ["Bom feriado{, nome}. Feliz Dia do Trabalho."];
  if (chave === "11-5") return ["Feliz Dia Nacional da Cultura{, nome}."];
  if (FERIADOS_FIXOS.has(chave)) return ["Bom feriado{, nome}."];

  // Carnaval: do sábado à terça antes da Quarta-feira de Cinzas (Páscoa − 46).
  const ateCinzas = diasEntre(agora, new Date(pascoa(ano).getTime() - 46 * 86_400_000));
  if (ateCinzas >= 1 && ateCinzas <= 4) {
    return ["Bom Carnaval{, nome}.", "Carnaval{, nome}? As negociações esperam a Quarta-feira de Cinzas."];
  }
  if (ateCinzas === 0) return ["Agora o ano começa{, nome}."];

  // Até o dia 23, dezembro é quando muitas empresas fecham o patrocínio
  // incentivado do ano (o abatimento vale para o ano do aporte).
  if (mes === 12 && dia <= 23 && agora.getDay() !== 0 && agora.getDay() !== 6) {
    return ["Dezembro é mês de fechar patrocínio{, nome}.", "Muitas empresas fecham o patrocínio do ano agora{, nome}."];
  }
  return [];
}

export function periodoDoDia(hora: number): Periodo {
  if (hora < 5) return "madrugada";
  if (hora < 12) return "manha";
  if (hora < 18) return "tarde";
  return "noite";
}

/** Primeiro nome, só a partir de um nome de verdade (nunca do e-mail). */
export function primeiroNome(nome?: string | null): string {
  const limpo = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!limpo || limpo.includes("@")) return "";
  return limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

/** A organização só entra na frase quando tem nome próprio e curto. */
export function organizacaoCabe(organizacao?: string | null, nome?: string | null): boolean {
  const org = (organizacao ?? "").trim();
  if (!org || org.length > 32) return false;
  const normal = (s: string) => s.trim().toLocaleLowerCase("pt-BR");
  if (normal(org) === "minha organização") return false;
  // Toda conta nova nasce com uma organização com o nome da pessoa.
  if (nome && (normal(org) === normal(nome) || normal(org) === normal(primeiroNome(nome)))) return false;
  return true;
}

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function preencher(modelo: string, nome: string, org: string): string {
  return modelo
    .replace("{, nome}", nome ? `, ${nome}` : "")
    .replace("{org}", org);
}

/** Todas as frases possíveis para o momento (útil para conferir e testar). */
export function frasesPossiveis({ nome, organizacao, agora }: EntradaSaudacao): string[] {
  const periodo = periodoDoDia(agora.getHours());
  const primeiro = primeiroNome(nome);
  const especiais = frasesDaData(agora);
  const modelos = especiais.length
    ? especiais
    : [
        ...FRASES[periodo],
        ...frasesDoDia(agora.getDay(), periodo),
        ...(periodo !== "madrugada" && organizacaoCabe(organizacao, nome) ? FRASES_ORGANIZACAO : []),
      ];
  return modelos.map((m) => preencher(m, primeiro, (organizacao ?? "").trim()));
}

export function saudacaoDoPainel(entrada: EntradaSaudacao): string {
  const opcoes = frasesPossiveis(entrada);
  const { agora } = entrada;
  const dia = `${agora.getFullYear()}-${agora.getMonth() + 1}-${agora.getDate()}`;
  const indice = hash(`${entrada.semente ?? ""}|${dia}|${periodoDoDia(agora.getHours())}`) % opcoes.length;
  return opcoes[indice];
}
