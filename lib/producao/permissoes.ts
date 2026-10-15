// Permissões da produção na edição do membro (plano do módulo, PD0.7b): quem
// recebe a ação na tela de Equipe, o que o modal oferece a cada papel, como o
// valor da alçada é lido e o que se diz quando o banco recusa.
//
// Quem decide é o banco (fn_producao_definir_funcao e as auth_producao_* de
// supabase/migrations/*_producao_permissoes.sql): aqui a tela evita pedir o que
// ele recusaria e explica a recusa em português. Este arquivo não sabe de tela
// nem de banco; as chamadas ao banco estão em permissoes-banco.ts.
//
// O que a pessoa pode, pela regra do banco (auth_producao_papel_permite):
// - administrador vê e aprova tudo: não precisa de função, a tela não a oferece;
// - colaborador: vê o dinheiro se o admin marcar, e aprova pedidos até a alçada
//   (a alçada só vale com o dinheiro);
// - leitor: vê o dinheiro se o admin marcar, mas nunca aprova;
// - captador e proponente nunca usam a produção.

import type { ModuloId } from "@/lib/modulos";
import { formatarValorBRL, formatarValorCompleto, formatarValorCurto, lerValorBRL, MENSAGEM_VALOR_INVALIDO } from "@/lib/valor";

/** A produção, como o módulo aparece em organizations.modulos_ativos e em organization_members.modulos_acesso. */
const PRODUCAO: ModuloId = "producao";

/** O recorte da pessoa na produção (`producao_funcoes.escopo`). */
export type EscopoDaProducao = "organizacao" | "vinculado";

/** A função da pessoa na produção, como `producao_funcoes` a guarda. */
export type FuncaoNaProducao = {
  /** Vê o dinheiro da produção (orçamento, cachês, pagamentos). */
  dinheiro: boolean;
  /** Aprova pedidos até este valor, em reais; nula = não aprova. Só vale com `dinheiro`. */
  alcada: number | null;
  escopo: EscopoDaProducao;
};

/** Sem registro em `producao_funcoes`: sem dinheiro, sem alçada, a organização inteira (o padrão do banco). */
export const SEM_FUNCAO: FuncaoNaProducao = { dinheiro: false, alcada: null, escopo: "organizacao" };

/** As funções da organização por pessoa (id do usuário). */
export type FuncoesPorPessoa = Record<string, FuncaoNaProducao>;

// ─── Quem recebe a ação ─────────────────────────────────────────────────────

export type PapelDaProducao = "admin" | "colaborador" | "leitor";

/**
 * O papel da organização na linguagem da produção. "visualizador" é o nome antigo
 * do colaborador (o banco e as telas o tratam assim). Captador, proponente (os
 * externos de PAPEIS_EXTERNOS) e papel desconhecido caem no padrão e não usam a
 * produção: papel novo nasce sem acesso, como no banco.
 */
export function papelNaProducao(papel: string): PapelDaProducao | null {
  switch (papel) {
    case "admin": return "admin";
    case "colaborador":
    case "visualizador": return "colaborador";
    case "leitor": return "leitor";
    default: return null;
  }
}

/** O pedaço do membro da equipe que a decisão precisa. */
export type MembroParaPermissoes = {
  user_id: string;
  papel: string;
  /** Módulos que a pessoa usa; a rota de membros devolve ["captacao"] quando vazio. */
  modulos_acesso?: readonly string[] | null;
  full_name?: string | null;
  email?: string | null;
};

/** O que a edição do membro oferece: sempre o dinheiro; a alçada só ao colaborador (o leitor nunca aprova). */
export type OfertaDePermissoes = { alcada: boolean };

/**
 * A ação "Permissões da produção" na tela de Equipe. Só o administrador da
 * organização a vê, e só para membro interno (colaborador ou leitor) que usa a
 * produção, numa organização que a tem em vigor: com a produção só para leitura
 * o banco recusa a função (modulo_inativo), e a organização sem a produção fica
 * exatamente como era. Devolve null quando não há o que oferecer.
 */
export function ofertaDePermissoes(entrada: {
  souAdmin: boolean;
  /** Módulos em vigor na organização (organizations.modulos_ativos). */
  modulosDaOrganizacao: readonly ModuloId[];
  membro: Pick<MembroParaPermissoes, "papel" | "modulos_acesso">;
}): OfertaDePermissoes | null {
  const { souAdmin, modulosDaOrganizacao, membro } = entrada;
  if (!souAdmin || !modulosDaOrganizacao.includes(PRODUCAO)) return null;
  if (!membro.modulos_acesso?.includes(PRODUCAO)) return null;
  const papel = papelNaProducao(membro.papel);
  if (papel !== "colaborador" && papel !== "leitor") return null;
  return { alcada: papel === "colaborador" };
}

