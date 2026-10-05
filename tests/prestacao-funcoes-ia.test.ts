import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// O comportamento da autorização é testado com Deno em
// supabase/functions/_shared/prestacao-acesso.test.ts. Aqui garantimos que as
// funções continuam ligadas a ela antes de baixar qualquer arquivo.

const FUNCOES = [
  { arquivo: "supabase/functions/extrair-comprovante/index.ts", pasta: "comprovantes" },
  { arquivo: "supabase/functions/importar-orcamento/index.ts", pasta: "orcamento" },
  { arquivo: "supabase/functions/ler-extrato-pdf/index.ts", pasta: "extratos" },
];

for (const { arquivo, pasta } of FUNCOES) {
  test(`${arquivo} autoriza antes de baixar o arquivo`, async () => {
    const fonte = await readFile(arquivo, "utf8");
    const autoriza = fonte.indexOf("autorizarArquivoDaPrestacao(");
    const baixa = fonte.indexOf(".download(");
    assert.ok(autoriza > 0, "não chama autorizarArquivoDaPrestacao");
    assert.ok(baixa > autoriza, "baixa o arquivo antes de autorizar");
    assert.match(fonte, /if \(!acesso\.ok\) return acesso\.resposta;/);
    assert.match(fonte, new RegExp(`pastas: \\["${pasta}"\\]`));
    assert.doesNotMatch(fonte, /SUPABASE_SERVICE_ROLE_KEY/, "cria cliente de serviço próprio, fora da autorização");
  });
}

test("autorização confere token, caminho, membro e acesso pelo banco", async () => {
  const fonte = await readFile("supabase/functions/_shared/prestacao-acesso.ts", "utf8");
  for (const trecho of ["auth.getUser(token)", "lerCaminhoPrestacao(", "organization_members", 'rpc("can_access_prestacao"', 'rpc("auth_prestacao_pode"', "organizacaoDaPrestacao("]) {
    assert.ok(fonte.includes(trecho), `falta ${trecho}`);
  }
});

test("o extrato em PDF só é lido para quem edita a prestação", async () => {
  const fonte = await readFile("supabase/functions/ler-extrato-pdf/index.ts", "utf8");
  assert.match(fonte, /exigirEdicao: true/);
  assert.match(fonte, /response_schema: ESQUEMA/, "a resposta da IA segue um esquema");
});

test("modelo da IA: o padrão não é o 2.5 Flash e os modelos 3.x ficam sem temperatura 0", async () => {
  const modelo = await readFile("supabase/functions/_shared/modelo-ia.ts", "utf8");
  assert.match(modelo, /Deno\.env\.get\("GOOGLE_AI_MODEL"\) \|\| "gemini-3\.\d+-flash"/);
  for (const arquivo of ["supabase/functions/importar-orcamento/index.ts", "supabase/functions/ler-extrato-pdf/index.ts"]) {
    const fonte = await readFile(arquivo, "utf8");
    assert.match(fonte, /modeloDaIa\(\)/, `${arquivo} usa o modelo compartilhado`);
    assert.doesNotMatch(fonte, /gemini-2\.5|temperature: 0/, `${arquivo} fixa modelo ou temperatura`);
  }
});

test("as funções de IA exigem JWT na configuração", async () => {
  const config = await readFile("supabase/config.toml", "utf8");
  for (const nome of ["extrair-comprovante", "importar-orcamento", "ler-extrato-pdf"]) {
    assert.match(config, new RegExp(`\\[functions\\.${nome}\\]\\s+verify_jwt = true`));
  }
});
