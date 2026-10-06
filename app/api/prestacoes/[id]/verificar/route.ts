// POST /api/prestacoes/[id]/verificar (P2.7): roda o motor de checagens
// (lib/prestacao/checagens) e grava os achados em prestacao_verificacoes.
//
// O acesso é conferido com a sessão de quem pediu (a RLS só mostra a
// prestação a quem a acessa). O estado é lido com o service role, para o
// resultado não depender do que cada papel enxerga, e a gravação passa por
// fn_prestacao_verificacoes_sincronizar, que só o service role executa.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executarChecagens } from "@/lib/prestacao/checagens";
import { estadoDaPrestacao } from "@/lib/prestacao/checagens/estado";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
  const { data: visivel } = await (supabase as any).from("prestacoes_contas").select("id").eq("id", id).maybeSingle();
  if (!visivel) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  try {
    const db = createAdminClient();
    const achados = executarChecagens(await estadoDaPrestacao(db, id));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função ainda não está no tipo Database
    const { data: resumo, error: erroSincronizar } = await (db as any).rpc("fn_prestacao_verificacoes_sincronizar", {
      p_prestacao_id: id,
      p_achados: achados.map(a => ({
        chave: a.chave,
        codigo: a.codigo,
        severidade: a.severidade,
        resultado: a.resultado,
        entidade_tipo: a.entidade.tipo,
        entidade_id: a.entidade.id,
        mensagem: a.mensagem,
        fonte: a.fonte,
        dados: a.dados,
        justificativa: a.justificativa,
      })),
    });
    if (erroSincronizar) throw new Error(erroSincronizar.message);
    return NextResponse.json({ ...resumo, achados: achados.length });
  } catch (erro) {
    console.error("[verificar] falhou", id, erro);
    return NextResponse.json({ error: "verificacao_falhou" }, { status: 500 });
  }
}
