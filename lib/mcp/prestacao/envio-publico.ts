import type { Admin } from "@/lib/mcp/crm";
import { conferirEnvio, hashDoCodigo, prepararEnvio, type ContextoDaCaixa, type Destino, type EnderecoDeEnvio } from "@/lib/mcp/prestacao/caixa";
import { registrarAcao, type QuemGrava } from "@/lib/mcp/prestacao/gravacao";
import { MAX_ARQUIVOS_POR_ENVIO } from "@/lib/mcp/prestacao/tipos-de-envio";
import { ErroMcp, erroDoBanco } from "@/lib/mcp/validacao";

/**
 * A página de envio de arquivos (/enviar/{código}): quem recebe o link do assistente abre no navegador, sem login, e
 * manda os arquivos direto para o Storage. O link é o que autoriza: vale poucos minutos, para uma prestação e um destino,
 * com um número máximo de arquivos, e o banco guarda só o hash do código. Como o conector, esta parte escreve com a chave
 * de serviço, então cada passo confere de novo o que o link diz (a prestação e o destino vêm sempre da sessão, nunca do
 * pedido) e se quem criou o link ainda edita a prestação.
 */

/**
 * Depois que o link vence, ainda dá para conferir o que já tinha sido enviado (o último arquivo pode terminar de subir fora do
 * prazo), mas só por mais meia hora: nada de usar um link velho indefinidamente.
 */
export const JANELA_DE_CONCLUSAO_MS = 30 * 60 * 1000;

/** 32 bytes em base64url: o formato que criarLinkDeEnvio gera. Qualquer outra coisa nem chega ao banco. */
export const CODIGO_DO_LINK = /^[A-Za-z0-9_-]{43}$/;

export const COLUNAS_DA_SESSAO = "id,prestacao_id,usuario_id,chave_id,plataforma,destino,max_arquivos,enviados,expira_em,revogada_em,created_at";

export interface SessaoDeEnvio {
  id: string;
  prestacao_id: string;
  usuario_id: string | null;
  chave_id: string | null;
  plataforma: "claude" | "chatgpt" | "outro";
  destino: Destino;
  max_arquivos: number;
  enviados: number;
  expira_em: string;
  revogada_em: string | null;
  created_at: string;
}

export type SituacaoDoLink = "valido" | "inexistente" | "expirado" | "revogado" | "esgotado" | "sem_permissao";

/** O que a pessoa lê quando o link não vale, e o status da resposta da rota. Não diz nada da prestação. */
export const AVISO_DO_LINK: Record<Exclude<SituacaoDoLink, "valido">, { status: number; titulo: string; texto: string }> = {
  inexistente: { status: 404, titulo: "Link não encontrado", texto: "Confira o endereço recebido ou peça um novo link ao assistente." },
  expirado: { status: 410, titulo: "Este link expirou", texto: "Peça um novo link ao assistente." },
  revogado: { status: 410, titulo: "Este link foi desativado", texto: "Peça um novo link ao assistente." },
  esgotado: { status: 409, titulo: "Este link já recebeu todos os arquivos", texto: "Para enviar mais, peça um novo link ao assistente." },
  sem_permissao: { status: 403, titulo: "Este link não vale mais", texto: "Peça um novo link ao assistente." },
};

export interface LinkDeEnvio {
  situacao: SituacaoDoLink;
  /** Só quando o link vale. Antes disso quem tem o código não descobre nada da prestação. */
  sessao?: SessaoDeEnvio;
  prestacao?: { id: string; titulo: string; organization_id: string; organizacao: string | null };
}

/**
 * Confere o link: formato, existência, revogação, validade, vagas e se quem o criou ainda edita a prestação.
 * `aceitaVencido` (só até JANELA_DE_CONCLUSAO_MS depois do prazo) e `aceitaEsgotado` servem para concluir um envio já feito
 * (o último arquivo pode terminar de subir depois do prazo) sem abrir o link para arquivos novos.
 */
