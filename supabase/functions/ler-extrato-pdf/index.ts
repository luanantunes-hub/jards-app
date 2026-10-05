// Leitura de extrato bancário em PDF pela IA (P2.2). Devolve a transcrição
// do extrato; quem transforma em lançamentos e confere o saldo é o app
// (lerLeituraDoPdf em lib/prestacao/extrato.ts), e quem grava é a função do
// banco fn_prestacao_extrato_importar.
import { modeloDaIa } from "../_shared/modelo-ia.ts";
import { autorizarArquivoDaPrestacao, corsHeaders, respostaJson } from "../_shared/prestacao-acesso.ts";

const LIMITE_BYTES = 15 * 1024 * 1024;

const PROMPT = `Este PDF é um extrato de conta corrente de banco brasileiro (geralmente do Banco do Brasil), da conta de um projeto incentivado.
Transcreva o extrato. Não calcule nem corrija nada: copie o que está escrito.

- banco, agencia, conta: como aparecem no cabeçalho, ou null.
- periodo_inicio e periodo_fim: o período do extrato em AAAA-MM-DD, ou null.
- saldo_inicial: o "Saldo Anterior" (ou saldo inicial) do começo do período. saldo_final: o saldo do fim do período ("S A L D O", "Saldo final" ou o último saldo). Números com ponto decimal, negativos quando o saldo é devedor (D ou -), ou null.
- lancamentos: cada movimentação da conta, na ordem do extrato:
  - data: a data do lançamento em AAAA-MM-DD (no Banco do Brasil, a coluna "Dt. balancete");
  - historico: o histórico; se houver uma linha de detalhe logo abaixo (favorecido, hora, descrição), junte as duas com " · ";
  - documento: o número do documento como está escrito, ou null;
  - valor: número com ponto decimal, NEGATIVO para débito (D, "-" ou saída) e POSITIVO para crédito (C ou entrada);
  - saldo: o saldo mostrado na mesma linha, com o mesmo sinal, ou null se a linha não mostra saldo.

Não são lançamentos: linhas de saldo ("Saldo Anterior", "Saldo do dia", "S A L D O", "Saldo final"), totais, cabeçalhos, "Lançamentos futuros", agendamentos, bloqueios e linhas sem valor.
Se o PDF não for um extrato bancário, devolva lancamentos vazio.`;

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    banco: { type: "STRING", nullable: true },
    agencia: { type: "STRING", nullable: true },
    conta: { type: "STRING", nullable: true },
    periodo_inicio: { type: "STRING", nullable: true },
    periodo_fim: { type: "STRING", nullable: true },
    saldo_inicial: { type: "NUMBER", nullable: true },
    saldo_final: { type: "NUMBER", nullable: true },
    lancamentos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          data: { type: "STRING" },
          historico: { type: "STRING" },
          documento: { type: "STRING", nullable: true },
          valor: { type: "NUMBER" },
          saldo: { type: "NUMBER", nullable: true },
        },
        required: ["data", "historico", "valor"],
        propertyOrdering: ["data", "historico", "documento", "valor", "saldo"],
      },
    },
  },
  required: ["lancamentos"],
  propertyOrdering: ["banco", "agencia", "conta", "periodo_inicio", "periodo_fim", "saldo_inicial", "saldo_final", "lancamentos"],
};

function emBase64(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { storage_path, prestacao_id } = await req.json() as { storage_path: string; prestacao_id: string };

    // A leitura tem custo e serve para importar: só quem edita a prestação.
    const acesso = await autorizarArquivoDaPrestacao(req, {
      prestacaoId: prestacao_id,
      storagePath: storage_path,
      pastas: ["extratos"],
      exigirEdicao: true,
    });
    if (!acesso.ok) return acesso.resposta;

    const { data: arquivo, error: erroDownload } = await acesso.admin.storage
      .from("documentos")
      .download(storage_path);
    if (erroDownload || !arquivo) return respostaJson({ error: "Arquivo não encontrado" }, 404);
    if (arquivo.size > LIMITE_BYTES) return respostaJson({ error: "pdf_grande_demais" }, 413);

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) return respostaJson({ error: "GOOGLE_AI_API_KEY não configurada" }, 500);
    const modelo = modeloDaIa();

    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: "application/pdf", data: emBase64(new Uint8Array(await arquivo.arrayBuffer())) } },
            ],
          }],
          generationConfig: {
            response_mime_type: "application/json",
            response_schema: ESQUEMA,
          },
        }),
      },
    );
    if (!resposta.ok) {
      console.error("Gemini error:", await resposta.text());
      return respostaJson({ error: "Erro na leitura pela IA" }, 502);
    }

    const corpo = await resposta.json();
    const candidato = corpo?.candidates?.[0];
    // Custo por chamada (P2.10 vai registrar; por enquanto fica no log da função).
    console.log("ler-extrato-pdf", modelo, JSON.stringify(corpo?.usageMetadata ?? {}));
    if (candidato?.finishReason === "MAX_TOKENS") return respostaJson({ error: "extrato_longo_demais" }, 422);

    let extrato: unknown = null;
    try {
      extrato = JSON.parse(candidato?.content?.parts?.[0]?.text ?? "null");
    } catch {
      return respostaJson({ error: "Erro na leitura pela IA" }, 502);
    }
    return respostaJson({ extrato });
  } catch (err) {
    console.error(err);
    return respostaJson({ error: String(err) }, 500);
  }
});
