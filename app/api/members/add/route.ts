import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { target_user_id, organization_id } = await req.json() as {
    target_user_id: string;
    organization_id: string;
  };

  if (!target_user_id || !organization_id) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const admin = adminClient();

  // 1. Confirmar que o solicitante é admin da org
  const { data: requesterMember } = await admin
    .from("organization_members")
    .select("papel")
    .eq("organization_id", organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!requesterMember || requesterMember.papel !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Duplicidade é validada antes de consumir um assento contratado.
  const { data: existente, error: duplicateError } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organization_id)
    .eq("user_id", target_user_id)
    .maybeSingle();

  if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 500 });
  if (existente) {
    return NextResponse.json({ error: "Este usuário já é membro da organização" }, { status: 409 });
  }

  const { error: insertError } = await (admin as any).rpc("add_organization_member_with_seat", {
    target_org: organization_id,
    target_user: target_user_id,
    target_role: "captador",
  });

  if (insertError) {
    const noSeat = insertError.code === "23514" || insertError.message?.includes("assentos disponiveis");
    const duplicate = insertError.code === "23505";
    return NextResponse.json({
      error: noSeat
        ? "Não há vagas disponíveis. Compre usuários extras antes de adicionar outro membro."
        : duplicate ? "Este usuário já é membro da organização" : insertError.message,
      ...(noSeat ? { code: "NO_SEATS" } : {}),
    }, { status: noSeat || duplicate ? 409 : 500 });
  }

  return NextResponse.json({ ok: true });
}
