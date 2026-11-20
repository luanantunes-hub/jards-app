import assert from "node:assert/strict";
import test from "node:test";
import {
  ErroDaTroca, emailDoAviso, emailDoCodigo, frasesDaConfirmacao, gerarCodigo, hashDoCodigo, mensagemDoErroDaTroca, confirmarTrocaDeConta, pedirTrocaDeConta,
  type PortasDaTroca, type ResultadoDaConfirmacao,
} from "../lib/ticketeria/pagamento/troca-de-conta";

const LOJA = "0d760000-0000-4000-8000-000000000061";
const USUARIO = "0d760000-0000-4000-8000-0000000000a1";
const CONTA = { banco: "237", agencia: "1234", conta: "98765", digito: "0" };

function portas(sobre: Partial<PortasDaTroca> = {}) {
  const chamadas: { pedir: unknown[][]; confirmar: unknown[][]; cancelar: unknown[][]; emails: { para: string; assunto: string; texto: string; html: string }[] } = { pedir: [], confirmar: [], cancelar: [], emails: [] };
  const p: PortasDaTroca = {
    async pedir(...args) { chamadas.pedir.push(args); },
    async confirmar(...args) { chamadas.confirmar.push(args); return { resultado: "confirmada", efetiva_em: "2026-11-20T15:00:00.000Z", imediata: false }; },
    async cancelar(...args) { chamadas.cancelar.push(args); return 1; },
    async enviarEmail(para, m) { chamadas.emails.push({ para, ...m }); return true; },
    ...sobre,
  };
  return { p, chamadas };
}

test("o código tem sempre 6 dígitos, com zeros à esquerda", () => {
  assert.equal(gerarCodigo(() => 7), "000007");
  assert.equal(gerarCodigo(() => 999_999), "999999");
  assert.match(gerarCodigo(), /^\d{6}$/);
});

test("o hash do código depende do código, da loja e de quem pediu", () => {
  const base = hashDoCodigo("123456", LOJA, USUARIO);
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(hashDoCodigo("123456", LOJA, USUARIO), base);
  assert.notEqual(hashDoCodigo("123457", LOJA, USUARIO), base);
  assert.notEqual(hashDoCodigo("123456", "0d760000-0000-4000-8000-00000000006b", USUARIO), base);
  assert.notEqual(hashDoCodigo("123456", LOJA, "0d760000-0000-4000-8000-0000000000a3"), base);
});

test("pedir a troca guarda só o hash, vale 15 minutos e manda o código ao e-mail de quem pediu", async () => {
  const { p, chamadas } = portas();
  const agora = new Date("2026-11-19T12:00:00.000Z");
  const r = await pedirTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "luan@exemplo.com", conta: CONTA, portas: p, agora, codigo: "042042" });
  assert.equal(r.expira_em, "2026-11-19T12:15:00.000Z");
  const [loja, usuario, conta, hash, expira] = chamadas.pedir[0] as [string, string, typeof CONTA, string, Date];
  assert.deepEqual([loja, usuario, conta], [LOJA, USUARIO, CONTA]);
  assert.equal(hash, hashDoCodigo("042042", LOJA, USUARIO));
  assert.equal(expira.toISOString(), "2026-11-19T12:15:00.000Z");
  assert.equal(chamadas.emails.length, 1);
  assert.equal(chamadas.emails[0].para, "luan@exemplo.com");
  assert.match(chamadas.emails[0].texto, /042042/);
  assert.match(chamadas.emails[0].assunto, /042042/);
  assert.equal(JSON.stringify(chamadas.pedir).includes("042042"), false, "o código em si não vai para o banco");
});

test("conta bancária com problema: nem pede nem manda e-mail", async () => {
  const { p, chamadas } = portas();
  await assert.rejects(pedirTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "a@b.co", conta: { ...CONTA, banco: "23" }, portas: p }), (e: unknown) => e instanceof ErroDaTroca && e.codigo === "dados_invalidos" && e.problemas.length === 1);
  assert.deepEqual([chamadas.pedir.length, chamadas.emails.length], [0, 0]);
});

test("se o e-mail do código não sai, o pedido é cancelado (ninguém fica com código que não recebeu)", async () => {
  const { p, chamadas } = portas({ async enviarEmail() { return false; } });
  await assert.rejects(pedirTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "a@b.co", conta: CONTA, portas: p }), (e: unknown) => e instanceof ErroDaTroca && e.codigo === "email_nao_enviado");
  assert.equal(chamadas.pedir.length, 1);
  assert.deepEqual(chamadas.cancelar[0], [LOJA]);
});

