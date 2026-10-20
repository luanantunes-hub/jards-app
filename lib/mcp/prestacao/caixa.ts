import { createHash, randomBytes, randomUUID } from "crypto";
import type { Admin } from "@/lib/mcp/crm";
import { impressaoDigital, LIMITE_ARQUIVO_BYTES, tipoPeloConteudo, type TipoReal } from "@/lib/mcp/prestacao/arquivos";
import type { QuemGrava } from "@/lib/mcp/prestacao/gravacao";
import { ACEITO_PELO_NOME, FRASE_ACEITA, MAX_ARQUIVOS_POR_ENVIO, type DestinoDeEnvio } from "@/lib/mcp/prestacao/tipos-de-envio";
import { ErroMcp, erroDoBanco } from "@/lib/mcp/validacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { lerDocumentoFiscal } from "@/lib/prestacao/documento-fiscal";

/**
 * A caixa de entrada dos arquivos que chegam pelo chat (assistente_arquivos). O arquivo entra aqui, conferido pelo que ele
 * é de verdade (pelos bytes, não pelo nome) e guardado no Storage no lugar final; só vira despesa ou evidência quando o
 * assistente registra. O que ninguém registra sai depois de 7 dias.
 */

export type Destino = DestinoDeEnvio;
/** Por onde o arquivo chegou à caixa: anexo do ChatGPT, endereço de envio, página de envio ou texto colado no chat. */
export const ORIGENS_DA_CAIXA = ["chatgpt", "url_assinada", "pagina", "texto"] as const;
export type Origem = (typeof ORIGENS_DA_CAIXA)[number];

/** O endereço de envio do Storage vale 2 horas (prazo fixo do Storage); o arquivo que chegou fica 7 dias na caixa à espera do registro. */
export const VALIDADE_DO_ENDERECO_MS = 2 * 60 * 60 * 1000;
export const VALIDADE_DA_CAIXA_MS = 7 * 24 * 60 * 60 * 1000;
export { MAX_ARQUIVOS_POR_ENVIO };

const TIPOS_ACEITOS: Record<Destino, readonly TipoReal[]> = {
  despesa: ["pdf", "xml", "png", "jpeg", "webp", "heic"],
  evidencia: ["pdf", "png", "jpeg", "gif", "webp", "heic"],
};
const EXTENSAO: Partial<Record<TipoReal, string>> = { pdf: "pdf", xml: "xml", png: "png", jpeg: "jpg", gif: "gif", webp: "webp", heic: "heic" };
const CONTENT_TYPE: Partial<Record<TipoReal, string>> = {
  pdf: "application/pdf",
  xml: "application/xml",
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
};

const frase = (destino: Destino) => FRASE_ACEITA[destino];

export const COLUNAS_DA_CAIXA = "id,prestacao_id,origem,destino,situacao,nome_arquivo,tipo_real,tamanho_bytes,sha256,storage_path,registro_tabela,registro_id,detalhe,expira_em,created_at";

export interface LinhaDaCaixa {
  id: string;
  prestacao_id: string;
  origem: Origem;
  destino: Destino;
  situacao: "aguardando" | "recebido" | "registrado" | "descartado";
  nome_arquivo: string;
  tipo_real: string | null;
  tamanho_bytes: number | string | null;
  sha256: string | null;
  storage_path: string;
  registro_tabela: string | null;
  registro_id: string | null;
  detalhe: string | null;
  expira_em: string;
  created_at: string;
}

/** O arquivo como o assistente vê: nunca o caminho no Storage. */
export function visaoDaCaixa(linha: LinhaDaCaixa) {
  return {
    arquivo_id: linha.id,
    nome: linha.nome_arquivo,
    destino: linha.destino,
    situacao: linha.situacao,
    tipo: linha.tipo_real,
    tamanho_bytes: linha.tamanho_bytes === null ? null : Number(linha.tamanho_bytes),
    origem: linha.origem,
    registrado_em: linha.registro_id ? { tabela: linha.registro_tabela, id: linha.registro_id } : null,
    detalhe: linha.detalhe,
    expira_em: linha.expira_em,
  };
}

