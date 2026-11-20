import { DESFECHOS_NEGOCIACAO } from "@/lib/etapas";
import { garantirDaOrganizacao, garantirMembro, linkDoApp, nomesPorId, type Admin, type Linha } from "@/lib/mcp/crm";
import { POTENCIAIS_FECHAMENTO, PRIORIDADES } from "@/lib/mcp/enums";
import { carregarFunil, carregarOpcoesComerciais, escolherEtapaInicial, exigirOpcao } from "@/lib/mcp/funil";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import {
  dataDe,
  erroDoBanco,
  ErroMcp,
  numero,
  opcao,
  paginacao,
  paramBooleano,
  paramUuid,
  texto,
  uuidDe,
} from "@/lib/mcp/validacao";

const COLUNAS =
  "id,status,potencial_fechamento,prioridade,valor_solicitado,valor_aprovado,data_previsao,proxima_prospeccao,empresa_crm_id,projeto_id,contato_empresa_id,captador_id,captador_externo_id,supervisor_id,origem_oportunidade,canal_planejado,notas,created_at,updated_at";

const ROTULOS_DE_EXCLUSIVIDADE: Record<string, string> = {
  exclusividade_empresa: "exclusividade por empresa",
  exclusividade_projeto: "exclusividade por projeto",
  time_lock: "time lock",
  relacao_pessoal: "relação pessoal",
};

export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const { limite, deslocamento } = paginacao(query);
  const status = query.get("status")?.trim() || null;
  const empresaId = paramUuid(query, "empresa_crm_id");
  const projetoId = paramUuid(query, "projeto_id");

  let consulta = admin
    .from("captacoes")
    .select(COLUNAS)
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (status) consulta = consulta.eq("status", status);
  if (empresaId) consulta = consulta.eq("empresa_crm_id", empresaId);
  if (projetoId) consulta = consulta.eq("projeto_id", projetoId);
  if (paramBooleano(query, "apenas_em_aberto")) consulta = consulta.not("status", "in", `(${DESFECHOS_NEGOCIACAO.join(",")})`);

  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as Linha[];
  const [empresas, projetos, funil] = await Promise.all([
    nomesPorId(admin, orgId, "empresas_crm", linhas.map((linha) => linha.empresa_crm_id)),
    nomesPorId(admin, orgId, "projetos_crm", linhas.map((linha) => linha.projeto_id)),
    carregarFunil(admin, orgId),
  ]);
  const etapas = new Map(funil.negociacao.map((etapa) => [etapa.chave, etapa.nome]));
  return resposta({
    negociacoes: linhas.map((linha) => ({
      ...linha,
      etapa: etapas.get(linha.status as string) ?? linha.status,
      empresa_nome: linha.empresa_crm_id ? empresas.get(linha.empresa_crm_id) ?? null : null,
      projeto_nome: linha.projeto_id ? projetos.get(linha.projeto_id) ?? null : null,
    })),
  });
});

/** Mesma trava do app: empresa com exclusividade ou time lock ativos só abre negociação para o captador dono da regra. */
async function conferirExclusividade(
  admin: Admin,
  orgId: string,
  empresaCrmId: string,
  projetoId: string | null,
  captadorInternoId: string | null,
  captadorExternoId: string | null
): Promise<void> {
  const { data, error } = await admin.rpc("verificar_exclusividade", { p_empresa_crm_id: empresaCrmId, p_projeto_id: projetoId });
  if (error) throw erroDoBanco(error);
  const regra = ((data ?? []) as Linha[])[0];
  if (!regra) return;

  // A regra aponta para captadores.id: o captador interno é achado pelo usuário vinculado a ele.
  let meuCaptadorId = captadorExternoId;
  if (!meuCaptadorId && captadorInternoId) {
    const { data: captador, error: erroCaptador } = await admin.from("captadores").select("id").eq("organization_id", orgId).eq("user_id", captadorInternoId).maybeSingle();
    if (erroCaptador) throw erroDoBanco(erroCaptador);
    meuCaptadorId = (captador?.id as string | undefined) ?? null;
  }
  if (regra.captador_user_id === meuCaptadorId) return;

  const { data: dono } = await admin.from("captadores").select("nome").eq("id", regra.captador_user_id).maybeSingle();
  const tipo = ROTULOS_DE_EXCLUSIVIDADE[regra.tipo as string] ?? (regra.tipo as string);
  throw new ErroMcp(409, `Esta empresa tem ${tipo} ativa com ${(dono?.nome as string | undefined) ?? "outro captador"}. A negociação não foi criada.`);
}

