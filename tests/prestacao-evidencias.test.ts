import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import exifr from "exifr";
import { type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarEvidencias } from "../lib/prestacao/checagens/checar-evidencias";
import {
  dadosDaFoto,
  dataDoExif,
  periodoDaAtividade,
  quandoFoiTirada,
  somarDias,
  tipoPeloArquivo,
  type EvidenciaParaChecar,
} from "../lib/prestacao/evidencias";
import { acharMunicipio, buscarMunicipios, distanciaKm, lerCsvMunicipios, type TabelaMunicipios } from "../lib/prestacao/municipios";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const SAO_PAULO = { latitude: -23.5329, longitude: -46.6395 };

async function lerFoto(arquivo: string) {
  const caminho = `tests/fixtures/objeto/${arquivo}`;
  const [cru, gps] = await Promise.all([
    exifr.parse(caminho, { reviveValues: false, pick: ["DateTimeOriginal", "CreateDate"] }),
    exifr.gps(caminho),
  ]);
  return dadosDaFoto(cru, gps);
}

test("foto: data da câmera e posição lidas do EXIF", async () => {
  assert.deepEqual(await lerFoto("foto-sao-paulo.jpg"), { capturadaEm: "2026-09-10T14:32:05", latitude: -23.5453, longitude: -46.6382 });
  const rio = await lerFoto("foto-rio.jpg");
  assert.equal(rio.capturadaEm, "2025-12-20T09:15:00");
  assert.ok(Math.abs(rio.latitude! + 22.9068) < 1e-6);

  assert.equal(dataDoExif("2026:09:10 14:32:05"), "2026-09-10T14:32:05");
  assert.equal(dataDoExif("0000:00:00 00:00:00"), null, "câmera sem relógio");
  assert.equal(dataDoExif(new Date()), null, "só o texto cru, sem o fuso do navegador");
  assert.deepEqual(dadosDaFoto(null, { latitude: 0, longitude: 0 }), { capturadaEm: null, latitude: null, longitude: null }, "0,0 é GPS sem sinal");
  assert.equal(quandoFoiTirada("2026-09-10T14:32:05"), "10/09/2026 às 14:32");
  assert.deepEqual(["foto.HEIC", "video.mov", "lista.pdf"].map(n => tipoPeloArquivo(null, n)), ["foto", "video", "outro"]);
});

test("municípios: tabela gerada, busca sem acento e distância", async () => {
  const tabela = JSON.parse(await readFile("public/dados/municipios.json", "utf8")) as TabelaMunicipios;
  assert.equal(tabela.licenca, "MIT");
  assert.ok(tabela.municipios.length >= 5570, "todos os municípios");
  assert.deepEqual(acharMunicipio(tabela, "SP", "sao paulo")?.slice(0, 3), ["3550308", "São Paulo", "SP"]);
  assert.equal(acharMunicipio(tabela, "RJ", "São Paulo"), null, "o nome vale dentro da UF");
  assert.equal(buscarMunicipios(tabela, "RJ", "nit")[0][1], "Niterói", "começa com o trecho primeiro");
  assert.ok(buscarMunicipios(tabela, "MG", "").length <= 50);

  const km = distanciaKm(SAO_PAULO, { latitude: -22.9068, longitude: -43.1729 });
  assert.ok(km > 350 && km < 365, `São Paulo–Rio: ${km}`);

  const lida = lerCsvMunicipios("codigo_ibge,nome,latitude,longitude,capital,codigo_uf\n3550308,São Paulo,-23.5329,-46.6395,1,35", "﻿codigo_uf,uf,nome\n35,SP,São Paulo", "teste", "2026-10-07");
  assert.deepEqual(lida.municipios, [["3550308", "São Paulo", "SP", -23.5329, -46.6395]]);
  assert.throws(() => lerCsvMunicipios("codigo_ibge,nome,latitude,longitude,capital,codigo_uf\n123,X,0,0,0,35", "codigo_uf,uf\n35,SP", "t", "d"));
});