/** Nome para exibir: sem pasta, sem caracteres de controle, até 300 letras. */
export function nomeLimpo(nome: unknown): string {
  const texto = typeof nome === "string" ? nome : "";
  const limpo = texto
    .replace(/[\\/]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return limpo || "arquivo";
}

/**
 * Na despesa, um XML só entra se for mesmo uma nota (NF-e, NFC-e ou NFS-e). A leitura pelo conteúdo chama de XML qualquer
 * texto que começa com uma tag, inclusive uma página HTML: aqui o que não é nota fiscal é recusado, com o motivo.
 */
function motivoDoXmlRecusado(destino: Destino, tipo: TipoReal, bytes: Buffer): string | null {
  if (destino !== "despesa" || tipo !== "xml") return null;
  const leitura = lerDocumentoFiscal(bytes.toString("utf8"));
  return leitura.ok ? null : leitura.motivo;
}

const pastaDoDestino = (destino: Destino) => ({ tipo: destino === "despesa" ? ("comprovantes" as const) : ("evidencias" as const) });

/** Para onde vai o arquivo no Storage, e a pasta e o nome para procurá-lo depois. */
function caminhoDoArquivo(organizationId: string, prestacaoId: string, destino: Destino, extensao: string, arquivoId: string) {
  const caminho = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: pastaDoDestino(destino), nomeOriginal: `arquivo.${extensao}`, arquivoId });
  const partes = caminho.split("/");
  return { caminho, pasta: partes.slice(0, -1).join("/"), nome: partes[partes.length - 1] };
}

export interface ContextoDaCaixa {
  admin: Admin;
  organizationId: string;
  prestacaoId: string;
  quem: QuemGrava;
}

const fim = (ms: number) => new Date(Date.now() + ms).toISOString();

async function linhaPorConteudo(admin: Admin, prestacaoId: string, destino: Destino, sha256: string): Promise<LinhaDaCaixa | null> {
  const { data, error } = await admin
    .from("assistente_arquivos" as never)
    .select(COLUNAS_DA_CAIXA)
    .eq("prestacao_id", prestacaoId)
    .eq("destino", destino)
    .eq("sha256", sha256)
    .in("situacao", ["recebido", "registrado"])
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  return (data as unknown as LinhaDaCaixa | null) ?? null;
}

/**
 * Recebe os bytes de um arquivo (anexo do ChatGPT ou texto colado no chat): confere o que ele é, guarda no Storage e põe
 * na caixa. O mesmo conteúdo enviado de novo devolve o que já está lá, sem guardar outra cópia.
 */
export async function receberArquivo(
  contexto: ContextoDaCaixa,
  entrada: { destino: Destino; origem: Origem; nome: string; bytes: Buffer },
): Promise<{ linha: LinhaDaCaixa; repetido: boolean }> {
  const { admin, organizationId, prestacaoId, quem } = contexto;
  const { destino, origem, bytes } = entrada;
  if (bytes.length === 0) throw new ErroMcp(400, `${nomeLimpo(entrada.nome)}: o arquivo está vazio.`);
  if (bytes.length > LIMITE_ARQUIVO_BYTES) throw new ErroMcp(413, `${nomeLimpo(entrada.nome)}: o arquivo passa de 15 MB.`);

  const tipo = tipoPeloConteudo(bytes);
  if (!TIPOS_ACEITOS[destino].includes(tipo)) {
    throw new ErroMcp(415, `${nomeLimpo(entrada.nome)}: este arquivo não é ${frase(destino)} (pelo conteúdo, parece ${tipo === "texto" ? "um texto" : tipo === "desconhecido" ? "um formato desconhecido" : tipo}).`);
  }
  const motivoDoXml = motivoDoXmlRecusado(destino, tipo, bytes);
  if (motivoDoXml) throw new ErroMcp(415, `${nomeLimpo(entrada.nome)}: ${motivoDoXml}`);
  const sha256 = impressaoDigital(bytes);
  const existente = await linhaPorConteudo(admin, prestacaoId, destino, sha256);
  if (existente) return { linha: existente, repetido: true };

  const arquivoId = randomUUID();
  const { caminho } = caminhoDoArquivo(organizationId, prestacaoId, destino, EXTENSAO[tipo] ?? "bin", arquivoId);
  const subida = await admin.storage.from("documentos").upload(caminho, bytes, { contentType: CONTENT_TYPE[tipo] ?? "application/octet-stream", upsert: false });
  if (subida.error) throw new ErroMcp(502, "Não foi possível guardar o arquivo agora. Tente de novo em instantes.");

  const { data, error } = await admin
    .from("assistente_arquivos" as never)
    .insert({
      id: arquivoId,
      prestacao_id: prestacaoId,
      usuario_id: quem.usuarioId,
      chave_id: quem.chaveId,
      plataforma: quem.plataforma,
      origem,
      destino,
      situacao: "recebido",
      nome_arquivo: nomeLimpo(entrada.nome),
      tipo_real: tipo,
      tamanho_bytes: bytes.length,
      sha256,
      storage_path: caminho,
      expira_em: fim(VALIDADE_DA_CAIXA_MS),
    } as never)
    .select(COLUNAS_DA_CAIXA)
    .single();
  if (error || !data) {
    await admin.storage.from("documentos").remove([caminho]);
    // Duas cópias do mesmo arquivo chegaram juntas: vale a que entrou primeiro.
    if (error?.code === "23505") {
      const primeira = await linhaPorConteudo(admin, prestacaoId, destino, sha256);
      if (primeira) return { linha: primeira, repetido: true };
    }
    throw erroDoBanco(error);
  }
  return { linha: data as unknown as LinhaDaCaixa, repetido: false };
}

