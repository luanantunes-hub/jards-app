import type { Admin } from "@/lib/mcp/crm";
import { COLUNAS_DA_CAIXA, type LinhaDaCaixa } from "@/lib/mcp/prestacao/caixa";
import { avisarEquipe, registrarAcao, type QuemGrava } from "@/lib/mcp/prestacao/gravacao";
import { ErroMcp, dataDe, erroDoBanco, listaDeTextos, numero, opcao, texto, uuidDe, type Corpo } from "@/lib/mcp/validacao";
import { REQUISITOS_EVIDENCIA, rotuloDoTipo, TIPOS_EVIDENCIA, type RequisitoEvidencia, type TipoEvidencia } from "@/lib/prestacao/evidencias";

export const MAX_EVIDENCIAS_POR_CHAMADA = 10;

const TIPOS = TIPOS_EVIDENCIA.map(t => t.id) as readonly TipoEvidencia[];
const REQUISITOS = REQUISITOS_EVIDENCIA.map(r => r.id) as readonly RequisitoEvidencia[];
const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", heic: "image/heic" };

export interface EvidenciaInformada {
  arquivoId: string | null;
  url: string | null;
  tipo: TipoEvidencia | null;
  descricao: string | null;
  atividadeId: string | null;
  metaId: string | null;
  localId: string | null;
  capturadaEm: string | null;
  latitude: number | null;
  longitude: number | null;
  requisitos: RequisitoEvidencia[];
  justificativa: string | null;
}

