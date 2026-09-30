import { z } from "zod";
import { ensureAuthenticated, supabase } from "./supabase.js";

/**
 * Este servidor autentica como o usuário real (ver supabase.ts) e usa a anon
 * key — nunca service role. Toda leitura/escrita passa pelo RLS do Supabase,
 * que já restringe:
 *   - dados de CRM (projetos, propostas, tarefas, contatos) à(s)
 *     organização(ões) de que o usuário é membro;
 *   - contatos, ao consumo de crédito via fn_desbloquear_empresa (a mesma
 *     função usada pelo app web).
 * Editais e a base pública de empresas/patrocinadores não são escopados por
 * organização — são compartilhados entre todos os usuários, de propósito.
 */

const orgIdParam = z
  .string()
  .uuid()
  .optional()
  .describe(
    "ID da organização (organizations.id). Opcional se o usuário pertence a apenas uma organização — " +
      "use listar_minhas_organizacoes para descobrir o ID."
  );
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

const PLANO_NECESSARIO_MSG =
  "Assinatura necessária. O acesso ao Jards via MCP está disponível nos planos pagos — assine em /meu-plano.";

/** Reaproveita fn_org_assinatura_ativa — a mesma checagem que já protege créditos/contatos no app web. */
async function orgTemAssinaturaAtiva(organizationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_org_assinatura_ativa", { p_organization_id: organizationId });
  return !error && data === true;
}

/** Resolve a organização-alvo: usa a informada, ou a única de que o usuário é membro. */
async function resolveOrgId(organizationId?: string): Promise<string> {
  const { data, error } = await supabase.from("organization_members").select("organization_id");
  if (error) throw new Error(error.message);
  const orgs = [...new Set((data ?? []).map((r) => r.organization_id))];

  if (organizationId) {
    if (!orgs.includes(organizationId)) throw new Error("Usuário não pertence a essa organização.");
    if (!(await orgTemAssinaturaAtiva(organizationId))) throw new Error(PLANO_NECESSARIO_MSG);
    return organizationId;
  }

  const pagas: string[] = [];
  for (const id of orgs) if (await orgTemAssinaturaAtiva(id)) pagas.push(id);

  if (pagas.length === 1) return pagas[0];
  if (pagas.length === 0) {
    if (orgs.length === 0) throw new Error("Usuário não pertence a nenhuma organização.");
    throw new Error(PLANO_NECESSARIO_MSG);
  }
  throw new Error(
    `Usuário pertence a ${pagas.length} organizações com plano pago — informe organization_id. Use listar_minhas_organizacoes.`
  );
}

