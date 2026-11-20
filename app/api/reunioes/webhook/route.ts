// Recebe os avisos do Vexa (meeting.started, meeting.completed, bot.failed). O endereço e o segredo são registrados uma vez na conta do Vexa (PUT /user/webhook, pelo
// script scripts/reunioes-registrar-webhook.ts). Cada aviso vem assinado (X-Webhook-Signature, HMAC do horário mais o corpo); sem assinatura válida, 401.
//
// A entrega é "pelo menos uma vez": o mesmo aviso pode chegar de novo. Por isso cada ação olha o estado atual da reunião e a transcrição só é gravada se a reunião ainda
// não tem nenhuma. Aviso de reunião que não é do Jards (a conta do Vexa pode ter outras) responde 200 e é ignorado, para o Vexa não ficar reenviando.
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { concluirReuniao } from "@/lib/reunioes/concluir";
import { assinaturaValida, decidirAcao, lerAviso, type SituacaoDaReuniao } from "@/lib/reunioes/vexa-webhook";
import { registrarUsoDaReuniao } from "@/lib/reunioes/uso";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  const segredo = process.env.VEXA_WEBHOOK_SECRET;
  if (!segredo) return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 });

  const corpo = await req.text();
  const valida = assinaturaValida({ segredo, corpo, horario: req.headers.get("x-webhook-timestamp"), assinatura: req.headers.get("x-webhook-signature") });
  if (!valida) return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });

  let json: unknown = null;
  try { json = JSON.parse(corpo); } catch { /* corpo que não é JSON cai no "aviso ilegível" abaixo */ }
  const aviso = lerAviso(json);
  if (!aviso) return NextResponse.json({ ok: true, ignorado: "aviso que o Jards não usa" });

  const admin = adminClient();
  const { data: reuniao } = await admin.from("reunioes").select("id,status,iniciada_em").eq("vexa_bot_id", aviso.vexaId).maybeSingle();
  if (!reuniao) return NextResponse.json({ ok: true, ignorado: "reunião que não é do Jards" });

  const acao = decidirAcao(aviso, reuniao.status as SituacaoDaReuniao);
  if (acao === "ignorar") return NextResponse.json({ ok: true });

  if (acao === "iniciar") {
    await admin.from("reunioes").update({ status: "gravando", iniciada_em: reuniao.iniciada_em ?? aviso.comecouEm ?? new Date().toISOString() }).eq("id", reuniao.id);
    return NextResponse.json({ ok: true });
  }

  const iniciadaEm = reuniao.iniciada_em ?? aviso.comecouEm;
  const fim = aviso.terminouEm ? new Date(aviso.terminouEm) : new Date();

  if (acao === "falhar") {
    await admin.from("reunioes").update({ status: "falhou", erro: aviso.motivo ? `O assistente não conseguiu participar: ${aviso.motivo}` : "O assistente não conseguiu participar da reunião", ...(iniciadaEm && !reuniao.iniciada_em ? { iniciada_em: iniciadaEm } : {}) }).eq("id", reuniao.id);
    // se o robô chegou a entrar, o tempo dele conta no uso mesmo que a reunião tenha falhado depois
    await registrarUsoDaReuniao(admin, reuniao.id, iniciadaEm, fim);
    return NextResponse.json({ ok: true });
  }

  // concluir: busca a transcrição no Vexa e grava (uma vez só)
  const fechou = await concluirReuniao(admin, { id: reuniao.id, iniciada_em: reuniao.iniciada_em }, aviso.vexaId, aviso.comecouEm, aviso.terminouEm);
  // Falha ao buscar a transcrição: a reunião fica "processando" e a resposta é 502, para o Vexa reenviar o aviso (ele tenta de novo depois de 1, 5 e 30 minutos).
  if (!fechou) return NextResponse.json({ error: "Não foi possível buscar a transcrição agora" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
