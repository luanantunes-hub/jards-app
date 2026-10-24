import { conferirEnvio, limparVencidos, listarCaixa, visaoDaCaixa, type ContextoDaCaixa } from "@/lib/mcp/prestacao/caixa";
import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { listaDeUuids } from "@/lib/mcp/validacao";

// Baixar e conferir arquivos de até 15 MB, vários por chamada, passa do prazo padrão das funções: um minuto basta.
export const maxDuration = 60;

/**
 * Confere o que chegou depois do envio por endereço: tamanho, tipo pelo conteúdo e impressão digital.
 * Sem arquivo_ids, confere tudo que ainda espera. O que chegou fica na caixa de entrada, pronto para registrar;
 * o que não serve é apagado, com o motivo. O envio pelo link (página) já se confere sozinho na hora: se nada espera,
 * a resposta mostra o que já está na caixa, à espera do registro.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);
  const ids = listaDeUuids(corpo, "arquivo_ids", 20) ?? undefined;

  await limparVencidos(admin, prestacao.id);
  const contexto: ContextoDaCaixa = { admin, organizationId: orgId, prestacaoId: prestacao.id, quem };
  const resultados = await conferirEnvio(contexto, { ids });

  if (resultados.length === 0) {
    const { linhas } = await listarCaixa(admin, prestacao.id, { situacao: "recebido", limite: 10, deslocamento: 0 });
    return resposta({
      arquivos: [],
      chegaram: 0,
      ainda_nao_chegaram: 0,
      recusados: 0,
      aviso: "Nada esperando conferência. Use preparar_envio_de_arquivos para enviar arquivos.",
      ...(linhas.length > 0
        ? {
            recebidos_aguardando_registro: linhas.map(visaoDaCaixa),
            proximo_passo: "Estes arquivos já foram conferidos (o envio pelo link se confere na hora) e esperam o registro: chame registrar_despesas (ou registrar_evidencia) com o arquivo_id de cada um.",
          }
        : {}),
    });
  }

  const chegaram = resultados.filter(r => r.resultado === "chegou").length;
  return resposta({
    arquivos: resultados.map(r => ({ ...visaoDaCaixa(r.linha), resultado: r.resultado, ...(r.motivo ? { motivo: r.motivo } : {}) })),
    chegaram,
    ainda_nao_chegaram: resultados.filter(r => r.resultado === "ainda_nao_chegou").length,
    recusados: resultados.filter(r => r.resultado === "recusado").length,
    ...(chegaram > 0 ? { proximo_passo: "Chame registrar_despesas (ou registrar_evidencia) com o arquivo_id de cada arquivo que chegou." } : {}),
  });
});
