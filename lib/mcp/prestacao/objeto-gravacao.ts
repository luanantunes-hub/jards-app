import type { Admin } from "@/lib/mcp/crm";
import { vinculoValido } from "@/lib/mcp/prestacao/evidencias-gravacao";
import { avisarEquipe, registrarAcao, type QuemGrava } from "@/lib/mcp/prestacao/gravacao";
import { COLUNAS_DA_ATIVIDADE, COLUNAS_DA_META, atividadeParaOAssistente, metaParaOAssistente, type AtividadeLida, type MetaLida } from "@/lib/mcp/prestacao/objeto-leitura";
import { ErroMcp, ausente, dataDe, erroDoBanco, inteiro, listaDeTextos, numero, opcao, soDia, texto, ufDe, uuidDe, type Corpo } from "@/lib/mcp/validacao";
import { LIMITE_JUSTIFICATIVA_META, erroDaMeta } from "@/lib/prestacao/objeto";

/**
 * Atividades e metas do objeto, gravadas pelo assistente. São o texto e os números do que aconteceu no projeto, e a equipe
 * revisa e completa no app: por isso aqui a atividade só nasce com o que foi dito (nada é inventado ou deduzido), e a
 * meta só recebe o realizado e a justificativa (o previsto e a descrição vêm do projeto aprovado e não mudam por aqui).
 * Cada gravação deixa o que havia antes em assistente_acoes, e o aviso à equipe é um só por chamada.
 */

export const MAX_ATIVIDADES_POR_CHAMADA = 20;

const STATUS_DA_ATIVIDADE = ["realizado", "nao_realizado"] as const;
type StatusDaAtividade = (typeof STATUS_DA_ATIVIDADE)[number];

/**
 * Campo informado de verdade: nulo, vazio ou ausente é "não informado". Muitos assistentes mandam null nos opcionais que não
 * vão usar, então null nunca limpa nada: para esvaziar um campo existe a lista `limpar`.
 */
const presente = (corpo: Corpo, campo: string) => !ausente(corpo[campo]);

/** Um dia (AAAA-MM-DD), sem hora: as colunas de data da atividade são `date`. */
function diaDe(corpo: Corpo, campo: string, obrigatorio = false): string | null {
  const valor = dataDe(corpo, campo, obrigatorio);
  if (valor !== null && !soDia(valor)) throw new ErroMcp(400, `${campo} deve ser um dia, no formato AAAA-MM-DD (sem hora).`);
  return valor;
}

export interface CamposDaAtividade {
  titulo: string;
  descricao: string | null;
  data_realizacao: string;
  data_inicio: string | null;
  data_fim: string | null;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  publico_atingido: number | null;
  meta_prevista: number | null;
  empregos_diretos: number | null;
  empregos_indiretos: number | null;
  democratizacao_descricao: string | null;
  acessibilidade_descricao: string | null;
  status_realizacao: StatusDaAtividade;
  justificativa_nao_realizacao: string | null;
  meta_id: string | null;
  local_id: string | null;
}

const CONTAGENS = { min: 0, max: 100_000_000 } as const;

/** Lê, campo a campo, o que veio no corpo. Só entra no resultado o que foi informado (para a atualização mexer apenas nisso). */
function lerCampos(corpo: Corpo, { nova }: { nova: boolean }): Partial<CamposDaAtividade> {
  const campos: Partial<CamposDaAtividade> = {};
  const comTexto = (campo: keyof CamposDaAtividade, max: number) => {
    if (presente(corpo, campo)) campos[campo as "descricao"] = texto(corpo, campo, { max }) as string;
  };
  const comContagem = (campo: "publico_atingido" | "meta_prevista" | "empregos_diretos" | "empregos_indiretos") => {
    if (presente(corpo, campo)) campos[campo] = inteiro(corpo, campo, CONTAGENS);
  };

  if (nova || presente(corpo, "titulo")) {
    const titulo = texto(corpo, "titulo", { max: 300, obrigatorio: true });
    campos.titulo = titulo as string;
  }
  if (nova || presente(corpo, "data_realizacao")) campos.data_realizacao = diaDe(corpo, "data_realizacao", true) as string;
  for (const campo of ["data_inicio", "data_fim"] as const) if (presente(corpo, campo)) campos[campo] = diaDe(corpo, campo);
  comTexto("descricao", 2000);
  comTexto("local", 300);
  comTexto("cidade", 200);
  if (presente(corpo, "estado")) campos.estado = ufDe(corpo, "estado");
  comContagem("publico_atingido");
  comContagem("meta_prevista");
  comContagem("empregos_diretos");
  comContagem("empregos_indiretos");
  comTexto("democratizacao_descricao", 2000);
  comTexto("acessibilidade_descricao", 2000);
  if (presente(corpo, "status_realizacao")) {
    const status = opcao(corpo, "status_realizacao", STATUS_DA_ATIVIDADE);
    if (status) campos.status_realizacao = status;
  }
  comTexto("justificativa_nao_realizacao", 2000);
  if (presente(corpo, "meta_id")) campos.meta_id = uuidDe(corpo, "meta_id");
  if (presente(corpo, "local_id")) campos.local_id = uuidDe(corpo, "local_id");
  return campos;
}

