// Coleta das páginas e arquivos dos órgãos (P6.1), o modo "paginas" da função.
//
// Cada fonte vencida (ativa, do tipo pagina ou arquivo, coletada há mais dias
// que a frequência dela) é baixada e lida por _shared/vigia-paginas.ts. Se o
// hash mudou, a versão nova vai para normas_documentos, ligada à anterior, e
// a cópia do que foi baixado vai para o bucket normas. A primeira coleta (ou a
// que segue uma troca de recorte) é a referência e não pede conferência.
//
// Uma fonte que falha fica vencida e é tentada de novo no dia seguinte; na
// terceira falha seguida, entra no aviso ao super admin.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";
import {
  aplicarRecorte,
  conteudoDoHtml,
  conteudoDoVolto,
  conteudoParaHash,
  decodificarBytes,
  ehParteComTexto,
  formatoDoArquivo,
  normalizarTexto,
  resumoDaMudanca,
  sha256Hex,
  TEXTO_MAXIMO_PAGINA,
  textoDoXmlOffice,
  urlDaApiVolto,
  type ArquivoLigado,
  type ConteudoDaPagina,
  type Recorte,
} from "../_shared/vigia-paginas.ts";

// O cliente que createClient devolve, com a chave de serviço e sem os tipos do banco.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sem os tipos do banco na função
export type Cliente = SupabaseClient<any, "public", "public", any, any>;

export type FonteVigiada = {
  id: string;
  nome: string;
  tipo: "pagina" | "arquivo";
  url: string;
  orgao: string | null;
  configuracao: { recorte?: Recorte | null } | null;
  ultimo_hash: string | null;
  falhas_seguidas: number;
  frequencia_dias: number;
  ultima_coleta_em: string | null;
};

export const CAMPOS_DA_FONTE = "id, nome, tipo, url, orgao, configuracao, ultimo_hash, falhas_seguidas, frequencia_dias, ultima_coleta_em";

const TAMANHO_MAXIMO = 40 * 1024 * 1024;
const NAVEGADOR = "Mozilla/5.0 (compatible; JardsVigiaNormativo/1.0; +https://jards.com.br)";
const FALHAS_PARA_AVISAR = 3;

const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Repete o passo quando a rede ou o servidor falham, com espera de 3 e 8 segundos. */
async function comTentativas<T>(passo: () => Promise<T>): Promise<T> {
  const esperas = [3_000, 8_000];
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await passo();
    } catch (falha) {
      if (tentativa >= esperas.length) throw falha;
      await esperar(esperas[tentativa]);
    }
  }
}

type Resposta = { status: number; bytes: Uint8Array; contentType: string | null; modificadoEm: string | null };

/** Erro de rede ou 5xx é lançado (para tentar de novo); 4xx volta como resposta. */
async function buscar(url: string, aceitar: string): Promise<Resposta> {
  const resposta = await fetch(url, {
    headers: { "User-Agent": NAVEGADOR, Accept: aceitar },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (resposta.status >= 500) {
    await resposta.body?.cancel();
    throw new Error(`${new URL(url).hostname} respondeu ${resposta.status}`);
  }
  if (resposta.status !== 200) {
    await resposta.body?.cancel();
    return { status: resposta.status, bytes: new Uint8Array(), contentType: null, modificadoEm: null };
  }
  const declarado = Number(resposta.headers.get("content-length") ?? 0);
  if (declarado > TAMANHO_MAXIMO) {
    await resposta.body?.cancel();
    throw new Error(`arquivo de ${Math.round(declarado / 1048576)} MB, acima de 40 MB`);
  }
  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.length > TAMANHO_MAXIMO) throw new Error(`arquivo de ${Math.round(bytes.length / 1048576)} MB, acima de 40 MB`);
  return { status: 200, bytes, contentType: resposta.headers.get("content-type"), modificadoEm: resposta.headers.get("last-modified") };
}

async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@1.8.1");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return normalizarTexto((text as string[]).join("\n"));
}

function textoDoOffice(bytes: Uint8Array, formato: ConteudoDaPagina["formato"]): string {
  const partes = unzipSync(bytes, { filter: arquivo => ehParteComTexto(formato, arquivo.name) });
  const decodificador = new TextDecoder("utf-8");
  return normalizarTexto(Object.keys(partes).sort().map(nome => textoDoXmlOffice(decodificador.decode(partes[nome]))).join("\n"));
}

const EXTENSAO: Record<ConteudoDaPagina["formato"], string> = {
  volto: "json", html: "html", pdf: "pdf", docx: "docx", xlsx: "xlsx", odt: "odt", ods: "ods", arquivo: "bin",
};

