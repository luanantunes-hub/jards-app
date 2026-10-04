import { autorizarArquivoDaPrestacao, corsHeaders } from "../_shared/prestacao-acesso.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { storage_path, prestacao_id } = await req.json() as { storage_path: string; prestacao_id: string };

    // Confere quem chama antes de usar a chave de serviço.
    const acesso = await autorizarArquivoDaPrestacao(req, {
      prestacaoId: prestacao_id,
      storagePath: storage_path,
      pastas: ["orcamento"],
    });
    if (!acesso.ok) return acesso.resposta;
    const supabase = acesso.admin;

    // Baixa o PDF do Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documentos")
      .download(storage_path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Arquivo não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_AI_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const model = Deno.env.get("GOOGLE_AI_MODEL") || "gemini-2.5-flash";
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `Este documento é um orçamento de projeto cultural (planilha ou tabela de rubricas).
Extraia todas as rubricas orçamentárias e retorne APENAS um array JSON, sem markdown, sem explicação:

[
  {
    "rubrica": <nome da rubrica/categoria, string>,
    "descricao": <descrição detalhada se houver, string ou null>,
    "valor_aprovado": <valor numérico com ponto decimal, ex: 15000.00>,
    "tolerancia_pct": <percentual de tolerância se informado, número inteiro, default 15>
  }
]

Regras:
- Inclua TODAS as linhas que representem uma rubrica com valor.
- Ignore linhas de total, subtotal ou cabeçalho.
- Se o documento tiver colunas como "Valor Previsto", "Valor Aprovado", "Orçado" ou "Proposto", use esse valor em valor_aprovado.
- Se houver percentual de tolerância ou variação permitida, use em tolerancia_pct; caso contrário use 15.
- Retorne array vazio [] se não encontrar nenhuma rubrica.`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "application/pdf", data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      return new Response(JSON.stringify({ error: "Erro na análise pelo Gemini" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    let itens: unknown[] = [];
    try {
      itens = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) itens = JSON.parse(match[0]);
    }

    return new Response(JSON.stringify({ itens }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