export async function conferirLink(admin: Admin, codigo: string, opcoes: { aceitaVencido?: boolean; aceitaEsgotado?: boolean } = {}): Promise<LinkDeEnvio> {
  if (!CODIGO_DO_LINK.test(codigo)) return { situacao: "inexistente" };
  const { data, error } = await admin
    .from("assistente_sessoes_envio" as never)
    .select(COLUNAS_DA_SESSAO)
    .eq("token_hash", hashDoCodigo(codigo))
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) return { situacao: "inexistente" };
  const sessao = data as unknown as SessaoDeEnvio;

  if (sessao.revogada_em) return { situacao: "revogado" };
  const vencimento = Date.parse(sessao.expira_em);
  if (!opcoes.aceitaVencido && vencimento <= Date.now()) return { situacao: "expirado" };
  if (opcoes.aceitaVencido && vencimento + JANELA_DE_CONCLUSAO_MS <= Date.now()) return { situacao: "expirado" };
  if (!opcoes.aceitaEsgotado && sessao.enviados >= sessao.max_arquivos) return { situacao: "esgotado" };

  // Quem criou o link precisa continuar editando a prestação (papel e módulo em vigor), senão o link morre junto.
  if (!sessao.usuario_id) return { situacao: "sem_permissao" };
  const { data: pode, error: erroPode } = await admin.rpc("fn_mcp_prestacao_pode" as never, { p_usuario: sessao.usuario_id, p_prestacao: sessao.prestacao_id, p_acao: "editar" } as never);
  if (erroPode) throw erroDoBanco(erroPode);
  if (pode !== true) return { situacao: "sem_permissao" };

  const { data: prestacao, error: erroPrestacao } = await admin.from("prestacoes_contas").select("id,titulo,organization_id").eq("id", sessao.prestacao_id).maybeSingle();
  if (erroPrestacao) throw erroDoBanco(erroPrestacao);
  if (!prestacao) return { situacao: "inexistente" };
  const dona = prestacao as unknown as { id: string; titulo: string; organization_id: string };
  const { data: organizacao } = await admin.from("organizations").select("nome").eq("id", dona.organization_id).maybeSingle();

  return {
    situacao: "valido",
    sessao,
    prestacao: { id: dona.id, titulo: dona.titulo, organization_id: dona.organization_id, organizacao: (organizacao as { nome?: string } | null)?.nome ?? null },
  };
}

type LinkValido = Required<Pick<LinkDeEnvio, "sessao" | "prestacao">>;

async function exigirLink(admin: Admin, codigo: string, opcoes: Parameters<typeof conferirLink>[2] = {}): Promise<LinkValido> {
  const link = await conferirLink(admin, codigo, opcoes);
  if (link.situacao !== "valido" || !link.sessao || !link.prestacao) {
    const aviso = AVISO_DO_LINK[link.situacao === "valido" ? "inexistente" : link.situacao];
    throw new ErroMcp(aviso.status, `${aviso.titulo}. ${aviso.texto}`, { situacao: link.situacao });
  }
  return { sessao: link.sessao, prestacao: link.prestacao };
}

const quemDoLink = (sessao: SessaoDeEnvio): QuemGrava => ({ usuarioId: sessao.usuario_id as string, chaveId: sessao.chave_id, plataforma: sessao.plataforma });

function contextoDoLink(admin: Admin, { sessao, prestacao }: LinkValido): ContextoDaCaixa {
  return { admin, organizationId: prestacao.organization_id, prestacaoId: sessao.prestacao_id, quem: quemDoLink(sessao) };
}

/**
 * Reserva vagas no link antes de entregar os endereços. A conta é feita pelo próprio banco (só atualiza se `enviados` ainda
 * é o que foi lido), então dois envios ao mesmo tempo não passam do máximo.
 */