export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo, origem }) => {
  const empresaCrmId = uuidDe(corpo, "empresa_crm_id", true) as string;
  const projetoId = uuidDe(corpo, "projeto_id");
  const empresa = await garantirDaOrganizacao(admin, orgId, "empresas_crm", "empresa_crm_id", empresaCrmId, "id,nome,empresa_pub_id");
  await garantirDaOrganizacao(admin, orgId, "projetos_crm", "projeto_id", projetoId);

  const [funil, opcoes] = await Promise.all([carregarFunil(admin, orgId), carregarOpcoesComerciais(admin, orgId)]);
  const status = escolherEtapaInicial(funil.negociacao, texto(corpo, "etapa", { max: 60 }));
  const potencial = opcao(corpo, "potencial_fechamento", POTENCIAIS_FECHAMENTO) ?? "medio";
  const prioridade = opcao(corpo, "prioridade", PRIORIDADES);
  const valor = numero(corpo, "valor", { min: 0 });
  const cotaId = uuidDe(corpo, "cota_id");
  const previsao = dataDe(corpo, "data_previsao");
  const origemOportunidade = exigirOpcao(texto(corpo, "origem_oportunidade", { max: 60 }), opcoes.origem, "origem_oportunidade");
  const canalPlanejado = exigirOpcao(texto(corpo, "canal_planejado", { max: 60 }), opcoes.canal, "canal_planejado");

  const captadorId = uuidDe(corpo, "captador_id");
  const captadorExternoId = uuidDe(corpo, "captador_externo_id");
  if (captadorId && captadorExternoId) throw new ErroMcp(400, "Informe captador_id (da equipe) ou captador_externo_id (agência), não os dois.");
  await garantirMembro(admin, orgId, "captador_id", captadorId);
  await garantirDaOrganizacao(admin, orgId, "captadores", "captador_externo_id", captadorExternoId);
  await garantirMembro(admin, orgId, "supervisor_id", uuidDe(corpo, "supervisor_id"));

  const contatoId = uuidDe(corpo, "contato_empresa_id");
  const contato = await garantirDaOrganizacao(admin, orgId, "contatos", "contato_empresa_id", contatoId, "id,empresa_crm_id");
  if (contato && contato.empresa_crm_id !== empresaCrmId) throw new ErroMcp(400, "contato_empresa_id é de outra empresa: escolha um contato desta empresa.");

  if (cotaId) {
    if (!projetoId) throw new ErroMcp(400, "cota_id só vale junto com projeto_id.");
    const { data: cota, error } = await admin.from("cotas_patrocinio").select("id").eq("organization_id", orgId).eq("projeto_id", projetoId).eq("id", cotaId).maybeSingle();
    if (error) throw erroDoBanco(error);
    if (!cota) throw new ErroMcp(404, "cota_id não foi encontrada neste projeto.");
  }

  await conferirExclusividade(admin, orgId, empresaCrmId, projetoId, captadorId, captadorExternoId);

  // Pedido repetido: já existe negociação em aberto desta empresa neste projeto, então devolve a que existe.
  if (projetoId) {
    const { data: aberta, error } = await admin
      .from("captacoes")
      .select(COLUNAS)
      .eq("organization_id", orgId)
      .eq("empresa_crm_id", empresaCrmId)
      .eq("projeto_id", projetoId)
      .not("status", "in", `(${DESFECHOS_NEGOCIACAO.join(",")})`)
      .limit(1)
      .maybeSingle();
    if (error) throw erroDoBanco(error);
    if (aberta) {
      return resposta({
        negociacao: aberta,
        ja_existia: true,
        mensagem: "Já existe uma negociação em aberto desta empresa neste projeto: nada foi criado.",
        url: linkDoApp(origem, "negociacao", (aberta as Linha).id as string),
      });
    }
  }

  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    empresa_crm_id: empresaCrmId,
    empresa_id: (empresa?.empresa_pub_id as string | null | undefined) ?? null,
    projeto_id: projetoId,
    status,
    potencial_fechamento: potencial,
    prioridade,
    captador_id: captadorId,
    captador_externo_id: captadorExternoId,
    supervisor_id: uuidDe(corpo, "supervisor_id"),
    contato_empresa_id: contatoId,
    data_previsao: previsao ? previsao.slice(0, 10) : null,
    origem_oportunidade: origemOportunidade,
    canal_planejado: canalPlanejado,
    notas: texto(corpo, "notas", { max: 4000 }),
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data: criada, error } = await admin.from("captacoes").insert(campos).select("id").single();
  if (error) throw erroDoBanco(error);
  const id = (criada as Linha).id as string;

  // Valor e cota moram na proposta simplificada (ou na própria negociação, sem projeto): mesma regra do app.
  if (valor !== null || cotaId) {
    const { error: erroValor } = await admin.rpc("fn_aplicar_proposta_simplificada", {
      p_captacao_id: id,
      p_valor: valor,
      p_cota_id: cotaId,
      p_alterar_cota: cotaId !== null,
    });
    if (erroValor) {
      // Não deixa uma negociação pela metade, sem o valor que a pessoa pediu.
      await admin.from("captacoes").delete().eq("id", id);
      throw erroDoBanco(erroValor);
    }
  }

  const { data, error: erroLeitura } = await admin.from("captacoes").select(COLUNAS).eq("id", id).single();
  if (erroLeitura) throw erroDoBanco(erroLeitura);
  return resposta(
    {
      negociacao: { ...data, etapa: funil.negociacao.find((etapa) => etapa.chave === status)?.nome ?? status, empresa_nome: empresa?.nome ?? null },
      ja_existia: false,
      url: linkDoApp(origem, "negociacao", id),
    },
    201
  );
});
