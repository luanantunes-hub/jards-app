// Ajuda do app (o botão "?"): responde perguntas sobre o uso do Jards com o Gemini, usando só o guia do Jards.
//
// A IA não recebe dado de cliente, de organização nem de pessoa: só a pergunta, as últimas trocas da conversa, o caminho
// da tela (sem ids) e o guia (guia.ts). Cada pergunta fica em suporte_perguntas, com o custo, para a equipe melhorar o
// guia e vigiar o gasto. A escrita usa a chave de serviço; quem chama precisa estar logado (verify_jwt) e tem limite por
// minuto e por dia (suporte-regras.ts).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { custoDaChamada, usoDaResposta } from "../_shared/leitura-documento.ts";
import { modeloDaIa } from "../_shared/modelo-ia.ts";
import {
  decidirLimite,
  lerPedido,
  limparResposta,
  montarPedidoDaIa,
  type PedidoDeAjuda,
} from "../_shared/suporte-regras.ts";
import { GUIA_DO_JARDS } from "./guia.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const MENSAGEM_DE_FALHA = "Não consegui responder agora. Tente de novo ou fale com a equipe.";

/** Quantas perguntas a pessoa fez desde `janelaMs` atrás; null quando o banco não respondeu (falha fechada). */
async function contarPerguntas(admin: SupabaseClient, userId: string, janelaMs: number): Promise<number | null> {
  const { count, error } = await admin
    .from("suporte_perguntas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - janelaMs).toISOString());
  if (error) {
    console.error("suporte-assistente: contagem de perguntas:", error.message);
    return null;
  }
  return count ?? 0;
}

function mensagemDoErro(texto: string): string {
  try {
    return String(JSON.parse(texto)?.error?.message ?? "").slice(0, 300);
  } catch {
    return texto.slice(0, 300);
  }
}

type RespostaDaIa = { ok: true; texto: string; corpo: unknown } | { ok: false; erro: string; corpo: unknown };

async function perguntarAoGemini(apiKey: string, modelo: string, pedido: PedidoDeAjuda): Promise<RespostaDaIa> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
  // O raciocínio do Gemini conta como saída: o teto deixa folga para ele e para uma resposta curta.
  const corpoDoPedido = JSON.stringify({
    ...montarPedidoDaIa({ guia: GUIA_DO_JARDS, pedido }),
    generationConfig: { maxOutputTokens: 2000 },
  });
  let ultimoErro = "sem resposta";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: corpoDoPedido,
        signal: AbortSignal.timeout(25_000),
      });
      if (resposta.ok) {
        const dados = await resposta.json();
        const candidato = dados?.candidates?.[0];
        const partes: { text?: string; thought?: boolean }[] = candidato?.content?.parts ?? [];
        const texto = partes.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
        if (texto.trim()) return { ok: true, texto, corpo: dados };
        return { ok: false, erro: `resposta vazia (${candidato?.finishReason ?? "sem candidato"})`, corpo: dados };
      }
      ultimoErro = `HTTP ${resposta.status}: ${mensagemDoErro(await resposta.text())}`;
      // Só excesso de pedidos e erro do lado do Google merecem uma segunda tentativa.
      if (resposta.status !== 429 && resposta.status < 500) return { ok: false, erro: ultimoErro, corpo: null };
    } catch (erro) {
      ultimoErro = String(erro).slice(0, 200);
    }
    await new Promise((resolver) => setTimeout(resolver, 1_500));
  }
  return { ok: false, erro: ultimoErro, corpo: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Entre na sua conta para perguntar." }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: erroDeAutenticacao } = await admin.auth.getUser(token);
  if (erroDeAutenticacao || !user) return json({ error: "Sessão inválida. Entre de novo." }, 401);

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  const lido = lerPedido(corpo);
  if (!lido.ok) return json({ error: lido.erro }, 400);

  const [noMinuto, noDia] = await Promise.all([
    contarPerguntas(admin, user.id, 60_000),
    contarPerguntas(admin, user.id, 86_400_000),
  ]);
  if (noMinuto === null || noDia === null) return json({ error: MENSAGEM_DE_FALHA, escalar: true }, 503);
  const limite = decidirLimite(noMinuto, noDia);
  if (!limite.permitido) return json({ error: limite.motivo, escalar: true }, 429);

  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) {
    console.error("suporte-assistente: GOOGLE_AI_API_KEY não configurada");
    return json({ error: MENSAGEM_DE_FALHA, escalar: true }, 503);
  }

  const inicio = Date.now();
  const modelo = modeloDaIa();
  const { pedido } = lido;
  const resultado = await perguntarAoGemini(apiKey, modelo, pedido);
  const uso = usoDaResposta(resultado.corpo);
  const limpa = resultado.ok ? limparResposta(resultado.texto) : null;

  // Só para registro (organização e custo): o guia e a resposta não dependem disso.
  const { data: vinculo } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { error: erroDoRegistro } = await admin.from("suporte_perguntas").insert({
    user_id: user.id,
    organization_id: vinculo?.organization_id ?? null,
    pergunta: pedido.pergunta,
    resposta: limpa?.resposta ?? null,
    escalou: limpa?.escalar ?? false,
    pagina: pedido.pagina || null,
    modelo,
    tokens_entrada: uso.entrada,
    tokens_saida: uso.saida,
    custo_usd: custoDaChamada(Deno.env.get("GOOGLE_AI_PRECOS"), modelo, uso),
    duracao_ms: Math.max(Date.now() - inicio, 0),
    sucesso: resultado.ok,
    erro: resultado.ok ? null : resultado.erro.slice(0, 500),
  });
  if (erroDoRegistro) console.error("suporte-assistente: registro da pergunta:", erroDoRegistro.message);

  if (!limpa || !limpa.resposta) {
    if (!resultado.ok) console.error(`suporte-assistente: Gemini (${modelo}):`, resultado.erro);
    return json({ error: MENSAGEM_DE_FALHA, escalar: true }, 502);
  }
  return json({ resposta: limpa.resposta, escalar: limpa.escalar });
});