export interface EnderecoDeEnvio {
  arquivo_id: string;
  nome: string;
  upload_url: string;
}

/**
 * Prepara o envio de arquivos do ambiente do assistente (ou do navegador): um endereço assinado do Storage por arquivo,
 * cada um no caminho já escolhido, e uma linha "aguardando" na caixa. O arquivo vai direto ao Storage; depois,
 * conferirEnvio confere o que chegou.
 */
export async function prepararEnvio(
  contexto: ContextoDaCaixa,
  entrada: { destino: Destino; origem: Origem; nomes: readonly string[] },
): Promise<EnderecoDeEnvio[]> {
  const { admin, organizationId, prestacaoId, quem } = contexto;
  const { destino, origem } = entrada;
  if (entrada.nomes.length === 0 || entrada.nomes.length > MAX_ARQUIVOS_POR_ENVIO) {
    throw new ErroMcp(400, `Informe de 1 a ${MAX_ARQUIVOS_POR_ENVIO} nomes de arquivo.`);
  }
  for (const nome of entrada.nomes) {
    if (!ACEITO_PELO_NOME[destino].test(nomeLimpo(nome))) {
      throw new ErroMcp(415, `${nomeLimpo(nome)}: ${destino === "despesa" ? "despesa aceita" : "evidência aceita"} ${frase(destino)}.`);
    }
  }

  const enderecos: EnderecoDeEnvio[] = [];
  for (const nome of entrada.nomes) {
    const arquivoId = randomUUID();
    const extensao = (/\.([A-Za-z0-9]{1,8})$/.exec(nomeLimpo(nome))?.[1] ?? "bin").toLowerCase();
    const { caminho } = caminhoDoArquivo(organizationId, prestacaoId, destino, extensao, arquivoId);
    const assinado = await admin.storage.from("documentos").createSignedUploadUrl(caminho);
    if (assinado.error || !assinado.data) throw new ErroMcp(502, "Não foi possível preparar o envio agora. Tente de novo em instantes.");
    const { error } = await admin.from("assistente_arquivos" as never).insert({
      id: arquivoId,
      prestacao_id: prestacaoId,
      usuario_id: quem.usuarioId,
      chave_id: quem.chaveId,
      plataforma: quem.plataforma,
      origem,
      destino,
      situacao: "aguardando",
      nome_arquivo: nomeLimpo(nome),
      storage_path: caminho,
      expira_em: fim(VALIDADE_DO_ENDERECO_MS),
    } as never);
    if (error) throw erroDoBanco(error);
    enderecos.push({ arquivo_id: arquivoId, nome: nomeLimpo(nome), upload_url: assinado.data.signedUrl });
  }
  return enderecos;
}

export interface ResultadoDaConferencia {
  linha: LinhaDaCaixa;
  /** chegou: conferido e na caixa; ainda_nao_chegou: o envio ainda não foi feito; recusado: chegou e não serve (foi apagado). */
  resultado: "chegou" | "ainda_nao_chegou" | "recusado" | "repetido";
  motivo?: string;
}