test("os erros do banco passam como estão (mesma conta, conta bloqueada)", async () => {
  const { p } = portas({ async pedir() { throw new ErroDaTroca("mesma_conta"); } });
  await assert.rejects(pedirTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "a@b.co", conta: CONTA, portas: p }), (e: unknown) => e instanceof ErroDaTroca && e.codigo === "mesma_conta");
});

test("confirmar com o código certo manda o aviso com o dia e a hora em que a troca passa a valer", async () => {
  const { p, chamadas } = portas();
  const r = await confirmarTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "luan@exemplo.com", codigo: "042 042", conta: CONTA, portas: p });
  assert.deepEqual(r, { resultado: "confirmada", efetiva_em: "2026-11-20T15:00:00.000Z", imediata: false, aviso_enviado: true });
  assert.equal(chamadas.confirmar[0][2], hashDoCodigo("042042", LOJA, USUARIO), "espaços no meio do código não atrapalham");
  assert.equal(chamadas.emails[0].para, "luan@exemplo.com");
  assert.match(chamadas.emails[0].texto, /20\/11\/2026 às 12:00/);
  assert.match(chamadas.emails[0].texto, /Bradesco · 1234 · 98765-0/);
  assert.match(chamadas.emails[0].texto, /cancele a troca/);
});

test("se o aviso não sai, a troca continua confirmada", async () => {
  const { p } = portas({ async enviarEmail() { throw new Error("rede"); } });
  const r = await confirmarTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "a@b.co", codigo: "111111", conta: CONTA, portas: p });
  assert.equal(r.resultado, "confirmada");
  assert.equal((r as { aviso_enviado?: boolean }).aviso_enviado, false);
});

test("código errado, vencido ou sem pedido: não manda aviso nenhum", async () => {
  for (const resultado of [{ resultado: "codigo_errado", restantes: 3 }, { resultado: "codigo_expirado" }, { resultado: "tentativas_esgotadas" }, { resultado: "sem_pedido" }] as ResultadoDaConfirmacao[]) {
    const { p, chamadas } = portas({ async confirmar() { return resultado; } });
    assert.deepEqual(await confirmarTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "a@b.co", codigo: "111111", conta: CONTA, portas: p }), resultado);
    assert.equal(chamadas.emails.length, 0);
  }
});

test("o código precisa ter 6 números: nem chega ao banco", async () => {
  const { p, chamadas } = portas();
  for (const codigo of ["", "12345", "1234567", "12a456", "' or 1=1"]) {
    await assert.rejects(confirmarTrocaDeConta({ loja: LOJA, usuario: USUARIO, email: "a@b.co", codigo, conta: CONTA, portas: p }), (e: unknown) => e instanceof ErroDaTroca && e.codigo === "codigo_invalido");
  }
  assert.equal(chamadas.confirmar.length, 0);
});

test("o aviso diz o que muda e como desfazer; se não havia conta, diz que já vale", () => {
  const espera = emailDoAviso({ conta: CONTA, efetivaEm: new Date("2026-11-20T15:00:00.000Z"), imediata: false });
  assert.match(espera.texto, /continuam saindo só para a conta atual/);
  assert.match(espera.texto, /Ticketeria > Recebimentos/);
  assert.doesNotMatch(espera.html, /<script/i);
  const na_hora = emailDoAviso({ conta: CONTA, efetivaEm: new Date(), imediata: true });
  assert.match(na_hora.texto, /foi definida/);
  assert.doesNotMatch(na_hora.texto, /cancele/);
});

test("o e-mail do código não deixa o código virar HTML", () => {
  assert.match(emailDoCodigo("123456").html, /123456/);
});

test("as frases para a pessoa", () => {
  assert.equal(frasesDaConfirmacao({ resultado: "codigo_errado", restantes: 1 }), "Código errado. Resta 1 tentativa.");
  assert.equal(frasesDaConfirmacao({ resultado: "codigo_errado", restantes: 3 }), "Código errado. Restam 3 tentativas.");
  assert.equal(frasesDaConfirmacao({ resultado: "confirmada", efetiva_em: "x", imediata: false }), null);
  for (const r of ["codigo_expirado", "tentativas_esgotadas", "sem_pedido"] as const) assert.match(frasesDaConfirmacao({ resultado: r }) ?? "", /Peça a troca de novo/);
  assert.equal(mensagemDoErroDaTroca(400, "mesma_conta"), "Esta já é a conta de saques.");
  assert.equal(mensagemDoErroDaTroca(429, undefined), "Muitas tentativas. Espere um pouco e tente de novo.");
  assert.match(mensagemDoErroDaTroca(400, "dados_invalidos", ["banco com 3 números"]), /banco com 3 números/);
});
