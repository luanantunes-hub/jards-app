// Validação em tempo de execução dos regimes (P1.1, ampliada na P1.11).
//
// Os tipos continuam em tipos.ts; o schema é anotado com eles, então o
// compilador acusa qualquer diferença entre os dois. Serve para conferir os
// regimes do código antes de gerar o seed e, depois, o que vier do banco ou
// das propostas do agente normativo. As referências internas (grupo de custo
// de um teto, prazo citado por uma dimensão) são conferidas aqui também.

import { z } from "zod";
import type { RegimeNormativo } from "./tipos";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD");
const texto = z.string().min(1);
const codigo = z.string().regex(/^[a-z][a-z0-9_]*$/, "código em minúsculas, números e _");

const fonte = z.object({
  documento: texto,
  dispositivo: texto,
  citacao: texto.optional(),
  aConfirmar: z.boolean().optional(),
  nota: texto.optional(),
});

const lacuna = z.object({
  lacuna: z.enum(["nao_se_aplica", "norma_silente"]),
  motivo: texto,
  fonte,
});

/** Dimensão: a lacuna explicada ou o conteúdo. */
function dimensao<T extends z.ZodType>(conteudo: T) {
  return z.union([lacuna, conteudo]);
}

const severidade = z.enum(["bloqueio", "alerta", "info"]);

const regra = z.object({
  codigo,
  descricao: texto,
  severidade,
  parametros: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  fonte,
});
const regras = z.array(regra);

const area = z.enum(["cultura", "esporte", "audiovisual", "saude", "outro"]);

const base = z.enum([
  "valor_captado", "valor_projeto", "valor_total_projeto", "valor_aprovado_execucao",
  "valor_homologado_execucao", "valor_autorizado_captacao", "valor_atividade_fim", "orcamento_producao",
  "valor_executado",
]);

const marco = z.enum([
  "fim_vigencia", "conclusao_objeto", "fim_exercicio", "fim_captacao", "envio_prestacao",
  "ciencia_diligencia", "registro_decisao", "ciencia_decisao", "submissao_peca",
  "protocolo_alteracao", "assinatura_termo", "liberacao_recursos",
]);

const regraPrazo = {
  quantidade: z.number().int().positive(),
  unidade: z.enum(["dias_corridos", "dias_uteis", "meses", "anos"]),
  prorrogaParaDiaUtil: z.boolean().optional(),
};

const prazo = z.object({
  ...regraPrazo,
  descricao: texto,
  responsavel: z.enum(["proponente", "orgao"]),
  marco,
  fonte,
});

const percentual = z.number().gt(0).max(100);

const meioPagamento = z.enum(["pix", "ted", "doc", "boleto", "cheque", "saque", "cartao", "debito_automatico", "cambio"]);

const aplicabilidade = z.object({
  criterio: z.enum(["protocolo_projeto", "aprovacao_projeto", "assinatura_termo", "ato_praticado"]),
  desde: data.nullable(),
  ate: data.nullable(),
  descricao: texto,
  sucede: z.array(codigo),
  fonte,
}).refine(a => !a.desde || !a.ate || a.ate >= a.desde, "ate antes de desde");

const prestacaoParcial = z.object({
  modalidades: z.array(z.enum(["continua", "periodica", "por_parcela", "a_criterio_do_orgao"])).min(1),
  descricao: texto,
  prazo: texto.nullable(),
  regras,
  fonte,
});

const baseDefinida = z.object({
  descricao: texto,
  soma: z.union([z.literal("todos"), z.array(codigo).min(1)]),
  exceto: z.array(codigo),
  fonte,
});

const orcamento = z.object({
  estrutura: z.object({ niveis: z.array(texto).min(1), descricao: texto, fonte }),
  grupos: z.array(z.object({ codigo, rotulo: texto, descricao: texto, fonte })).min(1),
  bases: z.object({
    valor_projeto: baseDefinida.optional(),
    valor_total_projeto: baseDefinida.optional(),
    valor_aprovado_execucao: baseDefinida.optional(),
    valor_atividade_fim: baseDefinida.optional(),
    orcamento_producao: baseDefinida.optional(),
  }),
  tetos: z.array(z.object({
    codigo,
    descricao: texto,
    grupos: z.array(codigo).min(1),
    percentual,
    base,
    teto: z.number().positive().optional(),
    proporcionalAoCaptado: z.boolean().optional(),
    severidade,
    fonte,
  })),
  regras,
});