/** Confere o que chegou ao endereço de envio: tamanho, tipo pelo conteúdo e impressão digital. O que não serve é apagado. */
export async function conferirEnvio(
  contexto: ContextoDaCaixa,
  filtro: { ids?: readonly string[]; destino?: Destino; desde?: string } = {},
): Promise<ResultadoDaConferencia[]> {
  const { admin, prestacaoId } = contexto;
  let consulta = admin
    .from("assistente_arquivos" as never)
    .select(COLUNAS_DA_CAIXA)
    .eq("prestacao_id", prestacaoId)
    .eq("situacao", "aguardando")
    .order("created_at", { ascending: true })
    .limit(MAX_ARQUIVOS_POR_ENVIO * 2);
  if (filtro.ids && filtro.ids.length > 0) consulta = consulta.in("id", [...filtro.ids]);
  if (filtro.destino) consulta = consulta.eq("destino", filtro.destino);
  if (filtro.desde) consulta = consulta.gte("created_at", filtro.desde);
  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);

  const bucket = admin.storage.from("documentos");
  const resultados: ResultadoDaConferencia[] = [];
  for (const linha of (data ?? []) as unknown as LinhaDaCaixa[]) {
    const partes = linha.storage_path.split("/");
    const pasta = partes.slice(0, -1).join("/");
    const nome = partes[partes.length - 1];

    const { data: achados } = await bucket.list(pasta, { search: nome, limit: 1 });
    const achado = (achados ?? []).find(objeto => objeto.name === nome);
    if (!achado) {
      resultados.push({ linha, resultado: "ainda_nao_chegou", motivo: "O arquivo ainda não chegou ao endereço de envio." });
      continue;
    }

    const recusar = async (motivo: string): Promise<void> => {
      await bucket.remove([linha.storage_path]);
      const { data: atualizada } = await admin
        .from("assistente_arquivos" as never)
        .update({ situacao: "descartado", detalhe: motivo.slice(0, 500), atualizado_em: new Date().toISOString() } as never)
        .eq("id", linha.id)
        .select(COLUNAS_DA_CAIXA)
        .single();
      resultados.push({ linha: (atualizada as unknown as LinhaDaCaixa | null) ?? { ...linha, situacao: "descartado", detalhe: motivo }, resultado: "recusado", motivo });
    };

    const tamanhoDeclarado = Number((achado.metadata as { size?: number } | null)?.size ?? 0);
    if (tamanhoDeclarado > LIMITE_ARQUIVO_BYTES) {
      await recusar(`${linha.nome_arquivo}: o arquivo passa de 15 MB.`);
      continue;
    }
    const baixado = await bucket.download(linha.storage_path);
    if (baixado.error || !baixado.data) {
      resultados.push({ linha, resultado: "ainda_nao_chegou", motivo: "Não foi possível ler o arquivo agora. Tente conferir de novo." });
      continue;
    }
    const bytes = Buffer.from(await baixado.data.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LIMITE_ARQUIVO_BYTES) {
      await recusar(`${linha.nome_arquivo}: ${bytes.length === 0 ? "o arquivo está vazio" : "o arquivo passa de 15 MB"}.`);
      continue;
    }
    const tipo = tipoPeloConteudo(bytes);
    if (!TIPOS_ACEITOS[linha.destino].includes(tipo)) {
      await recusar(`${linha.nome_arquivo}: não é ${frase(linha.destino)} (pelo conteúdo, parece ${tipo === "texto" ? "um texto" : tipo === "desconhecido" ? "um formato desconhecido" : tipo}). O arquivo foi apagado.`);
      continue;
    }
    const motivoDoXml = motivoDoXmlRecusado(linha.destino, tipo, bytes);
    if (motivoDoXml) {
      await recusar(`${linha.nome_arquivo}: ${motivoDoXml} O arquivo foi apagado.`);
      continue;
    }
    const sha256 = impressaoDigital(bytes);
    const igual = await linhaPorConteudo(admin, prestacaoId, linha.destino, sha256);
    if (igual) {
      await bucket.remove([linha.storage_path]);
      await admin.from("assistente_arquivos" as never).update({ situacao: "descartado", detalhe: "O mesmo conteúdo já estava na prestação.", atualizado_em: new Date().toISOString() } as never).eq("id", linha.id);
      resultados.push({ linha: igual, resultado: "repetido", motivo: "O mesmo conteúdo já estava na prestação; vale o que entrou antes." });
      continue;
    }
    const { data: atualizada, error: erroAtualizar } = await admin
      .from("assistente_arquivos" as never)
      .update({
        situacao: "recebido",
        tipo_real: tipo,
        tamanho_bytes: bytes.length,
        sha256,
        detalhe: null,
        expira_em: fim(VALIDADE_DA_CAIXA_MS),
        atualizado_em: new Date().toISOString(),
      } as never)
      .eq("id", linha.id)
      .select(COLUNAS_DA_CAIXA)
      .single();
    if (erroAtualizar || !atualizada) {
      // Corrida com outra cópia igual: ela ficou com o conteúdo.
      if (erroAtualizar?.code === "23505") {
        await bucket.remove([linha.storage_path]);
        const primeira = await linhaPorConteudo(admin, prestacaoId, linha.destino, sha256);
        if (primeira) {
          resultados.push({ linha: primeira, resultado: "repetido", motivo: "O mesmo conteúdo já estava na prestação; vale o que entrou antes." });
          continue;
        }
      }
      throw erroDoBanco(erroAtualizar);
    }
    resultados.push({ linha: atualizada as unknown as LinhaDaCaixa, resultado: "chegou" });
  }
  return resultados;
}

