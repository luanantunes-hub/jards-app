// Comportamento da autorização das funções de IA, com as respostas do
// Supabase simuladas. Rodar com:
//   cd supabase/functions && deno test --allow-env _shared/prestacao-acesso.test.ts
import { autorizarArquivoDaPrestacao } from "./prestacao-acesso.ts";

const ORG = "11111111-1111-4111-8111-111111111111";
const OUTRA = "99999999-9999-4999-8999-999999999999";
const PREST = "22222222-2222-4222-8222-222222222222";
const ARQ = "44444444-4444-4444-8444-444444444444";
const USER = "55555555-5555-4555-8555-555555555555";

Deno.env.set("SUPABASE_URL", "https://exemplo.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
Deno.env.set("SUPABASE_ANON_KEY", "anon");

type Cenario = { tokenValido: boolean; membro: boolean; podeAcessar: boolean; podeEditar: boolean; orgDaPrestacao: string | null };
let cenario: Cenario;
const chamadas: string[] = [];

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  chamadas.push(`${init?.method ?? "GET"} ${url.pathname}`);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.pathname === "/auth/v1/user") {
    return cenario.tokenValido ? json({ id: USER, aud: "authenticated", role: "authenticated", email: "a@b.c", app_metadata: {}, user_metadata: {}, created_at: "" }) : json({ msg: "invalid" }, 401);
  }
  if (url.pathname === "/rest/v1/organization_members") {
    if (headers.get("Authorization") !== "Bearer service") throw new Error("membro deve ser lido com a chave de serviço");
    return json(cenario.membro ? [{ id: "m1" }] : []);
  }
  if (url.pathname === "/rest/v1/rpc/can_access_prestacao") {
    if (headers.get("Authorization") !== "Bearer token-usuario") throw new Error("rpc deve usar o token do usuário");
    return json(cenario.podeAcessar);
  }
  if (url.pathname === "/rest/v1/rpc/auth_prestacao_pode") {
    if (headers.get("Authorization") !== "Bearer token-usuario") throw new Error("rpc deve usar o token do usuário");
    const corpo = JSON.parse(String(init?.body ?? "{}"));
    if (corpo.p_acao !== "editar" || corpo.p_prestacao_id !== PREST) throw new Error("rpc com parâmetros errados");
    return json(cenario.podeEditar);
  }
  if (url.pathname === "/rest/v1/prestacoes_contas") {
    return json([{ id: PREST, projeto: cenario.orgDaPrestacao ? { organization_id: cenario.orgDaPrestacao } : null, captacao: null }]);
  }
  throw new Error("URL inesperada " + url.href);
};

function req(token?: string) {
  return new Request("https://f/x", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
const caminhoOk = `${ORG}/prestacoes/${PREST}/comprovantes/${ARQ}.pdf`;
const caminhoExtrato = `${ORG}/prestacoes/${PREST}/extratos/${ARQ}.pdf`;
const base: Cenario = { tokenValido: true, membro: true, podeAcessar: true, podeEditar: true, orgDaPrestacao: ORG };

async function status(
  c: Partial<Cenario>,
  token: string | undefined,
  prestacaoId: unknown,
  storagePath: unknown,
  pastas: ("comprovantes" | "orcamento" | "extratos")[] = ["comprovantes"],
  exigirEdicao?: boolean,
) {
  cenario = { ...base, ...c };
  chamadas.length = 0;
  const r = await autorizarArquivoDaPrestacao(req(token), { prestacaoId, storagePath, pastas, exigirEdicao });
  return r.ok ? 200 : r.resposta.status;
}

Deno.test("autorizado no caminho certo", async () => {
  const s = await status({}, "token-usuario", PREST, caminhoOk);
  if (s !== 200) throw new Error(`esperado 200, veio ${s}`);
});
Deno.test("sem token: 401", async () => { if (await status({}, undefined, PREST, caminhoOk) !== 401) throw new Error(); });
Deno.test("token inválido: 401", async () => { if (await status({ tokenValido: false }, "x", PREST, caminhoOk) !== 401) throw new Error(); });
Deno.test("sem prestação: 400", async () => { if (await status({}, "token-usuario", undefined, caminhoOk) !== 400) throw new Error(); });
Deno.test("caminho antigo: 403", async () => { if (await status({}, "token-usuario", PREST, `prestacoes/${PREST}/1.pdf`) !== 403) throw new Error(); });
Deno.test("caminho de outra prestação: 403", async () => {
  if (await status({}, "token-usuario", "33333333-3333-4333-8333-333333333333", caminhoOk) !== 403) throw new Error();
});
Deno.test("pasta errada para a função: 403", async () => { if (await status({}, "token-usuario", PREST, caminhoOk, ["orcamento"]) !== 403) throw new Error(); });
Deno.test("não é membro da organização da pasta: 403", async () => { if (await status({ membro: false }, "token-usuario", PREST, caminhoOk) !== 403) throw new Error(); });
Deno.test("banco nega acesso à prestação: 403", async () => { if (await status({ podeAcessar: false }, "token-usuario", PREST, caminhoOk) !== 403) throw new Error(); });
Deno.test("pasta de organização diferente da dona: 403", async () => { if (await status({ orgDaPrestacao: OUTRA }, "token-usuario", PREST, caminhoOk) !== 403) throw new Error(); });
Deno.test("prestação sem organização conhecida: vale a pasta do membro", async () => { if (await status({ orgDaPrestacao: null }, "token-usuario", PREST, caminhoOk) !== 200) throw new Error(); });
Deno.test("extrato em PDF: quem edita passa", async () => {
  if (await status({}, "token-usuario", PREST, caminhoExtrato, ["extratos"], true) !== 200) throw new Error();
});
Deno.test("extrato em PDF: quem só lê a prestação recebe 403", async () => {
  if (await status({ podeEditar: false }, "token-usuario", PREST, caminhoExtrato, ["extratos"], true) !== 403) throw new Error();
});
Deno.test("sem exigir edição, o papel não é consultado", async () => {
  await status({ podeEditar: false }, "token-usuario", PREST, caminhoOk);
  if (chamadas.some(c => c.includes("auth_prestacao_pode"))) throw new Error("não deveria consultar o papel");
});
