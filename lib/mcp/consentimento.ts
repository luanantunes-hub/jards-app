import { MODULOS_MCP, modulosDoEscopo, type ModuloMcp } from "@/lib/mcp/modulos";

/** Nome do campo da caixa de marcar de cada módulo na tela de consentimento. */
export const campoDoModulo = (modulo: ModuloMcp) => `modulo_${modulo}`;

/** Marca que a tela nova enviou a escolha de módulos: sem ela o formulário é o de antes dos módulos (só a captação). */
export const CAMPO_MODULOS_ESCOLHIDOS = "modulos_escolhidos";

/**
 * Os módulos que a pessoa autorizou, nunca além dos que ela pode autorizar agora:
 * - ChatGPT: o `scope` da Action diz os módulos (sem nenhum no texto vale a captação, como as Actions antigas);
 * - Claude e outros assistentes: as caixas marcadas na tela; formulário sem a marca vale só a captação.
 */
export function modulosAutorizados(entrada: {
  cliente: "chatgpt" | "public";
  scope: string;
  formulario: { has(nome: string): boolean };
  disponiveis: readonly ModuloMcp[];
}): ModuloMcp[] {
  const { cliente, scope, formulario, disponiveis } = entrada;
  let pedidos: readonly ModuloMcp[];
  if (cliente === "chatgpt") pedidos = modulosDoEscopo(scope);
  else if (!formulario.has(CAMPO_MODULOS_ESCOLHIDOS)) pedidos = ["captacao"];
  else pedidos = MODULOS_MCP.filter((modulo) => formulario.has(campoDoModulo(modulo)));
  return MODULOS_MCP.filter((modulo) => pedidos.includes(modulo) && disponiveis.includes(modulo));
}

/**
 * Como a tela de consentimento oferece os módulos a quem usa um assistente MCP (Claude): a captação já vem marcada,
 * como sempre foi; a prestação só vem marcada quando é o único módulo (quem tem os dois escolhe, e nada novo é
 * liberado sem a pessoa marcar).
 */
export function marcadosInicialmente(disponiveis: readonly ModuloMcp[]): ModuloMcp[] {
  if (disponiveis.length === 1) return [...disponiveis];
  return disponiveis.filter((modulo) => modulo === "captacao");
}
