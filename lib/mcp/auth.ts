import crypto from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULO_CAPTACAO, PAPEL_COM_ACESSO_AO_CRM } from "@/lib/mcp/enums";
import { assistenteDaChave } from "@/lib/mcp/conexoes";
import { estaNoLimite, isRateLimited, registrarOcorrencia } from "@/lib/mcp/rateLimit";
import { MODULO_PADRAO, normalizarModulosDaChave, NOME_DO_MODULO, prestacaoLiberadaPara, type ModuloMcp } from "@/lib/mcp/modulos";
import {
  acessoDaPrestacao,
  podeEditarNaPrestacao,
  type AcessoNaOrganizacao,
  type AcessoPrestacao,
  type ModulosDaOrganizacao,
} from "@/lib/mcp/prestacao/acesso";

const MAX_REQUESTS_PER_KEY_PER_MIN = 60;
const MAX_FAILED_AUTH_PER_IP_PER_MIN = 20;

/** Tentativas com chave que não existe, por IP. Quem usa chave válida (inclusive atrás do egress compartilhado de um LLM) nunca entra nessa conta. */
const chaveDeFalhas = (ip: string) => `mcp-auth-fail:${ip}`;

export type McpKeyScope = "read" | "write";

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export const MCP_KEY_PREFIX = "jards_mcp_";

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `${MCP_KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, MCP_KEY_PREFIX.length + 6) };
}

export interface McpAuthContext {
  userId: string;
  /** A chave que fez o pedido e o assistente dela, para a trilha de ações da prestação. Ausentes valem "sem chave" e "outro". */
  chaveId?: string;
  plataforma?: "claude" | "chatgpt" | "outro";
  organizationIds: string[];
  /** Só as organizações de organizationIds com assinatura paga ativa — MCP/GPT exige plano pago. */
  paidOrganizationIds: string[];
  scope: McpKeyScope;
  /**
   * Módulos que esta chave fala: os que a pessoa autorizou E a que ela tem acesso agora. Ausente vale só a captação,
   * como as chaves de antes dos módulos. organizationIds e paidOrganizationIds são sempre da captação.
   */
  modulos?: ModuloMcp[];
  /** Onde a pessoa usa a prestação de contas. Só vem quando a chave tem esse módulo. */
  prestacao?: AcessoPrestacao;
}

export type { AcessoNaOrganizacao };

export interface Membro {
  organization_id: string;
  papel: string | null;
  modulos_acesso: string[] | null;
  prestacao_funcao?: string | null;
}

/**
 * Organizações em que a pessoa pode usar o conector: ela é da equipe (admin) e tem o módulo de captação.
 * Captador e proponente são externos e no app só veem o próprio espaço; o conector lê com a chave de serviço
 * (sem o RLS do app), então quem não tem esse acesso no app também não pode ter pelo conector.
 */
export function organizacoesComAcessoAoCrm(membros: readonly Membro[]): string[] {
  return membros
    .filter((m) => m.papel === PAPEL_COM_ACESSO_AO_CRM && (m.modulos_acesso == null || m.modulos_acesso.includes(MODULO_CAPTACAO)))
    .map((m) => m.organization_id);
}

export const SEM_ACESSO_AO_CONECTOR =
  "Esta conta não tem acesso ao conector do Jards: ele é para quem é da equipe da organização e usa a captação. Captadores e proponentes externos usam só o próprio espaço no app.";

export const SEM_ACESSO_A_PRESTACAO =
  "Esta conta não usa a prestação de contas em nenhuma organização: o conector é para a equipe (admin, colaborador ou leitor) com o módulo liberado no próprio acesso. Proponentes e convidados usam só o espaço deles no app.";

/**
 * Autentica uma requisição do MCP/Custom GPT pelo header `Authorization: Bearer <chave>`.
 * Nunca confia em organization_id vindo da requisição: resolve as organizações do
 * dono da chave e usa só essas — o mesmo corte que o RLS aplicaria no app web.
 */
export async function authenticateMcpRequest(
  req: NextRequest
): Promise<McpAuthContext | NextResponse> {
  const ip = getIp(req);

  // Barato e antes de tocar o banco: contém tentativas de adivinhar uma chave. Só as tentativas com
  // chave desconhecida contam (abaixo); contar toda requisição derrubava com 429 mais de 20 chamadas
  // por minuto de um mesmo IP, e o Claude e o ChatGPT chamam de IPs compartilhados por muita gente.
  if (estaNoLimite(chaveDeFalhas(ip), MAX_FAILED_AUTH_PER_IP_PER_MIN)) {
    return NextResponse.json({ error: "Muitas tentativas de autenticação. Aguarde um momento." }, { status: 429 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!rawKey) {
    return NextResponse.json({ error: "Informe a chave em Authorization: Bearer <chave>" }, { status: 401 });
  }

  const admin = createAdminClient();
  const keyHash = hashApiKey(rawKey);
  const { data: key, error } = await admin
    .from("mcp_api_keys")
    .select("id,user_id,label,revoked_at,expires_at,scope,modulos")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!key) registrarOcorrencia(chaveDeFalhas(ip));
  if (!key || key.revoked_at) {
    return NextResponse.json({ error: "Chave inválida ou revogada" }, { status: 401 });
  }
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Chave expirada — gere uma nova em /configuracoes/mcp" }, { status: 401 });
  }

  // Limite por chave — independe de IP, então funciona igual atrás do egress
  // compartilhado de um provedor de LLM (ex. ChatGPT) sem punir outras chaves.
  if (isRateLimited(`mcp-key:${key.id}`, MAX_REQUESTS_PER_KEY_PER_MIN)) {
    return NextResponse.json({ error: "Limite de requisições da chave excedido. Aguarde um momento." }, { status: 429 });
  }

  // Último uso e trilha de auditoria ("quem acessou o quê, quando"), gravados depois da resposta:
  // não atrasam a requisição nem a derrubam se falharem. O construtor de consultas do Supabase só
  // envia quando é aguardado; um `void` solto, como era aqui, nunca gravava nada.
  after(async () => {
    await Promise.all([
      admin.from("mcp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id),
      admin.from("mcp_api_key_usage").insert({
        key_id: key.id,
        user_id: key.user_id,
        method: req.method,
        path: req.nextUrl.pathname,
        ip,
      }),
    ]).catch(() => undefined);
  });

  const modulosDaChave = normalizarModulosDaChave(key.modulos);
  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id,papel,modulos_acesso,prestacao_funcao")
    .eq("user_id", key.user_id);
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
  const membros = (memberships ?? []) as Membro[];

  // Captação: admin da organização com o módulo e plano pago (como sempre foi).
  const organizationIds = modulosDaChave.includes("captacao") ? organizacoesComAcessoAoCrm(membros) : [];
  const paidOrganizationIds = await filterPaidOrganizations(admin, organizationIds);

  // Prestação de contas: o módulo vale por organização (em vigor ou só para consulta), não pelo plano da captação.
  let prestacao: AcessoPrestacao | null = null;
  if (modulosDaChave.includes("prestacao")) {
    const { data: organizacoes, error: organizacoesError } = await admin
      .from("organizations")
      .select("id,nome,modulos_ativos,modulos_leitura")
      .in("id", membros.map((m) => m.organization_id));
    if (organizacoesError) return NextResponse.json({ error: "Não foi possível conferir seu acesso agora. Tente de novo em instantes." }, { status: 500 });
    prestacao = acessoDaPrestacao(membros, (organizacoes ?? []) as ModulosDaOrganizacao[]);
  }

  const decisao = decidirAcesso({
    modulosDaChave,
    quantidadeDeVinculos: membros.length,
    captacao: { organizationIds, paidOrganizationIds },
    prestacao,
  });
  if (!decisao.ok) return NextResponse.json(decisao.corpo, { status: decisao.status });

  return {
    userId: key.user_id,
    chaveId: key.id,
    plataforma: assistenteDaChave(key.label) ?? "outro",
    scope: (key.scope as McpKeyScope) ?? "read",
    ...decisao.contexto,
  };
}

const PLANO_NECESSARIO_ERROR = {
  error: "Assinatura necessária. O acesso via MCP/ChatGPT está disponível nos planos pagos do Jards.",
  upgrade_url: "/meu-plano?acao=assinar",
};

export type DecisaoDeAcesso =
  | { ok: true; contexto: Pick<McpAuthContext, "organizationIds" | "paidOrganizationIds" | "modulos" | "prestacao"> }
  | { ok: false; status: 402 | 403; corpo: Record<string, unknown> };

/**
 * Decide o que a chave pode usar. Chave só da captação (as de antes dos módulos) segue exatamente a regra antiga:
 * 403 sem acesso, 402 sem plano pago. A prestação não depende do plano da captação: basta o módulo da organização.
 */
export function decidirAcesso(entrada: {
  modulosDaChave: readonly ModuloMcp[];
  quantidadeDeVinculos: number;
  captacao: { organizationIds: string[]; paidOrganizationIds: string[] };
  prestacao: AcessoPrestacao | null;
}): DecisaoDeAcesso {
  const { modulosDaChave, captacao, prestacao } = entrada;
  const temCaptacao = modulosDaChave.includes("captacao");
  const temPrestacao = modulosDaChave.includes("prestacao");
  const captacaoOk = temCaptacao && captacao.paidOrganizationIds.length > 0;
  const prestacaoOk = temPrestacao && (prestacao?.organizationIds.length ?? 0) > 0;

  if (!captacaoOk && !prestacaoOk) {
    // Tem organização na captação, mas nenhuma com plano pago.
    if (temCaptacao && captacao.organizationIds.length > 0) return { ok: false, status: 402, corpo: PLANO_NECESSARIO_ERROR };
    if (temCaptacao && !temPrestacao) {
      if (entrada.quantidadeDeVinculos > 0) return { ok: false, status: 403, corpo: { error: SEM_ACESSO_AO_CONECTOR } };
      return { ok: false, status: 402, corpo: PLANO_NECESSARIO_ERROR };
    }
    return { ok: false, status: 403, corpo: { error: SEM_ACESSO_A_PRESTACAO } };
  }

  const modulos: ModuloMcp[] = [];
  if (captacaoOk) modulos.push("captacao");
  if (prestacaoOk) modulos.push("prestacao");
  return {
    ok: true,
    contexto: {
      organizationIds: temCaptacao ? captacao.organizationIds : [],
      paidOrganizationIds: temCaptacao ? captacao.paidOrganizationIds : [],
      modulos,
      ...(temPrestacao && prestacao ? { prestacao } : {}),
    },
  };
}

/**
 * MCP/Custom GPT é recurso de plano pago — reaproveita fn_org_assinatura_ativa,
 * a mesma checagem que já protege créditos/contatos no app web.
 */
export async function filterPaidOrganizations(
  admin: ReturnType<typeof createAdminClient>,
  organizationIds: string[]
): Promise<string[]> {
  if (organizationIds.length === 0) return [];
  const results = await Promise.all(
    organizationIds.map(async (id) => {
      const { data, error } = await admin.rpc("fn_org_assinatura_ativa", { p_organization_id: id });
      return !error && data === true ? id : null;
    })
  );
  return results.filter((id): id is string => id !== null);
}

/**
 * Módulos do conector que a pessoa pode autorizar hoje: a captação (admin com plano pago) e a prestação de contas
 * (equipe com o módulo liberado em alguma organização que o tem, e liberada para ela na implantação). É o que a tela
 * de consentimento oferece.
 */
export async function modulosQueAPessoaPodeAutorizar(
  admin: ReturnType<typeof createAdminClient>,
  pessoa: { id: string; email?: string | null }
): Promise<ModuloMcp[]> {
  const userId = pessoa.id;
  const { data: memberships, error } = await admin
    .from("organization_members")
    .select("organization_id,papel,modulos_acesso,prestacao_funcao")
    .eq("user_id", userId);
  if (error || !memberships) return [];
  const membros = memberships as Membro[];

  const modulos: ModuloMcp[] = [];
  if ((await filterPaidOrganizations(admin, organizacoesComAcessoAoCrm(membros))).length > 0) modulos.push("captacao");

  const { data: organizacoes } = await admin
    .from("organizations")
    .select("id,nome,modulos_ativos,modulos_leitura")
    .in("id", membros.map((m) => m.organization_id));
  const usaPrestacao = acessoDaPrestacao(membros, (organizacoes ?? []) as ModulosDaOrganizacao[]).organizationIds.length > 0;
  if (usaPrestacao && prestacaoLiberadaPara(pessoa)) modulos.push("prestacao");
  return modulos;
}

/** Bloqueia ferramentas de escrita para chaves geradas como somente-leitura (mínimo privilégio). */
export function requireWriteScope(ctx: McpAuthContext): NextResponse | null {
  if (ctx.scope !== "write") {
    return NextResponse.json(
      { error: "Esta chave é somente leitura. Gere uma chave com escopo de escrita em /configuracoes/mcp para criar registros." },
      { status: 403 }
    );
  }
  return null;
}

/** Bloqueia a rota de um módulo que a chave não autorizou (ou a que a pessoa não tem acesso agora). */
export function requireModulo(ctx: McpAuthContext, modulo: ModuloMcp): NextResponse | null {
  if ((ctx.modulos ?? [MODULO_PADRAO]).includes(modulo)) return null;
  return NextResponse.json(
    { error: `Esta conexão não inclui o módulo de ${NOME_DO_MODULO[modulo]}. Autorize o acesso de novo no assistente e marque esse módulo na tela do Jards.` },
    { status: 403 }
  );
}

/** Organização da prestação de contas: a escolhida, ou a única; para gravar, o módulo precisa estar em vigor e o papel precisa editar. */
function resolverOrganizacaoDaPrestacao(ctx: McpAuthContext, requested: string | null, escrita: boolean): string | NextResponse {
  const acesso = ctx.prestacao;
  const ids = acesso?.organizationIds ?? [];
  if (!acesso || ids.length === 0) return NextResponse.json({ error: SEM_ACESSO_A_PRESTACAO }, { status: 403 });

  let organizacao: string;
  if (requested) {
    if (!ids.includes(requested)) {
      return NextResponse.json({ error: "Você não usa a prestação de contas nessa organização." }, { status: 403 });
    }
    organizacao = requested;
  } else if (ids.length === 1) {
    organizacao = ids[0];
  } else {
    return NextResponse.json(
      {
        error: "Você usa a prestação de contas em mais de uma organização: informe organization_id.",
        organizacoes: ids.map((id) => ({ id, nome: acesso.porOrganizacao[id]?.nome ?? null })),
      },
      { status: 400 }
    );
  }

  if (escrita) {
    const naOrganizacao = acesso.porOrganizacao[organizacao];
    if (!naOrganizacao?.emVigor) {
      return NextResponse.json(
        {
          error: "O módulo de prestação de contas desta organização está só para consulta (o teste gratuito ou a assinatura terminou). Assine para gravar.",
          upgrade_url: "/meu-plano?acao=assinar",
        },
        { status: 402 }
      );
    }
    if (!podeEditarNaPrestacao(naOrganizacao.papel)) {
      return NextResponse.json({ error: "Seu papel nesta organização só consulta a prestação de contas." }, { status: 403 });
    }
  }
  return organizacao;
}

export function resolveOrgId(
  ctx: McpAuthContext,
  requested: string | null,
  modulo: ModuloMcp = "captacao",
  opcoes: { escrita?: boolean } = {}
): string | NextResponse {
  if (modulo === "prestacao") return resolverOrganizacaoDaPrestacao(ctx, requested, opcoes.escrita === true);
  if (requested) {
    if (!ctx.organizationIds.includes(requested)) {
      return NextResponse.json({ error: "Você não pertence a essa organização" }, { status: 403 });
    }
    if (!ctx.paidOrganizationIds.includes(requested)) {
      return NextResponse.json(PLANO_NECESSARIO_ERROR, { status: 402 });
    }
    return requested;
  }
  if (ctx.paidOrganizationIds.length === 1) return ctx.paidOrganizationIds[0];
  if (ctx.paidOrganizationIds.length === 0) {
    if (ctx.organizationIds.length === 0) {
      return NextResponse.json({ error: "Você não pertence a nenhuma organização" }, { status: 403 });
    }
    return NextResponse.json(PLANO_NECESSARIO_ERROR, { status: 402 });
  }
  return NextResponse.json(
    { error: "Você pertence a mais de uma organização — informe organization_id", organizacoes: ctx.paidOrganizationIds },
    { status: 400 }
  );
}

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
