// Dias sem expediente para a contagem de prazos.
//
// Datas são strings ISO "AAAA-MM-DD" e a aritmética é feita em UTC, para não
// depender do fuso de quem roda o código.
//
// Feriados nacionais calculados aqui; estaduais, municipais e o defeso
// eleitoral entram como dias extras (virão de calendario_regulatorio).

export type DiaSemExpediente = {
  data: string;
  nome: string;
  tipo: "feriado" | "ponto_facultativo";
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validarData(data: string): string {
  if (!ISO.test(data)) throw new Error(`Data inválida: ${data}`);
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new Error(`Data inválida: ${data}`);
  }
  return data;
}

function paraDate(data: string): Date {
  const [ano, mes, dia] = validarData(data).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function paraIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(data: string, dias: number): string {
  const d = paraDate(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraIso(d);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(data: string): number {
  return paraDate(data).getUTCDay();
}

/** Diferença em dias corridos (b − a). */
export function diferencaEmDias(a: string, b: string): number {
  return Math.round((paraDate(b).getTime() - paraDate(a).getTime()) / 86_400_000);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
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
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const FIXOS: [string, string][] = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"], // Lei 14.759/2023
  ["12-25", "Natal"],
];

/**
 * Feriados nacionais e os pontos facultativos federais em que os órgãos não
 * abrem (segunda e terça de carnaval, Corpus Christi). A quarta-feira de
 * cinzas tem expediente a partir das 14h e conta como dia útil.
 */
export function feriadosNacionais(ano: number): DiaSemExpediente[] {
  const domingo = pascoa(ano);
  const dias: DiaSemExpediente[] = FIXOS.map(([mmdd, nome]) => ({ data: `${ano}-${mmdd}`, nome, tipo: "feriado" }));
  dias.push(
    { data: somarDias(domingo, -48), nome: "Carnaval (segunda-feira)", tipo: "ponto_facultativo" },
    { data: somarDias(domingo, -47), nome: "Carnaval (terça-feira)", tipo: "ponto_facultativo" },
    { data: somarDias(domingo, -2), nome: "Sexta-feira da Paixão", tipo: "feriado" },
    { data: somarDias(domingo, 60), nome: "Corpus Christi", tipo: "ponto_facultativo" },
  );
  return dias.sort((x, y) => x.data.localeCompare(y.data));
}

export type Calendario = {
  ehDiaUtil(data: string): boolean;
  motivo(data: string): string | null;
};

/**
 * Calendário para um prazo. `extras` recebe feriados locais e outros dias
 * sem expediente do órgão; `pontosFacultativos: false` volta a contar
 * carnaval e Corpus Christi como dias úteis.
 */
export function criarCalendario(opcoes: { extras?: DiaSemExpediente[]; pontosFacultativos?: boolean } = {}): Calendario {
  const { extras = [], pontosFacultativos = true } = opcoes;
  const porAno = new Map<number, Map<string, string>>();

  function diasDoAno(ano: number): Map<string, string> {
    let mapa = porAno.get(ano);
    if (!mapa) {
      mapa = new Map();
      for (const dia of feriadosNacionais(ano)) {
        if (dia.tipo === "feriado" || pontosFacultativos) mapa.set(dia.data, dia.nome);
      }
      for (const dia of extras) {
        if (dia.data.startsWith(`${ano}-`)) mapa.set(dia.data, dia.nome);
      }
      porAno.set(ano, mapa);
    }
    return mapa;
  }

  function motivo(data: string): string | null {
    const semana = diaDaSemana(data);
    if (semana === 0) return "Domingo";
    if (semana === 6) return "Sábado";
    return diasDoAno(Number(data.slice(0, 4))).get(data) ?? null;
  }

  return { motivo, ehDiaUtil: data => motivo(data) === null };
}
