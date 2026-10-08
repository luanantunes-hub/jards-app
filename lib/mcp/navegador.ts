/**
 * Quem abre o endereço do servidor MCP digitando na barra do navegador manda `Accept: text/html`;
 * clientes MCP (que abrem o fluxo de eventos) mandam `text/event-stream`, e o curl aceita qualquer tipo.
 * Só o primeiro caso é levado para a tela de instruções.
 */
export function pedidoDeNavegador(accept: string | null): boolean {
  if (!accept) return false;
  const tipos = accept.toLowerCase();
  return tipos.includes("text/html") && !tipos.includes("text/event-stream");
}
