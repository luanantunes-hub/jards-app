import { carregarOpcoesComerciais, exigirOpcao } from "@/lib/mcp/funil";
import { exigirAlgumContexto, lerContextoDoRelacionamento, tipoDaInteracao, tipoDetalhadoDaInteracao } from "@/lib/mcp/relacionamento";
import { DIRECOES_INTERACAO } from "@/lib/mcp/enums";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { dataDe, erroDoBanco, inteiro, opcao, paraInstante, texto } from "@/lib/mcp/validacao";

/** Conversa que já aconteceu (ligação, e-mail, reunião, mensagem): entra no histórico da empresa e da negociação. */
export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo }) => {
  const assunto = texto(corpo, "assunto", { obrigatorio: true, max: 200 }) as string;
  const contexto = await lerContextoDoRelacionamento(admin, orgId, corpo);
  exigirAlgumContexto(contexto, "interação", "empresa_crm_id, contato_id, captacao_id ou proponente_id");

  const opcoes = await carregarOpcoesComerciais(admin, orgId);
  const canal = exigirOpcao(texto(corpo, "canal", { max: 60 }), opcoes.canal, "canal") ?? "email";
  const resultado = exigirOpcao(texto(corpo, "resultado", { max: 60 }), opcoes.resultado, "resultado");
  const ocorreuEm = dataDe(corpo, "ocorreu_em");

  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    created_by: ctx.userId,
    ...contexto,
    tipo: tipoDaInteracao(canal),
    canal,
    tipo_interacao: tipoDetalhadoDaInteracao(canal),
    direcao: opcao(corpo, "direcao", DIRECOES_INTERACAO) ?? "saida",
    assunto,
    resumo: texto(corpo, "resumo", { max: 4000 }),
    resultado,
    proximo_passo: texto(corpo, "proximo_passo", { max: 500 }),
    duracao_minutos: inteiro(corpo, "duracao_minutos", { min: 0, max: 1440 }),
    ocorreu_em: ocorreuEm ? paraInstante(ocorreuEm) : new Date().toISOString(),
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data, error } = await admin
    .from("crm_interacoes")
    .insert(campos)
    .select("id,tipo,canal,direcao,assunto,resumo,resultado,proximo_passo,ocorreu_em,empresa_crm_id,contato_id,captacao_id,proponente_id")
    .single();
  if (error) throw erroDoBanco(error);
  return resposta({ interacao: data }, 201);
});
