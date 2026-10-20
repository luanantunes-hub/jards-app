import type { Admin } from "@/lib/mcp/crm";
import { COLUNAS_DA_CAIXA, type LinhaDaCaixa } from "@/lib/mcp/prestacao/caixa";
import { avisarEquipe, registrarAcao, type QuemGrava } from "@/lib/mcp/prestacao/gravacao";
import { ErroMcp, dataDe, erroDoBanco, numero, opcao, texto, uuidDe, type Corpo } from "@/lib/mcp/validacao";
import { despesaDoDocumento, lerDocumentoFiscal, type AvisoDoDocumento, type DespesaSugerida } from "@/lib/prestacao/documento-fiscal";
import { limparChave } from "@/lib/prestacao/despesas";
import { TIPOS_DA_DESPESA } from "@/lib/mcp/prestacao/enums";
import { limparDocumento } from "@/lib/prestacao/fornecedores";
import type { TipoComprovante } from "@/lib/supabase/types";

export const MAX_DESPESAS_POR_CHAMADA = 20;

const CHAVE_DE_ACESSO = /^([0-9A-Z]{44}|[0-9A-Z]{50})$/;

/** Os campos que a despesa leva ao banco. Sempre pendente: quem aceita ou rejeita é a equipe. */
export interface CamposDaDespesa {
  tipo: TipoComprovante;
  valor_extraido: number | null;
  data_doc: string | null;
  descricao_servico: string | null;
  numero_documento: string | null;
  serie: string | null;
  chave_acesso: string | null;
  iss: number;
  inss: number;
  irrf: number;
  outras_retencoes: number;
  identificacao_projeto: "presente" | null;
  fornecedor_id: string | null;
  no_id: string | null;
  observacao: string | null;
}

/** O que o assistente informou de uma despesa (todos opcionais; o XML da nota preenche o que souber). */
export interface DespesaInformada {
  arquivoId: string;
  tipo: TipoComprovante | null;
  valor: number | null;
  data: string | null;
  numero: string | null;
  serie: string | null;
  chave: string | null;
  descricao: string | null;
  retencoes: { iss: number; inss: number; irrf: number; outras: number };
  itemId: string | null;
  fornecedorDocumento: string | null;
  observacao: string | null;
}

const centavos = (v: number) => Math.round(v * 100);

/** Lê os campos de uma despesa do corpo, validando cada um (400 com o campo errado no texto). */
export function lerDespesaInformada(bruto: unknown, posicao: number): DespesaInformada {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new ErroMcp(400, `despesas[${posicao}] deve ser um objeto.`);
  const corpo = bruto as Corpo;
  const campo = <T>(ler: () => T): T => {
    try {
      return ler();
    } catch (erro) {
      if (erro instanceof ErroMcp) throw new ErroMcp(erro.status, `despesas[${posicao}]: ${erro.message}`, erro.extra);
      throw erro;
    }
  };
  const retencoes = corpo.retencoes && typeof corpo.retencoes === "object" && !Array.isArray(corpo.retencoes) ? (corpo.retencoes as Corpo) : {};
  return campo(() => ({
    arquivoId: uuidDe(corpo, "arquivo_id", true) as string,
    tipo: opcao(corpo, "tipo", TIPOS_DA_DESPESA),
    valor: numero(corpo, "valor", { min: 0, max: 1_000_000_000 }),
    data: dataDe(corpo, "data_do_documento"),
    numero: texto(corpo, "numero_do_documento", { max: 60 }),
    serie: texto(corpo, "serie", { max: 20 }),
    chave: texto(corpo, "chave_de_acesso", { max: 80 }),
    descricao: texto(corpo, "descricao", { max: 500 }),
    retencoes: {
      iss: numero(retencoes, "iss", { min: 0, max: 1_000_000_000 }) ?? 0,
      inss: numero(retencoes, "inss", { min: 0, max: 1_000_000_000 }) ?? 0,
      irrf: numero(retencoes, "irrf", { min: 0, max: 1_000_000_000 }) ?? 0,
      outras: numero(retencoes, "outras", { min: 0, max: 1_000_000_000 }) ?? 0,
    },
    itemId: uuidDe(corpo, "item_id"),
    fornecedorDocumento: texto(corpo, "fornecedor_documento", { max: 30 }),
    observacao: texto(corpo, "observacao", { max: 1000 }),
  }));
}

