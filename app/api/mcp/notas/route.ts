import { garantirDaOrganizacao } from "@/lib/mcp/crm";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco, ErroMcp, texto, uuidDe } from "@/lib/mcp/validacao";

const ESCOPOS = {
  empresa_crm_id: "empresas_crm",
  contato_id: "contatos",
  captacao_id: "captacoes",
  edital_user_id: "editais_user",
  proponente_id: "proponentes",
} as const;

/** Nota livre numa empresa, num contato, numa negociação, numa inscrição em edital ou num proponente. */
export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo }) => {
  const conteudo = texto(corpo, "conteudo", { obrigatorio: true, max: 8000 }) as string;
  const titulo = texto(corpo, "titulo", { max: 200 });

  const campos = Object.keys(ESCOPOS) as (keyof typeof ESCOPOS)[];
  const informados = campos.map((campo) => [campo, uuidDe(corpo, campo)] as const).filter(([, id]) => id !== null);
  if (informados.length !== 1) throw new ErroMcp(400, `A nota fica numa só coisa: informe exatamente um destes: ${campos.join(", ")}.`);
  const [coluna, id] = informados[0] as [keyof typeof ESCOPOS, string];
  await garantirDaOrganizacao(admin, orgId, ESCOPOS[coluna], coluna, id);

  const { data, error } = await admin
    .from("notas")
    .insert({ organization_id: orgId, account_id: ctx.userId, conteudo, ...(titulo ? { titulo } : {}), [coluna]: id })
    .select("id,titulo,conteudo,created_at,empresa_crm_id,contato_id,captacao_id,edital_user_id,proponente_id")
    .single();
  // O banco não aceita dois títulos iguais na mesma pessoa/instituição proponente.
  if (error?.code === "23505") throw new ErroMcp(409, "Este proponente já tem uma nota com esse título: use outro título ou deixe sem título.");
  if (error) throw erroDoBanco(error);
  return resposta({ nota: data }, 201);
});
