import { DESFECHOS_INSCRICAO } from "@/lib/etapas";
import { nomesPorId, type Linha } from "@/lib/mcp/crm";
import { carregarFunil } from "@/lib/mcp/funil";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco, paginacao, paramBooleano, paramUuid } from "@/lib/mcp/validacao";

const COLUNAS =
  "id,status,prioridade,valor,data_abertura,data_fechamento,data_resultado,potencial_fechamento,site,lei,observacoes,empresa_crm_id,projeto_id,edital_pub_id,updated_at";

/** Inscrições da organização em editais de patrocínio das empresas (a página "Editais inscritos" do app). */
export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const { limite, deslocamento } = paginacao(query);
  const status = query.get("status")?.trim() || null;
  const empresaId = paramUuid(query, "empresa_crm_id");
  const projetoId = paramUuid(query, "projeto_id");

  let consulta = admin
    .from("editais_user")
    .select(COLUNAS)
    .eq("organization_id", orgId)
    .order("data_fechamento", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (status) consulta = consulta.eq("status", status);
  if (empresaId) consulta = consulta.eq("empresa_crm_id", empresaId);
  if (projetoId) consulta = consulta.eq("projeto_id", projetoId);
  if (paramBooleano(query, "apenas_em_aberto")) consulta = consulta.not("status", "in", `(${DESFECHOS_INSCRICAO.join(",")})`);

  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as Linha[];

  const editaisIds = [...new Set(linhas.map((linha) => linha.edital_pub_id as string | null).filter((id): id is string => Boolean(id)))];
  const [empresas, projetos, editais, funil] = await Promise.all([
    nomesPorId(admin, orgId, "empresas_crm", linhas.map((linha) => linha.empresa_crm_id)),
    nomesPorId(admin, orgId, "projetos_crm", linhas.map((linha) => linha.projeto_id)),
    editaisIds.length > 0 ? admin.from("editais").select("id,titulo,url_acesso").in("id", editaisIds) : Promise.resolve({ data: [], error: null }),
    carregarFunil(admin, orgId),
  ]);
  if (editais.error) throw erroDoBanco(editais.error);
  const titulos = new Map(((editais.data ?? []) as Linha[]).map((edital) => [edital.id as string, edital as Linha]));
  const etapas = new Map(funil.inscricao.map((etapa) => [etapa.chave, etapa.nome]));

  return resposta({
    inscricoes: linhas.map((linha) => ({
      ...linha,
      etapa: etapas.get(linha.status as string) ?? linha.status,
      empresa_nome: linha.empresa_crm_id ? empresas.get(linha.empresa_crm_id) ?? null : null,
      projeto_nome: linha.projeto_id ? projetos.get(linha.projeto_id) ?? null : null,
      edital_titulo: linha.edital_pub_id ? (titulos.get(linha.edital_pub_id)?.titulo as string | undefined) ?? null : null,
      edital_url: linha.edital_pub_id ? (titulos.get(linha.edital_pub_id)?.url_acesso as string | undefined) ?? null : null,
    })),
  });
});
