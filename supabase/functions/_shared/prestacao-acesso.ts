// Autorização das edge functions que leem arquivos da prestação de contas.
//
// As funções baixam o arquivo com a chave de serviço, que ignora as políticas
// do banco e do storage. Por isso, antes do download, conferimos aqui:
// 1. o token de quem chama;
// 2. que o arquivo está na pasta desta prestação, no formato de prestacao-caminho.ts;
// 3. que a pessoa é membro da organização da primeira pasta;
// 4. que a pessoa acessa a prestação, pela própria função do banco
//    (can_access_prestacao, chamada com o token dela);
// 5. que a pasta é da organização dona da prestação;
// 6. quando a função grava ou gasta uma leitura em nome de quem edita
//    (extrato em PDF), que o papel da pessoa permite editar a prestação
//    (auth_prestacao_pode, também com o token dela).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ehUuid,
  lerCaminhoPrestacao,
  organizacaoDaPrestacao,
  SELECT_ORGANIZACAO_DA_PRESTACAO,
  type CaminhoPrestacao,
  type PastaPrestacao,
} from "./prestacao-caminho.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Autorizado = { ok: true; admin: SupabaseClient; userId: string; caminho: CaminhoPrestacao };
type Negado = { ok: false; resposta: Response };

function negar(status: number, error: string): Negado {
  return { ok: false, resposta: respostaJson({ error }, status) };
}

export async function autorizarArquivoDaPrestacao(
  req: Request,
  params: { prestacaoId: unknown; storagePath: unknown; pastas: PastaPrestacao["tipo"][]; exigirEdicao?: boolean },
): Promise<Autorizado | Negado> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return negar(401, "Sem autorização");

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErro } = await admin.auth.getUser(token);
  if (authErro || !user) return negar(401, "Usuário inválido");

  const { prestacaoId, storagePath, pastas } = params;
  if (!ehUuid(prestacaoId)) return negar(400, "Prestação não informada");

  const caminho = lerCaminhoPrestacao(storagePath);
  if (
    !caminho ||
    caminho.prestacaoId.toLowerCase() !== prestacaoId.toLowerCase() ||
    !pastas.includes(caminho.pasta.tipo)
  ) {
    return negar(403, "Arquivo fora da pasta desta prestação");
  }

  const { data: membro, error: membroErro } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", caminho.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membroErro) throw membroErro;
  if (!membro) return negar(403, "Sem acesso a esta organização");

  const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: podeAcessar, error: acessoErro } = await comoUsuario.rpc("can_access_prestacao", {
    target_prestacao_id: prestacaoId,
  });
  if (acessoErro) throw acessoErro;
  if (podeAcessar !== true) return negar(403, "Sem acesso a esta prestação");

  if (params.exigirEdicao) {
    const { data: podeEditar, error: edicaoErro } = await comoUsuario.rpc("auth_prestacao_pode", {
      p_prestacao_id: prestacaoId,
      p_acao: "editar",
    });
    if (edicaoErro) throw edicaoErro;
    if (podeEditar !== true) return negar(403, "Sem permissão para editar esta prestação");
  }

  const { data: prestacao, error: prestacaoErro } = await admin
    .from("prestacoes_contas")
    .select(SELECT_ORGANIZACAO_DA_PRESTACAO)
    .eq("id", prestacaoId)
    .maybeSingle();
  if (prestacaoErro) throw prestacaoErro;
  const dona = organizacaoDaPrestacao(prestacao);
  if (dona && dona.toLowerCase() !== caminho.organizationId.toLowerCase()) {
    return negar(403, "Arquivo em pasta de outra organização");
  }

  return { ok: true, admin, userId: user.id, caminho };
}
