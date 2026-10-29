import { COLUNAS_DA_DESPESA, despesaParaOAssistente, type FornecedorLido, type ItemLido, type LinhaDeDespesa, type VerificacaoDaDespesa } from "@/lib/mcp/prestacao/despesas";
import { avisarDespesasRegistradas, contextoDasDespesas, lerDespesaInformada, MAX_DESPESAS_POR_CHAMADA, registrarDespesa, type ResultadoDaDespesa } from "@/lib/mcp/prestacao/despesas-gravacao";
import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp, erroDoBanco, paginacao, paramBooleano, paramOpcao, paramUuid, termoDeBusca } from "@/lib/mcp/validacao";

const STATUS_DA_DESPESA = ["pendente", "aceito", "rejeitado"] as const;

/**
 * As despesas (comprovantes) da prestação, as de data mais recente primeiro: valor bruto e líquido, fornecedor, item do
 * orçamento, o que a leitura por IA apontou e as verificações abertas de cada uma. Sem arquivo, caminho de arquivo nem chave de acesso.
 */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, query, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const { limite, deslocamento } = paginacao(query);
  const status = paramOpcao(query, "status", STATUS_DA_DESPESA);
  const itemId = paramUuid(query, "item_id");
  const semItem = paramBooleano(query, "sem_item");
  const busca = termoDeBusca(query.get("busca"));

  let consulta = admin
    .from("prestacao_comprovantes")
    .select(COLUNAS_DA_DESPESA, { count: "exact" })
    .eq("prestacao_id", prestacao.id)
    .order("data_doc", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (status) consulta = consulta.eq("status", status);
  if (itemId) consulta = consulta.eq("no_id", itemId);
  if (semItem) consulta = consulta.is("no_id", null);
  if (busca) consulta = consulta.or(`descricao_servico.ilike.%${busca}%,nome_arquivo.ilike.%${busca}%,numero_documento.ilike.%${busca}%`);

  const { data, error, count } = await consulta;
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as unknown as LinhaDeDespesa[];

  const idsDeFornecedor = [...new Set(linhas.map(l => l.fornecedor_id).filter((x): x is string => !!x))];
  const idsDeItem = [...new Set(linhas.map(l => l.no_id).filter((x): x is string => !!x))];
  const idsDasDespesas = linhas.map(l => l.id);
  const [fornecedores, itens, verificacoes] = await Promise.all([
    idsDeFornecedor.length ? admin.from("prestacao_fornecedores").select("id,nome,tipo_pessoa,documento").eq("organization_id", orgId).in("id", idsDeFornecedor) : { data: [], error: null },
    idsDeItem.length ? admin.from("prestacao_orcamento_nos").select("id,codigo,nome").eq("prestacao_id", prestacao.id).in("id", idsDeItem) : { data: [], error: null },
    idsDasDespesas.length
      ? admin.from("prestacao_verificacoes").select("check_codigo,severidade,mensagem,entidade_id").eq("prestacao_id", prestacao.id).eq("status", "aberta").eq("entidade_tipo", "despesa").in("entidade_id", idsDasDespesas)
      : { data: [], error: null },
  ]);
  for (const leitura of [fornecedores, itens, verificacoes]) if (leitura.error) throw erroDoBanco(leitura.error);

  const porId = <T extends { id: string }>(lista: unknown) => new Map(((lista ?? []) as T[]).map(x => [x.id, x]));
  const abertasPorDespesa = new Map<string, VerificacaoDaDespesa[]>();
  for (const v of (verificacoes.data ?? []) as unknown as VerificacaoDaDespesa[]) {
    if (v.entidade_id) abertasPorDespesa.set(v.entidade_id, [...(abertasPorDespesa.get(v.entidade_id) ?? []), v]);
  }
  const contexto = {
    prestacaoId: prestacao.id,
    origem,
    fornecedores: porId<FornecedorLido>(fornecedores.data),
    itens: porId<ItemLido>(itens.data),
    verificacoes: abertasPorDespesa,
  };

  const total = count ?? linhas.length;
  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id) },
    despesas: linhas.map(l => despesaParaOAssistente(l, contexto)),
    total,
    proximo_deslocamento: deslocamento + limite < total ? deslocamento + limite : null,
  });
});

/**
 * Registra despesas a partir dos arquivos que já estão na caixa de entrada (enviar_arquivos ou preparar_envio_de_arquivos),
 * até 20 por vez. Cada uma nasce PENDENTE, com o canal "assistente": quem aceita ou rejeita é a equipe, no app. Para XML de
 * nota, o próprio XML preenche valor, data, número, chave e retenções; o que o assistente informar completa o que faltar.
 * Tudo fica em "Ações do assistente" na prestação, e a equipe é avisada.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);

  const lista = corpo.despesas;
  if (!Array.isArray(lista) || lista.length === 0) throw new ErroMcp(400, 'Informe "despesas": uma lista com uma despesa por arquivo (arquivo_id e os dados que você leu).');
  if (lista.length > MAX_DESPESAS_POR_CHAMADA) throw new ErroMcp(400, `Registre até ${MAX_DESPESAS_POR_CHAMADA} despesas por vez.`);
  const informadas = lista.map((item, posicao) => lerDespesaInformada(item, posicao));

  const contexto = await contextoDasDespesas(admin, orgId, prestacao);
  const resultados: Array<ResultadoDaDespesa & { url?: string }> = [];
  const vistos = new Set<string>();
  for (const informada of informadas) {
    if (vistos.has(informada.arquivoId)) {
      resultados.push({ arquivo_id: informada.arquivoId, ok: false, erro: "Este arquivo aparece mais de uma vez na lista." });
      continue;
    }
    vistos.add(informada.arquivoId);
    const resultado = await registrarDespesa({ admin, prestacaoId: prestacao.id, quem, informada, contexto });
    resultados.push(resultado.ok && resultado.despesa_id ? { ...resultado, url: `${origem}/prestacoes/${prestacao.id}/comprovantes?despesa=${resultado.despesa_id}` } : resultado);
  }

  const registradas = resultados.filter(r => r.ok);
  if (registradas.length > 0) await avisarDespesasRegistradas(admin, prestacao.id, prestacao.titulo, registradas.length, registradas[0].acao_id ?? registradas[0].despesa_id ?? prestacao.id);

  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id) },
    registradas: registradas.length,
    com_erro: resultados.length - registradas.length,
    resultados,
    importante: "Todas as despesas registradas estão PENDENTES: a equipe confere e avalia no app. O assistente não aceita nem rejeita despesas.",
    ...(registradas.length > 0 ? { proximo_passo: "Se quiser, rode rodar_verificacoes e depois listar_pendencias_da_prestacao para ver o que a conferência aponta." } : {}),
  });
});
