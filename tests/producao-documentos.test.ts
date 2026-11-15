// A pasta de documentos com validade (PD4.8): a validade, a leitura do formulário, o aviso do Hoje.
import test from "node:test";
import assert from "node:assert/strict";
import { avisosDeDocumentosParaHoje, lerDocumento, situacaoDaValidade, temNumeroDeDocumento, textoDaValidade, type DocumentoDaPasta } from "../lib/producao/documentos";

const HOJE = "2026-11-15";
const base = { escopo: "organizacao" as const, pessoaId: "", tipo: "certidao_negativa" as const, titulo: "Certidão negativa federal", emitidoEm: "", validade: "", notas: "" };

test("a validade: sem validade, vencida, a vencer em 30 dias ou em dia", () => {
  assert.deepEqual(situacaoDaValidade(null, HOJE), { estado: "sem_validade", dias: null });
  assert.deepEqual(situacaoDaValidade("2026-11-14", HOJE), { estado: "vencido", dias: -1 });
  assert.deepEqual(situacaoDaValidade("2026-11-15", HOJE), { estado: "vence_em_breve", dias: 0 }, "vence hoje ainda é a vencer");
  assert.equal(situacaoDaValidade("2026-12-15", HOJE).estado, "vence_em_breve", "30 dias exatos avisam");
  assert.equal(situacaoDaValidade("2026-12-16", HOJE).estado, "em_dia", "31 dias ainda não");
});

test("a validade em palavras", () => {
  assert.equal(textoDaValidade(null, HOJE), "Sem validade");
  assert.equal(textoDaValidade("2026-11-10", HOJE), "Venceu em 10/11/2026 (há 5 dias)");
  assert.equal(textoDaValidade("2026-11-14", HOJE), "Venceu em 14/11/2026 (há 1 dia)");
  assert.equal(textoDaValidade("2026-11-15", HOJE), "Vence hoje");
  assert.equal(textoDaValidade("2026-11-16", HOJE), "Vence em 1 dia (16/11/2026)");
  assert.equal(textoDaValidade("2026-11-27", HOJE), "Vence em 12 dias (27/11/2026)");
  assert.equal(textoDaValidade("2027-03-10", HOJE), "Válido até 10/03/2027");
});

test("número de documento no texto: CPF e sequências longas", () => {
  assert.equal(temNumeroDeDocumento("CPF 123.456.789-09"), true);
  assert.equal(temNumeroDeDocumento("12345678909"), true);
  assert.equal(temNumeroDeDocumento("RG 12.345.678-9"), true);
  assert.equal(temNumeroDeDocumento("Certidão de 2026, válida por 180 dias"), false, "ano e dias não são número de documento");
  assert.equal(temNumeroDeDocumento("CND federal"), false);
});

test("ler o documento: o que o banco recusa e o que a tela recusa", () => {
  const ok = lerDocumento({ ...base, validade: "2027-03-10", emitidoEm: "2026-09-10", notas: "Renovar em fevereiro" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.valor, { escopo: "organizacao", pessoa_id: null, tipo: "certidao_negativa", titulo: "Certidão negativa federal", emitido_em: "2026-09-10", validade: "2027-03-10", notas: "Renovar em fevereiro" });
  assert.equal(lerDocumento({ ...base, titulo: "  " }).ok, false, "título vazio");
  assert.equal(lerDocumento({ ...base, titulo: "x".repeat(121) }).ok, false, "título longo");
  assert.equal(lerDocumento({ ...base, tipo: "cnh" }).ok, false, "CNH não é da organização");
  assert.equal(lerDocumento({ ...base, escopo: "pessoa", tipo: "contrato_social", pessoaId: "p1" }).ok, false, "contrato social não é de pessoa");
  assert.equal(lerDocumento({ ...base, escopo: "pessoa", tipo: "cnh", pessoaId: "" }).ok, false, "de pessoa pede a pessoa");
  assert.equal(lerDocumento({ ...base, tipo: "outro" }).ok, true, "outro vale nos dois");
  assert.equal(lerDocumento({ ...base, emitidoEm: "2026-09-10", validade: "2026-09-09" }).ok, false, "validade antes da emissão");
  assert.equal(lerDocumento({ ...base, validade: "10/03/2027" }).ok, false, "data fora do formato");
  assert.equal(lerDocumento({ ...base, notas: "x".repeat(301) }).ok, false, "nota longa");
  assert.equal(lerDocumento({ ...base, titulo: "CNH 12345678909" }).ok, false, "número de documento no título");
  const pessoa = lerDocumento({ ...base, escopo: "pessoa", tipo: "cnh", pessoaId: "p1", titulo: "CNH categoria D" });
  assert.equal(pessoa.ok, true);
  if (pessoa.ok) assert.equal(pessoa.valor.pessoa_id, "p1");
});

test("os avisos do Hoje: vencidos e a vencer, o que vence primeiro antes, e o nome da pessoa", () => {
  const docs: DocumentoDaPasta[] = [
    { id: "1", escopo: "organizacao", pessoa_id: null, tipo: "certidao_negativa", titulo: "CND federal", emitido_em: null, validade: "2026-11-27", notas: null },
    { id: "2", escopo: "pessoa", pessoa_id: "p1", tipo: "cnh", titulo: "CNH D", emitido_em: null, validade: "2026-11-10", notas: null },
    { id: "3", escopo: "organizacao", pessoa_id: null, tipo: "contrato_social", titulo: "Contrato", emitido_em: null, validade: "2027-06-01", notas: null },
    { id: "4", escopo: "organizacao", pessoa_id: null, tipo: "outro", titulo: "Alvará da sede", emitido_em: null, validade: "2026-11-20", notas: null },
    { id: "5", escopo: "organizacao", pessoa_id: null, tipo: "carta_exclusividade", titulo: "Carta", emitido_em: null, validade: null, notas: null },
  ];
  const avisos = avisosDeDocumentosParaHoje(docs, id => (id === "p1" ? "Ana" : "?"), HOJE);
  assert.deepEqual(avisos.map(a => a.texto), [
    "CNH de Ana: venceu em 10/11/2026 (há 5 dias).",
    "Outro (Alvará da sede): vence em 5 dias (20/11/2026).",
    "Certidão negativa: vence em 12 dias (27/11/2026).",
  ]);
  assert.ok(avisos.every(a => a.href === "/producoes/documentos" && a.rotulo === "Documento"));
  assert.deepEqual(avisosDeDocumentosParaHoje([], () => "", HOJE), []);
});
