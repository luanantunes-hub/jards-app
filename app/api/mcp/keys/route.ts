import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateApiKey } from "@/lib/mcp/auth";

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function currentUser() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}

/** Lista as chaves do usuário logado (nunca a chave em texto puro, só metadados). */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("mcp_api_keys")
    .select("id,key_prefix,label,scope,expires_at,created_at,last_used_at,revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chaves: data });
}

/** Gera uma nova chave. A chave crua só aparece nesta resposta, uma vez. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
  const scope = body.scope === "write" ? "write" : "read";

  // Prazo obrigatório, com teto de 1 ano — chave sem validade é o tipo de coisa
  // que fica esquecida ativa para sempre. Padrão 90 dias se nada for informado.
  const expiresInDays = Math.min(Math.max(Number(body.expires_in_days) || 90, 1), 365);
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

  const { raw, hash, prefix } = generateApiKey();
  const admin = adminClient();
  const { data, error } = await admin
    .from("mcp_api_keys")
    .insert({ user_id: user.id, key_hash: hash, key_prefix: prefix, label, scope, expires_at: expiresAt })
    .select("id,key_prefix,label,scope,expires_at,created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ chave: raw, ...data }, { status: 201 });
}

/** Revoga uma chave do usuário logado. */
export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Informe id" }, { status: 400 });

  const admin = adminClient();
  const { error } = await admin
    .from("mcp_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
