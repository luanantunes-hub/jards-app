import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { avisarAtividadesRegistradas, lerAtividadeInformada, MAX_ATIVIDADES_POR_CHAMADA, proximaOrdemDasAtividades, registrarAtividade, type ResultadoDaAtividade } from "@/lib/mcp/prestacao/objeto-gravacao";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp } from "@/lib/mcp/validacao";

/**
 * Registra atividades do objeto (oficina, apresentação, ensaio...), até 20 por vez, com o que a pessoa contou: data, local,
 * público, empregos, meta e local do objeto a que servem. Nada é deduzido nem inventado. A mesma atividade (título e data)
 * não entra duas vezes. A equipe revisa e completa no app, e tudo fica em "Ações do assistente".
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);

  const lista = corpo.atividades;
  if (!Array.isArray(lista) || lista.length === 0) throw new ErroMcp(400, 'Informe "atividades": uma lista com uma atividade por item (título e data são obrigatórios).');
  if (lista.length > MAX_ATIVIDADES_POR_CHAMADA) throw new ErroMcp(400, `Registre até ${MAX_ATIVIDADES_POR_CHAMADA} atividades por vez.`);
  const informadas = lista.map((item, posicao) => lerAtividadeInformada(item, posicao));

  const base = await proximaOrdemDasAtividades(admin, prestacao.id);
  const resultados: ResultadoDaAtividade[] = [];
  let ordem = base;
  for (const campos of informadas) {
    const resultado = await registrarAtividade({ admin, prestacaoId: prestacao.id, quem, campos, ordem });
    if (resultado.ok) ordem += 1;
    resultados.push(resultado);
  }

  const registradas = resultados.filter(r => r.ok);
  if (registradas.length > 0) await avisarAtividadesRegistradas(admin, prestacao.id, prestacao.titulo, registradas.length, registradas[0].acao_id ?? registradas[0].atividade_id ?? prestacao.id);

  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id, "atividades") },
    registradas: registradas.length,
    com_erro: resultados.length - registradas.length,
    resultados,
  });
});
