import assert from "node:assert/strict";
import test from "node:test";
import {
  chaveParaCampo, itemEditavel, lerCampo, lerModelo, lerRespondente, lerRespostas, lerValorDoCampo, MODELO_PADRAO, MODELOS_PRONTOS, resumoDaRevisao, type ItemDoAcerto,
} from "../lib/producao/acerto";
import { DESTINOS_DO_ACERTO } from "../lib/producao/estados";
import { DESTINO_DO_ACERTO } from "../lib/producao/acerto";

const campo = { chave: "boca", secao: "Palco", rotulo: "Boca de cena (m)", tipo: "numero", opcoes: [], destino: "sala_palco_boca_m", visibilidade: "obrigatorio", ajuda: "" };

const item = (extra: Partial<ItemDoAcerto>): ItemDoAcerto => ({
  id: "i1", chave: "boca", secao: "Palco", rotulo: "Boca", tipo: "numero", opcoes: [], destino: "livre", visibilidade: "obrigatorio", ajuda: "",
  situacao: "pendente", valor_atual: null, resposta: null, motivo: null, ...extra,
});

test("o modelo padrão é válido, e todo destino da lista tem rótulo e regra", () => {
  const leitura = lerModelo(MODELO_PADRAO.nome, MODELO_PADRAO.campos);
  assert.equal(leitura.ok, true, leitura.ok ? "" : leitura.erro);
  assert.deepEqual(Object.keys(DESTINO_DO_ACERTO).sort(), [...DESTINOS_DO_ACERTO].sort());
});

test("o campo lido tem o formato que o banco guarda; destino pede o tipo certo", () => {
  assert.deepEqual(lerCampo(campo), { ok: true, campo: { ...campo, opcoes: [] } });
  assert.equal(lerCampo({ ...campo, tipo: "texto" }).ok, false, "a boca de cena da ficha é número");
  assert.equal(lerCampo({ ...campo, destino: "espaco_carga_descarga" }).ok, false, "a carga e descarga da ficha é texto");
  assert.equal(lerCampo({ ...campo, chave: "Boca" }).ok, false);
  assert.equal(lerCampo({ ...campo, rotulo: " " }).ok, false);
  assert.equal(lerCampo({ ...campo, visibilidade: "segredo" }).ok, false);
  assert.equal(lerCampo({ ...campo, tipo: "escolha", destino: "livre", opcoes: ["a"] }).ok, false, "escolha pede de 2 a 12 opções");
  assert.equal(lerCampo({ ...campo, tipo: "escolha", destino: "livre", opcoes: ["a", "a"] }).ok, false);
  assert.equal(lerCampo({ ...campo, tipo: "escolha", destino: "livre", opcoes: [" a ", "b"] }).ok, true);
});

test("o modelo: nome, de 1 a 80 campos e chaves que não se repetem", () => {
  assert.equal(lerModelo(" ", [campo]).ok, false);
  assert.equal(lerModelo("M", []).ok, false);
  assert.equal(lerModelo("M", [campo, campo]).ok, false);
  const erro = lerModelo("M", [campo, { ...campo, chave: "x", rotulo: "" }]);
  assert.equal(!erro.ok && erro.erro.startsWith("Campo 2:"), true);
});

test("o valor digitado vale pelo tipo: número com vírgula, faixa da ficha, inteiro, escolha, sim ou não, data e hora", () => {
  const boca = { tipo: "numero" as const, opcoes: [], destino: "sala_palco_boca_m" as const };
  assert.deepEqual(lerValorDoCampo(boca, "10,5"), { ok: true, valor: "10.5" });
  assert.deepEqual(lerValorDoCampo(boca, ""), { ok: true, valor: "" });
  assert.equal(lerValorDoCampo(boca, "201").ok, false);
  assert.equal(lerValorDoCampo(boca, "dez").ok, false);
  assert.equal(lerValorDoCampo(boca, "1e5").ok, false);
  assert.equal(lerValorDoCampo({ ...boca, destino: "sala_som_canais_entrada" }, "16.5").ok, false, "canais são inteiros");
  assert.deepEqual(lerValorDoCampo({ ...boca, destino: "sala_energia_tensao_v" }, "220"), { ok: true, valor: "220" });
  assert.equal(lerValorDoCampo({ ...boca, destino: "sala_energia_tensao_v" }, "50").ok, false, "a tensão fica entre 100 e 1.000 V");
  assert.equal(lerValorDoCampo({ tipo: "escolha", opcoes: ["a", "b"], destino: "livre" }, "c").ok, false);
  assert.deepEqual(lerValorDoCampo({ tipo: "sim_nao", opcoes: [], destino: "livre" }, "sim"), { ok: true, valor: "sim" });
  assert.equal(lerValorDoCampo({ tipo: "sim_nao", opcoes: [], destino: "livre" }, "talvez").ok, false);
  assert.equal(lerValorDoCampo({ tipo: "data", opcoes: [], destino: "livre" }, "2026-13-40").ok, false);
  assert.deepEqual(lerValorDoCampo({ tipo: "hora", opcoes: [], destino: "livre" }, "18:30"), { ok: true, valor: "18:30" });
  assert.equal(lerValorDoCampo({ tipo: "hora", opcoes: [], destino: "livre" }, "25:00").ok, false);
  assert.equal(lerValorDoCampo({ tipo: "texto", opcoes: [], destino: "livre" }, "x".repeat(2001)).ok, false);
});