export interface ContextoDaConsolidacao {
  fornecedores: ReadonlyArray<{ id: string; documento: string | null }>;
  proponente: { documento: string | null; nome: string | null } | null;
  identificador: string | null;
  /** Mutável de propósito: cada despesa registrada acrescenta a sua chave, e as do mesmo lote não se repetem. */
  chavesUsadas: Array<{ chave: string; nome: string }>;
  /** Itens do orçamento da prestação (qualquer versão): o banco só aceita item desta prestação. */
  itensValidos: ReadonlySet<string>;
}

export type Consolidada = { ok: true; campos: CamposDaDespesa; avisos: AvisoDoDocumento[] } | { ok: false; erro: string };

/**
 * Junta o que o XML da nota diz (quando há) com o que o assistente informou. O XML vale mais: ele é o documento. O que o XML não
 * traz o assistente completa; se os dois discordam, fica o XML e a diferença vira aviso. Confere as regras que o banco impõe
 * (chave de acesso, retenções, item do orçamento) para devolver um erro claro em vez de uma recusa seca do banco.
 */
export function consolidarDespesa(informada: DespesaInformada, xml: string | null, contexto: ContextoDaConsolidacao): Consolidada {
  const avisos: AvisoDoDocumento[] = [];
  let sugerida: DespesaSugerida | null = null;

  if (xml !== null) {
    const leitura = lerDocumentoFiscal(xml);
    if (!leitura.ok) return { ok: false, erro: `O XML não serve como nota: ${leitura.motivo} Envie o PDF da nota, ou o XML da nota (não de evento).` };
    sugerida = despesaDoDocumento(leitura.documento, {
      fornecedores: contexto.fornecedores.map(f => ({ id: f.id, documento: f.documento ?? "" })),
      proponente: contexto.proponente,
      identificador: contexto.identificador,
      chavesUsadas: contexto.chavesUsadas,
    });
    avisos.push(...sugerida.avisos);
    const doXml = sugerida.campos;
    if (informada.valor !== null && doXml.valor_extraido !== null && centavos(informada.valor) !== centavos(doXml.valor_extraido)) {
      avisos.push({ nivel: "alerta", texto: `O valor informado (${informada.valor}) difere do XML (${doXml.valor_extraido}); ficou o do XML.` });
    }
  }

  const doXml = sugerida?.campos ?? null;
  const chaveInformada = informada.chave ? limparChave(informada.chave) : null;
  let chave = doXml?.chave_acesso ?? chaveInformada;
  if (chave && !CHAVE_DE_ACESSO.test(chave)) {
    avisos.push({ nivel: "alerta", texto: "A chave de acesso não tem 44 ou 50 posições e não foi gravada; confira no documento." });
    chave = null;
  }
  if (chave && contexto.chavesUsadas.some(c => limparChave(c.chave) === chave)) {
    return { ok: false, erro: "Esta nota já está na prestação (mesma chave de acesso)." };
  }

  const valor = doXml?.valor_extraido ?? informada.valor;
  const retencoes = doXml
    ? { iss: doXml.iss, inss: doXml.inss, irrf: doXml.irrf, outras: doXml.outras_retencoes }
    : { iss: informada.retencoes.iss, inss: informada.retencoes.inss, irrf: informada.retencoes.irrf, outras: informada.retencoes.outras };
  const somaDasRetencoes = centavos(retencoes.iss) + centavos(retencoes.inss) + centavos(retencoes.irrf) + centavos(retencoes.outras);
  if (valor !== null && somaDasRetencoes > centavos(valor)) {
    return { ok: false, erro: "As retenções somam mais que o valor do documento. Confira o valor bruto e as retenções." };
  }

  if (informada.itemId && !contexto.itensValidos.has(informada.itemId)) {
    return { ok: false, erro: "item_id não é um item do orçamento desta prestação. Use obter_orcamento_da_prestacao para ver os itens." };
  }

  const documentoDoFornecedor = informada.fornecedorDocumento ? limparDocumento(informada.fornecedorDocumento) : null;
  let fornecedorId = sugerida?.fornecedorId ?? null;
  if (!fornecedorId && documentoDoFornecedor) {
    fornecedorId = contexto.fornecedores.find(f => limparDocumento(f.documento ?? "") === documentoDoFornecedor)?.id ?? null;
    if (!fornecedorId) avisos.push({ nivel: "info", texto: "O fornecedor não está cadastrado na organização; cadastre em Fornecedores para ligar à despesa." });
  }

  if (valor === null) avisos.push({ nivel: "alerta", texto: "A despesa entrou sem valor; a equipe precisa completar." });

  return {
    ok: true,
    avisos,
    campos: {
      tipo: doXml?.tipo ?? informada.tipo ?? "outro",
      valor_extraido: valor,
      data_doc: doXml?.data_doc ?? informada.data,
      descricao_servico: doXml?.descricao_servico ?? informada.descricao,
      numero_documento: doXml?.numero_documento ?? informada.numero,
      serie: doXml?.serie ?? informada.serie,
      chave_acesso: chave,
      iss: retencoes.iss,
      inss: retencoes.inss,
      irrf: retencoes.irrf,
      outras_retencoes: retencoes.outras,
      identificacao_projeto: doXml?.identificacao_projeto ?? null,
      fornecedor_id: fornecedorId,
      no_id: informada.itemId,
      observacao: informada.observacao,
    },
  };
}