/** As regras entre os campos, as mesmas que o app e o banco aplicam. Devolve o campo final já coerente. */
function conferirCampos(campos: CamposDaAtividade): CamposDaAtividade {
  if (campos.data_inicio && campos.data_fim && campos.data_fim < campos.data_inicio) throw new ErroMcp(400, "data_fim vem antes de data_inicio.");
  if (campos.status_realizacao === "nao_realizado") {
    if (!campos.justificativa_nao_realizacao?.trim()) throw new ErroMcp(400, "Atividade não realizada pede justificativa_nao_realizacao.");
    return campos;
  }
  // Realizada: a justificativa da não realização não se aplica (como na tela).
  return { ...campos, justificativa_nao_realizacao: null };
}

export function lerAtividadeInformada(bruto: unknown, posicao: number): CamposDaAtividade {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new ErroMcp(400, `atividades[${posicao}] deve ser um objeto.`);
  try {
    const lidos = lerCampos(bruto as Corpo, { nova: true });
    return conferirCampos({
      titulo: lidos.titulo as string,
      descricao: lidos.descricao ?? null,
      data_realizacao: lidos.data_realizacao as string,
      data_inicio: lidos.data_inicio ?? null,
      data_fim: lidos.data_fim ?? null,
      local: lidos.local ?? null,
      cidade: lidos.cidade ?? null,
      estado: lidos.estado ?? null,
      publico_atingido: lidos.publico_atingido ?? null,
      meta_prevista: lidos.meta_prevista ?? null,
      empregos_diretos: lidos.empregos_diretos ?? null,
      empregos_indiretos: lidos.empregos_indiretos ?? null,
      democratizacao_descricao: lidos.democratizacao_descricao ?? null,
      acessibilidade_descricao: lidos.acessibilidade_descricao ?? null,
      status_realizacao: lidos.status_realizacao ?? "realizado",
      justificativa_nao_realizacao: lidos.justificativa_nao_realizacao ?? null,
      meta_id: lidos.meta_id ?? null,
      local_id: lidos.local_id ?? null,
    });
  } catch (erro) {
    if (erro instanceof ErroMcp) throw new ErroMcp(erro.status, `atividades[${posicao}]: ${erro.message}`, erro.extra);
    throw erro;
  }
}

export interface ResultadoDaAtividade {
  ok: boolean;
  titulo: string;
  atividade_id?: string;
  acao_id?: string;
  erro?: string;
}

async function vinculosConferem(admin: Admin, prestacaoId: string, campos: Pick<CamposDaAtividade, "meta_id" | "local_id">): Promise<string | null> {
  if (campos.meta_id && !(await vinculoValido(admin, "prestacao_metas", prestacaoId, campos.meta_id))) return "meta_id não é desta prestação. Use obter_objeto_da_prestacao para ver os ids.";
  if (campos.local_id && !(await vinculoValido(admin, "prestacao_locais", prestacaoId, campos.local_id))) return "local_id não é desta prestação. Use obter_objeto_da_prestacao para ver os ids.";
  return null;
}