async function reservarVagas(admin: Admin, sessao: SessaoDeEnvio, quantidade: number): Promise<SessaoDeEnvio> {
  let atual = sessao;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const restantes = atual.max_arquivos - atual.enviados;
    if (quantidade > restantes) {
      throw new ErroMcp(409, restantes <= 0 ? AVISO_DO_LINK.esgotado.titulo + ". " + AVISO_DO_LINK.esgotado.texto : `Este link aceita mais ${restantes} ${restantes === 1 ? "arquivo" : "arquivos"}.`, { situacao: "esgotado", restantes: Math.max(restantes, 0) });
    }
    const { data, error } = await admin
      .from("assistente_sessoes_envio" as never)
      .update({ enviados: atual.enviados + quantidade } as never)
      .eq("id", atual.id)
      .eq("enviados", atual.enviados)
      .select(COLUNAS_DA_SESSAO)
      .maybeSingle();
    if (error) throw erroDoBanco(error);
    if (data) return data as unknown as SessaoDeEnvio;
    // Outro envio chegou junto: lê de novo e confere as vagas outra vez.
    const { data: nova, error: erroLer } = await admin.from("assistente_sessoes_envio" as never).select(COLUNAS_DA_SESSAO).eq("id", atual.id).maybeSingle();
    if (erroLer) throw erroDoBanco(erroLer);
    if (!nova) throw new ErroMcp(404, AVISO_DO_LINK.inexistente.titulo + ". " + AVISO_DO_LINK.inexistente.texto, { situacao: "inexistente" });
    atual = nova as unknown as SessaoDeEnvio;
  }
  throw new ErroMcp(409, "Muitos envios ao mesmo tempo neste link. Tente de novo em instantes.");
}

/** Devolve vagas ao link quando o preparo falhou antes de entregar os endereços. Melhor esforço: nunca atrapalha quem chamou. */
async function devolverVagas(admin: Admin, sessaoId: string, quantidade: number): Promise<void> {
  try {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { data: atual } = await admin.from("assistente_sessoes_envio" as never).select("enviados").eq("id", sessaoId).maybeSingle();
      if (!atual) return;
      const enviados = (atual as unknown as { enviados: number }).enviados;
      const { data } = await admin
        .from("assistente_sessoes_envio" as never)
        .update({ enviados: Math.max(0, enviados - quantidade) } as never)
        .eq("id", sessaoId)
        .eq("enviados", enviados)
        .select("id")
        .maybeSingle();
      if (data) return;
    }
  } catch {
    // o link fica com menos vagas do que devia; ele vence em minutos
  }
}

export interface PreparoDaPagina {
  arquivos: EnderecoDeEnvio[];
  restantes: number;
}

/** Os endereços de envio para os arquivos que a pessoa escolheu na página: um por arquivo, no destino que o link manda. */
export async function prepararEnvioDaPagina(admin: Admin, codigo: string, nomes: readonly string[]): Promise<PreparoDaPagina> {
  const link = await exigirLink(admin, codigo);
  if (nomes.length === 0) throw new ErroMcp(400, "Escolha ao menos um arquivo.");
  if (nomes.length > MAX_ARQUIVOS_POR_ENVIO) throw new ErroMcp(400, `Envie até ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`);

  const reservada = await reservarVagas(admin, link.sessao, nomes.length);
  try {
    const arquivos = await prepararEnvio(contextoDoLink(admin, link), { destino: link.sessao.destino, origem: "pagina", nomes });
    return { arquivos, restantes: Math.max(reservada.max_arquivos - reservada.enviados, 0) };
  } catch (erro) {
    await devolverVagas(admin, link.sessao.id, nomes.length);
    throw erro;
  }
}

export interface ArquivoConcluido {
  arquivo_id: string;
  nome: string;
  resultado: "chegou" | "ainda_nao_chegou" | "recusado" | "repetido";
  motivo?: string;
}

export interface ConclusaoDaPagina {
  arquivos: ArquivoConcluido[];
  chegaram: number;
  restantes: number;
}

