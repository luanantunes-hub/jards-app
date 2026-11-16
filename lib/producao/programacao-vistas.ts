// As vistas da programação pública (plano do módulo, PD8.3 e PD12.3): o filtro por sala e por dia, o endereço de cada filtro e o calendário (iCal)
// que o público baixa para pôr as sessões na própria agenda. Sem banco e sem tela: trabalha sobre os dias que `diasDaProgramacaoPublica` já deixou
// passar (dia, hora, título, sala e marca), então nada que não seja público entra aqui.

import type { DiaPublico } from "@/lib/producao/programacao";

export type FiltroDaProgramacao = { sala?: string | null; dia?: string | null };

/** Os nomes das salas que têm sessão, em ordem alfabética (para os botões do filtro). */
export function salasDaProgramacao(dias: readonly DiaPublico[]): string[] {
  return [...new Set(dias.flatMap(dia => dia.sessoes.map(sessao => sessao.sala)))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

/** Só as sessões da sala e do dia pedidos (sem filtro, tudo); o dia que fica sem sessão some. */
export function filtrarProgramacao(dias: readonly DiaPublico[], filtro: FiltroDaProgramacao): DiaPublico[] {
  const sala = filtro.sala?.trim() ?? "";
  const dia = filtro.dia?.trim() ?? "";
  return dias
    .filter(item => dia === "" || item.dia === dia)
    .map(item => ({ dia: item.dia, sessoes: item.sessoes.filter(sessao => sala === "" || sessao.sala === sala) }))
    .filter(item => item.sessoes.length > 0);
}

/** O filtro que vem do endereço: o dia só vale no formato AAAA-MM-DD e a sala até 80 letras; o resto vira "sem filtro". */
export function filtroDoEndereco(parametros: { sala?: string | string[]; dia?: string | string[] }): { sala: string; dia: string } {
  const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor) ?? "";
  const sala = primeiro(parametros.sala).trim().slice(0, 80);
  const dia = primeiro(parametros.dia).trim();
  return { sala, dia: /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : "" };
}

/** "?sala=Sala%20Grande&dia=2026-12-05" para o filtro (vazio, se não há filtro). */
export function consultaDoFiltro(filtro: FiltroDaProgramacao): string {
  const partes = new URLSearchParams();
  if (filtro.sala?.trim()) partes.set("sala", filtro.sala.trim());
  if (filtro.dia?.trim()) partes.set("dia", filtro.dia.trim());
  const texto = partes.toString();
  return texto === "" ? "" : `?${texto}`;
}

const FUSO_DE_BRASILIA_EM_HORAS = 3;

/** "2026-12-05" e "18:30" (hora de Brasília, sem horário de verão desde 2019) → "20261205T213000Z". */
export function momentoEmUtc(dia: string, hora: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const momento = new Date(Date.UTC(ano, mes - 1, d, h + FUSO_DE_BRASILIA_EM_HORAS, m, 0));
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${momento.getUTCFullYear()}${dois(momento.getUTCMonth() + 1)}${dois(momento.getUTCDate())}T${dois(momento.getUTCHours())}${dois(momento.getUTCMinutes())}00Z`;
}

/** O texto de um campo do iCal (RFC 5545): barra, ponto e vírgula, vírgula e quebra de linha ganham barra. */
export function escaparIcs(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Linhas de no máximo 75 bytes, as seguintes começando com um espaço (RFC 5545), sem cortar uma letra de dois bytes ao meio. */
export function dobrarLinhaIcs(linha: string): string {
  const encoder = new TextEncoder();
  const partes: string[] = [];
  let atual = "";
  let bytes = 0;
  for (const letra of linha) {
    const tamanho = encoder.encode(letra).length;
    const limite = partes.length === 0 ? 75 : 74;
    if (bytes + tamanho > limite) { partes.push(atual); atual = ""; bytes = 0; }
    atual += letra;
    bytes += tamanho;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

const sem = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * O calendário (.ics) das sessões: um evento por sessão, com início e fim em UTC, o título, o local (sala e espaço) e, se houver, quem apresenta. O
 * identificador de cada evento é sempre o mesmo para a mesma sessão, então baixar de novo atualiza em vez de duplicar.
 */
export function calendarioIcs(c: { titulo: string; espaco: string; dias: readonly DiaPublico[]; geradoEm: Date }): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  const g = c.geradoEm;
  const carimbo = `${g.getUTCFullYear()}${dois(g.getUTCMonth() + 1)}${dois(g.getUTCDate())}T${dois(g.getUTCHours())}${dois(g.getUTCMinutes())}${dois(g.getUTCSeconds())}Z`;
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jards//Programacao//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escaparIcs(c.titulo)}`, "X-WR-TIMEZONE:America/Sao_Paulo"];
  for (const dia of c.dias) {
    for (const sessao of dia.sessoes) {
      linhas.push(
        "BEGIN:VEVENT",
        `UID:${dia.dia}-${sessao.inicio.replace(":", "")}-${sem(sessao.sala)}-${sem(sessao.titulo)}@jards.com.br`,
        `DTSTAMP:${carimbo}`,
        `DTSTART:${momentoEmUtc(dia.dia, sessao.inicio)}`,
        `DTEND:${momentoEmUtc(dia.dia, sessao.fim)}`,
        `SUMMARY:${escaparIcs(sessao.titulo)}`,
        `LOCATION:${escaparIcs(`${sessao.sala}, ${c.espaco}`)}`,
        ...(sessao.marca ? [`DESCRIPTION:${escaparIcs(`Apresentada por ${sessao.marca.nome}`)}`] : []),
        "END:VEVENT",
      );
    }
  }
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrarLinhaIcs).join("\r\n") + "\r\n";
}