/** Registra uma atividade do objeto. A mesma atividade (título e data) não entra duas vezes: o pedido repetido devolve a que já existe. */
export async function registrarAtividade(entrada: { admin: Admin; prestacaoId: string; quem: QuemGrava; campos: CamposDaAtividade; ordem: number }): Promise<ResultadoDaAtividade> {
  const { admin, prestacaoId, quem, campos, ordem } = entrada;
  const falha = (erro: string, extra: Partial<ResultadoDaAtividade> = {}): ResultadoDaAtividade => ({ ok: false, titulo: campos.titulo, erro, ...extra });

  const problema = await vinculosConferem(admin, prestacaoId, campos);
  if (problema) return falha(problema);

  const { data: igual, error: erroAoProcurar } = await admin
    .from("prestacao_atividades" as never)
    .select("id")
    .eq("prestacao_id", prestacaoId)
    .eq("titulo", campos.titulo)
    .eq("data_realizacao", campos.data_realizacao)
    .maybeSingle();
  if (erroAoProcurar) throw erroDoBanco(erroAoProcurar);
  if (igual) return falha("Já existe uma atividade com este título e esta data. Use atualizar_atividade para mudá-la.", { atividade_id: (igual as { id: string }).id });

  const { data: inserida, error } = await admin
    .from("prestacao_atividades" as never)
    .insert({ ...campos, prestacao_id: prestacaoId, ordem, criado_por: quem.usuarioId } as never)
    .select("id")
    .single();
  if (error || !inserida) {
    if (error?.code === "23514" || error?.code === "23503") return falha("O banco recusou os dados da atividade. Confira as datas, a justificativa e os vínculos.");
    throw erroDoBanco(error);
  }
  const atividadeId = (inserida as { id: string }).id;

  try {
    const acaoId = await registrarAcao(admin, quem, {
      prestacaoId,
      ferramenta: "registrar_atividades",
      acao: "criar",
      tabela: "prestacao_atividades",
      registroId: atividadeId,
      resumo: `Registrou a atividade “${campos.titulo.slice(0, 150)}” (${campos.data_realizacao.split("-").reverse().join("/")})`,
      depois: { titulo: campos.titulo, data_realizacao: campos.data_realizacao, status_realizacao: campos.status_realizacao, meta_id: campos.meta_id, local_id: campos.local_id },
    });
    return { ok: true, titulo: campos.titulo, atividade_id: atividadeId, acao_id: acaoId };
  } catch (erro) {
    await admin.from("prestacao_atividades" as never).delete().eq("id", atividadeId).eq("prestacao_id", prestacaoId);
    throw erro;
  }
}

export async function proximaOrdemDasAtividades(admin: Admin, prestacaoId: string): Promise<number> {
  const { count, error } = await admin.from("prestacao_atividades" as never).select("id", { count: "exact", head: true }).eq("prestacao_id", prestacaoId);
  if (error) throw erroDoBanco(error);
  return count ?? 0;
}

export async function avisarAtividadesRegistradas(admin: Admin, prestacaoId: string, titulo: string, quantidade: number, chave: string): Promise<void> {
  await avisarEquipe(
    admin,
    prestacaoId,
    quantidade === 1 ? "Atividade registrada pelo assistente" : `${quantidade} atividades registradas pelo assistente`,
    `Em “${titulo}”. Veja “Ações do assistente” na prestação.`,
    chave,
  );
}

// ─── Atualizar uma atividade ────────────────────────────────────────────────

const CAMPOS_ATUALIZAVEIS = Object.keys({
  titulo: 0, descricao: 0, data_realizacao: 0, data_inicio: 0, data_fim: 0, local: 0, cidade: 0, estado: 0, publico_atingido: 0, meta_prevista: 0,
  empregos_diretos: 0, empregos_indiretos: 0, democratizacao_descricao: 0, acessibilidade_descricao: 0, status_realizacao: 0, justificativa_nao_realizacao: 0, meta_id: 0, local_id: 0,
}) as (keyof CamposDaAtividade)[];

const iguais = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/** Os campos de uma atividade que o assistente pode esvaziar (a pedido da pessoa), por `limpar`. Título, data e situação nunca ficam vazios. */
export const CAMPOS_QUE_SE_LIMPAM = ["descricao", "data_inicio", "data_fim", "local", "cidade", "estado", "publico_atingido", "meta_prevista", "empregos_diretos", "empregos_indiretos", "democratizacao_descricao", "acessibilidade_descricao", "meta_id", "local_id"] as const;