const TIPO_DA_COPIA: Record<ConteudoDaPagina["formato"], string> = {
  volto: "application/json",
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  arquivo: "application/octet-stream",
};

type Lida = { conteudo: ConteudoDaPagina; copia: Uint8Array; hash: string };

/**
 * Baixa e lê a fonte. Página do gov.br em Volto é lida pela API; só um 404 ou
 * uma resposta que não é página do Volto levam ao HTML (uma falha de rede não
 * pode trocar o formato e parecer mudança).
 */
export async function lerFonte(fonte: FonteVigiada): Promise<Lida> {
  const api = fonte.tipo === "pagina" ? urlDaApiVolto(fonte.url) : null;
  if (api) {
    const r = await comTentativas(() => buscar(api, "application/json"));
    if (r.status === 200 && (r.contentType ?? "").includes("json")) {
      const lido = conteudoDoVolto(JSON.parse(new TextDecoder("utf-8").decode(r.bytes)), fonte.url);
      if (lido) {
        const conteudo: ConteudoDaPagina = { formato: "volto", ...lido };
        return { conteudo, copia: r.bytes, hash: "" };
      }
    } else if (r.status !== 200 && r.status !== 404) {
      throw new Error(`a API do gov.br respondeu ${r.status}`);
    }
  }

  const r = await comTentativas(() => buscar(fonte.url, "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8"));
  if (r.status !== 200) throw new Error(`o endereço respondeu ${r.status}`);
  const formato = formatoDoArquivo(fonte.url, r.contentType);
  if (formato === "html") {
    return { conteudo: { formato, ...conteudoDoHtml(decodificarBytes(r.bytes, r.contentType), fonte.url) }, copia: r.bytes, hash: "" };
  }
  const texto = formato === "pdf"
    ? await textoDoPdf(r.bytes)
    : formato === "arquivo" ? "" : textoDoOffice(r.bytes, formato);
  // Arquivo compara pelos bytes: um PDF trocado com o mesmo texto também é mudança.
  return {
    conteudo: { formato, titulo: null, texto, arquivos: [], atualizadoEm: r.modificadoEm },
    copia: r.bytes,
    hash: await sha256Hex(r.bytes),
  };
}

export type ResultadoDaFonte = {
  fonte: string;
  situacao: "igual" | "nova" | "referencia" | "repetida" | "falhou";
  motivos?: string[];
  erro?: string;
};

