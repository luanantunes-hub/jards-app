import assert from "node:assert/strict";
import test from "node:test";
import {
  frasesPossiveis,
  organizacaoCabe,
  pascoa,
  periodoDoDia,
  primeiroNome,
  saudacaoDoPainel,
} from "../lib/saudacao";

// Meses em base 0, como no Date.
const em = (ano: number, mes: number, dia: number, hora: number) => new Date(ano, mes - 1, dia, hora);

test("períodos do dia", () => {
  assert.equal(periodoDoDia(3), "madrugada");
  assert.equal(periodoDoDia(5), "manha");
  assert.equal(periodoDoDia(12), "tarde");
  assert.equal(periodoDoDia(18), "noite");
});

test("Páscoa", () => {
  assert.equal(pascoa(2026).toDateString(), new Date(2026, 3, 5).toDateString());
  assert.equal(pascoa(2027).toDateString(), new Date(2027, 2, 28).toDateString());
});

test("primeiro nome vem do nome, nunca do e-mail", () => {
  assert.equal(primeiroNome("luan antunes"), "Luan");
  assert.equal(primeiroNome("  Ana   Maria "), "Ana");
  assert.equal(primeiroNome("luan@jards.com.br"), "");
  assert.equal(primeiroNome(null), "");
});

test("organização só entra quando tem nome próprio e curto", () => {
  assert.equal(organizacaoCabe("Platibanda", "Luan Antunes"), true);
  assert.equal(organizacaoCabe("Luan Antunes", "Luan Antunes"), false);
  assert.equal(organizacaoCabe("Luan", "Luan Antunes"), false);
  assert.equal(organizacaoCabe("Minha organização", "Ana"), false);
  assert.equal(organizacaoCabe("Associação Cultural de Amigos do Museu Paulista", "Ana"), false);
  assert.equal(organizacaoCabe("", "Ana"), false);
});

test("quinta comum de manhã: cumprimento do período e nome", () => {
  const frases = frasesPossiveis({ nome: "Ana Souza", organizacao: "Platibanda", agora: em(2026, 11, 12, 9) });
  assert.ok(frases.length > 1);
  assert.ok(frases.some((f) => f.includes("time Platibanda")));
  for (const f of frases) assert.match(f, /Bom dia/);
  assert.ok(frases.includes("Bom dia, Ana."));
});

test("sem nome, a frase não fica com vírgula sobrando", () => {
  for (const f of frasesPossiveis({ agora: em(2026, 11, 12, 15) })) {
    assert.doesNotMatch(f, /, \.|,\s*\?|\{|\}/);
  }
  assert.ok(frasesPossiveis({ agora: em(2026, 11, 12, 15) }).includes("Boa tarde."));
});

test("datas especiais substituem as frases comuns", () => {
  assert.deepEqual(frasesPossiveis({ nome: "Ana", agora: em(2027, 1, 1, 10) }), ["Feliz 2027, Ana."]);
  assert.deepEqual(frasesPossiveis({ nome: "Ana", agora: em(2026, 12, 25, 10) }), ["Feliz Natal, Ana."]);
  assert.deepEqual(frasesPossiveis({ nome: "Ana", agora: em(2026, 12, 31, 20) }), ["Que 2027 venha com muitos patrocínios, Ana."]);
  assert.deepEqual(frasesPossiveis({ nome: "Ana", agora: em(2026, 11, 5, 10) }), ["Feliz Dia Nacional da Cultura, Ana."]);
  assert.deepEqual(frasesPossiveis({ nome: "Ana", agora: em(2026, 11, 20, 10) }), ["Bom feriado, Ana."]);
});

test("Carnaval e Quarta-feira de Cinzas de 2027", () => {
  // Páscoa de 2027 em 28/3: Cinzas em 10/2, Carnaval de 6 a 9/2.
  assert.match(frasesPossiveis({ nome: "Ana", agora: em(2027, 2, 9, 10) })[0], /Carnaval/);
  assert.match(frasesPossiveis({ nome: "Ana", agora: em(2027, 2, 6, 10) })[0], /Carnaval/);
  assert.deepEqual(frasesPossiveis({ nome: "Ana", agora: em(2027, 2, 10, 10) }), ["Agora o ano começa, Ana."]);
  assert.doesNotMatch(frasesPossiveis({ nome: "Ana", agora: em(2027, 2, 11, 10) }).join(" "), /Carnaval/);
});

test("dezembro útil fala de fechar patrocínio; fim de semana não", () => {
  assert.match(frasesPossiveis({ nome: "Ana", agora: em(2026, 12, 9, 10) }).join(" "), /patrocínio/);
  assert.doesNotMatch(frasesPossiveis({ nome: "Ana", agora: em(2026, 12, 12, 10) }).join(" "), /fechar patrocínio/);
});

test("segunda de manhã e sexta à tarde têm frases próprias", () => {
  assert.ok(frasesPossiveis({ nome: "Ana", agora: em(2026, 11, 9, 9) }).includes("Boa semana, Ana. Por onde começamos?"));
  assert.ok(frasesPossiveis({ nome: "Ana", agora: em(2026, 11, 13, 16) }).includes("Boa sexta, Ana."));
});

test("a frase fica a mesma no mesmo período do dia e varia entre pessoas", () => {
  const base = { nome: "Ana", organizacao: "Platibanda" };
  const a = saudacaoDoPainel({ ...base, agora: em(2026, 11, 12, 9), semente: "u1" });
  const b = saudacaoDoPainel({ ...base, agora: em(2026, 11, 12, 11), semente: "u1" });
  assert.equal(a, b);
  const frases = new Set(["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"].map((semente) =>
    saudacaoDoPainel({ ...base, agora: em(2026, 11, 12, 9), semente })));
  assert.ok(frases.size > 1);
});