/** Lê a lista `limpar` do corpo, só com nomes que se podem esvaziar. */
function lerLimpar(corpo: Corpo, permitidos: readonly string[]): string[] {
  const lista = listaDeTextos(corpo, "limpar", { maxItens: permitidos.length, max: 40 }) ?? [];
  for (const campo of lista) if (!permitidos.includes(campo)) throw new ErroMcp(400, `limpar aceita só estes campos: ${permitidos.join(", ")}. Recebi "${campo.slice(0, 40)}".`);
  for (const campo of lista) if (presente(corpo, campo)) throw new ErroMcp(400, `${campo} está em limpar e também foi informado: escolha um dos dois.`);
  return lista;
}

/**
 * Muda só os campos informados de uma atividade (de qualquer pessoa da equipe: o assistente age em nome de quem pode editar a
 * prestação). Campo informado como vazio é limpo; campo que não veio continua como está. O que havia antes fica na trilha.
 */
export async function atualizarAtividade(entrada: { admin: Admin; prestacaoId: string; quem: QuemGrava; atividadeId: string; corpo: Corpo }) {
  const { admin, prestacaoId, quem, atividadeId, corpo } = entrada;
  const { data, error } = await admin.from("prestacao_atividades" as never).select(COLUNAS_DA_ATIVIDADE).eq("id", atividadeId).eq("prestacao_id", prestacaoId).maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw new ErroMcp(404, "Atividade não encontrada nesta prestação. Use obter_objeto_da_prestacao para ver os atividade_id.");
  const atual = data as unknown as AtividadeLida;

  const informados = lerCampos(corpo, { nova: false });
  const limpar = lerLimpar(corpo, CAMPOS_QUE_SE_LIMPAM);
  for (const campo of limpar) (informados as Record<string, unknown>)[campo] = null;
  const escolhidos = CAMPOS_ATUALIZAVEIS.filter(campo => campo in informados);
  if (escolhidos.length === 0) throw new ErroMcp(400, "Informe ao menos um campo para mudar (ex.: descricao, publico_atingido, status_realizacao), ou esvazie um campo em limpar.");

  const depoisCompleto = conferirCampos({ ...(atual as unknown as CamposDaAtividade), ...informados } as CamposDaAtividade);
  const problema = await vinculosConferem(admin, prestacaoId, depoisCompleto);
  if (problema) throw new ErroMcp(400, problema);

  // Só entram na gravação os campos que de fato mudam (e a justificativa que a regra limpa ao marcar como realizada).
  const mudancas: Partial<CamposDaAtividade> = {};
  const antes: Record<string, unknown> = {};
  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (!iguais((atual as unknown as Record<string, unknown>)[campo], depoisCompleto[campo])) {
      (mudancas as Record<string, unknown>)[campo] = depoisCompleto[campo];
      antes[campo] = (atual as unknown as Record<string, unknown>)[campo] ?? null;
    }
  }
  if (Object.keys(mudancas).length === 0) return { mudou: false as const, atividade: atividadeParaOAssistente(atual) };

  const { data: atualizada, error: erroAoGravar } = await admin
    .from("prestacao_atividades" as never)
    .update(mudancas as never)
    .eq("id", atividadeId)
    .eq("prestacao_id", prestacaoId)
    .select(COLUNAS_DA_ATIVIDADE)
    .single();
  if (erroAoGravar || !atualizada) {
    if (erroAoGravar?.code === "23514" || erroAoGravar?.code === "23503") throw new ErroMcp(400, "O banco recusou os dados da atividade. Confira as datas, a justificativa e os vínculos.");
    throw erroDoBanco(erroAoGravar);
  }

  try {
    const acaoId = await registrarAcao(admin, quem, {
      prestacaoId,
      ferramenta: "atualizar_atividade",
      acao: "atualizar",
      tabela: "prestacao_atividades",
      registroId: atividadeId,
      resumo: `Atualizou a atividade “${atual.titulo.slice(0, 150)}”: ${Object.keys(mudancas).join(", ")}`,
      antes,
      depois: mudancas,
    });
    return { mudou: true as const, acao_id: acaoId, campos_mudados: Object.keys(mudancas), atividade: atividadeParaOAssistente(atualizada as unknown as AtividadeLida) };
  } catch (erro) {
    // A trilha é parte da gravação: sem ela, volta o que havia.
    await admin.from("prestacao_atividades" as never).update(antes as never).eq("id", atividadeId).eq("prestacao_id", prestacaoId);
    throw erro;
  }
}

// ─── Atualizar uma meta ─────────────────────────────────────────────────────

/**
 * Lança o resultado de uma meta: o realizado e a justificativa da diferença. O previsto e a descrição vêm do projeto aprovado
 * e só mudam no app. Os números de volta (percentual, o que falta justificar) são os da tela.
 */
