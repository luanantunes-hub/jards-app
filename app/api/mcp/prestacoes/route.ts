import { STATUS_PRESTACAO } from "@/lib/mcp/prestacao/enums";
import { resumoDaPrestacao, type LinhaDePrestacao, type RegimeResumido } from "@/lib/mcp/prestacao/projecoes";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco, paginacao, paramOpcao, termoDeBusca } from "@/lib/mcp/validacao";

const COLUNAS = "id,titulo,status,prazo,prazo_final,prazo_final_override,valor_aprovado,valor_realizado,regime_id,identificador_oficial,updated_at";

/** Lista as prestações da organização, as com prazo mais perto primeiro. Só colunas escolhidas: nada de arquivo nem dado pessoal. */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, query, origem }) => {
  const { limite, deslocamento } = paginacao(query);
  const busca = termoDeBusca(query.get("busca"));
  const status = paramOpcao(query, "status", STATUS_PRESTACAO);

  let consulta = admin
    .from("prestacoes_contas")
    .select(COLUNAS, { count: "exact" })
    .eq("organization_id", orgId)
    .order("prazo", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(deslocamento, deslocamento + limite - 1);
  if (busca) consulta = consulta.ilike("titulo", `%${busca}%`);
  if (status) consulta = consulta.eq("status", status);

  const { data, error, count } = await consulta;
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as unknown as LinhaDePrestacao[];

  const idsDeRegime = [...new Set(linhas.map((linha) => linha.regime_id).filter((id): id is string => !!id))];
  const regimes = new Map<string, RegimeResumido>();
  if (idsDeRegime.length > 0) {
    const { data: encontrados, error: erroRegimes } = await admin.from("prestacao_regimes").select("id,codigo,nome").in("id", idsDeRegime);
    if (erroRegimes) throw erroDoBanco(erroRegimes);
    for (const regime of (encontrados ?? []) as unknown as RegimeResumido[]) regimes.set(regime.id, regime);
  }

  const total = count ?? linhas.length;
  return resposta({
    prestacoes: linhas.map((linha) => resumoDaPrestacao(linha, regimes, origem)),
    total,
    proximo_deslocamento: deslocamento + limite < total ? deslocamento + limite : null,
  });
});
