// Recebe o webhook do Vexa quando o status do bot muda (entrou, terminou, falhou).
//
// IMPORTANTE: o formato exato do payload do Vexa (nomes de campo, tipo de evento)
// ainda precisa ser confirmado contra a instância self-hosted real — por isso este
// handler trata o corpo do webhook apenas como um "avise algo mudou" e busca o
// estado autoritativo direto na API do Vexa (status + transcrição), em vez de
// confiar nos dados do corpo. Ajuste a extração de `vexaBotId` abaixo assim que o
// payload real for confirmado.
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { consultarStatusBot, buscarTranscricao } from "@/lib/reunioes/vexa";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function segredoValido(recebido: string | null, esperado: string) {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extrairVexaBotId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const candidato = obj.bot_id ?? obj.id ?? (obj.data as Record<string, unknown> | undefined)?.bot_id;
  return typeof candidato === "string" ? candidato : null;
}

const STATUS_EM_ANDAMENTO = new Set(["active", "recording", "joining", "in_call"]);
const STATUS_FINALIZADO = new Set(["completed", "done", "ended", "call_ended"]);
const STATUS_FALHOU = new Set(["failed", "error", "denied", "rejected"]);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.VEXA_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 });

  const recebido = req.headers.get("x-vexa-webhook-secret");
  if (!segredoValido(recebido, webhookSecret)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const vexaBotId = extrairVexaBotId(payload);
  if (!vexaBotId) return NextResponse.json({ error: "Payload sem bot_id" }, { status: 400 });

  const admin = adminClient();
  const { data: reuniao } = await admin
    .from("reunioes")
    .select("id,status")
    .eq("vexa_bot_id", vexaBotId)
    .maybeSingle();
  if (!reuniao) return NextResponse.json({ error: "Reunião não encontrada para este bot" }, { status: 404 });

  let statusVexa: string;
  try {
    ({ status: statusVexa } = await consultarStatusBot(vexaBotId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar o Vexa" }, { status: 502 });
  }

  if (STATUS_FALHOU.has(statusVexa)) {
    await admin.from("reunioes").update({ status: "falhou", erro: `Status do Vexa: ${statusVexa}` }).eq("id", reuniao.id);
    return NextResponse.json({ ok: true });
  }

  if (STATUS_EM_ANDAMENTO.has(statusVexa)) {
    await admin.from("reunioes").update({ status: "gravando", iniciada_em: new Date().toISOString() }).eq("id", reuniao.id);
    return NextResponse.json({ ok: true });
  }

  if (STATUS_FINALIZADO.has(statusVexa)) {
    await admin.from("reunioes").update({ status: "processando" }).eq("id", reuniao.id);
    try {
      const segmentos = await buscarTranscricao(vexaBotId);
      if (segmentos.length > 0) {
        await admin.from("reuniao_transcricoes").insert(
          segmentos.map(s => ({
            reuniao_id: reuniao.id,
            falante: s.speaker,
            texto: s.text,
            inicio_ms: s.start_ms,
            fim_ms: s.end_ms,
            confianca: s.confidence,
          })),
        );
      }
      await admin.from("reunioes").update({ status: "concluida", finalizada_em: new Date().toISOString() }).eq("id", reuniao.id);
    } catch (error) {
      await admin.from("reunioes").update({
        status: "falhou",
        erro: error instanceof Error ? error.message : "Não foi possível buscar a transcrição",
      }).eq("id", reuniao.id);
    }
    return NextResponse.json({ ok: true });
  }

  // Status desconhecido: não corrompe o estado atual, só registra pra investigação.
  await admin.from("reunioes").update({ erro: `Status do Vexa não mapeado: ${statusVexa}` }).eq("id", reuniao.id);
  return NextResponse.json({ ok: true });
}
