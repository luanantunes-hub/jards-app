// Baixa as subclasses da CNAE 2.3 do IBGE e grava public/dados/cnae-subclasses.json,
// que a tela do orçamento carrega quando a pessoa escolhe os CNAEs aceitos de
// um item (P2.4). O arquivo fica no repositório: o app não depende do IBGE no ar.
//
// Uso: npx tsx scripts/prestacao-gerar-cnae.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { lerTabelaIbge } from "../lib/prestacao/cnae";

const URL_IBGE = "https://servicodados.ibge.gov.br/api/v2/cnae/subclasses";
const SAIDA = "public/dados/cnae-subclasses.json";

async function gerar() {
  const resposta = await fetch(URL_IBGE, { headers: { Accept: "application/json" } });
  if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status}`);
  const tabela = lerTabelaIbge(await resposta.json(), URL_IBGE, new Date().toISOString().slice(0, 10));
  if (tabela.subclasses.length < 1300) throw new Error(`Só ${tabela.subclasses.length} subclasses; a CNAE 2.3 tem 1.332`);

  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, JSON.stringify(tabela));
  console.log(`${tabela.subclasses.length} subclasses e ${Object.keys(tabela.niveis).length} divisões, grupos e classes em ${SAIDA}`);
}

gerar().catch(erro => {
  console.error(erro);
  process.exit(1);
});
