// Carrega as mesorregiões e os municípios do IBGE no banco (tabelas mesorregioes_ibge e municipios_ibge) e recalcula
// a mesorregião de cada empresa (fn_empresas_recalcular_mesorregiao). Fonte: API de localidades do IBGE, que ainda
// publica as mesorregiões, aposentadas em 2017. Pode rodar de novo: faz upsert.
//
// Uso (a partir da raiz do repositório, com .env.local):
//   npx tsx scripts/importar-mesorregioes-ibge.ts          teste: baixa, confere e mostra; não grava
//   npx tsx scripts/importar-mesorregioes-ibge.ts --live   grava
//
// O servidor do IBGE não envia o certificado intermediário e o Node recusa a conexão (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
// Nesse caso, baixe os dois arquivos com curl e passe-os (os dois formatos são os da própria API):
//   curl -sS https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes -o mesorregioes.json
//   curl -sS https://servicodados.ibge.gov.br/api/v1/localidades/municipios -o municipios.json
//   npx tsx scripts/importar-mesorregioes-ibge.ts --mesorregioes=mesorregioes.json --municipios=municipios.json [--live]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  linhasDeMesorregioes,
  linhasDeMunicipios,
  problemasDaCarga,
  type MesorregiaoIbge,
  type MunicipioIbge,
} from "../lib/ibge-mesorregioes";

const API = "https://servicodados.ibge.gov.br/api/v1/localidades";
const LIVE = process.argv.includes("--live");
const LOTE = 500;

function lerEnv(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(join(process.cwd(), ".env.local"), "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

function argumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  return process.argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

async function baixar<T>(caminho: string): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const resposta = await fetch(`${API}/${caminho}`, { signal: AbortSignal.timeout(60_000) });
      if (!resposta.ok) throw new Error(`${caminho} respondeu ${resposta.status}`);
      return (await resposta.json()) as T;
    } catch (erro) {
      const codigo = (erro as { cause?: { code?: string } }).cause?.code;
      if (codigo === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
        throw new Error(
          "O servidor do IBGE não envia o certificado intermediário e o Node recusa a conexão. Baixe os dois arquivos com curl e passe-os com --mesorregioes=arquivo.json --municipios=arquivo.json (comandos no começo deste script).",
        );
      }
      if (tentativa >= 3) throw erro;
      console.warn(`Tentativa ${tentativa} de ${caminho} falhou (${(erro as Error).message}); tentando de novo…`);
      await new Promise((r) => setTimeout(r, 2000 * tentativa));
    }
  }
}

/** Do arquivo, quando o caminho foi passado; senão da API do IBGE. */
async function obter<T>(caminho: string, arquivo: string | undefined): Promise<T> {
  if (arquivo) return JSON.parse(readFileSync(arquivo, "utf8")) as T;
  return baixar<T>(caminho);
}

async function importar() {
  const [mesorregioesApi, municipiosApi] = await Promise.all([
    obter<MesorregiaoIbge[]>("mesorregioes", argumento("mesorregioes")),
    obter<MunicipioIbge[]>("municipios", argumento("municipios")),
  ]);
  const mesorregioes = linhasDeMesorregioes(mesorregioesApi);
  const { municipios, derivados, semMesorregiao } = linhasDeMunicipios(municipiosApi);
  const problemas = problemasDaCarga(mesorregioes, municipios);

  console.log(`${LIVE ? "LIVE RUN" : "DRY RUN"} — ${mesorregioes.length} mesorregiões e ${municipios.length} municípios do IBGE`);
  for (const d of derivados) {
    console.log(`  ${d.municipio}/${d.uf} veio sem microrregião; ficou em "${d.mesorregiao}" pela região imediata de ${d.regiaoImediata}`);
  }
  for (const s of semMesorregiao) console.error(`  SEM MESORREGIÃO: ${s.nome}/${s.uf} (${s.id})`);
  for (const p of problemas) console.error(`  PROBLEMA: ${p}`);
  if (semMesorregiao.length > 0 || problemas.length > 0) {
    throw new Error("A carga tem pendências (acima); nada foi gravado.");
  }

  if (!LIVE) {
    console.log("\n(dry run — nada foi escrito. rode com --live pra executar de verdade)");
    return;
  }

  const env = lerEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: erroMesorregioes } = await supabase.from("mesorregioes_ibge").upsert(mesorregioes, { onConflict: "id" });
  if (erroMesorregioes) throw new Error(`mesorregioes_ibge: ${erroMesorregioes.message}`);
  console.log(`OK: ${mesorregioes.length} mesorregiões`);

  for (let i = 0; i < municipios.length; i += LOTE) {
    const lote = municipios.slice(i, i + LOTE);
    const { error } = await supabase.from("municipios_ibge").upsert(lote, { onConflict: "id" });
    if (error) throw new Error(`municipios_ibge (${i}-${i + lote.length}): ${error.message}`);
    console.log(`OK: ${Math.min(i + LOTE, municipios.length)}/${municipios.length} municípios`);
  }

  const { data: alteradas, error: erroRecalculo } = await supabase.rpc("fn_empresas_recalcular_mesorregiao");
  if (erroRecalculo) throw new Error(`fn_empresas_recalcular_mesorregiao: ${erroRecalculo.message}`);
  console.log(`OK: ${alteradas} empresas tiveram a mesorregião recalculada`);

  const total = await supabase.from("empresas").select("id", { count: "exact", head: true });
  const com = await supabase.from("empresas").select("id", { count: "exact", head: true }).not("mesorregiao_id", "is", null);
  const { data: sem } = await supabase.from("empresas").select("nome, cidade, estado").is("mesorregiao_id", null).order("nome").limit(100);
  console.log(`\nEmpresas com mesorregião: ${com.count} de ${total.count}. Sem (cidade ausente ou que não casa com nenhum município):`);
  for (const e of sem ?? []) console.log(`  ${e.nome} — ${e.cidade ?? "(sem cidade)"}/${e.estado ?? "?"}`);
}

importar().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
