import { nomesDoCorpo, prepararEnvioDaPagina } from "@/lib/mcp/prestacao/envio-publico";
import { rotaDeEnvio } from "@/lib/mcp/prestacao/envio-rota";

/**
 * Página de envio de arquivos (/enviar/{código}), passo 1: para cada arquivo que a pessoa escolheu, um endereço de envio
 * direto ao Storage. Sem login: o código do link, que só o banco confere, é a autorização. A prestação e o destino
 * (despesa ou evidência) vêm do link, nunca do pedido.
 */
export const POST = rotaDeEnvio(async ({ admin, codigo, corpo }) => {
  const { arquivos, restantes } = await prepararEnvioDaPagina(admin, codigo, nomesDoCorpo(corpo));
  return { arquivos, restantes };
});
