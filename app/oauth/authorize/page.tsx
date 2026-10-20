import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLoopbackRedirectUri, normalizeScope, validateAuthorizationRequest } from "@/lib/mcp/oauth";
import { modulosQueAPessoaPodeAutorizar } from "@/lib/mcp/auth";
import { marcadosInicialmente } from "@/lib/mcp/consentimento";
import { MODULOS_MCP, modulosDoEscopo, NOME_DO_MODULO } from "@/lib/mcp/modulos";
import { headers } from "next/headers";
import { AuthorizeConsent, type ClienteConsentimento } from "./AuthorizeConsent";
import { OAuthPaywall } from "./OAuthPaywall";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function provedorDoCliente(redirectUri: string): string {
  try {
    const host = new URL(redirectUri).hostname;
    if (host === "claude.ai" || host === "claude.com") return "da Anthropic (Claude)";
    if (host === "chatgpt.com") return "da OpenAI (ChatGPT)";
  } catch {
    // cai no padrão
  }
  return isLoopbackRedirectUri(redirectUri) ? "do serviço de IA que você usa nesse aplicativo" : "do serviço de IA conectado";
}

function Aviso({ titulo, linhas }: { titulo: string; linhas: string[] }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-[#D94A4A]">{titulo}</h1>
      <ul className="mt-3 space-y-1 text-sm text-black/60">
        {linhas.map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tela de consentimento OAuth para assistentes de IA (Custom GPT do ChatGPT e assistentes MCP,
 * como o Claude). O proxy já garante que só chega aqui usuário logado (redireciona para
 * /login?next=... senão). Cada pessoa autoriza com a própria conta — nenhuma credencial é
 * compartilhada entre quem usa o mesmo assistente.
 *
 * Os módulos do Jards (captação, prestação de contas) são parte da autorização: o ChatGPT os pede no
 * `scope` da Action (sem nenhum, vale a captação); no Claude a pessoa marca o que quer liberar.
 */
export default async function OAuthAuthorizePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const clientId = firstValue(params.client_id);
  const redirectUri = firstValue(params.redirect_uri);
  const state = firstValue(params.state);
  const scopeDoPedido = firstValue(params.scope);
  const scope = normalizeScope(scopeDoPedido);
  const codeChallenge = firstValue(params.code_challenge) || undefined;
  const codeChallengeMethod = firstValue(params.code_challenge_method) || undefined;
  const resource = firstValue(params.resource) || undefined;

  const admin = createAdminClient();
  const validacao = await validateAuthorizationRequest(
    admin,
    { responseType: firstValue(params.response_type), clientId, redirectUri, codeChallenge, codeChallengeMethod, resource },
    await origemDaRequisicao()
  );

  if (!validacao.ok) return <Aviso titulo="Pedido de autorização inválido" linhas={validacao.errors} />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Não deveria acontecer (proxy já barra), mas por segurança.
    return null;
  }

  const disponiveis = await modulosQueAPessoaPodeAutorizar(admin, { id: user.id, email: user.email });
  if (disponiveis.length === 0) return <OAuthPaywall />;

  const chatgpt = validacao.client.kind === "chatgpt";
  // ChatGPT: os módulos vêm do scope da Action e a pessoa só permite ou nega. Claude: a pessoa escolhe entre os que pode usar.
  const modulosDoPedido = modulosDoEscopo(scopeDoPedido).filter((modulo) => disponiveis.includes(modulo));
  if (chatgpt && modulosDoPedido.length === 0) {
    const pedidos = modulosDoEscopo(scopeDoPedido).map((modulo) => NOME_DO_MODULO[modulo]);
    return (
      <Aviso
        titulo="Este assistente pede um módulo que você não pode liberar"
        linhas={[`O assistente pede acesso a: ${pedidos.join(", ")}.`, "Você não usa esse módulo em nenhuma organização (ou ele ainda não está liberado para a sua conta)."]}
      />
    );
  }

  const { data: memberships } = await admin
    .from("organization_members")
    .select("organizations(nome)")
    .eq("user_id", user.id);
  const nomesOrganizacoes = (memberships ?? [])
    .map((m: { organizations: { nome: string } | { nome: string }[] | null }) =>
      Array.isArray(m.organizations) ? m.organizations[0]?.nome : m.organizations?.nome
    )
    .filter((nome): nome is string => Boolean(nome));

  const cliente: ClienteConsentimento =
    chatgpt ? { tipo: "chatgpt" } : { tipo: "publico", nome: validacao.client.kind === "public" ? validacao.client.name : "", provedor: provedorDoCliente(redirectUri) };

  return (
    <AuthorizeConsent
      email={user.email ?? ""}
      organizacoes={nomesOrganizacoes}
      scope={scope}
      scopeDoPedido={scopeDoPedido}
      modulosDisponiveis={chatgpt ? modulosDoPedido : MODULOS_MCP.filter((modulo) => disponiveis.includes(modulo))}
      modulosMarcados={chatgpt ? modulosDoPedido : marcadosInicialmente(disponiveis)}
      cliente={cliente}
      clientId={clientId}
      redirectUri={redirectUri}
      state={state}
      codeChallenge={codeChallenge}
      codeChallengeMethod={codeChallengeMethod}
      resource={resource}
    />
  );
}