export interface ResultadoDaDespesa {
  arquivo_id: string;
  ok: boolean;
  despesa_id?: string;
  acao_id?: string;
  avisos?: AvisoDoDocumento[];
  erro?: string;
}

/** Os dados que o registro de despesas precisa da prestação, lidos uma vez por chamada. */
export async function contextoDasDespesas(admin: Admin, orgId: string, prestacao: { id: string; identificador_oficial: string | null; proponente: { id: string; nome: string } | null }): Promise<ContextoDaConsolidacao> {
  const [fornecedores, chaves, itens, proponente] = await Promise.all([
    admin.from("prestacao_fornecedores").select("id,documento").eq("organization_id", orgId),
    admin.from("prestacao_comprovantes").select("chave_acesso,nome_arquivo").eq("prestacao_id", prestacao.id).not("chave_acesso", "is", null),
    admin.from("prestacao_orcamento_nos").select("id").eq("prestacao_id", prestacao.id).eq("tipo", "item"),
    prestacao.proponente
      ? admin.from("proponentes").select("nome,cnpj").eq("id", prestacao.proponente.id).eq("organization_id", orgId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const leitura of [fornecedores, chaves, itens, proponente]) if (leitura.error) throw erroDoBanco(leitura.error);
  const dono = proponente.data as { nome: string | null; cnpj: string | null } | null;
  return {
    fornecedores: (fornecedores.data ?? []) as unknown as ContextoDaConsolidacao["fornecedores"],
    chavesUsadas: ((chaves.data ?? []) as unknown as { chave_acesso: string; nome_arquivo: string }[]).map(c => ({ chave: c.chave_acesso, nome: c.nome_arquivo })),
    itensValidos: new Set(((itens.data ?? []) as unknown as { id: string }[]).map(i => i.id)),
    proponente: dono ? { documento: dono.cnpj, nome: dono.nome } : null,
    identificador: prestacao.identificador_oficial,
  };
}

const reais = (v: number | null) => (v === null ? "sem valor" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/**
 * Registra uma despesa a partir de um arquivo da caixa de entrada. Quem chama já conferiu que a pessoa edita a prestação.
 * A despesa nasce pendente, com o canal "assistente", e o registro fica guardado em assistente_acoes. Se algo falhar depois
 * de gravar, desfaz: a caixa nunca fica com o arquivo "registrado" sem despesa, nem a despesa sem trilha.
 */
export async function registrarDespesa(
  entrada: { admin: Admin; prestacaoId: string; quem: QuemGrava; informada: DespesaInformada; contexto: ContextoDaConsolidacao },
): Promise<ResultadoDaDespesa> {
  const { admin, prestacaoId, quem, informada, contexto } = entrada;
  const falha = (erro: string): ResultadoDaDespesa => ({ arquivo_id: informada.arquivoId, ok: false, erro });

  const { data: linhaBruta, error: erroDaCaixa } = await admin
    .from("assistente_arquivos" as never)
    .select(COLUNAS_DA_CAIXA)
    .eq("id", informada.arquivoId)
    .eq("prestacao_id", prestacaoId)
    .maybeSingle();
  if (erroDaCaixa) throw erroDoBanco(erroDaCaixa);
  const arquivo = linhaBruta as unknown as LinhaDaCaixa | null;
  if (!arquivo) return falha("Arquivo não encontrado nesta prestação. Use listar_arquivos_recebidos para ver os ids.");
  if (arquivo.destino !== "despesa") return falha("Este arquivo foi enviado como evidência; use registrar_evidencia.");
  if (arquivo.situacao === "registrado") return falha("Este arquivo já virou despesa.");
  if (arquivo.situacao !== "recebido") return falha(arquivo.situacao === "aguardando" ? "O arquivo ainda não chegou: envie e chame conferir_envio_de_arquivos." : "Este arquivo foi descartado.");

  let xml: string | null = null;
  if (arquivo.tipo_real === "xml") {
    const baixado = await admin.storage.from("documentos").download(arquivo.storage_path);
    if (baixado.error || !baixado.data) return falha("Não foi possível ler o XML agora. Tente de novo em instantes.");
    xml = Buffer.from(await baixado.data.arrayBuffer()).toString("utf8");
  }

  const consolidada = consolidarDespesa(informada, xml, contexto);
  if (!consolidada.ok) return falha(consolidada.erro);
  const { campos, avisos } = consolidada;

  const { data: inserida, error: erroAoInserir } = await admin
    .from("prestacao_comprovantes" as never)
    .insert({
      prestacao_id: prestacaoId,
      nome_arquivo: arquivo.nome_arquivo.slice(0, 300),
      storage_path: arquivo.storage_path,
      tipo: campos.tipo,
      valor_extraido: campos.valor_extraido,
      data_doc: campos.data_doc,
      descricao_servico: campos.descricao_servico,
      numero_documento: campos.numero_documento,
      serie: campos.serie,
      chave_acesso: campos.chave_acesso,
      iss: campos.iss,
      inss: campos.inss,
      irrf: campos.irrf,
      outras_retencoes: campos.outras_retencoes,
      identificacao_projeto: campos.identificacao_projeto,
      fornecedor_id: campos.fornecedor_id,
      no_id: campos.no_id,
      observacao: campos.observacao,
      // O banco só obriga estes valores a quem está logado; o conector os fixa aqui: a despesa do assistente sempre começa pendente.
      status: "pendente",
      avaliado_por: null,
      avaliado_em: null,
      motivos_ia: [],
      canal: "assistente",
      origem: "nacional",
      enviado_por: quem.usuarioId,
    } as never)
    .select("id")
    .single();
  if (erroAoInserir || !inserida) {
    if (erroAoInserir?.code === "23505") return falha("Esta nota já está na prestação (mesma chave de acesso).");
    if (erroAoInserir?.code === "23514" || erroAoInserir?.code === "23503") return falha("O banco recusou os dados da despesa. Confira o item do orçamento, o fornecedor, as datas e os valores.");
    throw erroDoBanco(erroAoInserir);
  }
  const despesaId = (inserida as { id: string }).id;

  const desfazer = async () => {
    await admin.from("prestacao_comprovantes" as never).delete().eq("id", despesaId).eq("prestacao_id", prestacaoId);
  };

  const { error: erroAoMarcar } = await admin
    .from("assistente_arquivos" as never)
    .update({ situacao: "registrado", registro_tabela: "prestacao_comprovantes", registro_id: despesaId, atualizado_em: new Date().toISOString() } as never)
    .eq("id", arquivo.id)
    .eq("situacao", "recebido");
  if (erroAoMarcar) {
    await desfazer();
    throw erroDoBanco(erroAoMarcar);
  }

  let acaoId: string;
  try {
    acaoId = await registrarAcao(admin, quem, {
      prestacaoId,
      ferramenta: "registrar_despesas",
      acao: "criar",
      tabela: "prestacao_comprovantes",
      registroId: despesaId,
      resumo: `Registrou a despesa "${campos.descricao_servico ?? arquivo.nome_arquivo}" (${reais(campos.valor_extraido)}) como pendente`.slice(0, 500),
      depois: { arquivo_id: arquivo.id, tipo: campos.tipo, valor_extraido: campos.valor_extraido, data_doc: campos.data_doc, numero_documento: campos.numero_documento, no_id: campos.no_id },
    });
  } catch (erro) {
    await admin.from("assistente_arquivos" as never).update({ situacao: "recebido", registro_tabela: null, registro_id: null, atualizado_em: new Date().toISOString() } as never).eq("id", arquivo.id);
    await desfazer();
    throw erro;
  }

  if (campos.chave_acesso) contexto.chavesUsadas.push({ chave: campos.chave_acesso, nome: arquivo.nome_arquivo });
  return { arquivo_id: arquivo.id, ok: true, despesa_id: despesaId, acao_id: acaoId, ...(avisos.length > 0 ? { avisos } : {}) };
}

/** Um aviso à equipe para o lote inteiro. */
export async function avisarDespesasRegistradas(admin: Admin, prestacaoId: string, titulo: string, quantidade: number, chave: string): Promise<void> {
  await avisarEquipe(
    admin,
    prestacaoId,
    quantidade === 1 ? "Despesa registrada pelo assistente" : `${quantidade} despesas registradas pelo assistente`,
    `Em “${titulo}”, pendentes para a equipe conferir e avaliar. Veja “Ações do assistente” na prestação.`,
    chave,
  );
}