export async function atualizarMeta(entrada: { admin: Admin; prestacaoId: string; quem: QuemGrava; corpo: Corpo }) {
  const { admin, prestacaoId, quem, corpo } = entrada;
  const metaId = uuidDe(corpo, "meta_id", true) as string;
  const { data, error } = await admin.from("prestacao_metas" as never).select(COLUNAS_DA_META).eq("id", metaId).eq("prestacao_id", prestacaoId).maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw new ErroMcp(404, "Meta não encontrada nesta prestação. Use obter_objeto_da_prestacao para ver os meta_id.");
  const atual = data as unknown as MetaLida;

  const quer: { realizado?: number | null; justificativa?: string | null } = {};
  if (presente(corpo, "realizado")) quer.realizado = numero(corpo, "realizado", { min: 0 });
  if (presente(corpo, "justificativa")) quer.justificativa = texto(corpo, "justificativa", { max: LIMITE_JUSTIFICATIVA_META });
  for (const campo of lerLimpar(corpo, ["realizado", "justificativa"])) quer[campo as "realizado"] = null;
  if (!("realizado" in quer) && !("justificativa" in quer)) throw new ErroMcp(400, "Informe realizado (quanto foi alcançado) e/ou justificativa (por que ficou diferente do previsto), ou esvazie um deles em limpar.");

  const realizadoDepois = "realizado" in quer ? quer.realizado ?? null : atual.realizado === null ? null : Number(atual.realizado);
  const justificativaDepois = "justificativa" in quer ? quer.justificativa ?? null : atual.justificativa;
  const motivo = erroDaMeta({ descricao: atual.descricao, unidade: atual.unidade, previsto: Number(atual.previsto), realizado: realizadoDepois, justificativa: justificativaDepois });
  if (motivo) throw new ErroMcp(400, motivo);

  const mudancas: Record<string, unknown> = {};
  const antes: Record<string, unknown> = {};
  if ("realizado" in quer && !iguais(atual.realizado === null ? null : Number(atual.realizado), realizadoDepois)) {
    mudancas.realizado = realizadoDepois;
    antes.realizado = atual.realizado === null ? null : Number(atual.realizado);
  }
  if ("justificativa" in quer && !iguais(atual.justificativa, justificativaDepois)) {
    mudancas.justificativa = justificativaDepois;
    antes.justificativa = atual.justificativa;
  }

  const lerAtividades = async () => {
    const { data: leves, error: erroDasAtividades } = await admin.from("prestacao_atividades" as never).select("meta_id,status_realizacao,publico_atingido").eq("prestacao_id", prestacaoId).eq("meta_id", metaId);
    if (erroDasAtividades) throw erroDoBanco(erroDasAtividades);
    return (leves ?? []) as unknown as Pick<AtividadeLida, "meta_id" | "status_realizacao" | "publico_atingido">[];
  };

  if (Object.keys(mudancas).length === 0) return { mudou: false as const, meta: metaParaOAssistente(atual, await lerAtividades()) };

  const { data: atualizada, error: erroAoGravar } = await admin.from("prestacao_metas" as never).update(mudancas as never).eq("id", metaId).eq("prestacao_id", prestacaoId).select(COLUNAS_DA_META).single();
  if (erroAoGravar || !atualizada) {
    if (erroAoGravar?.code === "23514") throw new ErroMcp(400, "O banco recusou os valores da meta. Confira o realizado e a justificativa.");
    throw erroDoBanco(erroAoGravar);
  }

  try {
    const acaoId = await registrarAcao(admin, quem, {
      prestacaoId,
      ferramenta: "atualizar_meta",
      acao: "atualizar",
      tabela: "prestacao_metas",
      registroId: metaId,
      resumo: `Atualizou a meta “${atual.descricao.slice(0, 150)}”: ${Object.keys(mudancas).join(", ")}`,
      antes,
      depois: mudancas,
    });
    return { mudou: true as const, acao_id: acaoId, campos_mudados: Object.keys(mudancas), meta: metaParaOAssistente(atualizada as unknown as MetaLida, await lerAtividades()) };
  } catch (erro) {
    await admin.from("prestacao_metas" as never).update(antes as never).eq("id", metaId).eq("prestacao_id", prestacaoId);
    throw erro;
  }
}
