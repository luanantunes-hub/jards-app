import { comDiasPuros } from "@/lib/mcp/consultas";
import { garantirDaOrganizacao, garantirMembro, membrosDaEquipe, nomesPorId, type Linha } from "@/lib/mcp/crm";
import { PRIORIDADES, TIPOS_ATIVIDADE } from "@/lib/mcp/enums";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import {
  dataDe,
  diaEHoraEmBrasilia,
  diaSeguinte,
  erroDoBanco,
  ErroMcp,
  horaDe,
  opcao,
  paginacao,
  paramBooleano,
  paramData,
  paramOpcao,
  paramUuid,
  texto,
  uuidDe,
} from "@/lib/mcp/validacao";

const COLUNAS =
  "id,nome,tipo,prioridade,data_inicio,data_prevista,data_realizada,feita,hora_inicio,hora_fim,nota,resultado,responsavel_id,empresa_crm_id,captacao_id,contato_id,projeto_id,proponente_id,captador_id,edital_user_id,created_at,updated_at";

/** Cada atividade se liga a uma só coisa, como na tela de nova atividade. */
const VINCULOS = ["captacao_id", "empresa_crm_id", "contato_id", "projeto_id", "proponente_id", "captador_id", "edital_user_id"] as const;

const TABELA_DO_VINCULO = {
  captacao_id: "captacoes",
  empresa_crm_id: "empresas_crm",
  contato_id: "contatos",
  projeto_id: "projetos_crm",
  proponente_id: "proponentes",
  captador_id: "captadores",
  edital_user_id: "editais_user",
} as const;

/** Atividades são as tarefas do Jards (a página "Atividades" do app): ligações, e-mails, reuniões, eventos. */
export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const { limite, deslocamento } = paginacao(query);
  const tipo = paramOpcao(query, "tipo", TIPOS_ATIVIDADE);
  const responsavelId = paramUuid(query, "responsavel_id");
  const de = paramData(query, "de");
  const ate = paramData(query, "ate");

  let consulta = admin
    .from("atividades")
    .select(COLUNAS)
    .eq("organization_id", orgId)
    .order("data_prevista", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (paramBooleano(query, "apenas_pendentes")) consulta = consulta.eq("feita", false);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (responsavelId) consulta = consulta.eq("responsavel_id", responsavelId);
  for (const vinculo of ["empresa_crm_id", "captacao_id", "contato_id", "projeto_id", "proponente_id"] as const) {
    const id = paramUuid(query, vinculo);
    if (id) consulta = consulta.eq(vinculo, id);
  }
  if (de) consulta = consulta.gte("data_prevista", de.slice(0, 10));
  if (ate) consulta = consulta.lt("data_prevista", diaSeguinte(ate.slice(0, 10)));

  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as Linha[];
  const [empresas, projetos, contatos, equipe] = await Promise.all([
    nomesPorId(admin, orgId, "empresas_crm", linhas.map((linha) => linha.empresa_crm_id)),
    nomesPorId(admin, orgId, "projetos_crm", linhas.map((linha) => linha.projeto_id)),
    nomesPorId(admin, orgId, "contatos", linhas.map((linha) => linha.contato_id)),
    membrosDaEquipe(admin, orgId),
  ]);
  const responsaveis = new Map(equipe.map((membro) => [membro.id, membro.nome]));
  return resposta({
    atividades: linhas.map((linha) => ({
      ...comDiasPuros(linha),
      empresa_nome: linha.empresa_crm_id ? empresas.get(linha.empresa_crm_id) ?? null : null,
      projeto_nome: linha.projeto_id ? projetos.get(linha.projeto_id) ?? null : null,
      contato_nome: linha.contato_id ? contatos.get(linha.contato_id) ?? null : null,
      responsavel_nome: linha.responsavel_id ? responsaveis.get(linha.responsavel_id) ?? null : null,
    })),
  });
});

export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo }) => {
  const nome = texto(corpo, "nome", { obrigatorio: true, max: 200 }) as string;
  const tipo = opcao(corpo, "tipo", TIPOS_ATIVIDADE) ?? "outro";
  const prioridade = opcao(corpo, "prioridade", PRIORIDADES) ?? "media";
  // O app guarda o dia em data_inicio/data_prevista e a hora em hora_inicio/hora_fim. Quem manda dia e hora juntos
  // (AAAA-MM-DDTHH:MM, horário de Brasília) tem a hora separada do dia, e o dia não anda por causa do fuso.
  const previsto = diaEHoraEmBrasilia(dataDe(corpo, "data_prevista"));
  const inicioPedido = diaEHoraEmBrasilia(dataDe(corpo, "data_inicio"));
  const inicio = inicioPedido ?? previsto;
  if (inicio && previsto && inicio.dia > previsto.dia) {
    throw new ErroMcp(400, "data_prevista não pode ser anterior a data_inicio.");
  }
  const horaInicio = horaDe(corpo, "hora_inicio") ?? inicio?.hora ?? null;
  const horaFim = horaDe(corpo, "hora_fim");
  if (horaInicio && horaFim && horaFim < horaInicio) throw new ErroMcp(400, "hora_fim não pode ser anterior a hora_inicio.");

  const informados = VINCULOS.filter((campo) => uuidDe(corpo, campo));
  if (informados.length > 1) {
    throw new ErroMcp(400, `Uma atividade se liga a uma só coisa: informe um destes, não mais de um: ${VINCULOS.join(", ")}.`);
  }
  const vinculos: Record<string, string | null> = {};
  for (const campo of informados) {
    const id = uuidDe(corpo, campo);
    await garantirDaOrganizacao(admin, orgId, TABELA_DO_VINCULO[campo], campo, id);
    vinculos[campo] = id;
  }

  // Sem responsável informado, a atividade fica com quem autorizou o conector.
  const responsavelId = (await garantirMembro(admin, orgId, "responsavel_id", uuidDe(corpo, "responsavel_id"))) ?? ctx.userId;

  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    nome,
    tipo,
    prioridade,
    responsavel_id: responsavelId,
    data_inicio: inicio?.dia ?? null,
    data_prevista: previsto?.dia ?? null,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    nota: texto(corpo, "nota", { max: 4000 }),
    resultado: texto(corpo, "resultado", { max: 1000 }),
    feita: false,
    ...vinculos,
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data, error } = await admin.from("atividades").insert(campos).select(COLUNAS).single();
  if (error) throw erroDoBanco(error);
  return resposta({ atividade: comDiasPuros(data as Linha) }, 201);
});
