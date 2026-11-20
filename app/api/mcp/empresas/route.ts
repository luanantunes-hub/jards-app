import { mesmoNome, resolverDominio } from "@/lib/dominio";
import { acharPorNome, garantirMembro, linkDoApp, type Admin, type Linha } from "@/lib/mcp/crm";
import { TIPOS_EMPRESA } from "@/lib/mcp/enums";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { normalizarUf, separarCidadeUf } from "@/lib/mcp/ufs";
import {
  booleano,
  erroDoBanco,
  igualSemCaixa,
  inteiro,
  listaDeTextos,
  opcao,
  paginacao,
  paramOpcao,
  paramUf,
  termoDeBusca,
  texto,
  trechoParaBusca,
  ufDe,
  uuidDe,
  ErroMcp,
} from "@/lib/mcp/validacao";

const COLUNAS =
  "id,nome,setor,site,domain_key,tipo,status,cidade,estado,localizacao,cidades_interesse,ja_patrocina_cultura,ja_patrocina_esporte,potencial_relacionamento,responsavel_interno_id,empresa_pub_id,created_at,updated_at";

export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const { limite, deslocamento } = paginacao(query);
  const busca = termoDeBusca(query.get("busca"));
  const tipo = paramOpcao(query, "tipo", TIPOS_EMPRESA);
  const cidade = termoDeBusca(query.get("cidade"));
  const estado = paramUf(query, "estado");

  let consulta = admin
    .from("empresas_crm")
    .select("id,nome,setor,site,tipo,status,cidade,estado,localizacao,ja_patrocina_cultura,ja_patrocina_esporte,empresa_pub_id,updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (busca) consulta = consulta.ilike("nome", `%${busca}%`);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (cidade) consulta = consulta.ilike("cidade", `%${cidade}%`);
  if (estado) consulta = consulta.eq("estado", estado);

  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  return resposta({ empresas: data });
});

/** Empresa que já está no CRM da organização com esse nome (ou ligada à mesma empresa da base pública). */
async function acharExistente(admin: Admin, orgId: string, nome: string, empresaPubId: string | null): Promise<Linha | null> {
  if (empresaPubId) {
    const { data, error } = await admin.from("empresas_crm").select(COLUNAS).eq("organization_id", orgId).eq("empresa_pub_id", empresaPubId).limit(1).maybeSingle();
    if (error) throw erroDoBanco(error);
    if (data) return data as Linha;
  }
  return acharPorNome(admin, orgId, "empresas_crm", COLUNAS, nome);
}

/** Empresa da base pública do Jards com exatamente esse nome (só vincula quando não há dúvida). */
async function acharNaBasePublica(admin: Admin, nome: string): Promise<Linha | null> {
  // Igualdade primeiro: com um nome curto e comum ("Vale") a busca por trecho traz muitas empresas.
  for (const padrao of [igualSemCaixa(nome), `%${trechoParaBusca(nome)}%`]) {
    const { data, error } = await admin.from("empresas").select("id,nome,site,setor,cidade,estado").ilike("nome", padrao).limit(100);
    if (error) throw erroDoBanco(error);
    const iguais = ((data ?? []) as Linha[]).filter((linha) => mesmoNome(linha.nome as string, nome));
    if (iguais.length === 1) return iguais[0];
    if (iguais.length > 1) return null; // nome repetido na base: não há como saber qual é
  }
  return null;
}

export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo, origem }) => {
  const nome = texto(corpo, "nome", { obrigatorio: true, max: 200 }) as string;
  const tipo = opcao(corpo, "tipo", TIPOS_EMPRESA) ?? "prospect";
  const informouSite = texto(corpo, "site", { max: 300 });
  const informouSetor = texto(corpo, "setor", { max: 120 });
  const localizacaoPedida = texto(corpo, "localizacao", { max: 160 });
  let cidadePedida = texto(corpo, "cidade", { max: 120 });
  let estadoPedido = ufDe(corpo, "estado");
  if (localizacaoPedida && cidadePedida === null && estadoPedido === null) {
    const separada = separarCidadeUf(localizacaoPedida);
    if (separada.cidade === null && separada.estado === null) {
      throw new ErroMcp(400, 'localizacao deve ser "Cidade-UF" com a sigla de um estado, como Curitiba-PR. Prefira os campos cidade e estado.');
    }
    cidadePedida = separada.cidade;
    estadoPedido = separada.estado;
  }
  const cidadesInteresse = listaDeTextos(corpo, "cidades_interesse");
  const jaPatrocinaCultura = booleano(corpo, "ja_patrocina_cultura");
  const jaPatrocinaEsporte = booleano(corpo, "ja_patrocina_esporte");
  const potencial = inteiro(corpo, "potencial_relacionamento", { min: 0, max: 100 });
  const responsavel = await garantirMembro(admin, orgId, "responsavel_interno_id", uuidDe(corpo, "responsavel_interno_id"));
  const pedidaPub = uuidDe(corpo, "empresa_pub_id");

  // Quem pediu duas vezes (ou já tinha a empresa) recebe a que existe, em vez de uma duplicata.
  const existente = await acharExistente(admin, orgId, nome, pedidaPub);
  if (existente) {
    return resposta({
      empresa: existente,
      ja_existia: true,
      mensagem: "Esta empresa já está no CRM da organização: nada foi criado.",
      url: linkDoApp(origem, "empresa", existente.id as string),
    });
  }

  let basePublica: Linha | null = null;
  if (pedidaPub) {
    const { data, error } = await admin.from("empresas").select("id,nome,site,setor,cidade,estado").eq("id", pedidaPub).maybeSingle();
    if (error) throw erroDoBanco(error);
    if (!data) throw new ErroMcp(404, "empresa_pub_id não existe na base pública de patrocinadores.");
    basePublica = data as Linha;
  } else {
    basePublica = await acharNaBasePublica(admin, nome);
  }

  const site = informouSite ?? (basePublica?.site as string | null | undefined) ?? null;
  const setor = informouSetor ?? (basePublica?.setor as string | null | undefined) ?? null;
  // Sem localização informada, herda da empresa da base pública a que foi ligada.
  const herdaLocalizacao = cidadePedida === null && estadoPedido === null && basePublica !== null;
  const cidade = herdaLocalizacao ? ((basePublica?.cidade as string | null | undefined)?.trim() || null) : cidadePedida;
  const estado = herdaLocalizacao ? normalizarUf(basePublica?.estado as string | null | undefined) : estadoPedido;
  const localizacao = cidade && estado ? `${cidade}-${estado}` : cidade ?? estado ?? null;
  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    nome,
    tipo,
    setor,
    site,
    domain_key: resolverDominio(site),
    cidade,
    estado,
    localizacao,
    cidades_interesse: cidadesInteresse ?? [],
    ja_patrocina_cultura: jaPatrocinaCultura,
    ja_patrocina_esporte: jaPatrocinaEsporte,
    potencial_relacionamento: potencial,
    responsavel_interno_id: responsavel,
    empresa_pub_id: basePublica ? (basePublica.id as string) : null,
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data, error } = await admin.from("empresas_crm").insert(campos).select(COLUNAS).single();
  if (error) throw erroDoBanco(error);
  return resposta(
    {
      empresa: data,
      ja_existia: false,
      vinculada_a_base_publica: basePublica ? { id: basePublica.id, nome: basePublica.nome } : null,
      url: linkDoApp(origem, "empresa", (data as Linha).id as string),
    },
    201
  );
});
