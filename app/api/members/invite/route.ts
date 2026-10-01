import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  const noSeat = error.code === "23514" || error.message?.includes("assentos disponiveis");
  const duplicate = error.code === "23505";
  return NextResponse.json({
    error: noSeat
      ? "Não há vagas disponíveis. Compre usuários extras antes de convidar."
      : duplicate ? "Esta pessoa já faz parte da equipe ou possui um convite pendente." : error.message,
    ...(noSeat ? { code: "NO_SEATS" } : {}),
  }, { status: noSeat || duplicate ? 409 : 500 });
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

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/auth/callback?next=${
    role === "captador" ? "/workspace-captador" : role === "proponente" ? "/workspace-proponente" : "/configuracoes"
  }`;

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
    const { error: memberError } = await (admin as any).rpc("add_organization_member_with_seat", {
      target_org: organizationId,
      target_user: existingProfile.id,
      target_role: role,
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
    });
    return NextResponse.json({ ok: true, status: "accepted", email });
  }

  const { data: invitationId, error: reserveError } = await (admin as any).rpc("reserve_organization_invitation", {
    target_org: organizationId,
    target_email: email,
    target_role: role,
    inviter: user.id,
  });
  if (reserveError) return rpcErrorResponse(reserveError);

  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { organization_id: organizationId, organization_role: role },
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
