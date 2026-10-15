import assert from "node:assert/strict";
import test from "node:test";
import { ORDEM_DOS_PAINEIS, paineisDaData, paineisParaLigar, type ContextoDaData } from "../lib/producao/porte";
import {
  duracaoDoModelo,
  MODELOS_DE_ESTRADA,
  modelosDeDia,
  ROTULO_DO_FORMATO,
  ROTULO_DO_PAINEL,
  rotuloDoPainel,
  rotuloNovo,
  TIPOS_DE_PRODUCAO,
  tipoDeProducao,
  vocabularioDe,
} from "../lib/producao/vocabulario";

test("catálogo amplo: ninguém fica de fora", () => {
  const ids = TIPOS_DE_PRODUCAO.map(tipo => tipo.id);
  for (const id of ["show", "teatro", "danca", "circo", "concerto", "opera", "rua", "exposicao", "festival", "literatura", "audiovisual", "formacao", "educativo", "outro"]) {
    assert.ok(ids.includes(id as never), id);
  }
  assert.equal(new Set(ids).size, ids.length, "tipo repetido");
});

test("em todo tipo e formato, os termos existem, têm gênero e não se repetem entre níveis", () => {
  for (const tipo of TIPOS_DE_PRODUCAO) {
    assert.ok(tipo.formatos.length > 0, tipo.id);
    for (const formato of tipo.formatos) {
      assert.ok(ROTULO_DO_FORMATO[formato], `${tipo.id}: ${formato}`);
      const v = vocabularioDe(tipo.id, formato);
      for (const [nome, termo] of Object.entries(v)) {
        assert.ok(termo.singular.trim() && termo.plural.trim(), `${tipo.id}/${formato}.${nome}`);
        assert.ok(termo.genero === "m" || termo.genero === "f", `${tipo.id}/${formato}.${nome}`);
        // "Atividade" já é a tarefa do Jards e a realização da prestação.
        assert.doesNotMatch(termo.singular, /atividade/i, `${tipo.id}/${formato}.${nome}`);
      }
      // Obra, temporada, data e sessão com o mesmo nome deixariam dois botões "Novo show".
      const niveis = [v.obra, v.temporada, v.data, v.sessao].map(t => t.singular);
      assert.equal(new Set(niveis).size, niveis.length, `${tipo.id}/${formato}: ${niveis.join(", ")}`);
    }
  }
});

test("modelos de dia: blocos plausíveis, refeição nos dias longos, folga sem blocos", () => {
  const ids: string[] = [];
  for (const tipo of TIPOS_DE_PRODUCAO) {
    const modelos = modelosDeDia(tipo.id);
    assert.ok(modelos.length > 0, tipo.id);
    for (const modelo of modelos) {
      ids.push(modelo.id);
      if (modelo.tipoData === "folga") { assert.equal(modelo.blocos.length, 0); continue; }
      assert.ok(modelo.blocos.length > 0, modelo.id);
      for (const bloco of modelo.blocos) assert.ok(bloco.duracaoMin > 0 && bloco.titulo.trim(), `${modelo.id}: ${bloco.titulo}`);
      const total = duracaoDoModelo(modelo);
      assert.ok(total <= 24 * 60, modelo.id);
      // Mais de 8 horas de trabalho seguidas pedem uma pausa no roteiro.
      if (total > 8 * 60 && modelo.tipoData !== "viagem") {
        assert.ok(modelo.blocos.some(b => b.tipo === "refeicao" || b.tipo === "intervalo"), `${modelo.id} sem pausa`);
      }
    }
  }
  const unicos = new Set(TIPOS_DE_PRODUCAO.flatMap(tipo => tipo.modelosDia.map(m => m.id)));
  assert.equal(unicos.size, TIPOS_DE_PRODUCAO.flatMap(tipo => tipo.modelosDia).length, "id de modelo repetido");
  assert.ok(ids.length > 0);
});

test("quem circula ganha o dia de viagem e a folga; quem não circula, não", () => {
  for (const id of ["show", "teatro", "rua", "exposicao", "formacao", "audiovisual"] as const) {
    const nomes = modelosDeDia(id).map(m => m.id);
    for (const estrada of MODELOS_DE_ESTRADA) assert.ok(nomes.includes(estrada.id), `${id}: ${estrada.id}`);
  }
  for (const id of ["festival", "educativo"] as const) {
    assert.ok(!modelosDeDia(id).some(m => m.tipoData === "folga"), id);
  }
});

