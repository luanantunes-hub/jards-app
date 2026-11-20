import assert from "node:assert/strict";
import test from "node:test";
import { montarDiaDoModelo } from "../lib/producao/dia";
import { modelosDeDia, TIPOS_DE_PRODUCAO } from "../lib/producao/vocabulario";

// "Montar o dia" grava os blocos direto no banco. As regras de tabela de `producao_blocos`
// (migration producao_esqueleto) recusam o que não cabe nelas; aqui cada modelo de cada tipo de
// produção é montado em vários fusos e horas (inclusive os que viram a meia-noite) e conferido contra elas.
const FUSOS = ["America/Sao_Paulo", "America/Manaus", "America/Rio_Branco", "America/Noronha"];
const HORAS = ["00:30", "06:00", "14:00", "21:00", "23:45"];
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

test("Montar o dia: todo modelo, em qualquer fuso e hora, respeita as regras de tabela do bloco", () => {
  let conferidos = 0;
  for (const tipo of TIPOS_DE_PRODUCAO) {
    for (const modelo of modelosDeDia(tipo.id)) {
      for (const fuso of FUSOS) {
        for (const hora of HORAS) {
          const blocos = montarDiaDoModelo(modelo, "2027-03-14", hora, fuso);
          assert.equal(blocos.length, modelo.blocos.length);
          let fimAnterior = "";
          blocos.forEach((bloco, i) => {
            const onde = `${tipo.id} · ${modelo.nome} · ${fuso} ${hora} · bloco ${i}`;
            assert.ok(INSTANTE.test(bloco.inicio) && INSTANTE.test(bloco.fim), `${onde}: instante fora do formato`);
            // producao_blocos_periodo_check e producao_blocos_hora_check
            assert.ok(bloco.fim >= bloco.inicio, `${onde}: o fim vem antes do início`);
            assert.equal(bloco.exibicao, "exata", `${onde}: exibição`);
            // producao_blocos_tipo_check e producao_blocos_titulo_check
            assert.ok(bloco.tipo.trim().length >= 1 && bloco.tipo.trim().length <= 40, `${onde}: tipo fora de 1 a 40 letras`);
            assert.ok(bloco.titulo.trim().length >= 1 && bloco.titulo.trim().length <= 200, `${onde}: título fora de 1 a 200 letras`);
            assert.equal(bloco.ordem, i, `${onde}: ordem`);
            if (fimAnterior) assert.equal(bloco.inicio, fimAnterior, `${onde}: não começa onde o anterior termina`);
            fimAnterior = bloco.fim;
            conferidos++;
          });
        }
      }
    }
  }
  assert.ok(conferidos > 1000, "o teste não percorreu os modelos");
});
