import assert from "node:assert/strict";
import test from "node:test";
import { lerFichaDaSala, lerFichaDoEspaco, resumoDaFichaDaSala, type CamposDaSala, type CamposDoEspaco } from "../lib/producao/ficha";

const sala: CamposDaSala = {
  palcoBoca: "10,5", palcoProfundidade: "8", palcoAltura: "", palcoPiso: " Madeira ", somSistema: "Line array 2 x 8", somCanais: "32", luzDescricao: "", luzRefletores: "40",
  energiaKva: "30", energiaTensao: "220", energiaFases: "3", camarinsQuantidade: "2", camarinsCapacidade: "12", notas: "",
};
const espaco: CamposDoEspaco = { funcionamento: "Terça a domingo", acessibilidade: "", cargaDescarga: "Doca nos fundos", docaAltura: "1,2", veiculoMax: "12", contatoNome: " Ana ", contatoTelefone: "", contatoEmail: "ana@teatro.com", logo: "" };

test("a ficha da sala lida tem o formato do banco (vazio vira nulo)", () => {
  const leitura = lerFichaDaSala(sala);
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.ficha, {
    palco_boca_m: 10.5, palco_profundidade_m: 8, palco_altura_m: null, palco_piso: "Madeira", som_sistema: "Line array 2 x 8", som_canais_entrada: 32, luz_descricao: null, luz_refletores: 40,
    energia_kva: 30, energia_tensao_v: 220, energia_fases: 3, camarins_quantidade: 2, camarins_capacidade: 12, notas: null,
  });
});

test("o que o banco recusaria na ficha da sala a tela recusa antes", () => {
  for (const mudanca of [
    { palcoBoca: "201" }, { palcoAltura: "101" }, { palcoProfundidade: "abc" }, { somCanais: "257" }, { somCanais: "2,5" }, { luzRefletores: "5001" },
    { energiaTensao: "99" }, { energiaFases: "4" }, { energiaFases: "0" }, { energiaKva: "-1" }, { camarinsQuantidade: "101" }, { camarinsCapacidade: "1001" },
    { palcoPiso: "a".repeat(201) }, { somSistema: "a".repeat(501) }, { notas: "a".repeat(4001) },
  ]) assert.equal(lerFichaDaSala({ ...sala, ...mudanca }).ok, false, JSON.stringify(mudanca));
  assert.equal(lerFichaDaSala({ ...sala, palcoBoca: "", palcoProfundidade: "", somCanais: "", energiaFases: "" }).ok, true, "tudo é opcional");
});

test("a ficha do espaço lida e o que ela recusa", () => {
  const leitura = lerFichaDoEspaco(espaco);
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.ficha, { funcionamento: "Terça a domingo", acessibilidade: null, carga_descarga: "Doca nos fundos", doca_altura_m: 1.2, veiculo_max_m: 12, contato_nome: "Ana", contato_telefone: null, contato_email: "ana@teatro.com", logo_url: null });
  for (const mudanca of [{ docaAltura: "21" }, { veiculoMax: "41" }, { contatoEmail: "sem-arroba" }, { contatoTelefone: "1".repeat(41) }, { funcionamento: "a".repeat(2001) }, { contatoNome: "a".repeat(201) }, { logo: "http://casa.com.br/logo.png" }, { logo: "https://casa.com.br/logo.webp" }, { logo: `https://casa.com.br/${"a".repeat(500)}.png` }]) {
    assert.equal(lerFichaDoEspaco({ ...espaco, ...mudanca }).ok, false, JSON.stringify(mudanca));
  }
  for (const logo of ["https://casa.com.br/logo.png", "https://casa.com.br/logo.JPEG", "https://casa.com.br/a/b/logo.jpg"]) {
    const comLogo = lerFichaDoEspaco({ ...espaco, logo: ` ${logo} ` });
    assert.ok(comLogo.ok, logo);
    assert.equal(comLogo.ficha.logo_url, logo);
  }
});

test("o resumo traz só o que está preenchido, com as unidades", () => {
  const leitura = lerFichaDaSala(sala);
  assert.ok(leitura.ok);
  assert.deepEqual(resumoDaFichaDaSala(leitura.ficha), [
    "Palco: boca 10,5 m × profundidade 8 m × piso Madeira",
    "Som: Line array 2 x 8, 32 canais de entrada",
    "Luz: 40 refletores",
    "Energia: 30 kVA, 220 V, 3 fases",
    "Camarins: 2, até 12 pessoas",
  ]);
  assert.deepEqual(resumoDaFichaDaSala({}), []);
  assert.deepEqual(resumoDaFichaDaSala({ energia_fases: 1 }), ["Energia: 1 fase"]);
});
