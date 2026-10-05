// Consulta pública do fornecedor (P2.3): dados do CNPJ na BrasilAPI e
// sanções na consulta consolidada do TCU (inidôneos do TCU, CNIA do CNJ,
// CEIS e CNEP da CGU). Grava o resultado com a chave de serviço, porque o
// navegador não escreve essas colunas (migration 20261006150000).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cnpjValido, lerCertidoesTcu, lerCnpjBrasilApi, limparDocumento } from "../_shared/fornecedor-publico.ts";
import { corsHeaders, respostaJson } from "../_shared/prestacao-acesso.ts";

const CABECALHOS = { Accept: "application/json", "User-Agent": "Jards (prestacao de contas)" };

async function buscar(url: string, ms: number): Promise<Response | null> {
  try {
    return await fetch(url, { headers: CABECALHOS, signal: AbortSignal.timeout(ms) });
  } catch (erro) {
    console.error("consultar-fornecedor", url, String(erro));
    return null;
  }
}

async function jsonOuNulo(resposta: Response | null): Promise<unknown> {
  if (!resposta?.ok || !(resposta.headers.get("content-type") ?? "").includes("json")) return null;
  return await resposta.json().catch(() => null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return respostaJson({ error: "Sem autorização" }, 401);
    const { fornecedor_id } = await req.json() as { fornecedor_id?: unknown };
    if (typeof fornecedor_id !== "string") return respostaJson({ error: "Fornecedor não informado" }, 400);

    // Quem chama precisa ver o fornecedor (políticas do banco, com o token
    // dela) e poder editar na organização dele.
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: fornecedor, error: erroLeitura } = await comoUsuario
      .from("prestacao_fornecedores")
      .select("id, organization_id, tipo_pessoa, documento")
      .eq("id", fornecedor_id)
      .maybeSingle();
    if (erroLeitura) throw erroLeitura;
    if (!fornecedor) return respostaJson({ error: "Fornecedor não encontrado" }, 404);
    const { data: podeEditar, error: erroPapel } = await comoUsuario.rpc("auth_prestacao_org_pode", {
      p_org: fornecedor.organization_id,
      p_acao: "editar",
    });
    if (erroPapel) throw erroPapel;
    if (podeEditar !== true) return respostaJson({ error: "Sem permissão para editar fornecedores" }, 403);

    const cnpj = limparDocumento(fornecedor.documento);
    if (!["pj", "mei"].includes(fornecedor.tipo_pessoa) || !cnpjValido(cnpj)) {
      return respostaJson({ error: "sem_cnpj" }, 422);
    }

    // A consulta do TCU recebe o CNPJ como número: o alfanumérico ainda não passa por ela.
    const numerico = /^\d{14}$/.test(cnpj);
    const [receita, tcu] = await Promise.all([
      buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, 15000),
      numerico ? buscar(`https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/${cnpj}?seEmitirPDF=false`, 20000) : null,
    ]);
    const agora = new Date().toISOString();
    const campos: Record<string, unknown> = {};

    const dadosReceita = await jsonOuNulo(receita);
    if (dadosReceita) {
      Object.assign(campos, lerCnpjBrasilApi(dadosReceita), { cnpj_consultado_em: agora, cnpj_erro: null });
    } else {
      campos.cnpj_erro = receita?.status === 404 ? "CNPJ não encontrado na Receita." : "A consulta da Receita não respondeu; tente de novo.";
      console.error("consultar-fornecedor: BrasilAPI", receita?.status ?? "sem resposta");
    }

    const dadosTcu = await jsonOuNulo(tcu);
    if (dadosTcu) {
      const { certidoes, situacao } = lerCertidoesTcu(dadosTcu);
      Object.assign(campos, { sancoes: certidoes, sancoes_situacao: situacao, sancoes_consultadas_em: agora });
    } else {
      Object.assign(campos, { sancoes: null, sancoes_situacao: "indisponivel", sancoes_consultadas_em: agora });
      console.error("consultar-fornecedor: TCU", numerico ? (tcu?.status ?? "sem resposta") : "CNPJ alfanumérico");
    }

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: atualizado, error: erroGravacao } = await admin
      .from("prestacao_fornecedores")
      .update(campos)
      .eq("id", fornecedor.id)
      .select("*")
      .single();
    if (erroGravacao) throw erroGravacao;
    return respostaJson({ fornecedor: atualizado });
  } catch (err) {
    console.error(err);
    return respostaJson({ error: String(err) }, 500);
  }
});
