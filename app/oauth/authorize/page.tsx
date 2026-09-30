import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedRedirectUri, normalizeScope } from "@/lib/mcp/oauth";
import { userHasPaidOrg } from "@/lib/mcp/auth";
import { AuthorizeConsent } from "./AuthorizeConsent";
import { OAuthPaywall } from "./OAuthPaywall";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Tela de consentimento OAuth para a Custom GPT do Jards. O proxy já garante
 * que só chega aqui usuário logado (redireciona para /login?next=... senão).
 * Cada pessoa autoriza com a própria conta — nenhuma credencial é
 * compartilhada entre quem usa a mesma GPT.
 */
export default async function OAuthAuthorizePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const responseType = firstValue(params.response_type);
  const clientId = firstValue(params.client_id);
  const redirectUri = firstValue(params.redirect_uri);
  const state = firstValue(params.state);
  const scope = normalizeScope(firstValue(params.scope));
  const codeChallenge = firstValue(params.code_challenge) || undefined;
  const codeChallengeMethod = firstValue(params.code_challenge_method) || undefined;

  const erros: string[] = [];
  if (responseType !== "code") erros.push("response_type deve ser 'code'.");
  if (!clientId || clientId !== process.env.OAUTH_CHATGPT_CLIENT_ID) erros.push("client_id desconhecido.");
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) erros.push("redirect_uri não é um callback válido do ChatGPT.");

  if (erros.length > 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-[#D94A4A]">Pedido de autorização inválido</h1>
        <ul className="mt-3 space-y-1 text-sm text-black/60">
          {erros.map((e) => (
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

  const admin = createAdminClient();

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

  return (
    <AuthorizeConsent
      email={user.email ?? ""}
      organizacoes={nomesOrganizacoes}
      scope={scope}
      clientId={clientId}
      redirectUri={redirectUri}
      state={state}
      codeChallenge={codeChallenge}
      codeChallengeMethod={codeChallengeMethod}
    />
  );
}
