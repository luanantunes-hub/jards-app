import { criarLinkDeEnvio, limparVencidos, MAX_ARQUIVOS_POR_ENVIO, prepararEnvio, VALIDADE_DO_ENDERECO_MS, VALIDADE_DO_LINK_MS, type ContextoDaCaixa, type Destino } from "@/lib/mcp/prestacao/caixa";
import { exigirEdicao, quemGrava, registrarAcao } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp, inteiro, listaDeTextos, opcao } from "@/lib/mcp/validacao";

const DESTINOS = ["despesa", "evidencia"] as const;
const MODOS = ["endereco", "link"] as const;

/**
 * Prepara o envio de arquivos que não cabem no texto do chat. Dois jeitos:
 *  - "endereco" (informe os nomes): um endereço assinado de upload direto ao Storage por arquivo, para quem consegue enviar
 *    arquivos do próprio ambiente (o Claude Code, o Cowork, o ambiente de código do Claude) com PUT;
 *  - "link": uma página curta do Jards, sem login, onde a pessoa arrasta os arquivos ou tira a foto no celular.
 * Depois do envio, conferir_envio_de_arquivos confere o que chegou.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);

  const destino: Destino = opcao(corpo, "destino", DESTINOS) ?? "despesa";
  const nomes = listaDeTextos(corpo, "nomes", { maxItens: MAX_ARQUIVOS_POR_ENVIO, max: 300 });
  const modo = opcao(corpo, "modo", MODOS) ?? (nomes && nomes.length > 0 ? "endereco" : "link");

  await limparVencidos(admin, prestacao.id);
  const contexto: ContextoDaCaixa = { admin, organizationId: orgId, prestacaoId: prestacao.id, quem };

  if (modo === "link") {
    const maximo = inteiro(corpo, "maximo_de_arquivos", { min: 1, max: MAX_ARQUIVOS_POR_ENVIO }) ?? MAX_ARQUIVOS_POR_ENVIO;
    const { codigo, expira_em } = await criarLinkDeEnvio(contexto, { destino, maxArquivos: maximo });
    await registrarAcao(admin, quem, { prestacaoId: prestacao.id, ferramenta: "preparar_envio_de_arquivos", acao: "criar", tabela: "assistente_sessoes_envio", resumo: `Criou um link de envio de ${destino === "despesa" ? "despesas" : "evidências"}` });
    return resposta({
      modo,
      link_de_envio: `${origem}/enviar/${codigo}`,
      expira_em,
      validade_minutos: Math.round(VALIDADE_DO_LINK_MS / 60_000),
      maximo_de_arquivos: maximo,
      destino,
      orientacao: "Entregue este link à pessoa: ela abre, escolhe os arquivos (ou tira a foto) e envia. Depois, chame conferir_envio_de_arquivos. O link vale poucos minutos e só para este envio.",
    });
  }

  if (!nomes || nomes.length === 0) throw new ErroMcp(400, 'Informe "nomes" com o nome de cada arquivo (ex.: ["nf-123.pdf"]) para receber os endereços de envio.');
  const enderecos = await prepararEnvio(contexto, { destino, origem: "url_assinada", nomes });
  await registrarAcao(admin, quem, {
    prestacaoId: prestacao.id,
    ferramenta: "preparar_envio_de_arquivos",
    acao: "criar",
    tabela: "assistente_arquivos",
    resumo: `Preparou o envio de ${enderecos.length} ${enderecos.length === 1 ? "arquivo" : "arquivos"} para ${destino === "despesa" ? "despesa" : "evidência"}`,
  });

  const dominio = new URL(enderecos[0].upload_url).host;
  return resposta({
    modo,
    destino,
    enderecos,
    metodo: "PUT",
    cabecalho: "Content-Type: application/octet-stream",
    validade_horas: Math.round(VALIDADE_DO_ENDERECO_MS / 3_600_000),
    dominio_a_liberar: dominio,
    exemplo: `curl -X PUT -H "Content-Type: application/octet-stream" --data-binary @${nomes[0].replace(/[^\w.\-]/g, "_")} "${enderecos[0].upload_url}"`,
    orientacao: "Envie cada arquivo com PUT ao seu upload_url (um arquivo por endereço) e depois chame conferir_envio_de_arquivos. Se o ambiente não alcança o endereço, libere o domínio em dominio_a_liberar, ou use modo=link para a pessoa enviar pelo navegador.",
  });
});
