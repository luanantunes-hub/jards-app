// Baixa os municípios do Brasil com código do IBGE e coordenadas da sede e
// grava public/dados/municipios.json, que o local de realização e as
// evidências usam (P3.2). Fonte: kelvins/municipios-brasileiros (licença MIT),
// que reúne os códigos do IBGE e as coordenadas. O arquivo fica no
// repositório: o app não depende da fonte no ar.
//
// Uso: npx tsx scripts/prestacao-gerar-municipios.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { lerCsvMunicipios } from "../lib/prestacao/municipios";

const BASE = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv";
const SAIDA = "public/dados/municipios.json";

async function baixar(url: string): Promise<string> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`);
  return resposta.text();
}

async function gerar() {
  const [municipios, estados] = await Promise.all([baixar(`${BASE}/municipios.csv`), baixar(`${BASE}/estados.csv`)]);
  const tabela = lerCsvMunicipios(municipios, estados, "github.com/kelvins/municipios-brasileiros (MIT)", new Date().toISOString().slice(0, 10));
  if (tabela.municipios.length < 5560) throw new Error(`Só ${tabela.municipios.length} municípios; o Brasil tem 5.570`);
  // Coordenadas com 4 casas (cerca de 11 m): basta para a conferência e deixa o arquivo menor.
  const compacto = { ...tabela, municipios: tabela.municipios.map(([c, n, uf, lat, lon]) => [c, n, uf, Number(lat.toFixed(4)), Number(lon.toFixed(4))]) };
  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, JSON.stringify(compacto));
  console.log(`${tabela.municipios.length} municípios em ${SAIDA}`);
}

gerar().catch(erro => {
  console.error(erro);
  process.exit(1);
});
