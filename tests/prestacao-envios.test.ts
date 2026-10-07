import assert from "node:assert/strict";
import test from "node:test";
import {
  envioVigente,
  erroDaReabertura,
  erroDoRegistro,
  resumoDoRetrato,
  textoDaGuarda,
  textoDaSituacao,
  tituloDoEnvio,
  type EnvioDaLista,
} from "../lib/prestacao/envios";

const envio = (campos: Partial<EnvioDaLista> = {}): EnvioDaLista => ({
  id: "e1", etapa: "final", versao: 1, enviado_em: "2026-10-07", protocolo: "123", sistema: "Salic", comentario: null,
  situacao: "vigente", registrado_em: "2026-10-07T12:00:00Z", reaberto_em: null, motivo_reabertura: null,
  guarda_ate: null, guarda_marco: "registro_decisao", retrato_sha256: "a".repeat(64), ...campos,
});

test("envio que vale por etapa e título com a versão", () => {
  const lista = [envio({ id: "v1", situacao: "reaberto" }), envio({ id: "v2", versao: 2 }), envio({ id: "p1", etapa: "parcial" })];
  assert.equal(envioVigente(lista, "final")?.id, "v2");
  assert.equal(envioVigente(lista, "parcial")?.id, "p1");
  assert.equal(envioVigente([], "final"), null);
  assert.equal(tituloDoEnvio({ etapa: "final", versao: 1 }), "Prestação final");
  assert.equal(tituloDoEnvio({ etapa: "parcial", versao: 2 }), "Prestação parcial, versão 2");
});

test("guarda: com data, terminada ou até o marco do regime", () => {
  assert.equal(textoDaGuarda({ guarda_ate: "2031-12-31", guarda_marco: "fim_vigencia" }, "2026-10-07"), "Guardado até 31/12/2031");
  assert.equal(textoDaGuarda({ guarda_ate: "2020-12-31", guarda_marco: "fim_vigencia" }, "2026-10-07"), "Guarda terminou em 31/12/2020");
  assert.equal(textoDaGuarda({ guarda_ate: null, guarda_marco: "registro_decisao" }, "2026-10-07"), "Guardado até a decisão final sobre as contas e o prazo de guarda do regime");
  assert.equal(textoDaGuarda({ guarda_ate: null, guarda_marco: null }, "2026-10-07"), "Guardado até o marco de guarda do regime");
});

test("situação: vale ou reaberto com o motivo", () => {
  assert.equal(textoDaSituacao(envio()), "Vale: o que foi enviado não muda nem sai");
  assert.equal(textoDaSituacao(envio({ situacao: "reaberto", reaberto_em: "2026-10-09T10:00:00Z", motivo_reabertura: "Diligência pediu a nota corrigida." })),
    "Reaberto em 09/10/2026: Diligência pediu a nota corrigida.");
});

test("resumo do retrato: só o que tem", () => {
  assert.deepEqual(resumoDoRetrato({
    despesas: [{}, {}], pagamentos: [{}], lancamentos: [], metas: [{}], evidencias: [], bens: [], pecas: [], devolucoes: [{}],
    checklist: { marcacoes: [], arquivos: [{}, {}, {}] },
  }), ["2 despesas", "1 pagamento", "1 meta", "1 devolução", "3 documentos do checklist"]);
  assert.deepEqual(resumoDoRetrato(null), []);
});

test("formulário do registro e da reabertura", () => {
  assert.equal(erroDoRegistro({ enviadoEm: "2026-10-07", protocolo: "123" }, "2026-10-07"), null);
  assert.equal(erroDoRegistro({ enviadoEm: "", protocolo: "" }, "2026-10-07"), "Informe a data do envio.");
  assert.equal(erroDoRegistro({ enviadoEm: "2026-10-08", protocolo: "" }, "2026-10-07"), "A data do envio não pode ser futura.");
  assert.equal(erroDoRegistro({ enviadoEm: "2026-10-07", protocolo: "x".repeat(121) }, "2026-10-07"), "O protocolo tem até 120 caracteres.");
  assert.equal(erroDaReabertura("curto"), "Explique por que o envio está sendo reaberto (pelo menos 10 letras).");
  assert.equal(erroDaReabertura("Diligência pediu a nota corrigida."), null);
});
