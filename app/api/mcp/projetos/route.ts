import { chaveDoNome } from "@/lib/dominio";
import { acharPorNome, garantirDaOrganizacao, linkDoApp, type Linha } from "@/lib/mcp/crm";
import { FASES_PROJETO, STATUS_COMERCIAL_PROJETO, VISIBILIDADES_PROJETO } from "@/lib/mcp/enums";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import {
  dataDe,
  erroDoBanco,
  ErroMcp,
  listaDeTextos,
  numero,
  opcao,
  paginacao,
  paramOpcao,
  termoDeBusca,
  texto,
  uuidDe,
} from "@/lib/mcp/validacao";

const COLUNAS =
  "id,nome,descricao,fase,status_operacional,status_comercial,valor_alvo,valor_total,valor_garantido,proponente_id,proponente_nome,cidade,estado,abrangencia,data_inicio,data_fim,areas_culturais,tags,visibilidade,updated_at";

export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const { limite, deslocamento } = paginacao(query);
  const busca = termoDeBusca(query.get("busca"));
  const fase = paramOpcao(query, "fase", FASES_PROJETO);

  let consulta = admin
    .from("projetos_crm")
    .select("id,nome,descricao,fase,status_operacional,status_comercial,valor_alvo,valor_total,valor_garantido,proponente_nome,cidade,estado,data_inicio,data_fim,updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (busca) consulta = consulta.ilike("nome", `%${busca}%`);
  if (fase) consulta = consulta.eq("fase", fase);

  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  return resposta({ projetos: data });
});

export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo, origem }) => {
  const nome = texto(corpo, "nome", { obrigatorio: true, max: 200 }) as string;

  // Mesmo nome na organização: devolve o projeto que já existe.
  const existente = await acharPorNome(admin, orgId, "projetos_crm", COLUNAS, nome);
  if (existente) {
    return resposta({
      projeto: existente,
      ja_existia: true,
      mensagem: "Este projeto já está no CRM da organização: nada foi criado.",
      url: linkDoApp(origem, "projeto", existente.id as string),
    });
  }

  const dataInicio = dataDe(corpo, "data_inicio");
  const dataFim = dataDe(corpo, "data_fim");
  if (dataInicio && dataFim && dataFim.slice(0, 10) < dataInicio.slice(0, 10)) {
    throw new ErroMcp(400, "data_fim não pode ser anterior a data_inicio.");
  }
  const proponenteId = uuidDe(corpo, "proponente_id");
  const proponente = await garantirDaOrganizacao(admin, orgId, "proponentes", "proponente_id", proponenteId, "id,nome");

  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    nome,
    nome_key: chaveDoNome(nome),
    descricao: texto(corpo, "descricao", { max: 4000 }),
    valor_alvo: numero(corpo, "valor_alvo", { min: 0 }),
    valor_garantido: numero(corpo, "valor_garantido", { min: 0 }),
    fase: opcao(corpo, "fase", FASES_PROJETO),
    status_comercial: opcao(corpo, "status_comercial", STATUS_COMERCIAL_PROJETO),
    visibilidade: opcao(corpo, "visibilidade", VISIBILIDADES_PROJETO),
    proponente_id: proponenteId,
    proponente_nome: proponente ? (proponente.nome as string) : texto(corpo, "proponente_nome", { max: 200 }),
    cidade: texto(corpo, "cidade", { max: 120 }),
    estado: texto(corpo, "estado", { max: 60 }),
    abrangencia: texto(corpo, "abrangencia", { max: 120 }),
    data_inicio: dataInicio ? dataInicio.slice(0, 10) : null,
    data_fim: dataFim ? dataFim.slice(0, 10) : null,
    areas_culturais: listaDeTextos(corpo, "areas_culturais"),
    tags: listaDeTextos(corpo, "tags"),
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data, error } = await admin.from("projetos_crm").insert(campos).select(COLUNAS).single();
  if (error) throw erroDoBanco(error);
  return resposta({ projeto: data, ja_existia: false, url: linkDoApp(origem, "projeto", (data as Linha).id as string) }, 201);
});