// ─── O valor da alçada ──────────────────────────────────────────────────────

/** A maior alçada que o banco aceita: numeric(14,2), e `alcada_invalida` a partir de 1 trilhão. */
export const ALCADA_MAXIMA = 999_999_999_999.99;
const ALCADA_MAXIMA_EM_CENTAVOS = 99_999_999_999_999;

export const MENSAGEM_ALCADA_ACIMA_DO_LIMITE = `O valor máximo é R$ ${formatarValorBRL(ALCADA_MAXIMA)}.`;

export type LeituraDaAlcada = { ok: true; alcada: number | null } | { ok: false; erro: string };

/**
 * Lê o valor digitado em reais ("5.000,00"). Campo vazio = não aprova (null).
 * O resultado é sempre um número finito de 0 a ALCADA_MAXIMA, com no máximo dois
 * decimais, contado em centavos para não herdar erro de ponto flutuante. O que
 * não é número, tem mais de dois decimais ou passa do limite é recusado aqui,
 * antes de chamar o banco.
 */
export function lerAlcada(texto: string): LeituraDaAlcada {
  const { valor, valido } = lerValorBRL(texto);
  // Depois da vírgula só cabem os centavos: "1,555" e "1,5.6" não são valores (lerValorBRL arredondaria).
  const centavosDigitados = texto.replace(/R\$|\s/g, "").split(",")[1];
  if (!valido || (centavosDigitados !== undefined && !/^\d{0,2}$/.test(centavosDigitados))) {
    return { ok: false, erro: MENSAGEM_VALOR_INVALIDO };
  }
  if (valor === null) return { ok: true, alcada: null };
  const centavos = Math.round(valor * 100);
  if (!Number.isSafeInteger(centavos) || centavos < 0 || centavos > ALCADA_MAXIMA_EM_CENTAVOS) {
    return { ok: false, erro: MENSAGEM_ALCADA_ACIMA_DO_LIMITE };
  }
  return { ok: true, alcada: centavos / 100 };
}

/** A alçada como o campo a mostra ("5.000,00"); vazio quando a pessoa não aprova. */
export function textoDaAlcada(alcada: number | null): string {
  return formatarValorBRL(alcada);
}

// ─── O pedido ao banco ──────────────────────────────────────────────────────

/** O que fn_producao_definir_funcao recebe da pessoa-alvo, fora a organização e o usuário. */
export type PedidoDePermissoes = FuncaoNaProducao;

type MontagemDoPedido = { ok: true; pedido: PedidoDePermissoes } | { ok: false; erro: string };

/**
 * O pedido a partir do que o modal mostra. A alçada só segue quando o modal a
 * oferece (colaborador) e o dinheiro está marcado: sem dinheiro o banco recusa
 * (alcada_sem_dinheiro), e o leitor nunca aprova, então para ele a alçada vai
 * sempre vazia, inclusive limpando uma que sobrou de quando era colaborador.
 */
export function montarPedido(entrada: {
  comAlcada: boolean;
  dinheiro: boolean;
  textoAlcada: string;
  /** A função que a pessoa tem hoje; null = sem registro. */
  atual: FuncaoNaProducao | null;
}): MontagemDoPedido {
  const { comAlcada, dinheiro, textoAlcada, atual } = entrada;
  let alcada: number | null = null;
  if (comAlcada && dinheiro) {
    const lida = lerAlcada(textoAlcada);
    if (!lida.ok) return lida;
    alcada = lida.alcada;
  }
  // O recorte "só as temporadas e os espaços em que está" ainda não se oferece: o
  // banco o trata como "falha fechado" até a PD1.9 (quem o tem não vê nada). Ao
  // salvar, o escopo que a pessoa já tem volta como está.
  return { ok: true, pedido: { dinheiro, alcada, escopo: atual?.escopo ?? SEM_FUNCAO.escopo } };
}

/** O pedido não muda nada do que a pessoa tem (sem registro vale o padrão): fechar basta, sem tocar no banco. */
export function semMudancas(atual: FuncaoNaProducao | null, pedido: PedidoDePermissoes): boolean {
  const base = atual ?? SEM_FUNCAO;
  return base.dinheiro === pedido.dinheiro && base.alcada === pedido.alcada && base.escopo === pedido.escopo;
}

