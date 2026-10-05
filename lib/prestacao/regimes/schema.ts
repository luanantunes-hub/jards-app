// Validação em tempo de execução dos regimes (P1.1).
//
// Os tipos continuam em tipos.ts; o schema é anotado com eles, então o
// compilador acusa qualquer diferença entre os dois. Serve para conferir os
// regimes do código antes de gerar o seed e, depois, o que vier do banco ou
// das propostas do agente normativo.

import { z } from "zod";
import type { RegimeNormativo } from "./tipos";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD");

const fonte = z.object({
  documento: z.string().min(1),
  dispositivo: z.string().min(1),
  citacao: z.string().min(1).optional(),
  aConfirmar: z.boolean().optional(),
  nota: z.string().min(1).optional(),
});

const area = z.enum(["cultura", "esporte", "audiovisual", "saude", "outro"]);

const base = z.enum([
  "valor_captado", "valor_projeto", "valor_total_projeto", "valor_aprovado_execucao", "valor_homologado_execucao",
]);

const marco = z.enum([
  "fim_vigencia", "envio_prestacao", "ciencia_diligencia", "registro_decisao",
  "ciencia_decisao", "submissao_peca", "protocolo_alteracao",
]);

const regraPrazo = {
  quantidade: z.number().int().positive(),
  unidade: z.enum(["dias_corridos", "dias_uteis", "meses", "anos"]),
  prorrogaParaDiaUtil: z.boolean().optional(),
};

const prazo = z.object({
  ...regraPrazo,
  descricao: z.string().min(1),
  responsavel: z.enum(["proponente", "orgao"]),
  marco,
  fonte,
});

const limite = z.object({
  descricao: z.string().min(1),
  percentual: z.number().gt(0).max(100),
  base,
  teto: z.number().positive().optional(),
  fonte,
});

const meioPagamento = z.enum(["pix", "ted", "doc", "boleto", "cheque", "saque", "cartao", "debito_automatico", "cambio"]);

export const regimeSchema: z.ZodType<RegimeNormativo> = z.object({
  codigo: z.string().regex(/^[a-z0-9_]+$/, "código em minúsculas, números e _"),
  versao: z.number().int().positive(),
  nome: z.string().min(1),
  area,
  mecanismo: z.string().min(1),
  esfera: z.enum(["federal", "estadual", "municipal"]),
  orgao: z.string().min(1),
  sistemaOficial: z.string().min(1).nullable(),
  normaReferencia: z.string().min(1),
  vigenteDesde: data.nullable(),
  identificadorOficial: z.object({ tipo: z.string().min(1), rotulo: z.string().min(1) }).nullable(),
  prazos: z.record(z.string(), prazo),
  limites: z.record(z.string(), limite),
  pagamentos: z.object({
    meiosPermitidos: z.array(meioPagamento).min(1).nullable(),
    fonte: fonte.nullable(),
  }).refine(p => p.meiosPermitidos === null || p.fonte !== null, "meio de pagamento restrito precisa de fonte"),
  contas: z.object({
    descricao: z.string().min(1),
    bancos: z.array(z.string().min(1)),
    fonte,
  }).nullable(),
  guarda: z.object({ ...regraPrazo, marco, fonte }).nullable(),
  porte: z.object({
    base,
    faixas: z.array(z.object({ nome: z.string().min(1), ate: z.number().positive().nullable() })).min(1),
    fonte,
  }).nullable(),
  fontes: z.array(z.object({ documento: z.string().min(1), url: z.url() })),
});

export type ResultadoValidacao = { ok: true } | { ok: false; erros: string[] };

/** Confere um regime e devolve os problemas em texto (caminho: mensagem). */
export function validarRegime(regime: unknown): ResultadoValidacao {
  const resultado = regimeSchema.safeParse(regime);
  if (resultado.success) return { ok: true };
  return {
    ok: false,
    erros: resultado.error.issues.map(issue => `${issue.path.join(".") || "(regime)"}: ${issue.message}`),
  };
}
