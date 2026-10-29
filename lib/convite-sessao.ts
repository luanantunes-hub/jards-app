import type { SupabaseClient, User } from "@supabase/supabase-js";

// Convite de equipe: o convite do admin (inviteUserByEmail) não usa PKCE, então o Supabase devolve a sessão no
// fragmento do endereço (#access_token=...&refresh_token=...). O cliente do navegador (@supabase/ssr) só
// trabalha com PKCE e ignora esse fragmento: getSession() volta vazio. A tela lê os tokens e os entrega a
// setSession, que não confere o fluxo (tests/convite-sessao.test.ts roda isso contra o cliente de verdade).

export type FragmentoDoConvite =
  | { tipo: "tokens"; accessToken: string; refreshToken: string }
  | { tipo: "erro" }
  | { tipo: "nenhum" };

/** Lê o fragmento do endereço (window.location.hash). Link expirado ou já usado volta com #error_code=otp_expired. */
export function lerFragmentoDoConvite(hash: string): FragmentoDoConvite {
  const parametros = new URLSearchParams(hash.replace(/^#/, ""));
  if (parametros.get("error") || parametros.get("error_code")) return { tipo: "erro" };
  const accessToken = parametros.get("access_token");
  const refreshToken = parametros.get("refresh_token");
  return accessToken && refreshToken ? { tipo: "tokens", accessToken, refreshToken } : { tipo: "nenhum" };
}

/** Grava a sessão do convite no navegador (cookies que o servidor também lê). Devolve quem foi convidado, ou null. */
export async function estabelecerSessaoDoConvite(
  supabase: Pick<SupabaseClient, "auth">,
  fragmento: Extract<FragmentoDoConvite, { tipo: "tokens" }>,
): Promise<User | null> {
  const { data, error } = await supabase.auth.setSession({
    access_token: fragmento.accessToken,
    refresh_token: fragmento.refreshToken,
  });
  return error || !data.session ? null : data.session.user;
}

/** O convite guarda a organização nos metadados da conta (app/api/members/invite/route.ts). */
export function organizacaoDoConvite(user: Pick<User, "user_metadata"> | null | undefined): string | null {
  const id = user?.user_metadata?.organization_id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

// Mesma chave que o layout do app lê para abrir a organização escolhida. Quem é convidado já tem uma
// organização própria vazia (criada junto com a conta); sem isto o app abriria essa e não a da equipe.
const ORGANIZACAO_ATUAL = "jards:org-atual";

export function lembrarOrganizacaoAtual(organizationId: string | null) {
  if (!organizationId) return;
  try {
    localStorage.setItem(ORGANIZACAO_ATUAL, organizationId);
  } catch {
    // sem localStorage o app abre a organização padrão; a pessoa troca pelo menu
  }
}
