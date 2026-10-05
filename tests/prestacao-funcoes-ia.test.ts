import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// O comportamento da autorização é testado com Deno em
// supabase/functions/_shared/prestacao-acesso.test.ts. Aqui garantimos que as
// duas funções continuam ligadas a ela antes de baixar qualquer arquivo.

const FUNCOES = [
  { arquivo: "supabase/functions/extrair-comprovante/index.ts", pasta: "comprovantes" },
  { arquivo: "supabase/functions/importar-orcamento/index.ts", pasta: "orcamento" },
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
  for (const trecho of ["auth.getUser(token)", "lerCaminhoPrestacao(", "organization_members", 'rpc("can_access_prestacao"', "organizacaoDaPrestacao("]) {
    assert.ok(fonte.includes(trecho), `falta ${trecho}`);
  }
});

test("as duas funções exigem JWT na configuração", async () => {
  const config = await readFile("supabase/config.toml", "utf8");
  for (const nome of ["extrair-comprovante", "importar-orcamento"]) {
    assert.match(config, new RegExp(`\\[functions\\.${nome}\\]\\s+verify_jwt = true`));
  }
});
