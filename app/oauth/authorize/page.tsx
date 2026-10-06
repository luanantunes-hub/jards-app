import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLoopbackRedirectUri, normalizeScope, validateAuthorizationRequest } from "@/lib/mcp/oauth";
import { userHasPaidOrg } from "@/lib/mcp/auth";
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
  } catch {
    // cai no padrão
  }
  return isLoopbackRedirectUri(redirectUri) ? "do serviço de IA que você usa nesse aplicativo" : "do serviço de IA conectado";
}

/**
 * Tela de consentimento OAuth para assistentes de IA (Custom GPT do ChatGPT e assistentes MCP,
 * como o Claude). O proxy já garante que só chega aqui usuário logado (redireciona para
 * /login?next=... senão). Cada pessoa autoriza com a própria conta — nenhuma credencial é
 * compartilhada entre quem usa o mesmo assistente.
 */
export default async function OAuthAuthorizePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const clientId = firstValue(params.client_id);
  const redirectUri = firstValue(params.redirect_uri);
  const state = firstValue(params.state);
  const scope = normalizeScope(firstValue(params.scope));
  const codeChallenge = firstValue(params.code_challenge) || undefined;
  const codeChallengeMethod = firstValue(params.code_challenge_method) || undefined;
  const resource = firstValue(params.resource) || undefined;

  const admin = createAdminClient();
  const validacao = await validateAuthorizationRequest(
    admin,
    { responseType: firstValue(params.response_type), clientId, redirectUri, codeChallenge, codeChallengeMethod, resource },
    await origemDaRequisicao()
  );

  if (!validacao.ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-[#D94A4A]">Pedido de autorização inválido</h1>
        <ul className="mt-3 space-y-1 text-sm text-black/60">
          {validacao.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Não deveria acontecer (proxy já barra), mas por segurança.
    return null;
  }

  if (!(await userHasPaidOrg(admin, user.id))) {
    return <OAuthPaywall />;
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
    validacao.client.kind === "chatgpt"
      ? { tipo: "chatgpt" }
      : { tipo: "publico", nome: validacao.client.name, provedor: provedorDoCliente(redirectUri) };

  return (
    <AuthorizeConsent
      email={user.email ?? ""}
      organizacoes={nomesOrganizacoes}
      scope={scope}
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
