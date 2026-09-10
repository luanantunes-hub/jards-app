import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("jards_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.jards_super_admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { targetUserId } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: "targetUserId obrigatório" }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(targetUserId);
  if (targetErr || !targetData.user.email) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetData.user.email,
  });

  if (linkErr || !link?.properties?.hashed_token) {
    return NextResponse.json({ error: linkErr?.message ?? "Erro ao gerar link" }, { status: 500 });
  }

  await writeAdminAuditLog({
    actorUserId: user.id,
    organizationId: null,
    action: "impersonate",
    resourceType: "usuario",
    resourceId: targetUserId,
    targetUserId,
    summary: "Acesso administrativo iniciado para um usuário",
  });

  return NextResponse.json({ tokenHash: link.properties.hashed_token, email: targetData.user.email });
}
