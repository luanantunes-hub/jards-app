import { autorizarArquivoDaPrestacao, corsHeaders } from "../_shared/prestacao-acesso.ts";

type Rubrica = { id: string; rubrica: string; descricao: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { storage_path, mime_type, prestacao_id } = await req.json() as {
      storage_path: string;
      mime_type: string;
      prestacao_id: string;
    };

    // Confere quem chama antes de usar a chave de serviço.
    const acesso = await autorizarArquivoDaPrestacao(req, {
      prestacaoId: prestacao_id,
      storagePath: storage_path,
      pastas: ["comprovantes"],
    });
    if (!acesso.ok) return acesso.resposta;
    const supabase = acesso.admin;

    // Baixa o arquivo do Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documentos")
      .download(storage_path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Arquivo não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Itens da versão em uso do orçamento em árvore (P1.6), para a IA sugerir
    // o mais adequado. Sem orçamento em árvore, cai nas rubricas antigas.
    const { data: itensData } = await supabase
      .from("prestacao_orcamento_nos")
      .select("id, nome, descricao, versao:prestacao_orcamento_versoes!inner(ativa)")
      .eq("prestacao_id", prestacao_id)
      .eq("tipo", "item")
      .eq("versao.ativa", true)
      .order("ordem");
    let rubricas: Rubrica[] = ((itensData ?? []) as { id: string; nome: string; descricao: string | null }[])
      .map(item => ({ id: item.id, rubrica: item.nome, descricao: item.descricao }));
    if (rubricas.length === 0) {
      const { data: rubricasData } = await supabase
        .from("prestacao_itens")
        .select("id, rubrica, descricao")
        .eq("prestacao_id", prestacao_id)
        .order("ordem");
      rubricas = (rubricasData as Rubrica[]) ?? [];
    }

    // Converte para base64
    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const geminiMime = mime_type || detectMime(storage_path);
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_AI_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preferredModel = Deno.env.get("GOOGLE_AI_MODEL") || "gemini-3.6-flash";

    const rubricasJson = rubricas.length > 0
      ? JSON.stringify(rubricas.map((r, i) => ({ idx: i, id: r.id, rubrica: r.rubrica, descricao: r.descricao })))
      : "[]";

    const prompt = `Você é um especialista em prestação de contas da Lei Rouanet (Lei 8.313/91) e normas do MinC.
Analise este documento fiscal/comprovante e retorne APENAS um JSON, sem markdown, sem explicação.

Rubricas orçamentárias aprovadas neste projeto:
${rubricasJson}

Retorne exatamente neste formato:
{
  "valor": <número decimal com ponto, ex: 1500.00, ou null>,
  "data_doc": <data no formato YYYY-MM-DD, ou null>,
  "tipo_sugerido": <"nfe"|"recibo"|"contrato"|"extrato"|"invoice"|"cartao_embarque"|"print_screenshot"|"folha_pagamento"|"guia_tributo"|"rpa"|"foto"|"planilha"|"outro">,
  "descricao_servico": <descrição do serviço/produto em até 120 caracteres, ou null>,
  "rubrica_sugerida_id": <id UUID da rubrica mais adequada da lista acima, ou null se nenhuma se aplica>,
  "rubrica_confianca": <inteiro de 0 a 100 indicando a confiança na sugestão de rubrica>,
  "risco_glosa": <"baixo"|"medio"|"alto">,
  "motivos_glosa": <array de strings com os motivos de risco, vazio se risco baixo>
}

Regras para risco de glosa:
- ALTO: pagamento em espécie detectado, NF com CNPJ errado, documento ilegível, data fora do comum, RPA sem dados completos, valor muito acima do mercado, documento de origem duvidosa
- MÉDIO: ausência de CNPJ/CPF do prestador, data de emissão suspeita, descrição vaga do serviço, falta assinatura em recibo, NF cancelada ou com rasura visível, valor sem comprovante bancário correspondente
- BAIXO: documento fiscal completo, dados consistentes, valor razoável para o serviço descrito

Exemplos de motivos_glosa: "RPA sem número de CPF do prestador", "Descrição do serviço muito genérica", "Valor acima do praticado no mercado para o serviço", "Data de emissão fora do período de execução", "Ausência de assinatura do recebedor"

Para tipo_sugerido:
- NF-e/NFS-e: "nfe". RPA: "rpa". Extrato bancário: "extrato". Foto/evidência: "foto". Recibo simples: "recibo".`;

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: geminiMime, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        response_mime_type: "application/json",
      },
    });

    const modelCandidates = [...new Set([preferredModel, "gemini-2.5-flash"])];
    let geminiRes: Response | null = null;
    let providerError = "";
    let attemptedModel = preferredModel;

    for (const model of modelCandidates) {
      attemptedModel = model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      if (geminiRes.ok) break;
      providerError = await geminiRes.text();
      console.error(`Gemini error (${model}):`, providerError);
    }

    if (!geminiRes?.ok) {
      let providerMessage = "";
      try {
        const parsed = JSON.parse(providerError);
        providerMessage = parsed?.error?.message ?? "";
      } catch {
        providerMessage = providerError.slice(0, 300);
      }

      return new Response(JSON.stringify({
        error: "Erro na análise pelo Gemini",
        provider_status: geminiRes?.status ?? 502,
        provider_model: attemptedModel,
        provider_message: providerMessage,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
    }

    if (Object.keys(extracted).length === 0) {
      return new Response(JSON.stringify({ error: "A IA não encontrou dados legíveis no documento" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(extracted), {
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

function detectMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    xml: "application/xml",
  };
  return map[ext] ?? "application/octet-stream";
}
