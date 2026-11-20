// POST /api/acerto/{código}/responder (PD4.2): a casa envia o acerto técnico pelo link, sem conta.
//
// O código do link, que só o banco confere (o hash dele), é a autorização. O servidor confere o nome, o e-mail e cada
// valor pelo tipo do campo, grava de uma vez e avisa por e-mail quem criou o acerto. A organização, a data e os itens
// que a casa pode mudar vêm sempre do link e do banco, nunca do pedido.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { ErroDoAcerto, responderAoAcerto } from "@/lib/producao/acerto-publico";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { acertoRespondidoEmail } from "@/lib/email/templates";
import { estaNoLimite, registrarOcorrencia } from "@/lib/mcp/rateLimit";

const SEM_CACHE = { "cache-control": "no-store" };
/** Tentativas com um link que não existe, por IP, a cada minuto. Um código tem 256 bits, mas não custa fechar a porta. */
const MAX_FALHAS_POR_IP = 20;

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "desconhecido";
}

export async function POST(req: NextRequest, rota: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const ip = ipDe(req);
  const chaveDeFalhas = `acerto-falha:${ip}`;
  if (estaNoLimite(chaveDeFalhas, MAX_FALHAS_POR_IP)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { status: 429, headers: SEM_CACHE });
  }
  try {
    const { token } = await rota.params;
    const corpo: unknown = await req.json().catch(() => null);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: SEM_CACHE });
    const admin = createAdminClient();
    const resultado = await responderAoAcerto(admin, token, corpo as Record<string, unknown>);
    await avisarQuemCriou(admin, resultado, req.nextUrl.origin).catch(() => undefined); // o aviso é um favor: a resposta já está gravada
    return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
  } catch (erro) {
    if (erro instanceof ErroDoAcerto) {
      if (erro.extra.situacao === "inexistente") registrarOcorrencia(chaveDeFalhas);
      return NextResponse.json({ error: erro.message, ...erro.extra }, { status: erro.status, headers: SEM_CACHE });
    }
    console.error("[acerto] erro inesperado:", erro instanceof Error ? erro.message : "desconhecido");
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 500, headers: SEM_CACHE });
  }
}

/** Manda o e-mail a quem criou o acerto (se ainda existe e tem e-mail). Uma vez por resposta. */
async function avisarQuemCriou(admin: ReturnType<typeof createAdminClient>, resultado: { acertoId: string; organizationId: string; dataId: string; respondente: string }, origem: string) {
  const { data: acerto } = await clienteDaProducao(admin).from("producao_acertos").select("criado_por, modelo_nome, respondido_em").eq("id", resultado.acertoId).maybeSingle();
  if (!acerto?.criado_por) return;
  const [{ data: usuario }, { data: organizacao }, { data: perfil }] = await Promise.all([
    admin.auth.admin.getUserById(acerto.criado_por),
    admin.from("organizations").select("nome").eq("id", resultado.organizationId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", acerto.criado_por).maybeSingle(),
  ]);
  const para = usuario.user?.email;
  if (!para) return;
  const mensagem = acertoRespondidoEmail({
    recipientName: (perfil as { full_name?: string | null } | null)?.full_name ?? null,
    respondente: resultado.respondente,
    titulo: acerto.modelo_nome,
    organizacao: (organizacao as { nome?: string | null } | null)?.nome ?? "a produção",
    url: `${origem}/producoes/datas/${resultado.dataId}`,
  });
  await sendTransactionalEmail({ to: para, ...mensagem, idempotencyKey: `acerto-respondido-${resultado.acertoId}-${acerto.respondido_em ?? "x"}` });
}
