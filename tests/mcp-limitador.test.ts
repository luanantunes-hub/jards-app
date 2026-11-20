import assert from "node:assert/strict";
import test from "node:test";
import { estaNoLimite, isRateLimited, registrarOcorrencia } from "../lib/mcp/rateLimit";

let contador = 0;
const chaveNova = () => `teste-limitador-${process.pid}-${contador++}`;

test("consultar o limite não conta como ocorrência", () => {
  const chave = chaveNova();
  for (let i = 0; i < 50; i++) assert.equal(estaNoLimite(chave, 3), false);
});

test("só as ocorrências registradas levam ao limite: no limite, a próxima consulta já bloqueia", () => {
  const chave = chaveNova();
  registrarOcorrencia(chave);
  registrarOcorrencia(chave);
  assert.equal(estaNoLimite(chave, 3), false);
  registrarOcorrencia(chave);
  assert.equal(estaNoLimite(chave, 3), true);
});

test("tráfego normal de um mesmo IP, sem tentativa de adivinhar chave, nunca bloqueia", () => {
  const ip = chaveNova();
  // 200 chamadas válidas em um minuto: a conta de falhas continua zerada.
  for (let i = 0; i < 200; i++) assert.equal(estaNoLimite(ip, 20), false);
});

test("a janela expira e a conta recomeça", async () => {
  const chave = chaveNova();
  registrarOcorrencia(chave, 20);
  registrarOcorrencia(chave, 20);
  assert.equal(estaNoLimite(chave, 2), true);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(estaNoLimite(chave, 2), false);
});

test("o limitador por chave continua contando cada requisição", () => {
  const chave = chaveNova();
  assert.equal(isRateLimited(chave, 2), false);
  assert.equal(isRateLimited(chave, 2), false);
  assert.equal(isRateLimited(chave, 2), true);
});
