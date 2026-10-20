import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateApiKey, modulosQueAPessoaPodeAutorizar } from "@/lib/mcp/auth";
import { ehModuloMcp, MODULO_PADRAO, MODULOS_MCP, NOME_DO_MODULO, type ModuloMcp } from "@/lib/mcp/modulos";

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
    .select("id,key_prefix,label,scope,modulos,expires_at,created_at,last_used_at,revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Os módulos que a pessoa pode autorizar agora (a tela de conexão só oferece o que ela pode usar).
  const modulosDisponiveis = await modulosQueAPessoaPodeAutorizar(admin, { id: user.id, email: user.email });
  return NextResponse.json({ chaves: data, modulos_disponiveis: modulosDisponiveis });
}

/** Gera uma nova chave. A chave crua só aparece nesta resposta, uma vez. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin0 = adminClient();
  const disponiveis = await modulosQueAPessoaPodeAutorizar(admin0, { id: user.id, email: user.email });
  const assinaturaNecessaria = () =>
    NextResponse.json(
      { error: "Assinatura necessária. O acesso via MCP/ChatGPT está disponível nos planos pagos do Jards.", upgrade_url: "/meu-plano?acao=assinar" },
      { status: 402 }
    );
  if (disponiveis.length === 0) return assinaturaNecessaria();

  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
  const scope = body.scope === "write" ? "write" : "read";

  // Módulos da chave: sem informar, só a captação (como sempre foi). Nunca além dos que a pessoa pode autorizar agora.
  const pedidos: unknown = body.modulos === undefined ? [MODULO_PADRAO] : body.modulos;
  if (!Array.isArray(pedidos) || pedidos.length === 0 || !pedidos.every(ehModuloMcp)) {
    return NextResponse.json({ error: `modulos deve ser uma lista com ${MODULOS_MCP.join(" e/ou ")}.` }, { status: 400 });
  }
  const modulos: ModuloMcp[] = MODULOS_MCP.filter((modulo) => pedidos.includes(modulo));
  if (modulos.includes("captacao") && !disponiveis.includes("captacao")) return assinaturaNecessaria();
  const semAcesso = modulos.filter((modulo) => !disponiveis.includes(modulo));
  if (semAcesso.length > 0) {
    return NextResponse.json({ error: `Você não pode usar o módulo de ${NOME_DO_MODULO[semAcesso[0]]} pelo conector.` }, { status: 403 });
  }

  // Prazo obrigatório, com teto de 1 ano — chave sem validade é o tipo de coisa
  // que fica esquecida ativa para sempre. Padrão 90 dias se nada for informado.
  const expiresInDays = Math.min(Math.max(Number(body.expires_in_days) || 90, 1), 365);
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

  const { raw, hash, prefix } = generateApiKey();
  const admin = adminClient();
  const { data, error } = await admin
    .from("mcp_api_keys")
    .insert({ user_id: user.id, key_hash: hash, key_prefix: prefix, label, scope, modulos, expires_at: expiresAt })
    .select("id,key_prefix,label,scope,modulos,expires_at,created_at")
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
  const agora = new Date().toISOString();
  const { error } = await admin
    .from("mcp_api_keys")
    .update({ revoked_at: agora })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Conexão OAuth (Claude, ChatGPT): sem revogar também o refresh token, o assistente renovaria o
  // acesso sozinho logo depois e "desconectar" não adiantaria nada.
  const { error: refreshError } = await admin
    .from("oauth_refresh_tokens")
    .update({ revoked_at: agora })
    .eq("access_key_id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if (refreshError) return NextResponse.json({ error: refreshError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