/**
 * Confere o que a pessoa acabou de enviar: tamanho, tipo pelo conteúdo e impressão digital. O que não serve sai de circulação
 * e NÃO devolve a vaga: um link prepara no máximo o número de arquivos que ele aceita, aconteça o que acontecer com eles (quem
 * erra um envio pede outro link). Só entram na conta os arquivos que este link preparou: os ids que a página recebeu, enviados
 * pela página, dentro da vida do link.
 */
export async function concluirEnvioDaPagina(admin: Admin, codigo: string, ids: readonly string[]): Promise<ConclusaoDaPagina> {
  const link = await exigirLink(admin, codigo, { aceitaVencido: true, aceitaEsgotado: true });
  // Sem ids, a conferência olharia tudo que espera na prestação: aqui nunca.
  if (ids.length === 0) throw new ErroMcp(400, "Informe os arquivos enviados.");
  if (ids.length > MAX_ARQUIVOS_POR_ENVIO) throw new ErroMcp(400, `Informe até ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`);

  const contexto = contextoDoLink(admin, link);
  const resultados = await conferirEnvio(contexto, {
    ids,
    destino: link.sessao.destino,
    origem: "pagina",
    desde: link.sessao.created_at,
    ate: new Date(Date.parse(link.sessao.expira_em) + JANELA_DE_CONCLUSAO_MS).toISOString(),
  });

  const chegaram = resultados.filter(r => r.resultado === "chegou");
  if (chegaram.length > 0) {
    await registrarAcao(admin, quemDoLink(link.sessao), {
      prestacaoId: link.sessao.prestacao_id,
      ferramenta: "pagina_de_envio",
      acao: "criar",
      tabela: "assistente_arquivos",
      resumo: `Recebeu ${chegaram.length} ${chegaram.length === 1 ? "arquivo" : "arquivos"} pela página de envio (${link.sessao.destino === "despesa" ? "despesas" : "evidências"})`,
    }).catch(() => undefined);
  }

  const { data: atual } = await admin.from("assistente_sessoes_envio" as never).select("enviados,max_arquivos").eq("id", link.sessao.id).maybeSingle();
  const vagas = atual as unknown as { enviados: number; max_arquivos: number } | null;
  return {
    arquivos: resultados.map(r => ({ arquivo_id: r.linha.id, nome: r.linha.nome_arquivo, resultado: r.resultado, ...(r.motivo ? { motivo: r.motivo } : {}) })),
    chegaram: chegaram.length,
    restantes: vagas ? Math.max(vagas.max_arquivos - vagas.enviados, 0) : 0,
  };
}

// ─── Leitura do pedido ──────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Os nomes dos arquivos escolhidos, na ordem em que a página mandou (a resposta volta na mesma ordem; por isso repetidos não são juntados). */
export function nomesDoCorpo(corpo: Record<string, unknown>): string[] {
  const valor = corpo.nomes;
  if (!Array.isArray(valor) || valor.length === 0) throw new ErroMcp(400, "Escolha ao menos um arquivo.");
  if (valor.length > MAX_ARQUIVOS_POR_ENVIO) throw new ErroMcp(400, `Envie até ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`);
  return valor.map(item => {
    if (typeof item !== "string" || !item.trim() || item.length > 300) throw new ErroMcp(400, "O nome de um dos arquivos não é válido.");
    return item.trim();
  });
}

/** Os ids dos arquivos que a página acabou de enviar, em minúsculas e sem repetidos. */
export function idsDoCorpo(corpo: Record<string, unknown>): string[] {
  const valor = corpo.arquivo_ids;
  if (!Array.isArray(valor) || valor.length === 0) throw new ErroMcp(400, "Informe os arquivos enviados.");
  if (valor.length > MAX_ARQUIVOS_POR_ENVIO) throw new ErroMcp(400, `Informe até ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`);
  const ids = valor.map(item => {
    if (typeof item !== "string" || !UUID.test(item)) throw new ErroMcp(400, "Um dos arquivos informados não é válido.");
    return item.toLowerCase();
  });
  return [...new Set(ids)];
}
