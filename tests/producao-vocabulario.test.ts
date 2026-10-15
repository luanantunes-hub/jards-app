import assert from "node:assert/strict";
import test from "node:test";
import { paineisDaData, type ContextoDaData } from "../lib/producao/porte";
import {
  duracaoDoModelo,
  ROTULO_DO_FORMATO,
  rotuloNovo,
  TIPOS_DE_PRODUCAO,
  tipoDeProducao,
  vocabularioDe,
} from "../lib/producao/vocabulario";

test("catálogo amplo: ninguém fica de fora", () => {
  const ids = TIPOS_DE_PRODUCAO.map(tipo => tipo.id);
  for (const id of ["show", "teatro", "danca", "circo", "concerto", "rua", "exposicao", "festival", "literatura", "audiovisual", "formacao", "educativo", "outro"]) {
    assert.ok(ids.includes(id as never), id);
  }
  assert.equal(new Set(ids).size, ids.length, "tipo repetido");
});

test("todo tipo tem todos os termos, formatos e ao menos um modelo de dia", () => {
  for (const tipo of TIPOS_DE_PRODUCAO) {
    for (const [nome, termo] of Object.entries(tipo.vocabulario)) {
      assert.ok(termo.singular.trim() && termo.plural.trim(), `${tipo.id}.${nome}`);
      assert.ok(termo.genero === "m" || termo.genero === "f", `${tipo.id}.${nome}`);
      // "Atividade" já é a tarefa do Jards e a realização da prestação.
      assert.doesNotMatch(termo.singular, /atividade/i, `${tipo.id}.${nome}`);
    }
    assert.ok(tipo.formatos.length > 0, tipo.id);
    for (const formato of tipo.formatos) assert.ok(ROTULO_DO_FORMATO[formato], `${tipo.id}: ${formato}`);
    assert.ok(tipo.modelosDia.length > 0, tipo.id);
    for (const modelo of tipo.modelosDia) {
      assert.ok(modelo.blocos.length > 0, modelo.id);
      for (const bloco of modelo.blocos) assert.ok(bloco.duracaoMin > 0 && bloco.titulo.trim(), `${modelo.id}: ${bloco.titulo}`);
      // Nenhum dia sugerido passa de 24 horas: dia mais longo vira mais de uma data.
      assert.ok(duracaoDoModelo(modelo) <= 24 * 60, modelo.id);
    }
    assert.ok(tipo.paineis.includes("dia") && tipo.paineis.includes("equipe"), tipo.id);
  }
});

test("ids de modelo de dia são únicos no catálogo", () => {
  const ids = TIPOS_DE_PRODUCAO.flatMap(tipo => tipo.modelosDia.map(modelo => modelo.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("o vocabulário muda com o tipo, e o rótulo de criar concorda em gênero", () => {
  assert.equal(vocabularioDe("show").temporada.singular, "Turnê");
  assert.equal(vocabularioDe("audiovisual").data.singular, "Diária");
  assert.equal(vocabularioDe("formacao").temporada.singular, "Turma");
  assert.equal(vocabularioDe("exposicao").sessao.singular, "Visitação");
  assert.equal(rotuloNovo(vocabularioDe("show").obra), "Novo show");
  assert.equal(rotuloNovo(vocabularioDe("show").temporada), "Nova turnê");
  assert.equal(rotuloNovo(vocabularioDe("teatro").data), "Nova apresentação");
});

test("tipo desconhecido cai em \"outro\"", () => {
  assert.equal(tipoDeProducao("inexistente" as never).id, "outro");
});

test("o primeiro formato é o padrão de cada lado", () => {
  assert.equal(tipoDeProducao("show").formatos[0], "turne");
  assert.equal(tipoDeProducao("festival").formatos[0], "edicao");
  assert.equal(tipoDeProducao("exposicao").formatos[0], "itinerancia");
  assert.equal(tipoDeProducao("formacao").formatos[0], "turma");
});

const BASE: ContextoDaData = {
  tipo: "show",
  alguemViaja: false,
  temCotaDeConvidados: false,
  podeVerDinheiro: false,
  recebidaPorOutroEspaco: false,
};

test("porte progressivo: só aparece o que se aplica", () => {
  assert.deepEqual(paineisDaData(BASE), ["dia", "equipe", "palco"]);
  const turne = paineisDaData({ ...BASE, alguemViaja: true, recebidaPorOutroEspaco: true });
  assert.ok(turne.includes("viagem") && turne.includes("hospedagem") && turne.includes("acerto"));
  assert.ok(paineisDaData({ ...BASE, temCotaDeConvidados: true }).includes("convidados"));
});

test("dinheiro só com permissão, mesmo quando já tem conteúdo", () => {
  assert.ok(!paineisDaData({ ...BASE, comConteudo: ["dinheiro", "bordero"] }).includes("dinheiro"));
  const comPermissao = paineisDaData({ ...BASE, podeVerDinheiro: true });
  assert.ok(comPermissao.includes("dinheiro") && comPermissao.includes("bordero"));
});

test("painel com conteúdo não some, e o essencial vem primeiro", () => {
  assert.ok(paineisDaData({ ...BASE, comConteudo: ["hospedagem"] }).includes("hospedagem"));
  for (const tipo of TIPOS_DE_PRODUCAO) {
    const paineis = paineisDaData({ ...BASE, tipo: tipo.id });
    assert.deepEqual(paineis.slice(0, 2), ["dia", "equipe"], tipo.id);
  }
});

test("exposição mostra obras e visitação; formação não mostra palco", () => {
  const exposicao = paineisDaData({ ...BASE, tipo: "exposicao" });
  assert.ok(exposicao.includes("obras") && exposicao.includes("visitacao"));
  assert.ok(!paineisDaData({ ...BASE, tipo: "formacao" }).includes("palco"));
});
