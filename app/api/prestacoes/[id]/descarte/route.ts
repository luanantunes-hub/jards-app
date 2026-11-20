// POST /api/prestacoes/[id]/descarte (P9.5): descarta os dados pessoais da
// prestação depois da guarda.
//
// 1. A prévia roda com a sessão de quem pediu: o banco confere o acesso, o
//    papel (decidir), a decisão final e a guarda vencida, e devolve os
//    arquivos das fotos, dos vídeos e das listas de presença.
// 2. O service role apaga esses arquivos no armazenamento (a política do
//    bucket não deixa ninguém apagar o que foi enviado), só os da pasta desta
//    prestação.
// 3. O descarte roda com a sessão de quem pediu e fica registrado em nome
//    dela. Se os arquivos não saem, nada é descartado no banco e a pessoa
//    tenta de novo; o que já saiu não volta e não atrapalha a nova tentativa.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POR_VEZ = 100;
const ERROS: Record<string, number> = { sem_permissao: 403, prestacao_inexistente: 404, sem_decisao_final: 409, em_guarda: 409, nao_autenticado: 401 };

function erroDoBanco(mensagem: string | undefined) {
  const codigo = Object.keys(ERROS).find(c => (mensagem ?? "").includes(c));
  return codigo ? NextResponse.json({ error: codigo }, { status: ERROS[codigo] }) : null;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- funções novas ainda não estão no tipo Database
  const db = supabase as any;
  const { data: previa, error: erroPrevia } = await db.rpc("fn_prestacao_descarte_previa", { p_prestacao_id: id });
  if (erroPrevia) {
    const resposta = erroDoBanco(erroPrevia.message);
    if (resposta) return resposta;
    console.error("[descarte] prévia falhou", id, erroPrevia.message);
    return NextResponse.json({ error: "descarte_falhou" }, { status: 500 });
  }

  // Só os arquivos da pasta desta prestação; o caminho vem do banco, mas o service role apaga qualquer um.
  const arquivos = ((previa?.arquivos ?? []) as unknown[])
    .filter((p): p is string => typeof p === "string" && p.includes(`/prestacoes/${id}/`));
  if (arquivos.length) {
    const armazenamento = createAdminClient().storage.from("documentos");
    for (let i = 0; i < arquivos.length; i += POR_VEZ) {
      const { error } = await armazenamento.remove(arquivos.slice(i, i + POR_VEZ));
      if (error) {
        console.error("[descarte] arquivos não saíram", id, error.message);
        return NextResponse.json({ error: "arquivos" }, { status: 502 });
      }
    }
  }

  const { data: resultado, error } = await db.rpc("fn_prestacao_descartar_dados_pessoais", { p_prestacao_id: id });
  if (error) {
    const resposta = erroDoBanco(error.message);
    if (resposta) return resposta;
    console.error("[descarte] falhou", id, error.message);
    return NextResponse.json({ error: "descarte_falhou" }, { status: 500 });
  }
  return NextResponse.json(resultado);
}