/** Os arquivos da prestação na caixa, os mais novos primeiro. */
export async function listarCaixa(admin: Admin, prestacaoId: string, filtro: { situacao?: string; destino?: Destino; limite: number; deslocamento: number }) {
  let consulta = admin
    .from("assistente_arquivos" as never)
    .select(COLUNAS_DA_CAIXA, { count: "exact" })
    .eq("prestacao_id", prestacaoId)
    .order("created_at", { ascending: false })
    .range(filtro.deslocamento, filtro.deslocamento + filtro.limite - 1);
  if (filtro.situacao) consulta = consulta.eq("situacao", filtro.situacao);
  if (filtro.destino) consulta = consulta.eq("destino", filtro.destino);
  const { data, error, count } = await consulta;
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as unknown as LinhaDaCaixa[];
  return { linhas, total: count ?? linhas.length };
}

/** Tira da caixa (e do Storage) o que venceu sem ser registrado. Melhor esforço: nunca atrapalha quem chamou. */
export async function limparVencidos(admin: Admin, prestacaoId: string): Promise<void> {
  try {
    const { data } = await admin
      .from("assistente_arquivos" as never)
      .select("id,storage_path")
      .eq("prestacao_id", prestacaoId)
      .in("situacao", ["aguardando", "recebido"])
      .lt("expira_em", new Date().toISOString())
      .limit(50);
    const vencidos = (data ?? []) as unknown as { id: string; storage_path: string }[];
    if (vencidos.length === 0) return;
    await admin.storage.from("documentos").remove(vencidos.map(v => v.storage_path));
    await admin
      .from("assistente_arquivos" as never)
      .update({ situacao: "descartado", detalhe: "Venceu sem ser registrado.", atualizado_em: new Date().toISOString() } as never)
      .in("id", vencidos.map(v => v.id));
  } catch {
    // sem faxina desta vez
  }
}

// ─── Link de envio pelo navegador ───────────────────────────────────────────

export const VALIDADE_DO_LINK_MS = 15 * 60 * 1000;

export const hashDoCodigo = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

/** Cria o link curto de envio pelo navegador. O código só aparece aqui; o banco guarda o hash. */
export async function criarLinkDeEnvio(contexto: ContextoDaCaixa, entrada: { destino: Destino; maxArquivos: number }): Promise<{ codigo: string; expira_em: string }> {
  const { admin, prestacaoId, quem } = contexto;
  const codigo = randomBytes(32).toString("base64url");
  const expira = fim(VALIDADE_DO_LINK_MS);
  const { error } = await admin.from("assistente_sessoes_envio" as never).insert({
    prestacao_id: prestacaoId,
    usuario_id: quem.usuarioId,
    chave_id: quem.chaveId,
    plataforma: quem.plataforma,
    token_hash: hashDoCodigo(codigo),
    destino: entrada.destino,
    max_arquivos: Math.min(Math.max(entrada.maxArquivos, 1), MAX_ARQUIVOS_POR_ENVIO),
    expira_em: expira,
  } as never);
  if (error) throw erroDoBanco(error);
  return { codigo, expira_em: expira };
}
