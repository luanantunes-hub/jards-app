import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { REGIMES } from "../lib/prestacao/regimes";
import { ARQUIVO_MATRIZ, coberturaDoRegime, fontesEm, gerarMatrizCobertura, problemasDeCobertura } from "../lib/prestacao/regimes/cobertura";
import { DIMENSOES, type RegimeNormativo } from "../lib/prestacao/regimes/tipos";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";

test("todo regime cobre todas as dimensões: regras ou lacuna com motivo e fonte", () => {
  for (const regime of REGIMES) {
    assert.deepEqual(problemasDeCobertura(regime), [], regime.codigo);
    assert.equal(coberturaDoRegime(regime).length, DIMENSOES.length);
  }
});

test("a cobertura acusa dimensão ausente, lacuna sem fonte e prazo essencial faltando", () => {
  const incompleto = structuredClone(ROUANET_IN29_2026) as unknown as Record<string, unknown> & { prazos: Record<string, unknown> };
  delete incompleto.objeto;
  incompleto.porte = { lacuna: "norma_silente", motivo: "", fonte: { documento: "IN", dispositivo: "" } };
  delete incompleto.prazos.recurso;
  incompleto.envio = { lacuna: "nao_se_aplica", motivo: "teste", fonte: { documento: "IN", dispositivo: "art. 1" } };
  const problemas = problemasDeCobertura(incompleto as unknown as RegimeNormativo);
  assert.ok(problemas.includes("objeto: sem regras nem lacuna"));
  assert.ok(problemas.includes("porte: lacuna sem motivo ou sem fonte"));
  assert.ok(problemas.includes("prazos.recurso: sem prazo nem lacuna"));
  assert.ok(problemas.includes("envio: toda lei diz como a prestação é entregue"));
});

test("toda fonte dos regimes tem documento e dispositivo", () => {
  for (const regime of REGIMES) {
    for (const fonte of fontesEm(regime)) {
      assert.ok(fonte.documento.trim() && fonte.dispositivo.trim(), `${regime.codigo}: ${JSON.stringify(fonte)}`);
    }
  }
});

test("a Rouanet não tem dimensão em lacuna: a IN 29 trata de todas", () => {
  const lacunas = coberturaDoRegime(ROUANET_IN29_2026).filter(c => c.situacao !== "definida").map(c => c.chave);
  assert.deepEqual(lacunas, []);
});

test("a matriz de cobertura está igual ao código", async () => {
  const arquivo = await readFile(ARQUIVO_MATRIZ, "utf8");
  assert.equal(arquivo, gerarMatrizCobertura(), "rode: npx tsx scripts/prestacao-gerar-matriz-regimes.ts");
});
