import { chaveDoNome } from "@/lib/dominio";
import { acharPorNome, linkDoApp, type Linha } from "@/lib/mcp/crm";
import { TIPOS_PROPONENTE } from "@/lib/mcp/enums";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { email, erroDoBanco, opcao, paginacao, termoDeBusca, texto } from "@/lib/mcp/validacao";

const COLUNAS = "id,nome,tipo,cnpj,cidade,estado,email,telefone,site,descricao,maturidade,updated_at";

export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const { limite, deslocamento } = paginacao(query);
  const busca = termoDeBusca(query.get("busca"));

  let consulta = admin
    .from("proponentes")
    .select("id,nome,tipo,cidade,estado,email,telefone,site,updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (busca) consulta = consulta.ilike("nome", `%${busca}%`);

  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  return resposta({ proponentes: data });
});

export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo, origem }) => {
  const nome = texto(corpo, "nome", { obrigatorio: true, max: 200 }) as string;
  const cnpj = texto(corpo, "cnpj", { max: 30 });

  // Mesmo CNPJ ou mesmo nome na organização: devolve o proponente que já existe.
  let existente: Linha | null | undefined = await acharPorNome(admin, orgId, "proponentes", COLUNAS, nome);
  if (!existente && cnpj) {
    const { data, error } = await admin.from("proponentes").select(COLUNAS).eq("organization_id", orgId).eq("cnpj", cnpj).limit(1).maybeSingle();
    if (error) throw erroDoBanco(error);
    existente = (data as Linha | null) ?? undefined;
  }
  if (existente) {
    return resposta({
      proponente: existente,
      ja_existia: true,
      mensagem: "Este proponente já está no CRM da organização: nada foi criado.",
      url: linkDoApp(origem, "proponente", existente.id as string),
    });
  }

  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    nome,
    nome_key: chaveDoNome(nome),
    cnpj,
    tipo: opcao(corpo, "tipo", TIPOS_PROPONENTE),
    cidade: texto(corpo, "cidade", { max: 120 }),
    estado: texto(corpo, "estado", { max: 60 }),
    email: email(corpo, "email"),
    telefone: texto(corpo, "telefone", { max: 60 }),
    site: texto(corpo, "site", { max: 300 }),
    descricao: texto(corpo, "descricao", { max: 4000 }),
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data, error } = await admin.from("proponentes").insert(campos).select(COLUNAS).single();
  if (error) throw erroDoBanco(error);
  return resposta({ proponente: data, ja_existia: false, url: linkDoApp(origem, "proponente", (data as Linha).id as string) }, 201);
});