const condicao = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("mantem_grupos"), grupos: z.array(codigo).min(1), descricao: texto, fonte }),
  z.object({ tipo: z.literal("movido_ate"), percentual, base, acumulado: z.boolean(), descricao: texto, fonte }),
  z.object({ tipo: z.literal("pedido_numero"), numeros: z.array(z.number().int().positive()).min(1), descricao: texto, fonte }),
]);

const requisito = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("captado_minimo"), percentual, base, severidade, descricao: texto, fonte }),
  z.object({ tipo: z.literal("acumulado_maximo"), percentual, base, severidade, descricao: texto, fonte }),
  z.object({ tipo: z.literal("tetos"), severidade, descricao: texto, fonte }),
  z.object({ tipo: z.literal("maximo_pedidos"), quantidade: z.number().int().positive(), severidade, descricao: texto, fonte }),
  z.object({ tipo: z.literal("antecedencia"), quantidade: z.number().int().positive(), unidade: z.enum(["dias_corridos", "meses"]), severidade, descricao: texto, fonte }),
]);

const regraTipoAlteracao = z.object({
  permitido: z.boolean(),
  classificacao: z.enum(["administrativa", "formal"]),
  condicoes: z.array(condicao),
  requisitos: z.array(requisito),
  orientacoes: regras,
  fonte,
});

const alteracoes = z.object({
  janela: z.object({
    aPartirDe: z.enum(["liberacao", "assinatura_termo"]).nullable(),
    ate: z.literal("fim_execucao").nullable(),
    descricao: texto,
    fonte,
  }),
  tipos: z.object({
    remanejamento: regraTipoAlteracao,
    complementacao: regraTipoAlteracao,
    reducao: regraTipoAlteracao,
    inclusao: regraTipoAlteracao,
  }),
  alertasPorItem: z.array(z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("variacao_item"), percentual, descricao: texto, fonte }),
    z.object({ tipo: z.literal("item_ja_alterado"), descricao: texto, fonte }),
  ])),
  prazoAnalise: texto.nullable(),
  silencioAprova: z.boolean(),
  regras,
  fonte,
});

const fornecedores = z.object({
  limites: z.array(z.object({
    codigo,
    descricao: texto,
    escopo: z.enum(["fornecedor", "proponente_e_relacionados", "proponente_pf_mei"]),
    base,
    faixas: z.array(z.object({ percentual, severidade, consequencia: texto })).min(1),
    excecoes: z.array(z.object({ descricao: texto, fonte })),
    fonte,
  })),
  partesRelacionadas: z.object({ descricao: texto, fonte }).nullable(),
  regras,
  fonte,
});

const contas = z.object({
  contas: z.array(z.object({
    tipo: z.enum(["captacao", "movimento", "recolhimento", "aplicacao"]),
    descricao: texto,
    abertaPor: z.enum(["orgao", "proponente"]),
  })).min(1),
  bancos: z.array(texto),
  descricao: texto,
  tarifas: z.object({ regra: z.enum(["isentas", "vedadas", "so_manutencao", "admitidas", "norma_silente"]), descricao: texto, fonte }),
  liberacao: z.object({ descricao: texto, percentualMinimo: percentual.nullable(), base: base.nullable(), fonte }),
  rendimentos: z.object({
    aplicacao: z.enum(["automatica", "obrigatoria", "facultativa", "norma_silente"]),
    contamComoCaptado: z.boolean().nullable(),
    uso: texto,
    fonte,
  }),
  saldo: z.object({ descricao: texto, prazo: texto.nullable(), fonte }),
  regras,
  fonte,
});

const pagamentos = z.object({
  meiosPermitidos: z.array(meioPagamento).min(1).nullable(),
  meiosVedados: z.array(meioPagamento),
  descricao: texto,
  documentoFiscal: regras,
  regras,
  fonte,
});

