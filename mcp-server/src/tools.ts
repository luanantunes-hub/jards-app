import { z } from "zod";
import { supabase } from "./supabase.js";

/**
 * O client usa a service role key (bypassa RLS), então toda consulta aqui
 * precisa ser explicitamente filtrada por organization_id — nunca exponha
 * uma ferramenta que leia uma tabela multi-tenant sem esse filtro.
 */

const orgIdParam = z.string().uuid().describe("ID da organização (organizations.id) cujos dados serão consultados");
const limitParam = z.number().int().min(1).max(100).default(20).describe("Máximo de resultados (padrão 20, máx 100)");
const searchParam = z.string().trim().min(1).optional().describe("Termo de busca (contém, case-insensitive)");

export interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export const tools: ToolDef[] = [
  {
    name: "listar_projetos",
    description:
      "Lista projetos do CRM (projetos_crm) de uma organização: nome, fase, status, valores, proponente, cidade/estado.",
    schema: {
      organization_id: orgIdParam,
      busca: searchParam,
      fase: z
        .enum(["planejamento", "captacao", "execucao", "prestacao", "concluido"])
        .optional()
        .describe("Filtra pela fase do projeto"),
      limite: limitParam,
    },
    handler: async ({ organization_id, busca, fase, limite }) => {
      let query = supabase
        .from("projetos_crm")
        .select(
          "id,nome,descricao,fase,status_operacional,status_comercial,valor_alvo,valor_total,valor_garantido,proponente_nome,cidade,estado,data_inicio,data_fim,updated_at"
        )
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      if (fase) query = query.eq("fase", fase);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "obter_projeto",
    description: "Retorna os detalhes completos de um projeto do CRM pelo ID.",
    schema: {
      organization_id: orgIdParam,
      projeto_id: z.string().uuid().describe("ID do projeto (projetos_crm.id)"),
    },
    handler: async ({ organization_id, projeto_id }) => {
      const { data, error } = await supabase
        .from("projetos_crm")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("id", projeto_id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_empresas",
    description:
      "Lista empresas do CRM (empresas_crm) — patrocinadores e potenciais patrocinadores de uma organização.",
    schema: {
      organization_id: orgIdParam,
      busca: searchParam,
      limite: limitParam,
    },
    handler: async ({ organization_id, busca, limite }) => {
      let query = supabase
        .from("empresas_crm")
        .select("id,nome,cnpj,segmento,cidade,estado,status,updated_at")
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_propostas",
    description: "Lista propostas comerciais (propostas) de uma organização, opcionalmente filtradas por projeto.",
    schema: {
      organization_id: orgIdParam,
      projeto_id: z.string().uuid().optional().describe("Filtra propostas de um projeto específico"),
      limite: limitParam,
    },
    handler: async ({ organization_id, projeto_id, limite }) => {
      let query = supabase
        .from("propostas")
        .select("id,projeto_id,empresa_id,status,valor,created_at,updated_at")
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (projeto_id) query = query.eq("projeto_id", projeto_id);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_tarefas",
    description: "Lista tarefas (tarefas) de uma organização, opcionalmente filtradas por projeto ou responsável.",
    schema: {
      organization_id: orgIdParam,
      projeto_id: z.string().uuid().optional(),
      apenas_pendentes: z.boolean().default(false).describe("Se true, oculta tarefas concluídas"),
      limite: limitParam,
    },
    handler: async ({ organization_id, projeto_id, apenas_pendentes, limite }) => {
      let query = supabase
        .from("tarefas")
        .select("id,projeto_id,titulo,status,prazo,responsavel_id,updated_at")
        .eq("organization_id", organization_id)
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(limite as number);
      if (projeto_id) query = query.eq("projeto_id", projeto_id);
      if (apenas_pendentes) query = query.neq("status", "concluida");
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_captadores",
    description: "Lista captadores de uma organização.",
    schema: {
      organization_id: orgIdParam,
      busca: searchParam,
      limite: limitParam,
    },
    handler: async ({ organization_id, busca, limite }) => {
      let query = supabase
        .from("captadores")
        .select("id,nome,email,status,updated_at")
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_proponentes",
    description: "Lista proponentes de uma organização.",
    schema: {
      organization_id: orgIdParam,
      busca: searchParam,
      limite: limitParam,
    },
    handler: async ({ organization_id, busca, limite }) => {
      let query = supabase
        .from("proponentes")
        .select("id,nome,cidade,estado,updated_at")
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
];

export async function callTool(name: string, args: Record<string, unknown>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Ferramenta desconhecida: ${name}`);
  const parsed = z.object(tool.schema).parse(args ?? {});
  const data = await tool.handler(parsed);
  return textResult(data);
}
