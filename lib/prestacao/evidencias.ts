// Evidências do objeto (P3.2): o que comprova a realização (foto, vídeo,
// lista de presença, declaração…), ligado a meta, atividade e local, com a
// data e a posição lidas da foto. Sem React e sem Supabase; a leitura do
// arquivo (EXIF) fica em lerFotoNoNavegador, que carrega o exifr só quando há
// uma foto.

import type { PrestacaoEvidencia } from "@/lib/supabase/types";

export const TIPOS_EVIDENCIA = [
  { id: "foto", rotulo: "Foto" },
  { id: "video", rotulo: "Vídeo" },
  { id: "link", rotulo: "Link" },
  { id: "lista_presenca", rotulo: "Lista de presença" },
  { id: "declaracao", rotulo: "Declaração" },
  { id: "clipping", rotulo: "Clipping" },
  { id: "bordero", rotulo: "Borderô" },
  { id: "print", rotulo: "Print de tela" },
  { id: "relatorio_exibicao", rotulo: "Relatório de exibição" },
  { id: "cpb", rotulo: "CPB" },
  { id: "outro", rotulo: "Outro" },
] as const;
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number]["id"];

export const REQUISITOS_EVIDENCIA = [
  { id: "alcance_objeto", rotulo: "Alcance do objeto" },
  { id: "democratizacao", rotulo: "Democratização" },
  { id: "acessibilidade", rotulo: "Acessibilidade" },
  { id: "distribuicao", rotulo: "Distribuição" },
  { id: "divulgacao", rotulo: "Divulgação" },
] as const;
export type RequisitoEvidencia = (typeof REQUISITOS_EVIDENCIA)[number]["id"];

export const rotuloDoTipo = (tipo: string) => TIPOS_EVIDENCIA.find(t => t.id === tipo)?.rotulo ?? tipo;

/** Tipo sugerido pelo arquivo: imagem é foto, vídeo é vídeo; o resto a pessoa escolhe. */
export function tipoPeloArquivo(mime: string | null | undefined, nome: string): TipoEvidencia {
  const m = (mime ?? "").toLowerCase();
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "heif", "webp"].includes(ext)) return "foto";
  if (m.startsWith("video/") || ["mp4", "mov", "m4v", "webm"].includes(ext)) return "video";
  return "outro";
}

/** "2026:09:10 14:32:05" (EXIF, hora da câmera) → "2026-09-10T14:32:05"; inválida → null. */
export function dataDoExif(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const m = texto.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, a, mes, d, h, min, s] = m;
  if (a === "0000" || Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${a}-${mes}-${d}T${h}:${min}:${s}`;
}

export type DadosDaFoto = { capturadaEm: string | null; latitude: number | null; longitude: number | null };

/** Junta o que o exifr leu (data crua e GPS) no que a evidência guarda. */
export function dadosDaFoto(cru: { DateTimeOriginal?: unknown; CreateDate?: unknown } | null | undefined, gps: { latitude?: unknown; longitude?: unknown } | null | undefined): DadosDaFoto {
  const capturadaEm = dataDoExif(cru?.DateTimeOriginal) ?? dataDoExif(cru?.CreateDate);
  const lat = Number(gps?.latitude), lon = Number(gps?.longitude);
  const temPosicao = gps && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  return {
    capturadaEm,
    latitude: temPosicao ? Number(lat.toFixed(6)) : null,
    longitude: temPosicao ? Number(lon.toFixed(6)) : null,
  };
}

/** Lê a data e a posição da foto no navegador; sem EXIF ou fora de foto, tudo null. */
export async function lerFotoNoNavegador(arquivo: Blob): Promise<DadosDaFoto> {
  try {
    const exifr = (await import("exifr")).default;
    const [cru, gps] = await Promise.all([
      exifr.parse(arquivo, { reviveValues: false, pick: ["DateTimeOriginal", "CreateDate"] }).catch(() => null),
      exifr.gps(arquivo).catch(() => null),
    ]);
    return dadosDaFoto(cru, gps);
  } catch {
    return { capturadaEm: null, latitude: null, longitude: null };
  }
}

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** "10/09/2026 às 14:32" */
export function quandoFoiTirada(capturadaEm: string | null): string | null {
  if (!capturadaEm) return null;
  const hora = capturadaEm.slice(11, 16);
  return hora ? `${dataBr(capturadaEm)} às ${hora}` : dataBr(capturadaEm);
}

/** Link para ver a posição da foto no mapa. */
export const linkDoMapa = (latitude: number, longitude: number) => `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;

/** Acima disso a foto está longe demais da sede do município do local. */
export const DISTANCIA_MAXIMA_KM = 50;

/** Tolerância, em dias, entre a data da foto e a da atividade (fuso e virada da noite). */
export const TOLERANCIA_DIAS_ATIVIDADE = 1;

/** O período da atividade: início e fim, ou só a data de realização. */
export function periodoDaAtividade(a: { data_realizacao: string; data_inicio?: string | null; data_fim?: string | null }): { inicio: string; fim: string } {
  const inicio = (a.data_inicio || a.data_realizacao).slice(0, 10);
  const fim = (a.data_fim || a.data_inicio || a.data_realizacao).slice(0, 10);
  return fim < inicio ? { inicio: fim, fim: inicio } : { inicio, fim };
}

/** Soma dias a uma data ISO (AAAA-MM-DD), sem fuso. */
export function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export type EvidenciaParaChecar = Pick<PrestacaoEvidencia, "id" | "tipo" | "nome_arquivo" | "url" | "atividade_id" | "meta_id" | "local_id" | "capturada_em" | "latitude" | "longitude" | "justificativa">
  & Partial<Pick<PrestacaoEvidencia, "requisitos">>;

/** Nome curto da evidência para mensagens. */
export const nomeDaEvidencia = (e: Pick<PrestacaoEvidencia, "tipo" | "nome_arquivo" | "url">) =>
  e.nome_arquivo || e.url || rotuloDoTipo(e.tipo);
