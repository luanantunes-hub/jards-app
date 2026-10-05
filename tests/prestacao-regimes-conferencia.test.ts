// Conferência dos regimes derivados na própria norma (P1.11).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { REGIMES, definida, regimePorCodigo } from "../lib/prestacao/regimes";
import { aplicarConferencia, fontesComCaminho } from "../lib/prestacao/regimes/conferencia";
import { CONFERENCIA_ANCINE_IN150_2019 } from "../lib/prestacao/regimes/conferencias/ancine-in150-2019";
import { CONFERENCIA_LIE_P424_2020 } from "../lib/prestacao/regimes/conferencias/lie-p424-2020";
import { CONFERENCIA_SAUDE_LXXXVI_2017 } from "../lib/prestacao/regimes/conferencias/saude-lxxxvi-2017";

const P10 = regimePorCodigo("lie_p10_2026")!;

test("a conferência troca a fonte, troca a regra e tira o que a norma antiga não tem", () => {
  const conferido = aplicarConferencia(P10, [
    { caminho: "prazos.prestacaoFinal.fonte", fonte: { documento: "Norma antiga", dispositivo: "art. 1º" } },
    { caminho: "prestacaoParcial.regras[pcp_pelo_sei].fonte", regra: { codigo: "pcp_por_email" }, fonte: { documento: "Norma antiga", dispositivo: "art. 2º" } },
    { caminho: "prestacaoParcial.regras[pcp_sem_merito].fonte", remover: "só da norma nova" },
  ]);
  assert.equal(conferido.prazos.prestacaoFinal && "fonte" in conferido.prazos.prestacaoFinal ? conferido.prazos.prestacaoFinal.fonte.documento : null, "Norma antiga");
  const regras = definida(conferido.prestacaoParcial)?.regras.map(r => r.codigo) ?? [];
  assert.ok(regras.includes("pcp_por_email") && !regras.includes("pcp_pelo_sei") && !regras.includes("pcp_sem_merito"));
  assert.ok(definida(P10.prestacaoParcial)?.regras.some(r => r.codigo === "pcp_pelo_sei"), "o regime de origem fica intacto");
});

test("a conferência recusa caminho inexistente, ajuste repetido e remoção fora de lista", () => {
  const fonte = { documento: "x", dispositivo: "y" };
  assert.throws(() => aplicarConferencia(P10, [{ caminho: "prazos.naoExiste.fonte", fonte }]), /não existe/);
  assert.throws(() => aplicarConferencia(P10, [{ caminho: "prazos.prestacaoFinal.fonte", fonte }, { caminho: "prazos.prestacaoFinal.fonte", fonte }]), /repetido/);
  assert.throws(() => aplicarConferencia(P10, [{ caminho: "prazos.prestacaoFinal.fonte", remover: "x" }]), /Só item de lista/);
});

test("cada lista de conferência cobre só caminhos do regime e não repete", () => {
  const listas = [
    ["lie_p424_2020", CONFERENCIA_LIE_P424_2020],
    ["pronon_pronas_lxxxvi_2017", CONFERENCIA_SAUDE_LXXXVI_2017],
    ["ancine_in150_2019", CONFERENCIA_ANCINE_IN150_2019],
  ] as const;
  for (const [codigo, lista] of listas) {
    const caminhos = lista.map(a => a.caminho);
    assert.equal(new Set(caminhos).size, caminhos.length, codigo);
    const regime = regimePorCodigo(codigo)!;
    assert.equal(regime.versao, 2, `${codigo}: a conferência é a versão 2`);
    // O regime já conferido não tem mais o que a conferência removeu.
    const removidos = lista.filter(a => "remover" in a).map(a => a.caminho);
    const restantes = new Set(fontesComCaminho(regime).map(f => f.caminho));
    for (const caminho of removidos) assert.ok(!restantes.has(caminho), `${codigo}: ${caminho}`);
  }
});

test("o que continua a confirmar nos regimes conferidos tem o motivo escrito", () => {
  for (const codigo of ["lie_p424_2020", "pronon_pronas_lxxxvi_2017", "ancine_in150_2019"]) {
    const pendentes = fontesComCaminho(regimePorCodigo(codigo)!).filter(f => (f.dono.fonte as { aConfirmar?: boolean }).aConfirmar);
    for (const { caminho, dono } of pendentes) {
      const nota = (dono.fonte as { nota?: string }).nota ?? "";
      assert.ok(nota.length > 20, `${codigo}: ${caminho} sem nota`);
      assert.ok(!nota.includes("o dispositivo equivalente não foi conferido") && !nota.includes("a regra equivalente não foi conferida"), `${codigo}: ${caminho} ainda com a nota genérica da herança`);
    }
    assert.ok(pendentes.length <= 15, `${codigo}: ${pendentes.length} a confirmar`);
  }
});

test("os modelos citados pelos regimes existem na pasta de modelos oficiais", () => {
  for (const regime of REGIMES) {
    for (const modelo of definida(regime.envio)?.modelos ?? []) {
      if (!modelo.arquivo) continue;
      assert.ok(existsSync(`docs/acoes-futuras/estudos/prestacao-de-contas-fontes/modelos-oficiais/${modelo.arquivo}`), `${regime.codigo}: ${modelo.arquivo}`);
    }
  }
});