export const tools: ToolDef[] = [
  // ── Identidade ─────────────────────────────────────────────────────────
  {
    name: "listar_minhas_organizacoes",
    description: "Lista as organizações de que o usuário autenticado é membro (id, nome, papel).",
    schema: {},
    handler: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("papel,organizations(id,nome)");
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ── CRM (escopado por organização via RLS) ───────────────────────────────
  {
    name: "listar_projetos",
    description:
      "Lista projetos do CRM (projetos_crm) da organização do usuário: nome, fase, status, valores, proponente, cidade/estado.",
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
      const orgId = await resolveOrgId(organization_id as string | undefined);
      let query = supabase
        .from("projetos_crm")
        .select(
          "id,nome,descricao,fase,status_operacional,status_comercial,valor_alvo,valor_total,valor_garantido,proponente_nome,cidade,estado,data_inicio,data_fim,updated_at"
        )
        .eq("organization_id", orgId)
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
      const orgId = await resolveOrgId(organization_id as string | undefined);
      const { data, error } = await supabase
        .from("projetos_crm")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", projeto_id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_empresas_crm",
    description:
      "Lista empresas do CRM da organização do usuário (empresas_crm) — patrocinadores e prospects já trabalhados pela equipe.",
    schema: {
      organization_id: orgIdParam,
      busca: searchParam,
      tipo: z.enum(["prospect", "cliente_ativo", "ex_cliente"]).optional(),
      limite: limitParam,
    },
    handler: async ({ organization_id, busca, tipo, limite }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);
      let query = supabase
        .from("empresas_crm")
        .select("id,nome,setor,site,tipo,status,localizacao,ja_patrocina_cultura,ja_patrocina_esporte,updated_at")
        .eq("organization_id", orgId)
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
      "Traz contatos do CRM ligados a uma empresa. IMPORTANTE: ver contatos de uma empresa pela primeira vez consome 1 " +
      "crédito da organização (mesma regra do app — fn_desbloquear_empresa); se a empresa já estiver desbloqueada, é de graça.",
    schema: {
      organization_id: orgIdParam,
      empresa_crm_id: z.string().uuid().describe("Empresa cujos contatos serão desbloqueados/consultados"),
      busca: searchParam,
      limite: limitParam,
    },
    handler: async ({ organization_id, empresa_crm_id, busca, limite }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);
      const { data: desbloqueio, error: desbloqueioError } = await supabase.rpc("fn_desbloquear_empresa", {
        p_organization_id: orgId,
        p_empresa_id: empresa_crm_id,
      });
      if (desbloqueioError) throw new Error(desbloqueioError.message);

      let query = supabase
        .from("contatos")
        .select(
          "id,nome,cargo,email,telefone,telefone_2,linkedin_url,papel_decisao,sentimento,score,ativo_na_empresa,ultima_interacao,updated_at"
        )
        .eq("organization_id", orgId)
        .eq("empresa_crm_id", empresa_crm_id)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { desbloqueio, contatos: data };
    },
  },
  {
    name: "listar_propostas",
    description: "Lista propostas comerciais da organização do usuário, opcionalmente filtradas por projeto.",
    schema: {
      organization_id: orgIdParam,
      projeto_id: z.string().uuid().optional().describe("Filtra propostas de um projeto específico"),
      limite: limitParam,
    },
    handler: async ({ organization_id, projeto_id, limite }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);
      let query = supabase
        .from("propostas")
        .select("id,projeto_id,titulo,status,valor_proposto,total_visualizacoes,created_at,updated_at")
        .eq("organization_id", orgId)
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
    description: "Lista tarefas comerciais da organização do usuário, opcionalmente filtradas por responsável.",
    schema: {
      organization_id: orgIdParam,
      responsavel_id: z.string().uuid().optional(),
      apenas_pendentes: z.boolean().default(false).describe("Se true, oculta tarefas concluídas/canceladas"),
      limite: limitParam,
    },
    handler: async ({ organization_id, responsavel_id, apenas_pendentes, limite }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);
      let query = supabase
        .from("tarefas")
        .select("id,titulo,tipo,status,data_prazo,data_conclusao,responsavel_id,captacao_id,created_at")
        .eq("organization_id", orgId)
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
    description: "Lista captadores da organização do usuário.",
    schema: { organization_id: orgIdParam, busca: searchParam, limite: limitParam },
    handler: async ({ organization_id, busca, limite }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);
      let query = supabase
        .from("captadores")
        .select("id,nome,email,status,updated_at")
        .eq("organization_id", orgId)
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
    description: "Lista proponentes da organização do usuário.",
    schema: { organization_id: orgIdParam, busca: searchParam, limite: limitParam },
    handler: async ({ organization_id, busca, limite }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);
      let query = supabase
        .from("proponentes")
        .select("id,nome,cidade,estado,updated_at")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ── Base pública compartilhada (não escopada por organização) ───────────
  {
    name: "listar_patrocinadores_publicos",
    description:
      "Consulta a base pública de empresas/patrocinadores do Jards (não é a carteira da sua organização — é a base " +
      "compartilhada entre todos os clientes, usada para prospecção).",
    schema: { busca: searchParam, limite: limitParam },
    handler: async ({ busca, limite }) => {
      let query = supabase.from("empresas").select("id,nome,site,cidade,estado,segmento").limit(limite as number);
      if (busca) query = query.ilike("nome", `%${busca}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "listar_editais",
    description: "Lista editais públicos cadastrados no Jards (base compartilhada, não escopada por organização).",
    schema: { busca: searchParam, apenas_ativos: z.boolean().default(true), limite: limitParam },
    handler: async ({ busca, apenas_ativos, limite }) => {
      let query = supabase
        .from("editais")
        .select("id,titulo,data_abertura,data_fechamento,url_acesso,ativo")
        .order("data_fechamento", { ascending: true })
        .limit(limite as number);
      if (busca) query = query.ilike("titulo", `%${busca}%`);
      if (apenas_ativos) query = query.eq("ativo", true);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ── Análise ────────────────────────────────────────────────────────────
  {
    name: "avaliar_carteira_empresa",
    description:
      "Avalia a carteira de uma empresa a partir dos projetos que ela já apoiou (vendas_patrocinio): lista cada projeto " +
      "patrocinado com valor investido e data, além de totais, ticket médio, áreas culturais recorrentes e há quanto " +
      "tempo não patrocina — útil para decidir a próxima abordagem.",
    schema: { organization_id: orgIdParam, empresa_crm_id: z.string().uuid().describe("ID da empresa (empresas_crm.id) a avaliar") },
    handler: async ({ organization_id, empresa_crm_id }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);

      const { data: empresa, error: empresaError } = await supabase
        .from("empresas_crm")
        .select("id,nome,setor,tipo,ja_patrocina_cultura,ja_patrocina_esporte")
        .eq("organization_id", orgId)
        .eq("id", empresa_crm_id)
        .single();
      if (empresaError) throw new Error(empresaError.message);

      const { data: vendas, error: vendasError } = await supabase
        .from("vendas_patrocinio")
        .select("id,projeto_id,valor_vendido,quantidade,vendida_em")
        .eq("organization_id", orgId)
        .eq("empresa_crm_id", empresa_crm_id)
        .order("vendida_em", { ascending: false });
      if (vendasError) throw new Error(vendasError.message);

      const projetoIds = [...new Set((vendas ?? []).map((v) => v.projeto_id))];
      let projetosPorId = new Map<string, { id: string; nome: string; fase: string; areas_culturais: string[] }>();
      if (projetoIds.length > 0) {
        const { data: projetos, error: projetosError } = await supabase
          .from("projetos_crm")
          .select("id,nome,fase,areas_culturais")
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

      const ultimoPatrocinio = historico[0]?.vendida_em ?? null;
      const diasDesdeUltimo = ultimoPatrocinio
        ? Math.floor((Date.now() - new Date(ultimoPatrocinio).getTime()) / 86_400_000)
        : null;

      return {
        empresa,
        resumo: {
          projetos_apoiados: projetoIds.length,
          patrocinios_realizados: historico.length,
          valor_total_investido: valorTotal,
          ticket_medio: historico.length > 0 ? valorTotal / historico.length : 0,
          areas_culturais_recorrentes: areasRecorrentes,
          ultimo_patrocinio_em: ultimoPatrocinio,
          dias_desde_ultimo_patrocinio: diasDesdeUltimo,
        },
        historico_patrocinios: historico,
      };
    },
  },
  {
    name: "resumo_organizacao",
    description:
      "Visão geral para análise rápida da organização do usuário: quantidade de projetos por fase, propostas por " +
      "status, tarefas por status e valor total captado.",
    schema: { organization_id: orgIdParam },
    handler: async ({ organization_id }) => {
      const orgId = await resolveOrgId(organization_id as string | undefined);
      const [projetos, propostas, tarefas, vendas] = await Promise.all([
        supabase.from("projetos_crm").select("fase,status_comercial,valor_total").eq("organization_id", orgId),
        supabase.from("propostas").select("status").eq("organization_id", orgId),
        supabase.from("tarefas").select("status").eq("organization_id", orgId),
        supabase.from("vendas_patrocinio").select("valor_vendido").eq("organization_id", orgId),
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
      const orgId = await resolveOrgId(organization_id as string | undefined);
      const { data, error } = await supabase
        .from("contatos")
        .insert({ organization_id: orgId, ...campos })
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
      const orgId = await resolveOrgId(organization_id as string | undefined);
      const { data, error } = await supabase
        .from("tarefas")
        .insert({ organization_id: orgId, ...campos })
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
  await ensureAuthenticated();

  // Gate de plano no ponto de entrada: MCP é recurso pago. Cobre também as
  // ferramentas que não passam por resolveOrgId (identidade, base pública).
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id");
  if (membershipError) throw new Error(membershipError.message);
  const orgs = [...new Set((memberships ?? []).map((m) => m.organization_id))];
  const algumaPaga = (await Promise.all(orgs.map(orgTemAssinaturaAtiva))).some(Boolean);
  if (!algumaPaga) throw new Error(PLANO_NECESSARIO_MSG);

  const parsed = z.object(tool.schema).parse(args ?? {});
  const data = await tool.handler(parsed);
  return textResult(data);
}
