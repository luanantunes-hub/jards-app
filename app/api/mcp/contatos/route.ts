import { mesmoNome } from "@/lib/dominio";
import { consultarContatos } from "@/lib/mcp/consultas";
import { garantirDaOrganizacao, garantirMembro, linkDoApp, type Linha } from "@/lib/mcp/crm";
import { CANAIS_PREFERIDOS, ORIGENS_CONTATO, PAPEIS_DECISAO } from "@/lib/mcp/enums";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { email, erroDoBanco, ErroMcp, igualSemCaixa, opcao, paginacao, paramUuid, termoDeBusca, texto, trechoParaBusca, uuidDe } from "@/lib/mcp/validacao";

const COLUNAS =
  "id,nome,cargo,email,telefone,linkedin_url,origem,papel_decisao,canal_preferido,empresa_crm_id,proponente_id,captador_id,responsavel_interno_id,notas,created_at,updated_at";

export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const { limite, deslocamento } = paginacao(query);
  const contatos = await consultarContatos(admin, orgId, {
    busca: termoDeBusca(query.get("busca")),
    empresa_crm_id: paramUuid(query, "empresa_crm_id"),
    proponente_id: paramUuid(query, "proponente_id"),
    captador_id: paramUuid(query, "captador_id"),
    limite,
    deslocamento,
  });
  return resposta({ contatos });
});

export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo, origem }) => {
  const nome = texto(corpo, "nome", { obrigatorio: true, max: 200 }) as string;
  const empresaCrmId = uuidDe(corpo, "empresa_crm_id");
  const proponenteId = uuidDe(corpo, "proponente_id");
  const captadorId = uuidDe(corpo, "captador_id");
  if ([empresaCrmId, proponenteId, captadorId].filter(Boolean).length > 1) {
    throw new ErroMcp(400, "Um contato fica ligado a uma só coisa: informe empresa_crm_id, proponente_id ou captador_id, não mais de um.");
  }
  await garantirDaOrganizacao(admin, orgId, "empresas_crm", "empresa_crm_id", empresaCrmId);
  await garantirDaOrganizacao(admin, orgId, "proponentes", "proponente_id", proponenteId);
  await garantirDaOrganizacao(admin, orgId, "captadores", "captador_id", captadorId);

  const emailDoContato = email(corpo, "email");
  const responsavel = await garantirMembro(admin, orgId, "responsavel_interno_id", uuidDe(corpo, "responsavel_interno_id"));

  // Mesmo e-mail na organização, ou mesmo nome na mesma empresa: devolve o que já existe.
  let existente: Linha | null = null;
  if (emailDoContato) {
    const { data, error } = await admin.from("contatos").select(COLUNAS).eq("organization_id", orgId).ilike("email", igualSemCaixa(emailDoContato)).limit(1).maybeSingle();
    if (error) throw erroDoBanco(error);
    existente = (data as Linha | null) ?? null;
  } else {
    let consulta = admin.from("contatos").select(COLUNAS).eq("organization_id", orgId).ilike("nome", `%${trechoParaBusca(nome)}%`).limit(25);
    consulta = empresaCrmId ? consulta.eq("empresa_crm_id", empresaCrmId) : consulta.is("empresa_crm_id", null);
    const { data, error } = await consulta;
    if (error) throw erroDoBanco(error);
    existente = ((data ?? []) as Linha[]).find((linha) => mesmoNome(linha.nome as string, nome)) ?? null;
  }
  if (existente) {
    return resposta({
      contato: existente,
      ja_existia: true,
      mensagem: "Este contato já está no CRM da organização: nada foi criado.",
      url: linkDoApp(origem, "contato", existente.id as string),
    });
  }

  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    nome,
    empresa_crm_id: empresaCrmId,
    proponente_id: proponenteId,
    captador_id: captadorId,
    cargo: texto(corpo, "cargo", { max: 160 }),
    email: emailDoContato,
    telefone: texto(corpo, "telefone", { max: 60 }),
    linkedin_url: texto(corpo, "linkedin_url", { max: 300 }),
    origem: opcao(corpo, "origem", ORIGENS_CONTATO),
    papel_decisao: opcao(corpo, "papel_decisao", PAPEIS_DECISAO),
    canal_preferido: opcao(corpo, "canal_preferido", CANAIS_PREFERIDOS),
    responsavel_interno_id: responsavel,
    notas: texto(corpo, "notas", { max: 4000 }),
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data, error } = await admin.from("contatos").insert(campos).select(COLUNAS).single();
  if (error) throw erroDoBanco(error);
  return resposta({ contato: data, ja_existia: false, url: linkDoApp(origem, "contato", (data as Linha).id as string) }, 201);
});