test("o nome da temporada vem do formato, e alguns tipos trocam nomes com ele", () => {
  assert.equal(vocabularioDe("show").temporada.singular, "Turnê");
  assert.equal(vocabularioDe("show", "temporada").temporada.singular, "Temporada");
  assert.equal(vocabularioDe("exposicao").temporada.singular, "Período expositivo");
  assert.equal(vocabularioDe("exposicao", "itinerancia").temporada.singular, "Itinerância");
  assert.equal(vocabularioDe("audiovisual").data.singular, "Diária");
  assert.equal(vocabularioDe("audiovisual", "circulacao").data.singular, "Exibição");
  assert.equal(vocabularioDe("rua", "ciclo").temporada.singular, "Ciclo");
  assert.equal(vocabularioDe("opera").data.singular, "Récita");
  // Formato que o tipo não tem cai no padrão do tipo.
  assert.equal(vocabularioDe("festival", "turne").temporada.singular, "Edição");
});

test("o rótulo de criar concorda em gênero", () => {
  assert.equal(rotuloNovo(vocabularioDe("show").obra), "Novo show");
  assert.equal(rotuloNovo(vocabularioDe("show").temporada), "Nova turnê");
  assert.equal(rotuloNovo(vocabularioDe("teatro").data), "Nova apresentação");
  assert.equal(rotuloNovo(vocabularioDe("audiovisual").temporada), "Novo período de filmagem");
});

test("rótulo de painel muda onde a palavra tem outro sentido", () => {
  assert.equal(rotuloDoPainel("literatura", "convidados"), "Cortesias");
  assert.equal(rotuloDoPainel("show", "convidados"), ROTULO_DO_PAINEL.convidados);
});

test("tipo desconhecido cai em \"outro\"", () => {
  assert.equal(tipoDeProducao("inexistente" as never).id, "outro");
});

const BASE: ContextoDaData = {
  tipo: "show",
  alguemViaja: false,
  temCotaDeConvidados: false,
  podeVerDinheiro: false,
  temOutraParte: false,
};

test("porte progressivo: o essencial sempre, o resto quando se aplica", () => {
  assert.deepEqual(paineisDaData(BASE), ["dia", "equipe", "palco", "publico"]);
  for (const tipo of TIPOS_DE_PRODUCAO) {
    assert.deepEqual(paineisDaData({ ...BASE, tipo: tipo.id }).slice(0, 2), ["dia", "equipe"], tipo.id);
  }
});

test("os sinais da data valem para qualquer tipo", () => {
  for (const tipo of TIPOS_DE_PRODUCAO) {
    const viaja = paineisDaData({ ...BASE, tipo: tipo.id, alguemViaja: true });
    assert.ok(viaja.includes("viagem") && viaja.includes("hospedagem"), `${tipo.id}: viagem`);
    assert.ok(paineisDaData({ ...BASE, tipo: tipo.id, temCotaDeConvidados: true }).includes("convidados"), `${tipo.id}: convidados`);
    assert.ok(paineisDaData({ ...BASE, tipo: tipo.id, temOutraParte: true }).includes("acerto"), `${tipo.id}: acerto`);
  }
  // O festival que recebe atrações também faz o acerto técnico.
  assert.ok(paineisDaData({ ...BASE, tipo: "festival", temOutraParte: true }).includes("acerto"));
});

test("painel com conteúdo ou ligado à mão não some, nem quando o tipo muda", () => {
  const formacao = paineisDaData({ ...BASE, tipo: "formacao", comConteudo: ["hospedagem", "viagem"] });
  assert.ok(formacao.includes("hospedagem") && formacao.includes("viagem"));
  assert.ok(paineisDaData({ ...BASE, tipo: "outro", escolhidos: ["convidados"] }).includes("convidados"));
  assert.ok(paineisDaData({ ...BASE, tipo: "rua", comConteudo: ["acerto"] }).includes("acerto"));
});

test("dinheiro e receita do borderô só com permissão; o público não depende dela", () => {
  const sem = paineisDaData({ ...BASE, comConteudo: ["dinheiro", "bordero"], escolhidos: ["dinheiro"] });
  assert.ok(!sem.includes("dinheiro") && !sem.includes("bordero"));
  assert.ok(sem.includes("publico"));
  const com = paineisDaData({ ...BASE, podeVerDinheiro: true });
  assert.ok(com.includes("dinheiro") && com.includes("bordero"));
  assert.ok(paineisDaData({ ...BASE, tipo: "exposicao", podeVerDinheiro: true }).includes("bordero"));
});

test("os painéis saem sempre na mesma ordem, e o que falta pode ser ligado", () => {
  const todos = paineisDaData({ ...BASE, alguemViaja: true, temCotaDeConvidados: true, temOutraParte: true, podeVerDinheiro: true });
  assert.deepEqual(todos, ORDEM_DOS_PAINEIS.filter(p => todos.includes(p)));
  const paraLigar = paineisParaLigar(BASE);
  assert.ok(paraLigar.includes("convidados") && paraLigar.includes("hospedagem"));
  assert.ok(!paraLigar.includes("dinheiro"), "sem permissão, o dinheiro não se liga à mão");
  for (const painel of paraLigar) assert.ok(!paineisDaData(BASE).includes(painel));
});
