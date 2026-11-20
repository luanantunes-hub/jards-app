// Cliente da API do Vexa (github.com/Vexa-ai/vexa; hospedado em api.cloud.vexa.ai ou na sua própria instalação: a API é a mesma).
//
// Segue a documentação pública da versão 0.12 (docs.vexa.ai, "Meetings API" e "Webhooks"), lida em 17/11/2026. Ainda não foi exercitado contra uma reunião de verdade:
// a primeira reunião de teste confirma os campos. Por isso as respostas são lidas de forma defensiva e o que não bate vira erro claro, não dado errado.
//
// Variáveis de ambiente: VEXA_API_KEY (obrigatória; chave do tipo "bot"), VEXA_API_URL (padrão: o serviço hospedado).

export type VexaPlataforma = "google_meet" | "teams";

export const URL_PADRAO_DO_VEXA = "https://api.cloud.vexa.ai";

/** A reunião como o Vexa a conhece: `id` é o número da reunião no Vexa, que o Jards guarda em `reunioes.vexa_bot_id`. */
export type ReuniaoDoVexa = { id: string; plataforma: string | null; nativeMeetingId: string | null; status: string | null; motivo: string | null };

/** Um trecho de fala já pronto para gravar em `reuniao_transcricoes`. */
export type TrechoDeFala = { falante: string | null; texto: string; inicio_ms: number; fim_ms: number | null; confianca: number | null };

function config() {
  const apiKey = process.env.VEXA_API_KEY;
  if (!apiKey) throw new Error("Vexa não configurado (VEXA_API_KEY ausente)");
  return { baseUrl: (process.env.VEXA_API_URL || URL_PADRAO_DO_VEXA).replace(/\/+$/, ""), apiKey };
}

async function vexaFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", "X-API-Key": apiKey, ...init?.headers }, cache: "no-store" });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Vexa API ${res.status}: ${corpo.slice(0, 300) || res.statusText}`);
  }
  return res.json();
}

const texto = (valor: unknown): string | null => (typeof valor === "string" && valor.trim() !== "" ? valor : null);

/** A reunião numa resposta do Vexa (`POST /bots`, `GET /meetings/{id}`): o id vem como número e vira texto. Sem id, não serve. */
export function lerReuniaoDoVexa(corpo: unknown): ReuniaoDoVexa {
  const objeto = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const id = typeof objeto.id === "number" || typeof objeto.id === "string" ? String(objeto.id) : null;
  if (!id) throw new Error("O Vexa não devolveu o número da reunião");
  // o motivo de uma falha ou do fim aparece no próprio objeto ou dentro de `data`, conforme a versão do Vexa
  const dados = (objeto.data && typeof objeto.data === "object" ? objeto.data : {}) as Record<string, unknown>;
  const motivo = texto(objeto.failure_stage) ?? texto(objeto.completion_reason) ?? texto(dados.failure_stage) ?? texto(dados.completion_reason) ?? texto(dados.error) ?? texto(objeto.error);
  return { id, plataforma: texto(objeto.platform), nativeMeetingId: texto(objeto.native_meeting_id), status: texto(objeto.status), motivo };
}

/**
 * Os trechos de fala confirmados de uma transcrição (`GET /transcripts/by-id/{id}`): o tempo vem em segundos (vira milissegundos), rascunho (`completed: false`) fica
 * de fora, texto vazio fica de fora, e fala sem nome fica com falante nulo (o Vexa publica vazio quando não sabe quem falou, em 4 a 7% dos trechos com muita fala cruzada).
 */
export function lerTrechos(corpo: unknown): TrechoDeFala[] {
  const segmentos = (corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>).segments : null);
  if (!Array.isArray(segmentos)) return [];
  const trechos: TrechoDeFala[] = [];
  for (const bruto of segmentos) {
    const s = (bruto ?? {}) as Record<string, unknown>;
    const fala = texto(s.text)?.trim();
    if (!fala || s.completed === false || typeof s.start !== "number") continue;
    trechos.push({
      falante: texto(s.speaker)?.trim() ?? null,
      texto: fala,
      inicio_ms: Math.max(0, Math.round(s.start * 1000)),
      fim_ms: typeof s.end === "number" ? Math.max(0, Math.round(s.end * 1000)) : null,
      confianca: typeof s.confidence === "number" ? s.confidence : null,
    });
  }
  return trechos.sort((a, b) => a.inicio_ms - b.inicio_ms);
}

/**
 * Manda o robô para a reunião pelo link (o Vexa extrai a plataforma e o número da reunião do link, inclusive o código de acesso do Teams). Fala em português, não guarda
 * gravação de áudio (só o texto fica) e o robô sai sozinho depois de 5 minutos sozinho na sala.
 */
export async function enviarBot(params: { meetingUrl: string; nomeBot?: string; idioma?: string }): Promise<ReuniaoDoVexa> {
  const corpo = await vexaFetch("/bots", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: params.meetingUrl,
      bot_name: params.nomeBot ?? "Jards (gravando a reunião)",
      language: params.idioma ?? "pt",
      recording_enabled: false,
      automatic_leave: { max_time_left_alone: 300000 },
    }),
  });
  return lerReuniaoDoVexa(corpo);
}

export async function consultarReuniao(vexaId: string): Promise<ReuniaoDoVexa> {
  return lerReuniaoDoVexa(await vexaFetch(`/meetings/${encodeURIComponent(vexaId)}`));
}

export async function buscarTranscricao(vexaId: string): Promise<TrechoDeFala[]> {
  return lerTrechos(await vexaFetch(`/transcripts/by-id/${encodeURIComponent(vexaId)}`));
}

/** Manda o robô sair da reunião (e fecha a conta dela no Vexa). */
export async function pararBot(plataforma: string, nativeMeetingId: string): Promise<void> {
  await vexaFetch(`/bots/${encodeURIComponent(plataforma)}/${encodeURIComponent(nativeMeetingId)}`, { method: "DELETE" });
}

/** Registra o endereço que recebe os avisos do Vexa (uma vez por conta; `PUT /user/webhook`). */
export async function registrarWebhook(params: { url: string; segredo: string }): Promise<void> {
  await vexaFetch("/user/webhook", {
    method: "PUT",
    body: JSON.stringify({
      webhook_url: params.url,
      webhook_secret: params.segredo,
      webhook_events: { "meeting.started": true, "meeting.completed": true, "bot.failed": true, "meeting.status_change": false },
    }),
  });
}
