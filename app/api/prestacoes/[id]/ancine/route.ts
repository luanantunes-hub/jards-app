// GET /api/prestacoes/[id]/ancine (P7.5): os dados públicos do projeto na
// ANCINE, pela consulta de projetos do SAD/SIF (sem login), lidos pelo SALIC
// da prestação. O navegador não busca direto porque o SAD não libera CORS.
//
// O acesso é conferido com a sessão de quem pediu: só quem vê a prestação
// consulta, e só o SALIC dela.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerProjetoDoSad, salicDoSad, URL_DO_SAD } from "@/lib/prestacao/ancine-sad";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
  const { data: prestacao } = await (supabase as any).from("prestacoes_contas").select("id, identificador_oficial").eq("id", id).maybeSingle();
  if (!prestacao) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  const salic = salicDoSad(prestacao.identificador_oficial);
  if (!salic) return NextResponse.json({ error: "salic_invalido" }, { status: 422 });

  const url = `${URL_DO_SAD}${salic}`;
  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store", headers: { "user-agent": "Jards/1.0 (prestacao de contas)" } });
  } catch (erro) {
    console.error("[ancine] SAD não respondeu", salic, erro);
    return NextResponse.json({ error: "ancine_indisponivel" }, { status: 502 });
  }
  // SALIC inexistente: o SAD responde 500 com o erro do servidor dele.
  const html = new TextDecoder("latin1").decode(await resposta.arrayBuffer());
  const projeto = resposta.ok ? lerProjetoDoSad(html) : null;
  if (!projeto) {
    if (resposta.status >= 500 && /NullPointerException|BOException/.test(html)) return NextResponse.json({ error: "salic_nao_encontrado", url }, { status: 404 });
    if (!resposta.ok) return NextResponse.json({ error: "ancine_indisponivel", status: resposta.status }, { status: 502 });
    return NextResponse.json({ error: "salic_nao_encontrado", url }, { status: 404 });
  }
  return NextResponse.json({ projeto, url, consultadoEm: new Date().toISOString() });
}
