import assert from "node:assert/strict";
import test from "node:test";
import { itemDoAcertoDaDiferenca, compararRiderComSala, resumoDaComparacao } from "../lib/producao/rider-ficha";

const pedido = { palcoLarguraMinM: 10, palcoProfundidadeMinM: 6, canais: 16, cargaW: 12000 };

test("a boca de cena que não cabe diz quanto falta", () => {
  const [boca] = compararRiderComSala(pedido, { palco_boca_m: 8, palco_profundidade_m: 7, som_canais_entrada: 24, energia_kva: 30 });
  assert.equal(boca.chave, "boca");
  assert.equal(boca.situacao, "nao_atende");
  assert.equal(boca.texto, "O cenário pede 10 m de boca de cena; a sala tem 8 m, faltam 2 m.");
});

test("tudo o que cabe atende; medida de trena com 5 cm de folga não reprova", () => {
  const itens = compararRiderComSala(pedido, { palco_boca_m: 9.96, palco_profundidade_m: 6, som_canais_entrada: 16, energia_kva: 12 });
  assert.deepEqual(itens.map(item => item.situacao), ["atende", "atende", "atende", "atende"]);
});

test("o que a ficha não preencheu fica sem dado, não reprovado", () => {
  const itens = compararRiderComSala(pedido, { palco_boca_m: 12 });
  assert.deepEqual(itens.map(item => [item.chave, item.situacao]), [["boca", "atende"], ["profundidade", "sem_dado"], ["canais", "sem_dado"], ["energia", "sem_dado"]]);
  assert.equal(itens[1].tem, null);
  const semFicha = compararRiderComSala(pedido, null);
  assert.ok(semFicha.every(item => item.situacao === "sem_dado"));
});

test("só entra o que o rider pede", () => {
  const itens = compararRiderComSala({ palcoLarguraMinM: null, palcoProfundidadeMinM: 5, canais: 0, cargaW: null }, { palco_profundidade_m: 4 });
  assert.deepEqual(itens.map(item => item.chave), ["profundidade"]);
  assert.deepEqual(compararRiderComSala({ palcoLarguraMinM: null, palcoProfundidadeMinM: null, canais: null, cargaW: null }, {}), []);
});

test("canais e energia: faltam canais; energia em kVA com a conta de 1 kVA = 1.000 W", () => {
  const itens = compararRiderComSala({ palcoLarguraMinM: null, palcoProfundidadeMinM: null, canais: 24, cargaW: 12500 }, { som_canais_entrada: 16, energia_kva: 10 });
  assert.equal(itens[0].texto, "O cenário usa 24 canais; a mesa da sala tem 16, faltam 8.");
  assert.equal(itens[1].pede, "12,5 kVA");
  assert.equal(itens[1].situacao, "nao_atende");
});

test("o resumo conta o que atende, o que não atende e o que falta na ficha", () => {
  assert.equal(resumoDaComparacao(compararRiderComSala(pedido, { palco_boca_m: 8, palco_profundidade_m: 7, som_canais_entrada: 24 })), "2 de 4 itens atendidos, 1 não atende, 1 sem dado na ficha.");
  assert.equal(resumoDaComparacao([]), "O rider não pede medida, canal nem energia para comparar.");
  assert.equal(resumoDaComparacao(compararRiderComSala({ palcoLarguraMinM: 4, palcoProfundidadeMinM: null, canais: null, cargaW: null }, { palco_boca_m: 5 })), "1 de 1 item atendido.");
});

test("a diferença vira item do acerto: o número que a casa confirma, com a frase como ajuda e o que a ficha tem como valor atual", () => {
  const itens = compararRiderComSala({ palcoLarguraMinM: 10, palcoProfundidadeMinM: 6, canais: 24, cargaW: 18000 }, { palco_boca_m: 8, palco_profundidade_m: 7, som_canais_entrada: null, energia_kva: 12 });
  const porChave = new Map(itens.map(item => [item.chave, item]));
  const boca = itemDoAcertoDaDiferenca(porChave.get("boca")!, { palco_boca_m: 8 });
  assert.deepEqual(boca, {
    chave: "pedido_boca", secao: "O que o espetáculo pede", rotulo: "Boca de cena da sala (m)", tipo: "numero", opcoes: [], destino: "sala_palco_boca_m", visibilidade: "obrigatorio",
    ajuda: porChave.get("boca")!.texto, valor_atual: "8",
  });
  const canais = itemDoAcertoDaDiferenca(porChave.get("canais")!, { som_canais_entrada: null });
  assert.equal(canais?.destino, "sala_som_canais_entrada");
  assert.equal(canais?.valor_atual, null, "ficha sem dado: nenhum valor atual");
  const energia = itemDoAcertoDaDiferenca(porChave.get("energia")!, { energia_kva: 12 });
  assert.equal(energia?.destino, "sala_energia_kva");
  assert.equal(energia?.valor_atual, "12");
});

test("o que atende não vira pergunta, e cada diferença tem uma chave própria que cabe nas regras do banco", () => {
  const itens = compararRiderComSala({ palcoLarguraMinM: 10, palcoProfundidadeMinM: 6, canais: 24, cargaW: 18000 }, { palco_boca_m: 12, palco_profundidade_m: 3, som_canais_entrada: 32, energia_kva: 5 });
  const itensDoAcerto = itens.map(item => itemDoAcertoDaDiferenca(item, null));
  assert.equal(itensDoAcerto.find(item => item?.chave === "pedido_boca"), undefined, "a boca de cena atende");
  const chaves = itensDoAcerto.filter((item): item is NonNullable<typeof item> => item !== null).map(item => item.chave);
  assert.deepEqual(chaves.sort(), ["pedido_energia", "pedido_profundidade"]);
  for (const chave of chaves) assert.match(chave, /^[a-z0-9_]{1,40}$/);
  assert.equal(new Set(chaves).size, chaves.length);
});

test("a ajuda do item não passa de 300 letras, como o banco exige", () => {
  const longo = { chave: "boca" as const, rotulo: "Boca de cena", pede: "10 m", tem: "8 m", situacao: "nao_atende" as const, texto: "x".repeat(400) };
  const item = itemDoAcertoDaDiferenca(longo, { palco_boca_m: 8 });
  assert.equal(item?.ajuda.length, 300);
  assert.ok(item?.ajuda.endsWith("..."));
});
