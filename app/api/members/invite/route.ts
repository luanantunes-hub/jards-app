import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { destinoDoConvite, lerPedidoModulos, respostaErroEquipe } from "@/lib/equipe-modulos";

type MemberRole = "admin" | "colaborador" | "leitor" | "captador" | "proponente";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ilike trata % e _ como curingas: "%@empresa.com" acharia qualquer perfil
// daquele domínio. O e-mail é comparado literalmente.
function emailLiteral(email: string) {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function rpcErrorResponse(error: { code?: string; message?: string }) {
  const { status, ...corpo } = respostaErroEquipe(error);
  return NextResponse.json(corpo, { status });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    organization_id?: string;
    email?: string;
    role?: MemberRole;
    captador_id?: string;
    proponente_id?: string;
    modulos?: unknown;
    prestacao_funcao?: unknown;
  } | null;
  const organizationId = body?.organization_id ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const role = body?.role ?? "colaborador";
  const captadorId = body?.captador_id ?? "";
  const proponenteId = body?.proponente_id ?? "";
  if (
    !organizationId ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !["admin", "colaborador", "leitor", "captador", "proponente"].includes(role) ||
    (role === "captador" && !captadorId) ||
    (role === "proponente" && !proponenteId)
  ) {
    return NextResponse.json({ error: "Convite inválido" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: requester, error: requesterError } = await admin.from("organization_members")
    .select("papel").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (requesterError) return NextResponse.json({ error: requesterError.message }, { status: 500 });
  if (requester?.papel !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  // Módulos e função na prestação (P0.6). Sem módulos, "só captação".
  const { data: org, error: orgError } = await admin.from("organizations")
    .select("modulos_ativos").eq("id", organizationId).maybeSingle();
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });
  const pedido = lerPedidoModulos(role, body?.modulos, body?.prestacao_funcao, org?.modulos_ativos ?? ["captacao"]);
  if (!pedido.ok) return NextResponse.json({ error: pedido.erro }, { status: 400 });
  const { modulos, funcao } = pedido.valor;

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/auth/callback?next=${destinoDoConvite(role, modulos)}`;

  async function linkCaptador(userId: string) {
    if (role !== "captador") return null;
    const { error } = await admin.from("captadores").update({ user_id: userId }).eq("id", captadorId).eq("organization_id", organizationId);
    return error;
  }

  async function linkProponente(userId: string) {
    if (role !== "proponente") return null;
    const { error } = await admin.from("proponentes").update({ user_id: userId }).eq("id", proponenteId).eq("organization_id", organizationId);
    return error;
  }

  // Repetir um convite pendente gera um link manual, em vez de consumir outro
  // assento ou adicionar um usuário Auth ainda não confirmado à organização.
  const { data: pendingInvitation, error: pendingError } = await admin
    .from("organization_invitations")
    .select("id, invited_user_id")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .eq("role", role)
    .ilike("email", emailLiteral(email))
    .maybeSingle();
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
  if (pendingInvitation) {
    if (pendingInvitation.invited_user_id) {
      const captadorLinkError = await linkCaptador(pendingInvitation.invited_user_id);
      if (captadorLinkError) return NextResponse.json({ error: captadorLinkError.message }, { status: 500 });
      const proponenteLinkError = await linkProponente(pendingInvitation.invited_user_id);
      if (proponenteLinkError) return NextResponse.json({ error: proponenteLinkError.message }, { status: 500 });
    }
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    if (linkError || !linkData.properties?.action_link) {
      return NextResponse.json({ error: linkError?.message ?? "Não foi possível gerar o link do convite" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      status: "pending",
      email,
      invite_url: linkData.properties.action_link,
      manual: true,
    });
  }

  const { data: existingProfile, error: profileError } = await admin
    .from("profiles").select("id, email").ilike("email", emailLiteral(email)).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  if (existingProfile) {
    const { error: memberError } = await admin.rpc("adicionar_membro_com_modulos", {
      target_org: organizationId,
      target_user: existingProfile.id,
      target_role: role,
      target_modulos: modulos,
      target_funcao: funcao,
    });
    if (memberError) return rpcErrorResponse(memberError);

    const captadorLinkError = await linkCaptador(existingProfile.id);
    if (captadorLinkError) return NextResponse.json({ error: captadorLinkError.message }, { status: 500 });
    const proponenteLinkError = await linkProponente(existingProfile.id);
    if (proponenteLinkError) return NextResponse.json({ error: proponenteLinkError.message }, { status: 500 });

    // Registro historico do convite/adicao; nao reserva outro assento.
    await admin.from("organization_invitations").insert({
      organization_id: organizationId,
      email,
      role,
      status: "accepted",
      invited_by: user.id,
      invited_user_id: existingProfile.id,
      accepted_at: new Date().toISOString(),
      modulos_acesso: modulos,
      prestacao_funcao: funcao,
    });
    return NextResponse.json({ ok: true, status: "accepted", email });
  }

  const { data: invitationId, error: reserveError } = await admin.rpc("reservar_convite_com_modulos", {
    target_org: organizationId,
    target_email: email,
    target_role: role,
    inviter: user.id,
    target_modulos: modulos,
    target_funcao: funcao,
  });
  if (reserveError) return rpcErrorResponse(reserveError);

  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { organization_id: organizationId, organization_role: role, organization_modules: modulos },
  });
  if (inviteError || !data.user) {
    await admin.from("organization_invitations").update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    }).eq("id", invitationId);
    return NextResponse.json({ error: inviteError?.message ?? "Não foi possível enviar o convite" }, { status: 502 });
  }

  const { error: linkError } = await admin.from("organization_invitations")
    .update({ invited_user_id: data.user.id })
    .eq("id", invitationId);
  if (linkError) {
    return NextResponse.json({ error: "O convite foi enviado, mas não foi possível concluir o vínculo. Tente novamente mais tarde." }, { status: 500 });
  }

  const captadorLinkError = await linkCaptador(data.user.id);
  if (captadorLinkError) {
    return NextResponse.json({ error: "O convite foi enviado, mas não foi possível vincular o acesso à agência." }, { status: 500 });
  }
  const proponenteLinkError = await linkProponente(data.user.id);
  if (proponenteLinkError) {
    return NextResponse.json({ error: "O convite foi enviado, mas não foi possível vincular o acesso ao proponente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pending", email });
}