/** Lê os campos de uma evidência do corpo, validando cada um com o nome do campo errado no texto. */
export function lerEvidenciaInformada(bruto: unknown, posicao: number): EvidenciaInformada {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new ErroMcp(400, `evidencias[${posicao}] deve ser um objeto.`);
  const corpo = bruto as Corpo;
  try {
    const url = texto(corpo, "url", { max: 1000 });
    if (url && !/^https?:\/\//i.test(url)) throw new ErroMcp(400, "url deve começar com http:// ou https://.");
    const arquivoId = uuidDe(corpo, "arquivo_id");
    if (!arquivoId && !url) throw new ErroMcp(400, "Informe arquivo_id (um arquivo da caixa de entrada) ou url (um link).");
    if (arquivoId && url) throw new ErroMcp(400, "Informe arquivo_id ou url, não os dois.");
    const latitude = numero(corpo, "latitude", { min: -90, max: 90 });
    const longitude = numero(corpo, "longitude", { min: -180, max: 180 });
    if ((latitude === null) !== (longitude === null)) throw new ErroMcp(400, "Informe latitude e longitude juntas, ou nenhuma.");
    const requisitos = listaDeTextos(corpo, "requisitos", { maxItens: REQUISITOS.length, max: 40 }) ?? [];
    for (const r of requisitos) if (!(REQUISITOS as readonly string[]).includes(r)) throw new ErroMcp(400, `requisitos deve ter só estes: ${REQUISITOS.join(", ")}.`);
    return {
      arquivoId,
      url,
      tipo: opcao(corpo, "tipo", TIPOS),
      descricao: texto(corpo, "descricao", { max: 1000 }),
      atividadeId: uuidDe(corpo, "atividade_id"),
      metaId: uuidDe(corpo, "meta_id"),
      localId: uuidDe(corpo, "local_id"),
      capturadaEm: dataDe(corpo, "capturada_em"),
      latitude,
      longitude,
      requisitos: requisitos as RequisitoEvidencia[],
      justificativa: texto(corpo, "justificativa", { max: 2000 }),
    };
  } catch (erro) {
    if (erro instanceof ErroMcp) throw new ErroMcp(erro.status, `evidencias[${posicao}]: ${erro.message}`, erro.extra);
    throw erro;
  }
}

export interface ResultadoDaEvidencia {
  ok: boolean;
  arquivo_id?: string;
  evidencia_id?: string;
  acao_id?: string;
  erro?: string;
}

/** A atividade, a meta ou o local existem nesta prestação? O banco não confere esses vínculos a quem escreve com a chave de serviço. */
export async function vinculoValido(admin: Admin, tabela: "prestacao_atividades" | "prestacao_metas" | "prestacao_locais", prestacaoId: string, id: string): Promise<boolean> {
  const { data, error } = await admin.from(tabela as never).select("id").eq("id", id).eq("prestacao_id", prestacaoId).maybeSingle();
  if (error) throw erroDoBanco(error);
  return Boolean(data);
}

/**
 * Registra uma evidência (foto, lista de presença, declaração, link…) da realização do objeto. A evidência vem de um arquivo
 * da caixa de entrada ou de um link. Fica registrada em assistente_acoes; quem confere é a equipe.
 */
export async function registrarEvidencia(entrada: { admin: Admin; prestacaoId: string; quem: QuemGrava; informada: EvidenciaInformada }): Promise<ResultadoDaEvidencia> {
  const { admin, prestacaoId, quem, informada } = entrada;
  const falha = (erro: string): ResultadoDaEvidencia => ({ ok: false, ...(informada.arquivoId ? { arquivo_id: informada.arquivoId } : {}), erro });

  for (const [tabela, id, nome] of [
    ["prestacao_atividades", informada.atividadeId, "atividade_id"],
    ["prestacao_metas", informada.metaId, "meta_id"],
    ["prestacao_locais", informada.localId, "local_id"],
  ] as const) {
    if (id && !(await vinculoValido(admin, tabela, prestacaoId, id))) return falha(`${nome} não é desta prestação.`);
  }

  let arquivo: LinhaDaCaixa | null = null;
  if (informada.arquivoId) {
    const { data, error } = await admin.from("assistente_arquivos" as never).select(COLUNAS_DA_CAIXA).eq("id", informada.arquivoId).eq("prestacao_id", prestacaoId).maybeSingle();
    if (error) throw erroDoBanco(error);
    arquivo = data as unknown as LinhaDaCaixa | null;
    if (!arquivo) return falha("Arquivo não encontrado nesta prestação. Use listar_arquivos_recebidos para ver os ids.");
    if (arquivo.destino !== "evidencia") return falha("Este arquivo foi enviado como despesa; use registrar_despesas.");
    if (arquivo.situacao === "registrado") return falha("Este arquivo já virou evidência.");
    if (arquivo.situacao !== "recebido") return falha(arquivo.situacao === "aguardando" ? "O arquivo ainda não chegou: envie e chame conferir_envio_de_arquivos." : "Este arquivo foi descartado.");
  }

  const tipo: TipoEvidencia = informada.tipo ?? (informada.url ? "link" : arquivo?.tipo_real && arquivo.tipo_real !== "pdf" ? "foto" : "outro");
  const comDados = informada.capturadaEm !== null || informada.latitude !== null;
  const { data: inserida, error: erroAoInserir } = await admin
    .from("prestacao_evidencias" as never)
    .insert({
      prestacao_id: prestacaoId,
      tipo,
      requisitos: informada.requisitos,
      atividade_id: informada.atividadeId,
      meta_id: informada.metaId,
      local_id: informada.localId,
      nome_arquivo: arquivo ? arquivo.nome_arquivo.slice(0, 300) : null,
      storage_path: arquivo ? arquivo.storage_path : null,
      mime_type: arquivo?.tipo_real ? (MIME[arquivo.tipo_real] ?? null) : null,
      tamanho_bytes: arquivo?.tamanho_bytes ?? null,
      url: informada.url,
      descricao: informada.descricao,
      capturada_em: informada.capturadaEm,
      latitude: informada.latitude,
      longitude: informada.longitude,
      origem_dados: comDados ? "informado" : null,
      justificativa: informada.justificativa,
      criado_por: quem.usuarioId,
      canal: "assistente",
    } as never)
    .select("id")
    .single();
  if (erroAoInserir || !inserida) {
    if (erroAoInserir?.code === "23514" || erroAoInserir?.code === "23503") return falha("O banco recusou os dados da evidência. Confira o tipo, o link, as datas e os vínculos.");
    throw erroDoBanco(erroAoInserir);
  }
  const evidenciaId = (inserida as { id: string }).id;
  const desfazer = async () => {
    await admin.from("prestacao_evidencias" as never).delete().eq("id", evidenciaId).eq("prestacao_id", prestacaoId);
  };

  if (arquivo) {
    const { error } = await admin
      .from("assistente_arquivos" as never)
      .update({ situacao: "registrado", registro_tabela: "prestacao_evidencias", registro_id: evidenciaId, atualizado_em: new Date().toISOString() } as never)
      .eq("id", arquivo.id)
      .eq("situacao", "recebido");
    if (error) {
      await desfazer();
      throw erroDoBanco(error);
    }
  }

  let acaoId: string;
  try {
    acaoId = await registrarAcao(admin, quem, {
      prestacaoId,
      ferramenta: "registrar_evidencia",
      acao: "criar",
      tabela: "prestacao_evidencias",
      registroId: evidenciaId,
      resumo: `Registrou a evidência (${rotuloDoTipo(tipo)})${informada.descricao ? `: ${informada.descricao.slice(0, 120)}` : ""}`,
      depois: { arquivo_id: arquivo?.id ?? null, tipo, url: informada.url, atividade_id: informada.atividadeId, meta_id: informada.metaId, local_id: informada.localId },
    });
  } catch (erro) {
    if (arquivo) await admin.from("assistente_arquivos" as never).update({ situacao: "recebido", registro_tabela: null, registro_id: null, atualizado_em: new Date().toISOString() } as never).eq("id", arquivo.id);
    await desfazer();
    throw erro;
  }

  return { ok: true, ...(arquivo ? { arquivo_id: arquivo.id } : {}), evidencia_id: evidenciaId, acao_id: acaoId };
}

export async function avisarEvidenciasRegistradas(admin: Admin, prestacaoId: string, titulo: string, quantidade: number, chave: string): Promise<void> {
  await avisarEquipe(
    admin,
    prestacaoId,
    quantidade === 1 ? "Evidência registrada pelo assistente" : `${quantidade} evidências registradas pelo assistente`,
    `Em “${titulo}”. Veja “Ações do assistente” na prestação.`,
    chave,
  );
}