test("período da atividade e soma de dias", () => {
  assert.deepEqual(periodoDaAtividade({ data_realizacao: "2026-09-10" }), { inicio: "2026-09-10", fim: "2026-09-10" });
  assert.deepEqual(periodoDaAtividade({ data_realizacao: "2026-09-10", data_inicio: "2026-09-08", data_fim: "2026-09-12" }), { inicio: "2026-09-08", fim: "2026-09-12" });
  assert.equal(somarDias("2026-02-28", 1), "2026-03-01");
  assert.equal(somarDias("2026-01-01", -1), "2025-12-31");
});

const evidencia = (campos: Partial<EvidenciaParaChecar>): EvidenciaParaChecar => ({
  id: "e1", tipo: "foto", nome_arquivo: "oficina.jpg", url: null, atividade_id: "a1", meta_id: null, local_id: null,
  capturada_em: "2026-09-10T14:32:05", latitude: -23.5453, longitude: -46.6382, justificativa: null, ...campos,
});
const estado = (campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  prestacao: { data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-12-31" },
  atividades: [{ id: "a1", titulo: "Oficina na escola", data_realizacao: "2026-09-10", data_inicio: null, data_fim: null, local_id: "l1" }],
  locais: [{ id: "l1", pais: "Brasil", uf: "SP", municipio: "São Paulo", status: "realizado", ...SAO_PAULO }],
  ...campos,
});

test("evidência certa: ligada, na data da atividade e perto do local", () => {
  assert.deepEqual(checarEvidencias(estado({ evidencias: [evidencia({})] })), []);
  assert.deepEqual(checarEvidencias(estado({ evidencias: [evidencia({ capturada_em: "2026-09-11T00:40:00" })] })), [], "um dia de tolerância");
  assert.deepEqual(checarEvidencias(estado({ evidencias: [evidencia({ capturada_em: null, latitude: null, longitude: null })] })), [], "sem EXIF não há o que conferir");
});

test("evidência fora: sem vínculo, fora do período, em outra data e longe do local", () => {
  const achados = checarEvidencias(estado({
    evidencias: [
      evidencia({ id: "solta", atividade_id: null, capturada_em: null, latitude: null, longitude: null }),
      evidencia({ id: "antes", capturada_em: "2026-02-20T10:00:00", justificativa: "Ensaio aberto antes da estreia." }),
      evidencia({ id: "rio", latitude: -22.9068, longitude: -43.1729 }),
      evidencia({ id: "local-proprio", atividade_id: null, local_id: "l1", latitude: -22.9068, longitude: -43.1729 }),
    ],
  }));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade, a.justificativa]), [
    ["EVIDENCIA_SEM_VINCULO:evidencia:solta", "alerta", null],
    ["EVIDENCIA_FORA_DO_PERIODO:evidencia:antes", "alerta", "Ensaio aberto antes da estreia."],
    ["EVIDENCIA_FORA_DA_ATIVIDADE:evidencia:antes", "alerta", "Ensaio aberto antes da estreia."],
    ["EVIDENCIA_LONGE_DO_LOCAL:evidencia:rio", "alerta", null],
    ["EVIDENCIA_LONGE_DO_LOCAL:evidencia:local-proprio", "alerta", null],
  ]);
  assert.match(achados[1].mensagem, /antes do início da execução \(01\/03\/2026\)/);
  assert.match(achados[2].mensagem, /atividade "Oficina na escola" é de 10\/09\/2026/);
  assert.match(achados[3].mensagem, /a 36\d km de São Paulo\/SP/);
  assert.equal(achados[3].fonte?.regra?.codigo, "evidencias");
});

test("local sem coordenadas não gera alerta de distância", () => {
  const semCoordenadas = estado({
    locais: [{ id: "l1", pais: "Brasil", uf: "SP", municipio: "São Paulo", status: "realizado", latitude: null, longitude: null }],
    evidencias: [evidencia({ latitude: -22.9068, longitude: -43.1729 })],
  });
  assert.deepEqual(checarEvidencias(semCoordenadas), []);
});
