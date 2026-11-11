import assert from "node:assert/strict";
import test from "node:test";
import { lerDocumentoDoVeiculo, lerVeiculo, normalizarPlaca, placaParaExibir, resumoDosDocumentos, situacaoDoDocumento, type CamposDoVeiculo } from "../lib/producao/veiculos";

const base: CamposDoVeiculo = {
  nome: "Van da produção", placa: "", modelo: "", ano: "", categoria: "van", combustivel: "diesel_s10", contratacao: "proprio", fornecedor: "",
  consumo: "", carga: "", volume: "", lugares: "", notas: "",
};

test("placa: maiúsculas, sem hífen nem espaço; a antiga ganha hífen para mostrar", () => {
  assert.equal(normalizarPlaca(" abc-1d23 "), "ABC1D23");
  assert.equal(placaParaExibir("ABC1234"), "ABC-1234");
  assert.equal(placaParaExibir("ABC1D23"), "ABC1D23");
  assert.equal(placaParaExibir(null), "");
});

test("veículo: o mínimo é o nome; números com vírgula; fornecedor só fora do próprio", () => {
  const minimo = lerVeiculo(base);
  assert.ok(minimo.ok);
  assert.equal(minimo.ok && minimo.veiculo.placa, null);
  const completo = lerVeiculo({ ...base, placa: "abc-1234", ano: "2021", consumo: "9,5", carga: "1200", volume: "11,5", lugares: "15", contratacao: "locado", fornecedor: " Locadora Sul " });
  assert.ok(completo.ok);
  if (completo.ok) {
    assert.equal(completo.veiculo.placa, "ABC1234");
    assert.equal(completo.veiculo.consumo_km_por_litro, 9.5);
    assert.equal(completo.veiculo.capacidade_volume_m3, 11.5);
    assert.equal(completo.veiculo.fornecedor, "Locadora Sul");
  }
  const proprio = lerVeiculo({ ...base, fornecedor: "Locadora" });
  assert.equal(proprio.ok && proprio.veiculo.fornecedor, null, "o fornecedor de um veículo próprio é descartado, como o banco exige");
});

test("veículo: recusa o que o banco recusaria, com texto pronto", () => {
  const erro = (campos: Partial<CamposDoVeiculo>) => { const leitura = lerVeiculo({ ...base, ...campos }); return leitura.ok ? null : leitura.erro; };
  assert.match(erro({ nome: "  " }) ?? "", /nome/);
  assert.match(erro({ placa: "12" }) ?? "", /placa/);
  assert.match(erro({ ano: "1900" }) ?? "", /ano/);
  assert.match(erro({ ano: "2021,5" }) ?? "", /ano/);
  assert.match(erro({ consumo: "0" }) ?? "", /consumo/);
  assert.match(erro({ consumo: "100" }) ?? "", /consumo/);
  assert.match(erro({ lugares: "0" }) ?? "", /lugares/i);
  assert.match(erro({ categoria: "foguete" }) ?? "", /tipo/);
  assert.match(erro({ combustivel: "agua" }) ?? "", /combustível/);
  assert.match(erro({ contratacao: "emprestado" }) ?? "", /próprio|locado/);
  assert.match(erro({ carga: "abc" }) ?? "", /carga/);
});

test("documento: tipo da lista, validade em data, textos dentro do limite", () => {
  const bom = lerDocumentoDoVeiculo({ tipo: "seguro", numero: " AP-1 ", validade: "2026-12-31", observacoes: "" });
  assert.ok(bom.ok);
  assert.equal(bom.ok && bom.documento.numero, "AP-1");
  assert.equal(bom.ok && bom.documento.observacoes, null);
  assert.ok(!lerDocumentoDoVeiculo({ tipo: "rg", numero: "", validade: "", observacoes: "" }).ok);
  assert.ok(!lerDocumentoDoVeiculo({ tipo: "antt", numero: "", validade: "31/12/2026", observacoes: "" }).ok);
  assert.ok(!lerDocumentoDoVeiculo({ tipo: "antt", numero: "x".repeat(101), validade: "", observacoes: "" }).ok);
  assert.ok(lerDocumentoDoVeiculo({ tipo: "outro", numero: "", validade: "", observacoes: "" }).ok, "o documento sem validade é aceito");
});

test("situação do documento: vencido, vence em 30 dias (hoje incluído), em dia, sem validade", () => {
  const hoje = "2026-11-10";
  assert.equal(situacaoDoDocumento(null, hoje), "sem_validade");
  assert.equal(situacaoDoDocumento("2026-11-09", hoje), "vencido");
  assert.equal(situacaoDoDocumento("2026-11-10", hoje), "vence_em_breve");
  assert.equal(situacaoDoDocumento("2026-12-10", hoje), "vence_em_breve");
  assert.equal(situacaoDoDocumento("2026-12-11", hoje), "em_dia");
});

test("resumo: conta vencidos e os que vencem em breve e aponta o mais antigo", () => {
  const hoje = "2026-11-10";
  const resumo = resumoDosDocumentos([
    { tipo: "seguro", validade: "2026-11-20" }, { tipo: "antt", validade: "2026-10-01" }, { tipo: "vistoria", validade: "2027-06-01" },
    { tipo: "outro", validade: null }, { tipo: "documento_do_veiculo", validade: "2026-09-01" },
  ], hoje);
  assert.equal(resumo.vencidos, 2);
  assert.equal(resumo.vencemEmBreve, 1);
  assert.equal(resumo.proximo?.tipo, "documento_do_veiculo");
  assert.deepEqual(resumoDosDocumentos([], hoje), { vencidos: 0, vencemEmBreve: 0, proximo: null });
});
