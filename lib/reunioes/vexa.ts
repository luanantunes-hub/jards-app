// Cliente para a API do Vexa self-hosted (github.com/Vexa-ai/vexa).
//
// IMPORTANTE: os nomes de campo abaixo seguem a documentação pública do projeto
// (README/api-reference) no momento em que este cliente foi escrito. Confirme o
// payload exato contra a instância real (docs.vexa.ai da sua instalação) antes de
// usar em produção — a API ainda está em evolução ativa.

export type VexaPlataforma = "google_meet" | "teams";

type VexaBotResponse = {
  id: string;
  status: string;
  platform: string;
  meeting_url: string;
};

type VexaTranscriptSegment = {
  speaker: string | null;
  text: string;
  start_ms: number;
  end_ms: number | null;
  confidence: number | null;
};

type VexaTranscriptResponse = {
  segments: VexaTranscriptSegment[];
};

function config() {
  const baseUrl = process.env.VEXA_API_URL;
  const apiKey = process.env.VEXA_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Vexa não configurado (VEXA_API_URL/VEXA_API_KEY ausentes)");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function vexaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vexa API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function enviarBot(params: {
  meetingUrl: string;
  plataforma: VexaPlataforma;
  webhookUrl: string;
  nomeBot?: string;
}): Promise<{ vexaBotId: string; status: string }> {
  const data = await vexaFetch<VexaBotResponse>("/bots", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: params.meetingUrl,
      platform: params.plataforma,
      bot_name: params.nomeBot ?? "Jards",
      webhook_url: params.webhookUrl,
    }),
  });
  return { vexaBotId: data.id, status: data.status };
}

export async function consultarStatusBot(vexaBotId: string): Promise<{ status: string }> {
  const data = await vexaFetch<VexaBotResponse>(`/bots/${vexaBotId}/status`);
  return { status: data.status };
}

export async function buscarTranscricao(vexaBotId: string): Promise<VexaTranscriptSegment[]> {
  const data = await vexaFetch<VexaTranscriptResponse>(`/bots/${vexaBotId}/transcript`);
  return data.segments;
}
