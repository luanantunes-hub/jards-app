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

    const prompt = `Este documento é o orçamento de um projeto incentivado (planilha orçamentária, por exemplo a do Salic).
Extraia os itens com valor e retorne APENAS um array JSON, sem markdown, sem explicação:

[
  {
    "nome": <nome do item de despesa, string>,
    "descricao": <especificação ou justificativa, se houver, string ou null>,
    "valor": <valor total aprovado do item, número com ponto decimal, ex: 15000.00>,
    "etapa": <etapa, fase ou produto em que o item aparece no documento (ex.: "Pré-produção", "Divulgação/Comercialização", "Custos administrativos"), string ou null>,
    "grupo_custo": <"execucao"|"administracao"|"divulgacao"|"captacao"|"elaboracao"|"agenciamento"|"gerenciamento"|"colocacao"|"direitos"|"recolhimentos" ou null>
  }
]

Regras:
- Inclua TODOS os itens que tenham valor; ignore linhas de total, subtotal e cabeçalho.
- Se houver colunas como "Valor total", "Valor aprovado", "Orçado" ou "Proposto", use a do valor aprovado; se houver quantidade, ocorrência e valor unitário, use o total da linha.
- Em "etapa", repita exatamente o nome da etapa ou produto do documento, para os itens da mesma etapa ficarem juntos.
- Em "grupo_custo": custos administrativos e taxa de administração = "administracao"; divulgação, comunicação, assessoria de imprensa e acessibilidade comunicacional = "divulgacao"; remuneração de captação = "captacao"; elaboração do projeto = "elaboracao"; agenciamento = "agenciamento"; gerenciamento ou coordenação geral = "gerenciamento"; coordenação e colocação de quotas (audiovisual) = "colocacao"; direitos autorais e conexos = "direitos"; tributos e recolhimentos = "recolhimentos"; demais custos da atividade-fim = "execucao". Use null se não der para saber.
- Retorne array vazio [] se não encontrar nenhum item.`;

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
