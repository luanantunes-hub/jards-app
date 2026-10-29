import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET as retornoDoEmail } from "../app/api/auth/callback/route";

// O convite de equipe do Supabase (inviteUserByEmail) volta sem "code": a sessão vem no fragmento do endereço,
// que o servidor não lê. A rota de retorno leva essa pessoa à tela que cria a senha e aceita o convite.

const volta = (consulta: string) => retornoDoEmail(new Request(`https://app.jards.com.br/api/auth/callback${consulta}`));

test("convite sem código vai para a tela de criar senha, com o destino do convite", async () => {
  const resposta = await volta("?next=%2Fconfiguracoes");
  assert.ok(resposta.status >= 300 && resposta.status < 400);
  assert.equal(resposta.headers.get("location"), "https://app.jards.com.br/aceitar-convite?next=%2Fconfiguracoes");
});

test("sem next, o destino é o dashboard; next de fora do site é descartado", async () => {
  assert.equal((await volta("")).headers.get("location"), "https://app.jards.com.br/aceitar-convite?next=%2Fdashboard");
  assert.equal(
    (await volta("?next=https%3A%2F%2Foutro.site")).headers.get("location"),
    "https://app.jards.com.br/aceitar-convite?next=%2Fdashboard",
  );
});

test("erro devolvido pelo provedor (?error=, ?error_code=) continua indo para o login", async () => {
  for (const consulta of ["?error=access_denied&error_code=otp_expired&next=%2Fconfiguracoes", "?error_code=otp_expired", "?error_description=link+expirado"]) {
    const resposta = await volta(consulta);
    assert.equal(resposta.headers.get("location"), "https://app.jards.com.br/login?error=auth_callback_failed", consulta);
  }
});

test("a tela de criar senha é pública no proxy e o login aceita convites pendentes", async () => {
  // Sem estar na lista de rotas públicas, o proxy mandaria a pessoa do convite ao login antes de ler o fragmento.
  const proxy = await readFile("proxy.ts", "utf8");
  assert.equal(proxy.split('pathname.startsWith("/aceitar-convite")').length - 1, 2, "nas duas listas de rotas públicas");

  const login = await readFile("app/login/page.tsx", "utf8");
  assert.ok(login.indexOf("accept_my_organization_invitations") > login.indexOf("signInWithPassword"));

  const pagina = await readFile("app/aceitar-convite/page.tsx", "utf8");
  assert.ok(pagina.includes("estabelecerSessaoDoConvite("), "a sessão vem dos tokens do fragmento (tests/convite-sessao.test.ts roda isso contra o cliente real)");
  assert.ok(pagina.indexOf("auth.updateUser") < pagina.lastIndexOf("await entrarNaEquipe()"), "cria a senha e só então aceita");
  assert.ok(pagina.includes('rpc("accept_my_organization_invitations")'));
});
