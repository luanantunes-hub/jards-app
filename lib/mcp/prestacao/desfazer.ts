import type { Admin } from "@/lib/mcp/crm";
import { COLUNAS_DA_ACAO, TABELAS_QUE_O_ASSISTENTE_CRIA, podeRetirar, type LinhaDaAcao } from "@/lib/mcp/prestacao/acoes-do-assistente";
import { exigirRegistroLivre, registrarAcao, type QuemGrava } from "@/lib/mcp/prestacao/gravacao";
import { ErroMcp, erroDoBanco } from "@/lib/mcp/validacao";

export { COLUNAS_DA_ACAO, podeRetirar, type LinhaDaAcao };

export function acaoParaOAssistente(a: LinhaDaAcao) {
  return {
    acao_id: a.id,
    quando: a.created_at,
    ferramenta: a.ferramenta,
    tipo: a.acao,
    assistente: a.plataforma,
    o_que_fez: a.resumo,
    registro: a.registro_id ? { tabela: a.tabela, id: a.registro_id } : null,
    retirada_em: a.desfeita_em,
    pode_retirar: podeRetirar(a),
  };
}

/** Tabelas que apontam para a despesa: com ligação, a despesa não sai sem levar o resto, e isso se decide no app. */
const DEPENDENTES_DA_DESPESA = ["prestacao_pagamentos", "prestacao_bens", "prestacao_glosas"] as const;

/**
 * Retira da prestação uma despesa ou evidência que o assistente criou, enquanto a equipe ainda não mexeu nela. Confere tudo
 * antes de apagar: foi criada pelo assistente, ainda está pendente, não foi enviada ao órgão e não tem pagamento, bem nem glosa ligados.
 * O arquivo sai do Storage e a caixa de entrada registra que foi retirado; a trilha guarda o que foi retirado.
 */
export async function retirarRegistro(entrada: { admin: Admin; prestacaoId: string; quem: QuemGrava; acaoId: string; ferramenta?: string }): Promise<{ retirado: { tabela: string; id: string }; resumo: string }> {
  const { admin, prestacaoId, quem, acaoId } = entrada;

  const { data: acaoBruta, error } = await admin.from("assistente_acoes" as never).select(COLUNAS_DA_ACAO).eq("id", acaoId).eq("prestacao_id", prestacaoId).maybeSingle();
  if (error) throw erroDoBanco(error);
  const acao = acaoBruta as unknown as LinhaDaAcao | null;
  if (!acao) throw new ErroMcp(404, "Ação não encontrada nesta prestação. Use listar_acoes_do_assistente para ver os acao_id.");
  if (acao.desfeita_em) throw new ErroMcp(409, "Esta ação já foi retirada.");
  if (!podeRetirar(acao)) throw new ErroMcp(400, "Só dá para retirar uma despesa ou evidência que o assistente criou. Para outra coisa, use o app.");
  const tabela = acao.tabela as (typeof TABELAS_QUE_O_ASSISTENTE_CRIA)[number];
  const registroId = acao.registro_id as string;

  const colunas = tabela === "prestacao_comprovantes" ? "id,canal,status,storage_path,nome_arquivo,valor_extraido" : "id,canal,storage_path,nome_arquivo";
  const { data: registroBruto, error: erroDoRegistro } = await admin.from(tabela as never).select(colunas).eq("id", registroId).eq("prestacao_id", prestacaoId).maybeSingle();
  if (erroDoRegistro) throw erroDoBanco(erroDoRegistro);
  const registro = registroBruto as unknown as { id: string; canal: string | null; status?: string; storage_path: string | null; nome_arquivo: string | null; valor_extraido?: number | null } | null;
  if (!registro) throw new ErroMcp(404, "O registro já não existe na prestação.");
  // A trilha é do assistente, mas o apagamento é da linha: nunca apaga o que a equipe criou, mesmo com um acao_id trocado.
  if (registro.canal !== "assistente") throw new ErroMcp(409, "Este registro não é do assistente; retire pelo app.");
  if (tabela === "prestacao_comprovantes" && registro.status !== "pendente") throw new ErroMcp(409, "A equipe já avaliou esta despesa; peça a exclusão no app.");

  await exigirRegistroLivre(admin, tabela, registroId);
  if (tabela === "prestacao_comprovantes") {
    for (const dependente of DEPENDENTES_DA_DESPESA) {
      const { count, error: erroDeDependente } = await admin.from(dependente as never).select("id", { count: "exact", head: true }).eq("despesa_id", registroId);
      if (erroDeDependente) throw erroDoBanco(erroDeDependente);
      if ((count ?? 0) > 0) throw new ErroMcp(409, "Esta despesa já tem pagamento, bem ou glosa ligados; retire pelo app.");
    }
  }

  // A leitura de cima e o apagamento são dois passos: a equipe pode ter aceitado a despesa no meio. O apagamento repete a condição
  // (continua pendente e do assistente) e confere que apagou mesmo.
  let apagamento = admin.from(tabela as never).delete().eq("id", registroId).eq("prestacao_id", prestacaoId).eq("canal", "assistente");
  if (tabela === "prestacao_comprovantes") apagamento = apagamento.eq("status", "pendente");
  const { data: apagados, error: erroAoApagar } = await apagamento.select("id");
  if (erroAoApagar) throw erroDoBanco(erroAoApagar);
  if (!apagados || apagados.length === 0) throw new ErroMcp(409, "A equipe acabou de avaliar este registro, ou ele mudou; peça a exclusão no app.");
  if (registro.storage_path) await admin.storage.from("documentos").remove([registro.storage_path]);

  const agora = new Date().toISOString();
  await admin.from("assistente_arquivos" as never).update({ situacao: "descartado", detalhe: "Retirado pelo assistente.", atualizado_em: agora } as never).eq("registro_id", registroId);
  await admin.from("assistente_acoes" as never).update({ desfeita_em: agora, desfeita_por: quem.usuarioId } as never).eq("id", acaoId);
  const resumo = `Retirou ${tabela === "prestacao_comprovantes" ? "a despesa" : "a evidência"} "${registro.nome_arquivo ?? "sem nome"}" que o assistente tinha criado`;
  await registrarAcao(admin, quem, { prestacaoId, ferramenta: entrada.ferramenta ?? "retirar_registro_do_assistente", acao: "retirar", tabela, registroId, resumo, antes: { acao_id: acaoId, nome_arquivo: registro.nome_arquivo, valor_extraido: registro.valor_extraido ?? null } });
  return { retirado: { tabela, id: registroId }, resumo };
}