async function coletarFonte(admin: Cliente, fonte: FonteVigiada, execucaoId: string, hoje: string): Promise<ResultadoDaFonte> {
  const lida = await lerFonte(fonte);
  const recorte = aplicarRecorte(lida.conteudo.texto, fonte.configuracao?.recorte);
  if (!recorte.achou) throw new Error(`o início do recorte ("${fonte.configuracao?.recorte?.de}") não está mais no texto`);
  const texto = recorte.texto;
  if (texto.length > TEXTO_MAXIMO_PAGINA) {
    throw new Error(`o texto tem ${texto.length.toLocaleString("pt-BR")} caracteres, acima de 1 milhão: use um recorte`);
  }
  const arquivos: ArquivoLigado[] = lida.conteudo.arquivos;
  const hash = lida.hash || await sha256Hex(conteudoParaHash({ texto, arquivos }));
  const agora = new Date().toISOString();

  if (hash === fonte.ultimo_hash) {
    await admin.from("normas_fontes").update({ ultima_coleta_em: agora, falhas_seguidas: 0, ultimo_erro: null }).eq("id", fonte.id);
    return { fonte: fonte.nome, situacao: "igual" };
  }

  const { data: anterior } = await admin.from("normas_documentos")
    .select("id, texto, arquivos")
    .eq("fonte_id", fonte.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const referencia = fonte.ultimo_hash === null;
  const depois = { texto, arquivos };
  const mudanca = resumoDaMudanca(referencia || !anterior ? null : { texto: anterior.texto, arquivos: anterior.arquivos ?? [] }, depois);
  const resumo = mudanca.resumo;
  const motivos = referencia && anterior
    ? [mudanca.motivos[0].replace("primeira coleta", "nova referência depois da troca do recorte"), ...mudanca.motivos.slice(1)]
    : mudanca.motivos;
  if (lida.conteudo.formato === "arquivo") motivos.push("arquivo sem texto legível: compare a cópia guardada");

  const extensao = EXTENSAO[lida.conteudo.formato];
  const caminho = `${fonte.id}/${hoje}-${hash.slice(0, 12)}.${extensao}`;
  const { data: gravados, error } = await admin.from("normas_documentos")
    .upsert({
      fonte_id: fonte.id,
      chave: `fonte:${fonte.id}:${hash}`,
      publicado_em: hoje,
      orgao: fonte.orgao ?? "Órgão não informado",
      tipo_ato: fonte.tipo === "pagina" ? "Página" : "Arquivo",
      titulo: fonte.nome.slice(0, 500),
      ementa: resumo,
      texto,
      url: fonte.url,
      motivos,
      hash,
      situacao: referencia ? "referencia" : "novo",
      formato: lida.conteudo.formato,
      arquivo: caminho,
      arquivos,
      anterior_id: anterior?.id ?? null,
      execucao_id: execucaoId,
      atualizado_na_fonte: lida.conteudo.atualizadoEm?.slice(0, 100) ?? null,
    }, { onConflict: "chave", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`não foi possível guardar a versão (${error.message})`);

  const nova = gravados?.[0]?.id as string | undefined;
  if (nova) {
    const { error: erroCopia } = await admin.storage.from("normas")
      .upload(caminho, lida.copia, { contentType: TIPO_DA_COPIA[lida.conteudo.formato], upsert: true });
    if (erroCopia) {
      console.error("agente-normativo: cópia", fonte.nome, erroCopia.message);
      await admin.from("normas_documentos").update({ arquivo: null }).eq("id", nova);
    }
  }
  await admin.from("normas_fontes").update({
    ultimo_hash: hash,
    ultima_coleta_em: agora,
    ...(referencia ? {} : { ultima_mudanca_em: agora }),
    falhas_seguidas: 0,
    ultimo_erro: null,
  }).eq("id", fonte.id);

  // A página voltou a uma versão já guardada: nada novo para conferir.
  if (!nova) return { fonte: fonte.nome, situacao: "repetida" };
  return { fonte: fonte.nome, situacao: referencia ? "referencia" : "nova", motivos };
}

export type ResumoDaColeta = {
  lidos: number;
  rotina: number;
  relevantes: number;
  novos: number;
  semResposta: string[];
  detalhe: string | null;
  todasFalharam: boolean;
  resultados: ResultadoDaFonte[];
};

/** Coleta as fontes em ordem, sem começar outra depois de `prazoMs`. */
export async function coletarFontes(
  admin: Cliente, fontes: FonteVigiada[], execucaoId: string, hoje: string, prazoMs: number,
): Promise<ResumoDaColeta> {
  const inicio = Date.now();
  const resultados: ResultadoDaFonte[] = [];
  const semResposta: string[] = [];
  for (const fonte of fontes) {
    if (Date.now() - inicio > prazoMs) break;
    try {
      resultados.push(await coletarFonte(admin, fonte, execucaoId, hoje));
    } catch (falha) {
      const erro = (falha instanceof Error ? falha.message : String(falha)).slice(0, 1000);
      const falhas = fonte.falhas_seguidas + 1;
      await admin.from("normas_fontes").update({ falhas_seguidas: falhas, ultimo_erro: erro }).eq("id", fonte.id);
      if (falhas === FALHAS_PARA_AVISAR) semResposta.push(fonte.nome);
      resultados.push({ fonte: fonte.nome, situacao: "falhou", erro });
      console.error("agente-normativo: fonte", fonte.nome, erro);
    }
  }
  const falharam = resultados.filter(r => r.situacao === "falhou");
  const pendentes = fontes.length - resultados.length;
  const detalhe = [
    falharam.length ? `Sem resposta: ${falharam.map(r => `${r.fonte} (${r.erro})`).join("; ")}` : "",
    pendentes ? `${pendentes} ${pendentes === 1 ? "fonte ficou" : "fontes ficaram"} para a próxima coleta.` : "",
  ].filter(Boolean).join(" ").slice(0, 2000) || null;
  return {
    lidos: resultados.length,
    rotina: resultados.filter(r => r.situacao === "igual" || r.situacao === "repetida").length,
    relevantes: resultados.filter(r => r.situacao === "nova" || r.situacao === "referencia").length,
    novos: resultados.filter(r => r.situacao === "nova").length,
    semResposta,
    detalhe,
    todasFalharam: resultados.length > 0 && falharam.length === resultados.length,
    resultados,
  };
}

/** Fontes de página e arquivo ativas cuja última coleta passou da frequência. */
export function fonteVencida(fonte: Pick<FonteVigiada, "ultima_coleta_em" | "frequencia_dias">, agora = Date.now()): boolean {
  if (!fonte.ultima_coleta_em) return true;
  // Duas horas de folga: a rotina roda no mesmo horário todo dia.
  return agora - Date.parse(fonte.ultima_coleta_em) >= fonte.frequencia_dias * 86_400_000 - 2 * 3_600_000;
}
