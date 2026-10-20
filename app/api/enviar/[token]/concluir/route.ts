import { concluirEnvioDaPagina, idsDoCorpo } from "@/lib/mcp/prestacao/envio-publico";
import { rotaDeEnvio } from "@/lib/mcp/prestacao/envio-rota";

// Baixar e conferir arquivos de até 15 MB, vários por chamada, passa do prazo padrão das funções: um minuto basta.
export const maxDuration = 60;

/**
 * Página de envio de arquivos (/enviar/{código}), passo 2: depois de enviar, confere o que chegou (tamanho, tipo pelo
 * conteúdo, repetido) e deixa na caixa de entrada da prestação o que serve. O que não serve é apagado, com o motivo.
 */
export const POST = rotaDeEnvio(async ({ admin, codigo, corpo }) => concluirEnvioDaPagina(admin, codigo, idsDoCorpo(corpo)));
