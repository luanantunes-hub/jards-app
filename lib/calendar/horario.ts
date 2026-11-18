// Datas e horas no fuso da operação (o Jards é usado no Brasil). Lógica pura, sem rede: serve ao envio das atividades para a agenda e à importação das reuniões da agenda.

export const FUSO_PADRAO = "America/Sao_Paulo";

/** A data (AAAA-MM-DD) e a hora (HH:MM) que um instante marca no fuso informado. */
export function partesLocais(instante: Date | string, fuso: string = FUSO_PADRAO): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instante));
  const valor = (tipo: string) => partes.find(parte => parte.type === tipo)?.value ?? "00";
  return { data: `${valor("year")}-${valor("month")}-${valor("day")}`, hora: `${valor("hour")}:${valor("minute")}` };
}

export function somarDias(data: string, dias: number): string {
  const dia = new Date(`${data.slice(0, 10)}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + dias);
  return dia.toISOString().slice(0, 10);
}

/** O instante exato em que o relógio do fuso marca aquela data e hora. */
export function instanteLocal(data: string, hora: string, fuso: string = FUSO_PADRAO): Date {
  const alvo = Date.parse(`${data.slice(0, 10)}T${hora.slice(0, 5)}:00Z`);
  let chute = alvo;
  for (let volta = 0; volta < 2; volta++) {
    const local = partesLocais(new Date(chute), fuso);
    chute += alvo - Date.parse(`${local.data}T${local.hora}:00Z`);
  }
  return new Date(chute);
}

/** Data e hora de término quando só se sabe o começo: soma a duração (padrão 1 hora), passando para o dia seguinte se for o caso. */
export function fimPadrao(data: string, hora: string, minutos = 60): { data: string; hora: string } {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + minutos;
  const dias = Math.floor(total / 1440);
  const resto = total - dias * 1440;
  return { data: somarDias(data, dias), hora: `${String(Math.floor(resto / 60)).padStart(2, "0")}:${String(resto % 60).padStart(2, "0")}` };
}
