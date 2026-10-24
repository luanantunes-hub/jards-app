import { MODULOS, type ModuloId } from "@/lib/modulos";

/**
 * Módulos do Jards que o conector atende: os do app (lib/modulos.ts) que têm ferramentas aqui. Cada chave (token)
 * consente em um ou mais deles: quem autorizou só o CRM não ganha a Prestação de contas depois, sem nova autorização.
 */
export type ModuloMcp = Extract<ModuloId, "captacao" | "prestacao">;
export const MODULOS_MCP: readonly ModuloMcp[] = MODULOS.filter((modulo): modulo is ModuloMcp => modulo === "captacao" || modulo === "prestacao");

/** O que as chaves e as Actions criadas antes dos módulos sempre foram. */
export const MODULO_PADRAO: ModuloMcp = "captacao";

export function ehModuloMcp(valor: unknown): valor is ModuloMcp {
  return typeof valor === "string" && (MODULOS_MCP as readonly string[]).includes(valor);
}

/** Lê a coluna `modulos` de uma chave: o que não é módulo sai; vazio ou ausente vira só a captação. */
export function normalizarModulosDaChave(valor: unknown): ModuloMcp[] {
  if (!Array.isArray(valor)) return [MODULO_PADRAO];
  const modulos = MODULOS_MCP.filter((modulo) => valor.includes(modulo));
  return modulos.length > 0 ? modulos : [MODULO_PADRAO];
}

/** Módulos pedidos no `scope` do ChatGPT (ex.: "write prestacao"). Sem nenhum no texto vale a captação, como as Actions antigas. */
export function modulosDoEscopo(escopo: string | null | undefined): ModuloMcp[] {
  const palavras = (escopo ?? "").split(/[\s,]+/).filter(Boolean);
  const pedidos = MODULOS_MCP.filter((modulo) => palavras.includes(modulo));
  return pedidos.length > 0 ? pedidos : [MODULO_PADRAO];
}

/** Nome do módulo para falar com a pessoa. */
export const NOME_DO_MODULO: Record<ModuloMcp, string> = {
  captacao: "captação",
  prestacao: "prestação de contas",
};

/**
 * Trava de lançamento da prestação de contas no conector: enquanto o módulo está sendo implantado, só aparece para
 * autorizar (tela de consentimento e chaves pessoais) para quem a variável MCP_PRESTACAO_LIBERADA libera. Sem a variável,
 * ninguém; `todos`, qualquer pessoa com acesso ao módulo; senão, uma lista de e-mails ou ids separada por vírgula.
 * Só vale para novas autorizações: o que já foi autorizado continua funcionando (e se revoga pelas chaves).
 */
export function prestacaoLiberadaPara(pessoa: { id: string; email?: string | null }, configurada: string | undefined = process.env.MCP_PRESTACAO_LIBERADA): boolean {
  const itens = (configurada ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (itens.length === 0) return false;
  if (itens.includes("todos")) return true;
  return itens.includes(pessoa.id.toLowerCase()) || (!!pessoa.email && itens.includes(pessoa.email.toLowerCase()));
}

/** O escopo que volta ao assistente: o de sempre (read/write) e, só quando há mais que a captação, os módulos (ex.: "write prestacao"). */
export function escopoComModulos(escopo: "read" | "write", modulos: readonly ModuloMcp[]): string {
  const fora = modulos.filter((modulo) => modulo !== MODULO_PADRAO);
  return fora.length === 0 && modulos.includes(MODULO_PADRAO) ? escopo : [escopo, ...modulos].join(" ");
}