test("só o que a casa pode preencher agora é editável: preencher e pendente ou recusado", () => {
  assert.equal(itemEditavel(item({})), true);
  assert.equal(itemEditavel(item({ situacao: "recusado" })), true);
  assert.equal(itemEditavel(item({ situacao: "respondido" })), false);
  assert.equal(itemEditavel(item({ situacao: "aprovado" })), false);
  assert.equal(itemEditavel(item({ visibilidade: "leitura", situacao: "aprovado" })), false);
  assert.equal(itemEditavel(item({ visibilidade: "oculto", situacao: "aprovado" })), false);
});

test("as respostas: ignora o que a casa não pode mudar, exige o obrigatório e devolve o erro de cada item", () => {
  const itens = [
    item({ id: "a", visibilidade: "obrigatorio" }), item({ id: "b", visibilidade: "opcional", chave: "b" }),
    item({ id: "c", visibilidade: "leitura", situacao: "aprovado", chave: "c" }), item({ id: "d", situacao: "aprovado", chave: "d" }),
  ];
  assert.deepEqual(lerRespostas(itens, { a: "10,5", c: "99", d: "7", intruso: "x" }), { ok: true, respostas: [{ id: "a", valor: "10.5" }] });
  assert.deepEqual(lerRespostas(itens, { b: "3" }), { ok: false, erros: { a: "Campo obrigatório." } });
  assert.deepEqual(lerRespostas(itens, { a: "dez", b: "3" }), { ok: false, erros: { a: "Informe um número." } });
  assert.deepEqual(lerRespostas(itens, { a: 12 }), { ok: true, respostas: [{ id: "a", valor: "12" }] });
});

test("quem responde: nome de 2 a 120 letras, e-mail opcional mas com cara de e-mail", () => {
  assert.deepEqual(lerRespondente(" Casa Teste ", ""), { ok: true, nome: "Casa Teste", email: null });
  assert.deepEqual(lerRespondente("Ana", " ana@casa.com.br "), { ok: true, nome: "Ana", email: "ana@casa.com.br" });
  assert.equal(lerRespondente("A", "").ok, false);
  assert.equal(lerRespondente(undefined, "").ok, false);
  assert.equal(lerRespondente("Ana", "sem-arroba").ok, false);
});

test("a chave do campo sai do nome e não repete", () => {
  assert.equal(chaveParaCampo("Boca de cena (m)", new Set()), "boca_de_cena_m");
  assert.equal(chaveParaCampo("Observações", new Set()), "observacoes");
  assert.equal(chaveParaCampo("Boca de cena (m)", new Set(["boca_de_cena_m"])), "boca_de_cena_m_2");
  assert.equal(chaveParaCampo("???", new Set()), "campo");
  assert.match(chaveParaCampo("a".repeat(80), new Set()), /^[a-z0-9_]{1,40}$/);
});

test("o resumo da revisão", () => {
  assert.equal(resumoDaRevisao([{ situacao: "respondido" }, { situacao: "aprovado" }, { situacao: "recusado" }]), "1 para revisar, 1 aprovados, 1 recusados.");
  assert.equal(resumoDaRevisao([{ situacao: "pendente" }]), "0 para revisar, 0 aprovados.");
});

test("modelos prontos: todos passam pela leitura do banco, com nomes e chaves que não se repetem, e o primeiro é o padrão", () => {
  assert.equal(MODELOS_PRONTOS[0].nome, MODELO_PADRAO.nome);
  assert.equal(new Set(MODELOS_PRONTOS.map(modelo => modelo.nome)).size, MODELOS_PRONTOS.length, "nomes únicos");
  assert.equal(new Set(MODELOS_PRONTOS.map(modelo => modelo.id)).size, MODELOS_PRONTOS.length, "ids únicos");
  for (const modelo of MODELOS_PRONTOS) {
    const leitura = lerModelo(modelo.nome, modelo.campos);
    assert.ok(leitura.ok, `${modelo.id}: ${leitura.ok ? "" : leitura.erro}`);
    assert.ok(modelo.campos.some(campo => campo.visibilidade === "obrigatorio"), `${modelo.id}: a casa precisa ter o que preencher`);
  }
  assert.ok(MODELOS_PRONTOS.some(modelo => modelo.id === "teatro") && MODELOS_PRONTOS.some(modelo => modelo.id === "exposicao"));
});

test("modelos prontos: o que alimenta a ficha continua nos modelos de palco, e a exposição só usa a carga e descarga", () => {
  const destinos = (id: string) => new Set(MODELOS_PRONTOS.find(modelo => modelo.id === id)?.campos.map(campo => campo.destino));
  for (const id of ["casa-recebe", "teatro", "show", "danca"]) assert.ok(destinos(id).has("sala_palco_boca_m") && destinos(id).has("sala_energia_kva"), id);
  const exposicao = destinos("exposicao");
  assert.ok(exposicao.has("espaco_carga_descarga") && !exposicao.has("sala_palco_boca_m"));
});
