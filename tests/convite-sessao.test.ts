import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserClient } from "@supabase/ssr";
import { destinoInterno } from "../lib/destino-interno";
import { estabelecerSessaoDoConvite, lerFragmentoDoConvite, organizacaoDoConvite } from "../lib/convite-sessao";

// O convite de equipe volta com a sessão no fragmento do endereço. Estes testes rodam o cliente de navegador de
// verdade (@supabase/ssr), com window, document e fetch simulados, porque foi aí que a primeira versão da tela
// falhou sem que nenhum teste de texto percebesse.

const USUARIO = "11111111-1111-4111-8111-111111111111";
const ORGANIZACAO = "22222222-2222-4222-8222-222222222222";
const codificar = (objeto: object) => Buffer.from(JSON.stringify(objeto)).toString("base64url");
const agora = Math.floor(Date.now() / 1000);
const ACESSO = `${codificar({ alg: "HS256", typ: "JWT" })}.${codificar({ sub: USUARIO, exp: agora + 3600, role: "authenticated", aud: "authenticated" })}.assinatura`;
const FRAGMENTO = `#access_token=${ACESSO}&expires_at=${agora + 3600}&expires_in=3600&refresh_token=renovacao123456&token_type=bearer&type=invite`;

function navegadorSimulado(hash: string, autorizado = true) {
  const cookies: Record<string, string> = {};
  const chamadas: string[] = [];
  const documento = {
      visibilityState: "visible",
      addEventListener() {},
      removeEventListener() {},
      get cookie() { return Object.entries(cookies).map(([chave, valor]) => `${chave}=${valor}`).join("; "); },
      set cookie(valor: string) {
        const [par] = valor.split(";");
        const indice = par.indexOf("=");
        cookies[par.slice(0, indice)] = par.slice(indice + 1);
      },
  };
  Object.assign(globalThis, {
    document: documento,
    window: {
      document: documento,
      location: { href: `http://localhost:3000/aceitar-convite${hash}`, hash },
      history: { state: null, replaceState() {} },
      addEventListener() {},
      removeEventListener() {},
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    },
  });
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "teste" }, configurable: true });
  // O cliente abre um BroadcastChannel para sincronizar abas, e ele mantém o processo de teste vivo.
  Object.defineProperty(globalThis, "BroadcastChannel", { value: undefined, configurable: true });
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    chamadas.push(String(url));
    if (!String(url).includes("/auth/v1/user")) return new Response("{}", { status: 200 });
    if (!autorizado) return new Response(JSON.stringify({ msg: "invalid JWT" }), { status: 401, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({
      id: USUARIO, aud: "authenticated", email: "nova@walkmar.com.br", app_metadata: {},
      user_metadata: { organization_id: ORGANIZACAO, organization_role: "colaborador" }, created_at: "2026-10-29T13:47:00Z",
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  // Sem a renovação automática, que também manteria o processo de teste vivo.
  const cliente = createBrowserClient("http://localhost:54321", "anon-key-de-teste-xxxxxxxxxxxx", { auth: { autoRefreshToken: false } });
  return { cliente, cookies, chamadas };
}

test("o cliente de navegador não lê sozinho o fragmento do convite (por isso a tela lê os tokens)", async () => {
  const { cliente } = navegadorSimulado(FRAGMENTO);
  const { data } = await cliente.auth.getSession();
  assert.equal(data.session, null, "se isto mudar, o cliente passou a ler o fragmento e a leitura manual pode ser revista");
});

test("os tokens do fragmento viram a sessão do convidado, gravada em cookie para o servidor ler", async () => {
  const { cliente, cookies, chamadas } = navegadorSimulado(FRAGMENTO);
  const fragmento = lerFragmentoDoConvite(FRAGMENTO);
  assert.equal(fragmento.tipo, "tokens");
  if (fragmento.tipo !== "tokens") return;

  const convidado = await estabelecerSessaoDoConvite(cliente, fragmento);
  assert.equal(convidado?.id, USUARIO);
  assert.equal(organizacaoDoConvite(convidado), ORGANIZACAO);
  assert.ok(chamadas.some((url) => url.includes("/auth/v1/user")), "o token é conferido no Supabase");
  assert.ok(Object.keys(cookies).some((nome) => nome.endsWith("-auth-token")), "a sessão fica em cookie");
  assert.equal((await cliente.auth.getSession()).data.session?.user.id, USUARIO);
});

test("token recusado pelo Supabase não vira sessão", async () => {
  const { cliente } = navegadorSimulado(FRAGMENTO, false);
  const fragmento = lerFragmentoDoConvite(FRAGMENTO);
  if (fragmento.tipo !== "tokens") throw new Error("fragmento de teste inválido");
  assert.equal(await estabelecerSessaoDoConvite(cliente, fragmento), null);
});

test("fragmento: tokens, erro de link expirado e ausência", () => {
  assert.deepEqual(lerFragmentoDoConvite("#access_token=a&refresh_token=r&type=invite"), { tipo: "tokens", accessToken: "a", refreshToken: "r" });
  assert.deepEqual(lerFragmentoDoConvite("#error=access_denied&error_code=otp_expired&error_description=expirado"), { tipo: "erro" });
  assert.deepEqual(lerFragmentoDoConvite(""), { tipo: "nenhum" });
  assert.deepEqual(lerFragmentoDoConvite("#access_token=a"), { tipo: "nenhum" }, "sem refresh_token não dá para manter a sessão");
});

test("a organização do convite vem dos metadados e só vale se for um id", () => {
  assert.equal(organizacaoDoConvite({ user_metadata: { organization_id: ORGANIZACAO } }), ORGANIZACAO);
  assert.equal(organizacaoDoConvite({ user_metadata: {} }), null);
  assert.equal(organizacaoDoConvite({ user_metadata: { organization_id: "<script>" } }), null);
  assert.equal(organizacaoDoConvite(null), null);
});

test("destinoInterno só aceita caminhos do próprio site", () => {
  assert.equal(destinoInterno("/configuracoes"), "/configuracoes");
  assert.equal(destinoInterno("/prestacoes?aba=lancamentos#topo"), "/prestacoes?aba=lancamentos#topo");
  assert.equal(destinoInterno(["/producoes", "/x"]), "/producoes");
  for (const perigoso of [
    "//outro.site", "/\\outro.site", "/\t/outro.site", "/\n/outro.site", "/.//outro.site", "/%2F/outro.site/../..//outro.site",
    "https://outro.site", "javascript:alert(1)", "outro.site", "",
  ]) {
    assert.equal(destinoInterno(perigoso), "/dashboard", JSON.stringify(perigoso));
  }
  assert.equal(destinoInterno(null), "/dashboard");
  assert.equal(destinoInterno(undefined, "/dashboard?onboarding=1"), "/dashboard?onboarding=1");
  assert.equal(destinoInterno("//outro.site", "/dashboard?onboarding=1"), "/dashboard?onboarding=1");
});