const despesas = z.object({
  periodo: z.object({ descricao: texto, fonte }),
  vedadas: z.array(z.object({ codigo, descricao: texto, fonte })),
  regras,
  fonte,
});

const porte = z.object({
  base,
  faixas: z.array(z.object({ nome: texto, ate: z.number().positive().nullable() })).min(1),
  regras,
  fonte,
});

const objeto = z.object({ descricao: texto, regras, fonte });

const divulgacao = z.object({
  marcas: z.array(texto),
  aprovacaoPrevia: z.object({ exigida: z.boolean(), prazo: texto.nullable(), silencioAprova: z.boolean(), descricao: texto, fonte }),
  defeso: z.object({ descricao: texto, fonte }).nullable(),
  regras,
  fonte,
});

const envio = z.object({
  sistema: texto,
  descricao: texto,
  documentos: z.array(z.object({
    codigo,
    descricao: texto,
    em: z.array(z.enum(["parcial", "final"])).min(1),
    obrigatorio: z.boolean(),
    fonte,
  })),
  modelos: z.array(z.object({ codigo, nome: texto, formato: texto, arquivo: texto.nullable(), fonte })),
  regras,
  fonte,
});

const posEnvio = z.object({
  resultados: z.array(z.object({
    resultado: z.enum(["aprovada", "aprovada_ressalvas", "aprovada_parcialmente", "reprovada"]),
    descricao: texto,
    fonte,
  })).min(1),
  devolucao: z.object({
    descricao: texto,
    atualizacao: texto,
    gru: z.array(z.object({ unidadeGestora: texto, gestao: texto.nullable(), codigo: texto, referencia: texto, fonte })),
    fonte,
  }),
  regras,
  fonte,
});

const guarda = z.object({ ...regraPrazo, marco, descricao: texto, fonte });

const regimeBase = z.object({
  codigo,
  versao: z.number().int().positive(),
  nome: texto,
  area,
  mecanismo: texto,
  esfera: z.enum(["federal", "estadual", "municipal"]),
  orgao: texto,
  sistemaOficial: texto.nullable(),
  normaReferencia: texto,
  vigenteDesde: data.nullable(),
  identificadorOficial: z.object({ tipo: texto, rotulo: texto }).nullable(),
  fontes: z.array(z.object({ documento: texto, url: z.url() })),
  aplicabilidade: dimensao(aplicabilidade),
  prazos: z.record(z.string(), z.union([lacuna, prazo])),
  prestacaoParcial: dimensao(prestacaoParcial),
  orcamento: dimensao(orcamento),
  alteracoes: dimensao(alteracoes),
  fornecedores: dimensao(fornecedores),
  contas: dimensao(contas),
  pagamentos: dimensao(pagamentos),
  despesas: dimensao(despesas),
  porte: dimensao(porte),
  objeto: dimensao(objeto),
  divulgacao: dimensao(divulgacao),
  envio: dimensao(envio),
  posEnvio: dimensao(posEnvio),
  guarda: dimensao(guarda),
});

type Problema = { caminho: (string | number)[]; mensagem: string };

