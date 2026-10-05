// Consulta pública do fornecedor (P2.3): dados do CNPJ na BrasilAPI e
// sanções na consulta consolidada do TCU (inidôneos do TCU, CNIA do CNJ,
// CEIS e CNEP da CGU). Grava o resultado com a chave de serviço, porque o
// navegador não escreve essas colunas (migration 20261006150000).
// A cada consulta guarda os comprovantes (P2.3b, migration 20261006160000):
// a certidão do TCU em PDF oficial e o comprovante da consulta à Receita.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import {
  caminhoDocumentoFornecedor,
  cnpjValido,
  lerCertidoesTcu,
  lerCnpjBrasilApi,
  limparDocumento,
  linhasDoComprovante,
  paraWinAnsi,
  pdfDaCertidao,
  type Certidao,
  type LinhaComprovante,
} from "../_shared/fornecedor-publico.ts";
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

async function lerJson(resposta: Response | null): Promise<{ json: unknown; texto: string } | null> {
  if (!resposta?.ok || !(resposta.headers.get("content-type") ?? "").includes("json")) return null;
  const texto = await resposta.text().catch(() => "");
  try {
    return { json: JSON.parse(texto), texto };
  } catch {
    return null;
  }
}

async function sha256(conteudo: Uint8Array | string): Promise<string> {
  const bytes = typeof conteudo === "string" ? new TextEncoder().encode(conteudo) : conteudo;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/** A4 com margem de 50 pt; quebra por largura e abre página nova quando acaba o espaço. */
async function pdfDoComprovante(linhas: LinhaComprovante[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Comprovante de consulta pública do fornecedor");
  doc.setCreator("Jards");
  doc.setProducer("Jards");
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const [largura, altura, margem] = [595.28, 841.89, 50];
  const estilos = {
    titulo: { fonte: negrito, tamanho: 14, antes: 0, cor: rgb(0.05, 0.05, 0.05) },
    secao: { fonte: negrito, tamanho: 10, antes: 14, cor: rgb(0.05, 0.05, 0.05) },
    texto: { fonte: normal, tamanho: 9, antes: 2, cor: rgb(0.15, 0.15, 0.15) },
    nota: { fonte: normal, tamanho: 7.5, antes: 12, cor: rgb(0.4, 0.4, 0.4) },
  };
  let pagina = doc.addPage([largura, altura]);
  let y = altura - margem;
  for (const linha of linhas) {
    const e = estilos[linha.estilo];
    const recuo = (linha.texto.match(/^ */)?.[0].length ?? 0) * 6;
    const util = largura - 2 * margem - recuo;
    const partes: string[] = [];
    let atual = "";
    for (const palavra of paraWinAnsi(linha.texto.trim()).split(/\s+/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && e.fonte.widthOfTextAtSize(tentativa, e.tamanho) > util) {
        partes.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    if (atual) partes.push(atual);
    y -= e.antes;
    for (const parte of partes) {
      if (y - e.tamanho * 1.35 < margem) {
        pagina = doc.addPage([largura, altura]);
        y = altura - margem;
      }
      y -= e.tamanho * 1.35;
      pagina.drawText(parte, { x: margem + recuo, y, size: e.tamanho, font: e.fonte, color: e.cor });
    }
  }
  return await doc.save();
}

type Fornecedor = { id: string; organization_id: string; tipo_pessoa: string; documento: string | null };

/** Sobe o PDF e registra o comprovante; uma falha aqui não derruba a consulta. */
async function guardarComprovante(
  admin: SupabaseClient,
  fornecedor: Fornecedor,
  params: { tipo: "certidao_tcu" | "consulta_receita"; nome: string; bytes: Uint8Array; documento: string; userId: string },
): Promise<unknown> {
  const caminho = caminhoDocumentoFornecedor(fornecedor.organization_id, fornecedor.id, "pdf");
  const { error: erroEnvio } = await admin.storage.from("documentos").upload(caminho, params.bytes, { contentType: "application/pdf", upsert: false });
  if (erroEnvio) {
    console.error("consultar-fornecedor: envio", params.tipo, erroEnvio.message);
    return null;
  }
  const { data, error } = await admin
    .from("prestacao_fornecedor_documentos")
    .insert({
      fornecedor_id: fornecedor.id,
      origem: "consulta",
      tipo: params.tipo,
      nome_arquivo: params.nome,
      storage_path: caminho,
      documento: params.documento,
      hash_sha256: await sha256(params.bytes),
      criado_por: params.userId,
    })
    .select("*")
    .single();
  if (error) {
    console.error("consultar-fornecedor: registro", params.tipo, error.message);
    await admin.storage.from("documentos").remove([caminho]);
    return null;
  }
  return data;
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

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: { user }, error: erroUsuario } = await admin.auth.getUser(token);
    if (erroUsuario || !user) return respostaJson({ error: "Usuário inválido" }, 401);

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
      numerico ? buscar(`https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/${cnpj}?seEmitirPDF=true`, 30000) : null,
    ]);
    const agora = new Date();
    const campos: Record<string, unknown> = {};

    const respostaReceita = await lerJson(receita);
    const dadosReceita = respostaReceita ? lerCnpjBrasilApi(respostaReceita.json) : null;
    if (dadosReceita) {
      Object.assign(campos, dadosReceita, { cnpj_consultado_em: agora.toISOString(), cnpj_erro: null });
    } else {
      campos.cnpj_erro = receita?.status === 404 ? "CNPJ não encontrado na Receita." : "A consulta da Receita não respondeu; tente de novo.";
      console.error("consultar-fornecedor: BrasilAPI", receita?.status ?? "sem resposta");
    }

    const respostaTcu = await lerJson(tcu);
    let certidoes: Certidao[] | null = null;
    if (respostaTcu) {
      const lido = lerCertidoesTcu(respostaTcu.json);
      certidoes = lido.certidoes;
      Object.assign(campos, { sancoes: lido.certidoes, sancoes_situacao: lido.situacao, sancoes_consultadas_em: agora.toISOString() });
    } else {
      Object.assign(campos, { sancoes: null, sancoes_situacao: "indisponivel", sancoes_consultadas_em: agora.toISOString() });
      console.error("consultar-fornecedor: TCU", numerico ? (tcu?.status ?? "sem resposta") : "CNPJ alfanumérico");
    }

    const { data: atualizado, error: erroGravacao } = await admin
      .from("prestacao_fornecedores")
      .update(campos)
      .eq("id", fornecedor.id)
      .select("*")
      .single();
    if (erroGravacao) throw erroGravacao;

    // Comprovantes: a certidão oficial do TCU e o registro do que as fontes devolveram.
    const dia = agora.toISOString().slice(0, 10);
    const documentos: unknown[] = [];
    const certidaoPdf = pdfDaCertidao((respostaTcu?.json as Record<string, unknown> | undefined)?.certidaoPDF);
    if (certidaoPdf) {
      documentos.push(await guardarComprovante(admin, fornecedor, { tipo: "certidao_tcu", nome: `certidao-tcu-${dia}.pdf`, bytes: certidaoPdf, documento: cnpj, userId: user.id }));
    } else if (respostaTcu) {
      console.error("consultar-fornecedor: TCU sem certidão em PDF");
    }
    if (respostaReceita || respostaTcu) {
      const linhas = linhasDoComprovante({
        cnpj,
        consultadoEm: agora,
        dados: dadosReceita,
        certidoes,
        hashRespostas: await sha256(`${respostaReceita?.texto ?? ""}\n${respostaTcu?.texto ?? ""}`),
      });
      documentos.push(await guardarComprovante(admin, fornecedor, { tipo: "consulta_receita", nome: `consulta-publica-${dia}.pdf`, bytes: await pdfDoComprovante(linhas), documento: cnpj, userId: user.id }));
    }

    return respostaJson({ fornecedor: atualizado, documentos: documentos.filter(Boolean) });
  } catch (err) {
    console.error(err);
    return respostaJson({ error: String(err) }, 500);
  }
});
