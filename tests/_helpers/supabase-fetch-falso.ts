/**
 * Supabase de mentira para testar o proxy com o cliente de verdade: troca o fetch global por um que responde
 * como o Auth (/auth/v1/user) e o PostgREST (profiles e organization_members) responderiam. Guarda cada chamada
 * para o teste conferir o que foi consultado (e o que não foi). Nada sai da máquina.
 */
import type { LinhaDeVinculo } from "./modulos-grade";

export const URL_FALSA = "http://localhost:54321";
export const CHAVE_FALSA = "chave-anonima-de-teste";
/** O cliente guarda a sessão no cookie sb-<primeiro pedaço do host>-auth-token. */
export const COOKIE_DA_SESSAO = "sb-localhost-auth-token";

export type UsuarioFalso = { id: string; email: string; superAdmin: boolean; vinculos: LinhaDeVinculo[] };

function base64url(texto: string): string {
  return Buffer.from(texto).toString("base64url");
}

/** Token com a forma de um JWT (cabeçalho.corpo.assinatura); só o `sub` importa para o servidor falso. */
export function tokenDe(usuario: UsuarioFalso): string {
  const corpo = { sub: usuario.id, aud: "authenticated", role: "authenticated", email: usuario.email, exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(JSON.stringify(corpo))}.assinatura`;
}

/** O valor do cookie de sessão, no formato do @supabase/ssr ("base64-" mais o JSON em base64url). */
export function cookieDaSessao(usuario: UsuarioFalso): string {
  const sessao = {
    access_token: tokenDe(usuario),
    refresh_token: `refresh-${usuario.id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: usuario.id, aud: "authenticated", role: "authenticated", email: usuario.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
  return `${COOKIE_DA_SESSAO}=base64-${base64url(JSON.stringify(sessao))}`;
}

/** `vinculos` e `perfil` respondem 500; `vinculosParados` nunca responde (o banco travou). */
export type Falhas = { vinculos?: boolean; perfil?: boolean; vinculosParados?: boolean };

export function instalarSupabaseFalso(usuarios: readonly UsuarioFalso[], falhas: Falhas = {}) {
  const original = globalThis.fetch;
  const chamadas: string[] = [];

  function resposta(corpo: unknown, status = 200): Response {
    return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
  }

  globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    chamadas.push(`${init?.method ?? "GET"} ${url.pathname}`);

    const cabecalhos = new Headers(init?.headers);
    const token = (cabecalhos.get("authorization") ?? "").replace(/^Bearer /, "");
    const id = token.includes(".") ? JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub : null;
    const usuario = usuarios.find(u => u.id === id);

    if (url.pathname === "/auth/v1/user") {
      if (!usuario) return resposta({ code: 401, msg: "invalid JWT" }, 401);
      return resposta({ id: usuario.id, aud: "authenticated", role: "authenticated", email: usuario.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    }
    if (!usuario) return resposta({ message: "JWT inválido" }, 401);
    if (url.pathname === "/rest/v1/profiles") {
      if (falhas.perfil) return resposta({ message: "falha de teste" }, 500);
      return resposta([{ jards_super_admin: usuario.superAdmin }]);
    }
    if (url.pathname === "/rest/v1/organization_members") {
      if (falhas.vinculosParados) return new Promise<Response>(() => {});
      if (falhas.vinculos) return resposta({ message: "falha de teste" }, 500);
      return resposta(usuario.vinculos);
    }
    return resposta({ message: `rota não prevista no teste: ${url.pathname}` }, 404);
  }) as typeof fetch;

  return {
    chamadas,
    /** Chamadas ao banco (PostgREST), sem as do Auth. */
    consultasAoBanco: () => chamadas.filter(c => c.includes("/rest/v1/")),
    restaurar() {
      globalThis.fetch = original;
    },
  };
}