/** Referências internas: grupos citados existem, prazos citados existem, bases do orçamento definidas. */
function referencias(regime: z.infer<typeof regimeBase>): Problema[] {
  const problemas: Problema[] = [];
  const prazos = new Set(Object.keys(regime.prazos));
  const prazoExiste = (chave: string | null, caminho: (string | number)[]) => {
    if (chave !== null && !prazos.has(chave)) problemas.push({ caminho, mensagem: `prazo "${chave}" não existe em prazos` });
  };

  const orc = "lacuna" in regime.orcamento ? null : regime.orcamento;
  const grupos = new Set(orc?.grupos.map(g => g.codigo) ?? []);
  const grupoExiste = (lista: string[], caminho: (string | number)[]) => {
    if (!orc) return;
    for (const g of lista) if (!grupos.has(g)) problemas.push({ caminho, mensagem: `grupo "${g}" não está em orcamento.grupos` });
  };
  const baseExiste = (b: string, caminho: (string | number)[]) => {
    const doOrcamento = ["valor_projeto", "valor_total_projeto", "valor_aprovado_execucao", "valor_atividade_fim", "orcamento_producao"];
    if (orc && doOrcamento.includes(b) && !(b in orc.bases)) problemas.push({ caminho, mensagem: `base "${b}" não está definida em orcamento.bases` });
  };

  if (orc) {
    const repetidos = orc.grupos.map(g => g.codigo).filter((c, i, todos) => todos.indexOf(c) !== i);
    if (repetidos.length) problemas.push({ caminho: ["orcamento", "grupos"], mensagem: `grupo repetido: ${repetidos.join(", ")}` });
    for (const [chave, b] of Object.entries(orc.bases)) {
      if (b && b.soma !== "todos") grupoExiste(b.soma, ["orcamento", "bases", chave, "soma"]);
      if (b) grupoExiste(b.exceto, ["orcamento", "bases", chave, "exceto"]);
    }
    orc.tetos.forEach((t, i) => {
      grupoExiste(t.grupos, ["orcamento", "tetos", i, "grupos"]);
      baseExiste(t.base, ["orcamento", "tetos", i, "base"]);
    });
  }

  if (!("lacuna" in regime.alteracoes)) {
    const alt = regime.alteracoes;
    prazoExiste(alt.prazoAnalise, ["alteracoes", "prazoAnalise"]);
    for (const [tipo, r] of Object.entries(alt.tipos)) {
      r.condicoes.forEach((c, i) => {
        if (c.tipo === "mantem_grupos") grupoExiste(c.grupos, ["alteracoes", "tipos", tipo, "condicoes", i, "grupos"]);
        if (c.tipo === "movido_ate") baseExiste(c.base, ["alteracoes", "tipos", tipo, "condicoes", i, "base"]);
      });
      r.requisitos.forEach((req, i) => {
        if (req.tipo === "captado_minimo" || req.tipo === "acumulado_maximo") baseExiste(req.base, ["alteracoes", "tipos", tipo, "requisitos", i, "base"]);
      });
    }
  }
  if (!("lacuna" in regime.prestacaoParcial)) prazoExiste(regime.prestacaoParcial.prazo, ["prestacaoParcial", "prazo"]);
  if (!("lacuna" in regime.contas)) prazoExiste(regime.contas.saldo.prazo, ["contas", "saldo", "prazo"]);
  if (!("lacuna" in regime.divulgacao)) prazoExiste(regime.divulgacao.aprovacaoPrevia.prazo, ["divulgacao", "aprovacaoPrevia", "prazo"]);
  return problemas;
}

export const regimeSchema: z.ZodType<RegimeNormativo> = regimeBase.superRefine((regime, ctx) => {
  for (const p of referencias(regime)) ctx.addIssue({ code: "custom", path: p.caminho, message: p.mensagem });
});

export type ResultadoValidacao = { ok: true } | { ok: false; erros: string[] };

type Issue = { path: PropertyKey[]; message: string; code?: string; errors?: Issue[][] };

/**
 * Uma dimensão é "lacuna ou conteúdo": quando as duas formas falham, o zod
 * devolve um erro de união. Aqui ele vira os erros da forma que chegou mais
 * perto (a com menos problemas), com o caminho completo.
 */
function achatar(issue: Issue): { caminho: PropertyKey[]; mensagem: string }[] {
  if (issue.code === "invalid_union" && issue.errors?.length) {
    const melhor = [...issue.errors].sort((a, b) => a.length - b.length)[0];
    return melhor.flatMap(sub => achatar(sub).map(e => ({ caminho: [...issue.path, ...e.caminho], mensagem: e.mensagem })));
  }
  return [{ caminho: issue.path, mensagem: issue.message }];
}

/** Confere um regime e devolve os problemas em texto (caminho: mensagem). */
export function validarRegime(regime: unknown): ResultadoValidacao {
  const resultado = regimeSchema.safeParse(regime);
  if (resultado.success) return { ok: true };
  return {
    ok: false,
    erros: (resultado.error.issues as unknown as Issue[])
      .flatMap(achatar)
      .map(e => `${e.caminho.map(String).join(".") || "(regime)"}: ${e.mensagem}`),
  };
}
