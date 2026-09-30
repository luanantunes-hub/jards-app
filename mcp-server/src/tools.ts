import { z } from "zod";
import { supabase } from "./supabase.js";

/**
 * O client usa a service role key (bypassa RLS), então toda consulta/escrita aqui
 * precisa ser explicitamente filtrada/gravada por organization_id — nunca exponha
 * uma ferramenta nova sobre uma tabela multi-tenant sem esse filtro.
 */

const orgIdParam = z.string().uuid().describe("ID da organização (organizations.id) cujos dados serão acessados");
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

/**
 * `account_id` é uma coluna legada (pré multi-organização) ainda NOT NULL em
 * algumas tabelas. Dentro de uma mesma organização todo registro compartilha o
 * mesmo account_id, então resolvemos por amostragem em vez de pedir esse campo
 * ao usuário da ferramenta.
 */
async function resolveAccountId(organizationId: string): Promise<string> {
  const { data, error } = await supabase
    .from("contatos")
    .select("account_id")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.account_id) {
    throw new Error(
      "Não foi possível resolver account_id para essa organização (nenhum contato existente). Crie o primeiro registro pelo app."
    );
  }
  return data.account_id;
}

export const tools: ToolDef[] = [
  // ── Leitura ────────────────────────────────────────────────────────────
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
      tipo: z.enum(["prospect", "cliente_ativo", "ex_cliente"]).optional(),
      limite: limitParam,
    },
    handler: async ({ organization_id, busca, tipo, limite }) => {
      let query = supabase
        .from("empresas_crm")
        .select("id,nome,setor,site,tipo,status,localizacao,ja_patrocina_cultura,ja_patrocina_esporte,updated_at")
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      if (tipo) query = query.eq("tipo", tipo);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_contatos",
    description:
      "Traz contatos do CRM de uma organização — pessoas ligadas a empresas, proponentes ou captadores, com cargo, e-mail, telefone e papel de decisão.",
    schema: {
      organization_id: orgIdParam,
      busca: searchParam,
      empresa_crm_id: z.string().uuid().optional().describe("Filtra contatos de uma empresa específica"),
      apenas_ativos: z.boolean().default(true).describe("Se true (padrão), oculta contatos marcados como inativos na empresa"),
      limite: limitParam,
    },
    handler: async ({ organization_id, busca, empresa_crm_id, apenas_ativos, limite }) => {
      let query = supabase
        .from("contatos")
        .select(
          "id,nome,cargo,email,telefone,telefone_2,linkedin_url,empresa_crm_id,proponente_id,captador_id,papel_decisao,sentimento,score,ativo_na_empresa,ultima_interacao,updated_at"
        )
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      if (empresa_crm_id) query = query.eq("empresa_crm_id", empresa_crm_id);
      if (apenas_ativos) query = query.eq("ativo_na_empresa", true);
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
        .select("id,projeto_id,titulo,status,valor_proposto,total_visualizacoes,created_at,updated_at")
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
    description: "Lista tarefas comerciais de uma organização, opcionalmente filtradas por responsável.",
    schema: {
      organization_id: orgIdParam,
      responsavel_id: z.string().uuid().optional(),
      apenas_pendentes: z.boolean().default(false).describe("Se true, oculta tarefas concluídas/canceladas"),
      limite: limitParam,
    },
    handler: async ({ organization_id, responsavel_id, apenas_pendentes, limite }) => {
      let query = supabase
        .from("tarefas")
        .select("id,titulo,tipo,status,data_prazo,data_conclusao,responsavel_id,captacao_id,created_at")
        .eq("organization_id", organization_id)
        .order("data_prazo", { ascending: true, nullsFirst: false })
        .limit(limite as number);
      if (responsavel_id) query = query.eq("responsavel_id", responsavel_id);
      if (apenas_pendentes) query = query.in("status", ["pendente", "em_andamento"]);
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

  // ── Análise ────────────────────────────────────────────────────────────
  {
    name: "avaliar_carteira_empresa",
    description:
      "Avalia a carteira de uma empresa a partir dos projetos que ela já apoiou (vendas_patrocinio): lista cada projeto patrocinado com valor investido e data, além de totais, ticket médio, áreas culturais recorrentes e há quanto tempo não patrocina — útil para decidir próxima abordagem.",
    schema: {
      organization_id: orgIdParam,
      empresa_crm_id: z.string().uuid().describe("ID da empresa (empresas_crm.id) a avaliar"),
    },
    handler: async ({ organization_id, empresa_crm_id }) => {
      const { data: empresa, error: empresaError } = await supabase
        .from("empresas_crm")
        .select("id,nome,setor,tipo,ja_patrocina_cultura,ja_patrocina_esporte")
        .eq("organization_id", organization_id)
        .eq("id", empresa_crm_id)
        .single();
      if (empresaError) throw new Error(empresaError.message);

      const { data: vendas, error: vendasError } = await supabase
        .from("vendas_patrocinio")
        .select("id,projeto_id,valor_vendido,quantidade,vendida_em")
        .eq("organization_id", organization_id)
        .eq("empresa_crm_id", empresa_crm_id)
        .order("vendida_em", { ascending: false });
      if (vendasError) throw new Error(vendasError.message);

      const projetoIds = [...new Set((vendas ?? []).map((v) => v.projeto_id))];
      let projetosPorId = new Map<string, { id: string; nome: string; fase: string; areas_culturais: string[]; cidade: string | null }>();
      if (projetoIds.length > 0) {
        const { data: projetos, error: projetosError } = await supabase
          .from("projetos_crm")
          .select("id,nome,fase,areas_culturais,cidade")
          .in("id", projetoIds);
        if (projetosError) throw new Error(projetosError.message);
        projetosPorId = new Map((projetos ?? []).map((p) => [p.id, p]));
      }

      const historico = (vendas ?? []).map((v) => ({
        projeto_id: v.projeto_id,
        projeto_nome: projetosPorId.get(v.projeto_id)?.nome ?? null,
        projeto_fase: projetosPorId.get(v.projeto_id)?.fase ?? null,
        valor_vendido: v.valor_vendido,
        vendida_em: v.vendida_em,
      }));

      const valorTotal = historico.reduce((acc, h) => acc + (h.valor_vendido ?? 0), 0);
      const areasContagem: Record<string, number> = {};
      for (const id of projetoIds) {
        for (const area of projetosPorId.get(id)?.areas_culturais ?? []) {
          areasContagem[area] = (areasContagem[area] ?? 0) + 1;
        }
      }
      const areasRecorrentes = Object.entries(areasContagem)
        .sort((a, b) => b[1] - a[1])
        .map(([area, vezes]) => ({ area, vezes }));

      const ultimaPatrocinio = historico[0]?.vendida_em ?? null;
      const diasDesdeUltimo = ultimaPatrocinio
        ? Math.floor((Date.now() - new Date(ultimaPatrocinio).getTime()) / 86_400_000)
        : null;

      return {
        empresa,
        resumo: {
          projetos_apoiados: projetoIds.length,
          patrocinios_realizados: historico.length,
          valor_total_investido: valorTotal,
          ticket_medio: historico.length > 0 ? valorTotal / historico.length : 0,
          areas_culturais_recorrentes: areasRecorrentes,
          ultimo_patrocinio_em: ultimaPatrocinio,
          dias_desde_ultimo_patrocinio: diasDesdeUltimo,
        },
        historico_patrocinios: historico,
      };
    },
  },
  {
    name: "resumo_organizacao",
    description:
      "Visão geral para análise rápida: quantidade de projetos por fase, propostas por status, tarefas pendentes e valor total captado — ponto de partida para perguntas analíticas sobre a organização.",
    schema: { organization_id: orgIdParam },
    handler: async ({ organization_id }) => {
      const [projetos, propostas, tarefas, vendas] = await Promise.all([
        supabase.from("projetos_crm").select("fase,status_comercial,valor_total").eq("organization_id", organization_id),
        supabase.from("propostas").select("status").eq("organization_id", organization_id),
        supabase.from("tarefas").select("status").eq("organization_id", organization_id),
        supabase.from("vendas_patrocinio").select("valor_vendido").eq("organization_id", organization_id),
      ]);
      for (const r of [projetos, propostas, tarefas, vendas]) {
        if (r.error) throw new Error(r.error.message);
      }
      const contarPor = <T extends Record<string, unknown>>(rows: T[], campo: keyof T) => {
        const out: Record<string, number> = {};
        for (const row of rows) {
          const chave = String(row[campo] ?? "sem_status");
          out[chave] = (out[chave] ?? 0) + 1;
        }
        return out;
      };
      return {
        projetos_por_fase: contarPor(projetos.data ?? [], "fase"),
        projetos_por_status_comercial: contarPor(projetos.data ?? [], "status_comercial"),
        propostas_por_status: contarPor(propostas.data ?? [], "status"),
        tarefas_por_status: contarPor(tarefas.data ?? [], "status"),
        valor_total_captado_historico: (vendas.data ?? []).reduce((acc, v) => acc + (v.valor_vendido ?? 0), 0),
        total_projetos: (projetos.data ?? []).length,
      };
    },
  },

  // ── Criação ────────────────────────────────────────────────────────────
  {
    name: "criar_contato",
    description: "Cria um novo contato no CRM, opcionalmente já vinculado a uma empresa, proponente ou captador.",
    schema: {
      organization_id: orgIdParam,
      nome: z.string().trim().min(1),
      empresa_crm_id: z.string().uuid().optional(),
      proponente_id: z.string().uuid().optional(),
      captador_id: z.string().uuid().optional(),
      cargo: z.string().trim().optional(),
      email: z.string().trim().email().optional(),
      telefone: z.string().trim().optional(),
      linkedin_url: z.string().trim().url().optional(),
      origem: z.enum(["jards", "proprio", "indicacao", "linkedin", "outro"]).optional(),
      notas: z.string().trim().optional(),
    },
    handler: async ({ organization_id, ...campos }) => {
      const account_id = await resolveAccountId(organization_id as string);
      const { data, error } = await supabase
        .from("contatos")
        .insert({ organization_id, account_id, ...campos })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma nova tarefa comercial (ex.: ligação, e-mail, follow-up) no CRM.",
    schema: {
      organization_id: orgIdParam,
      titulo: z.string().trim().min(1),
      tipo: z.enum(["email", "ligacao", "reuniao", "documento", "followup", "tarefa"]).default("tarefa"),
      status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).default("pendente"),
      data_prazo: z.string().datetime().optional().describe("Prazo em ISO 8601, ex. 2026-10-15T12:00:00Z"),
      responsavel_id: z.string().uuid().optional(),
      captacao_id: z.string().uuid().optional(),
    },
    handler: async ({ organization_id, ...campos }) => {
      const account_id = await resolveAccountId(organization_id as string);
      const { data, error } = await supabase
        .from("tarefas")
        .insert({ organization_id, account_id, ...campos })
        .select()
        .single();
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