// ─── O que a tela mostra ────────────────────────────────────────────────────

/**
 * A alçada no resumo: "R$ 5.000" quando o valor é inteiro e abaixo de 1 milhão;
 * senão o valor exato ("R$ 7.500,50", "R$ 1.500.000,00"). O formato abreviado
 * ("R$ 1,5 mi") arredonda, e um limite de aprovação não pode parecer maior ou
 * menor do que é.
 */
function alcadaParaOResumo(alcada: number): string {
  return Number.isInteger(alcada) && alcada < 1_000_000 ? formatarValorCurto(alcada) : formatarValorCompleto(alcada);
}

/**
 * O resumo ao lado da ação ("Vê o dinheiro · aprova até R$ 5.000"); null quando a
 * pessoa não vê o dinheiro, que é o padrão e não pede aviso. O leitor nunca
 * aprova, então a alçada que sobrou de outro papel não aparece.
 */
export function resumoDasPermissoes(funcao: FuncaoNaProducao | null | undefined, comAlcada: boolean): string | null {
  if (!funcao?.dinheiro) return null;
  const partes = ["Vê o dinheiro"];
  if (comAlcada && funcao.alcada !== null) partes.push(`aprova até ${alcadaParaOResumo(funcao.alcada)}`);
  return partes.join(" · ");
}

function lerNumero(valor: unknown): number | null {
  const numero = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  return typeof numero === "number" && Number.isFinite(numero) ? numero : null;
}

/** Lê as linhas de `producao_funcoes` vindas do banco; linha sem pessoa é ignorada. */
export function lerFuncoes(linhas: unknown): FuncoesPorPessoa {
  const funcoes: FuncoesPorPessoa = {};
  if (!Array.isArray(linhas)) return funcoes;
  for (const linha of linhas) {
    if (typeof linha !== "object" || linha === null) continue;
    const { user_id: pessoa, dinheiro, alcada, escopo } = linha as Record<string, unknown>;
    if (typeof pessoa !== "string") continue;
    funcoes[pessoa] = {
      dinheiro: dinheiro === true,
      alcada: lerNumero(alcada),
      escopo: escopo === "vinculado" ? "vinculado" : "organizacao",
    };
  }
  return funcoes;
}

// ─── Quando o banco recusa ──────────────────────────────────────────────────

/** Para o erro que a pessoa não resolve (dado fora do formato, falha de rede, erro desconhecido). */
export const MENSAGEM_ERRO_DAS_PERMISSOES = "Não foi possível salvar as permissões. Tente de novo.";

/**
 * Os erros de fn_producao_definir_funcao, em linguagem da tela, no molde de
 * mensagemErroAcesso (lib/modulos-contrato.ts). O banco devolve o código como
 * mensagem. Recusa de permissão não é falha técnica: diz quem pode.
 */
const ERROS_DAS_PERMISSOES: Record<string, string> = {
  nao_autenticado: "Sua sessão expirou. Entre de novo para continuar.",
  sem_permissao: "Só quem administra a organização pode mudar as permissões da produção.",
  dados_invalidos: MENSAGEM_ERRO_DAS_PERMISSOES,
  escopo_invalido: MENSAGEM_ERRO_DAS_PERMISSOES,
  alcada_invalida: MENSAGEM_ALCADA_ACIMA_DO_LIMITE,
  alcada_sem_dinheiro: "Para aprovar pedidos, a pessoa precisa ver o dinheiro da produção.",
  membro_inexistente: "Essa pessoa não faz parte da organização.",
  captador_sem_modulo: "Captadores e proponentes externos não usam a produção.",
  modulo_inativo: "A organização não tem a produção ativa.",
  pessoa_sem_producao: "Essa pessoa não tem acesso à produção. Libere o acesso antes.",
};

/** Os códigos que a tela explica, para o teste conferir que cobrem os da função do banco. */
export const CODIGOS_DE_ERRO_DAS_PERMISSOES: readonly string[] = Object.keys(ERROS_DAS_PERMISSOES);

export function mensagemErroPermissoes(erro: { message?: string | null } | null | undefined): string {
  const mensagem = erro?.message ?? "";
  const codigo = CODIGOS_DE_ERRO_DAS_PERMISSOES.find(chave => mensagem.includes(chave));
  return codigo ? ERROS_DAS_PERMISSOES[codigo] : MENSAGEM_ERRO_DAS_PERMISSOES;
}
