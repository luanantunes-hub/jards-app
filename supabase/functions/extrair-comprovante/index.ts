// Leitura de comprovante pela IA (P2.10b). Lê o documento com o regime da
// prestação no prompt e devolve os campos fiscais (emitente, tomador,
// número, chave, retenções) e os motivos, cada um com um código do catálogo
// de checagens; a fonte de cada motivo vem da regra do regime, no app. A IA
// sugere e a pessoa confirma: nada é gravado aqui além do custo da chamada.
// XML de NF-e e NFS-e é lido no app, sem IA (lib/prestacao/documento-fiscal.ts).
import { emBase64, registrarChamadaIa } from "../_shared/chamadas-ia.ts";
import {
  ESQUEMA_DA_LEITURA,
  lerRespostaDaLeitura,
  promptDaLeitura,
  vedadasDoRegimeJson,
  type ContextoDaLeitura,
} from "../_shared/leitura-documento.ts";
import { modeloDaIa } from "../_shared/modelo-ia.ts";
import { autorizarArquivoDaPrestacao, corsHeaders, respostaJson } from "../_shared/prestacao-acesso.ts";

const LIMITE_BYTES = 15 * 1024 * 1024;

/** O que o Gemini lê como arquivo: PDF, imagem e texto (XML e CSV vão como texto). */
function mimeParaLeitura(informado: string | null | undefined, caminho: string): string | null {
  const extensao = caminho.split(".").pop()?.toLowerCase() ?? "";
  const porExtensao: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    heic: "image/heic", heif: "image/heif", xml: "text/plain", csv: "text/plain", txt: "text/plain",
  };
  const mime = (informado || "").toLowerCase();
  if (mime === "application/pdf" || /^image\/(png|jpeg|webp|heic|heif)$/.test(mime)) return mime;
  if (/xml|csv|^text\//.test(mime)) return "text/plain";
  return porExtensao[extensao] ?? null;
}

type Item = { id: string; nome: string; descricao: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { storage_path, mime_type, prestacao_id } = await req.json() as {
      storage_path: string;
      mime_type?: string;
      prestacao_id: string;
    };

    // A leitura tem custo e serve para cadastrar a despesa: só quem edita.
    const acesso = await autorizarArquivoDaPrestacao(req, {
      prestacaoId: prestacao_id,
      storagePath: storage_path,
      pastas: ["comprovantes"],
      exigirEdicao: true,
    });
    if (!acesso.ok) return acesso.resposta;
    const admin = acesso.admin;

    const mime = mimeParaLeitura(mime_type, storage_path);
    if (!mime) return respostaJson({ error: "Este tipo de arquivo não é lido pela IA; preencha os campos à mão." }, 415);

    const { data: arquivo, error: erroDownload } = await admin.storage.from("documentos").download(storage_path);
    if (erroDownload || !arquivo) return respostaJson({ error: "Arquivo não encontrado" }, 404);
    if (arquivo.size > LIMITE_BYTES) return respostaJson({ error: "Arquivo grande demais para a leitura (até 15 MB)." }, 413);

    // Contexto: regime, proponente, número do projeto, período e itens do orçamento em uso.
    const { data: prestacao, error: erroPrestacao } = await admin
      .from("prestacoes_contas")
      .select("identificador_oficial, identificador_tipo, data_inicio_execucao, data_fim_execucao, regime:prestacao_regimes(nome, parametros), proponente:proponentes(nome, cnpj)")
      .eq("id", prestacao_id)
      .maybeSingle();
    if (erroPrestacao) throw erroPrestacao;
    const p = (prestacao ?? {}) as {
      identificador_oficial?: string | null;
      identificador_tipo?: string | null;
      data_inicio_execucao?: string | null;
      data_fim_execucao?: string | null;
      regime?: { nome: string; parametros: unknown } | null;
      proponente?: { nome: string | null; cnpj: string | null } | null;
    };

    const { data: nos } = await admin
      .from("prestacao_orcamento_nos")
      .select("id, nome, descricao, versao:prestacao_orcamento_versoes!inner(ativa)")
      .eq("prestacao_id", prestacao_id)
      .eq("tipo", "item")
      .eq("versao.ativa", true)
      .order("ordem");
    const itens: Item[] = ((nos ?? []) as Item[]).map(n => ({ id: n.id, nome: n.nome, descricao: n.descricao }));

    const contexto: ContextoDaLeitura = {
      regime: p.regime ?? null,
      identificador: p.identificador_oficial ? { valor: p.identificador_oficial, tipo: p.identificador_tipo ?? null } : null,
      proponente: p.proponente ? { nome: p.proponente.nome, documento: p.proponente.cnpj } : null,
      periodo: { inicio: p.data_inicio_execucao ?? null, fim: p.data_fim_execucao ?? null },
      itens: itens.slice(0, 400),
    };

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) return respostaJson({ error: "GOOGLE_AI_API_KEY não configurada" }, 500);
    const modelo = modeloDaIa();
    const registro = {
      funcao: "extrair-comprovante" as const,
      organizationId: acesso.caminho.organizationId,
      prestacaoId: prestacao_id,
      userId: acesso.userId,
      modelo,
      arquivo: storage_path,
      tamanhoBytes: arquivo.size,
      inicio: Date.now(),
    };

    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptDaLeitura(contexto) },
              { inline_data: { mime_type: mime, data: emBase64(new Uint8Array(await arquivo.arrayBuffer())) } },
            ],
          }],
          generationConfig: {
            response_mime_type: "application/json",
            response_schema: ESQUEMA_DA_LEITURA,
          },
        }),
      },
    );

    if (!resposta.ok) {
      const textoErro = await resposta.text();
      console.error(`Gemini error (${modelo}):`, textoErro);
      let mensagem = "";
      try {
        mensagem = JSON.parse(textoErro)?.error?.message ?? "";
      } catch {
        mensagem = textoErro.slice(0, 300);
      }
      await registrarChamadaIa(admin, { ...registro, corpo: null, sucesso: false, erro: `HTTP ${resposta.status}: ${mensagem}` });
      return respostaJson({ error: "Erro na leitura pela IA", provider_status: resposta.status, provider_model: modelo, provider_message: mensagem }, 502);
    }

    const corpo = await resposta.json();
    const candidato = corpo?.candidates?.[0];
    let bruta: unknown = null;
    try {
      bruta = JSON.parse(candidato?.content?.parts?.[0]?.text ?? "null");
    } catch {
      bruta = null;
    }
    await registrarChamadaIa(admin, {
      ...registro,
      corpo,
      sucesso: bruta !== null,
      erro: bruta === null ? `resposta sem JSON (${candidato?.finishReason ?? "sem candidato"})` : null,
    });
    if (bruta === null) return respostaJson({ error: "A IA não devolveu uma leitura do documento" }, 502);

    const leitura = lerRespostaDaLeitura(
      bruta,
      contexto.itens.map(i => i.id),
      vedadasDoRegimeJson(contexto.regime?.parametros).map(v => v.codigo),
    );
    return respostaJson({ leitura, modelo });
  } catch (err) {
    console.error(err);
    return respostaJson({ error: String(err) }, 500);
  }
});
