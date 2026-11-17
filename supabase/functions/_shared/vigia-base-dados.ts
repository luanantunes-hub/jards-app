// Leitura da Base de Dados de Publicações do DOU (dados abertos da Imprensa Nacional).
//
// O INLABS exige login e passa semanas em manutenção. A Imprensa Nacional também
// publica, sem login, um .zip por mês com um XML por ato de cada seção do Diário
// (www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados). O arquivo é
// regravado uma vez por dia, perto do meio-dia, e traz os mesmos XMLs do INLABS
// (o formato do ato é o de vigia-dou.ts). Aqui ficam só as partes puras: o
// endereço da página do mês, o link do arquivo da seção 1, em que dia cada
// arquivo do .zip foi publicado, quais dias faltam ler e o que fazer com cada um.
// A rede, o banco e o descompactador (fflate) ficam na função agente-normativo.
//
// Sem dependências: o Deno (função) e o Node (testes) importam este arquivo.

export const BASE_DE_DADOS_DOU = "https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados";
const HOSPEDEIRO_DA_BASE = "www.in.gov.br";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// ─── Endereços ──────────────────────────────────────────────────────────────

/** Página do mês de um dia ("AAAA-MM-DD") na base aberta. */
export function enderecoDaPaginaDoMes(dia: string): string {
  const [ano, mes] = dia.split("-");
  return `${BASE_DE_DADOS_DOU}?ano=${ano}&mes=${encodeURIComponent(MESES[Number(mes) - 1])}`;
}

export type ArquivoDoMes = {
  url: string;
  /**
   * Identifica a gravação do arquivo (endereço do documento e instante da gravação,
   * os dois no link); muda quando a Imprensa Nacional regrava o arquivo. null se o
   * link não traz o instante.
   */
  versao: string | null;
};

/**
 * Link do .zip da seção 1 do mês de `dia`, tirado do HTML da página do mês.
 * Devolve null se o arquivo ainda não foi publicado e também se o link não for
 * https do próprio site da Imprensa Nacional (a página nunca nos leva a outro endereço).
 */
export function arquivoDaSecao1(html: string, dia: string): ArquivoDoMes | null {
  const [ano, mes] = dia.split("-");
  const achado = new RegExp(`href="([^"]*/S01${mes}${ano}[^"/]*\\.zip[^"]*)"`, "i").exec(html);
  if (!achado) return null;
  let url: URL;
  try {
    url = new URL(achado[1].replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== HOSPEDEIRO_DA_BASE) return null;
  const instante = url.searchParams.get("t");
  return { url: url.toString(), versao: instante && /^\d+$/.test(instante) ? `${url.pathname}?t=${instante}` : null };
}

// ─── Arquivos dentro do .zip ────────────────────────────────────────────────

/**
 * Dia ("AAAA-MM-DD") em que o arquivo do .zip foi publicado, pelo nome:
 * `20261103/DO1/515_20261103_123.xml` (pasta por dia), `515_20261001_123.xml`
 * (arquivos soltos) ou `2026-10-09-DO1E.zip` (edição extra num .zip dentro do .zip).
 */
export function diaDoArquivo(nome: string): string | null {
  const caminho = nome.replace(/\\/g, "/");
  const base = caminho.slice(caminho.lastIndexOf("/") + 1);
  const achado = /^(\d{4})(\d{2})(\d{2})\//.exec(caminho)
    ?? /(\d{4})-(\d{2})-(\d{2})/.exec(base)
    ?? /^\d+_(\d{4})(\d{2})(\d{2})_/.exec(base);
  if (!achado) return null;
  const mes = Number(achado[2]);
  const dia = Number(achado[3]);
  if (Number(achado[1]) < 2000 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${achado[1]}-${achado[2]}-${achado[3]}`;
}

/** Edição do arquivo ("DO1", "DO1E"…) quando o nome diz; null nos arquivos soltos. */
export function edicaoDoArquivo(nome: string): string | null {
  const caminho = nome.replace(/\\/g, "/");
  const achado = /^\d{8}\/(DO\d+[A-Z]*)\//i.exec(caminho) ?? /-(DO\d+[A-Z]*)\.zip$/i.exec(caminho);
  return achado ? achado[1].toUpperCase() : null;
}

/**
 * O que fazer com uma entrada do .zip na leitura de `dia`: "xml" (um ato),
 * "zip" (edição extra empacotada, a abrir) ou null (outro dia, outra edição,
 * imagem, pasta ou lixo do sistema).
 */
export function tipoDaEntrada(nome: string, dia: string, edicoes: readonly string[]): "xml" | "zip" | null {
  const minusculo = nome.toLowerCase();
  const tipo = minusculo.endsWith(".xml") ? "xml" : minusculo.endsWith(".zip") ? "zip" : null;
  if (!tipo || diaDoArquivo(nome) !== dia) return null;
  const edicao = edicaoDoArquivo(nome);
  if (edicao && !edicoes.some(vigiada => vigiada.toUpperCase() === edicao)) return null;
  return tipo;
}

/** O `unzipSync` do fflate, só o que usamos: `filter` decide quais entradas são descompactadas. */
export type Descompactar = (
  zip: Uint8Array,
  opcoes: { filter: (arquivo: { name: string }) => boolean },
) => Record<string, Uint8Array>;

/** Dias com ato dentro do .zip do mês, em ordem. Só percorre o índice: não descompacta nada. */
export function diasDoZip(zip: Uint8Array, descompactar: Descompactar): string[] {
  const dias = new Set<string>();
  descompactar(zip, {
    filter: arquivo => {
      const dia = diaDoArquivo(arquivo.name);
      if (dia && /\.(xml|zip)$/i.test(arquivo.name)) dias.add(dia);
      return false;
    },
  });
  return [...dias].sort();
}

/** Um XML por ato publicado no dia, nas edições vigiadas; abre a edição extra empacotada, se houver. */
export function xmlsDoDia(zip: Uint8Array, dia: string, edicoes: readonly string[], descompactar: Descompactar): Uint8Array[] {
  const entradas = descompactar(zip, { filter: arquivo => tipoDaEntrada(arquivo.name, dia, edicoes) !== null });
  const xmls: Uint8Array[] = [];
  for (const [nome, conteudo] of Object.entries(entradas)) {
    if (tipoDaEntrada(nome, dia, edicoes) !== "zip") {
      xmls.push(conteudo);
      continue;
    }
    const dentro = descompactar(conteudo, { filter: interno => interno.name.toLowerCase().endsWith(".xml") });
    xmls.push(...Object.values(dentro));
  }
  return xmls;
}

// ─── Dias a ler ─────────────────────────────────────────────────────────────

const MEIO_DIA = "T12:00:00Z";

export function somarDias(dia: string, quantos: number): string {
  const data = new Date(`${dia}${MEIO_DIA}`);
  data.setUTCDate(data.getUTCDate() + quantos);
  return data.toISOString().slice(0, 10);
}

/** Dias de `de` até `ate` (positivo quando `ate` é depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}${MEIO_DIA}`) - Date.parse(`${de}${MEIO_DIA}`)) / 86_400_000);
}

export function ehFimDeSemana(dia: string): boolean {
  const semana = new Date(`${dia}${MEIO_DIA}`).getUTCDay();
  return semana === 0 || semana === 6;
}

/** Dias de `inicio` até `hoje` que ainda não foram lidos, do mais antigo ao mais novo. */
export function diasPendentes(inicio: string, hoje: string, lidos: ReadonlySet<string>): string[] {
  const pendentes: string[] = [];
  for (let dia = inicio; dia <= hoje; dia = somarDias(dia, 1)) {
    if (!lidos.has(dia)) pendentes.push(dia);
  }
  return pendentes;
}

export type Veredito =
  /** O arquivo do mês tem o dia: baixar e ler. */
  | { acao: "ler" }
  /** O arquivo já passou do dia e não tem nada dele: fim de semana, feriado ou lacuna da fonte. */
  | { acao: "sem_edicao"; fimDeSemana: boolean }
  /** A base ainda não chegou neste dia (ela atualiza uma vez por dia): tentar de novo depois. */
  | { acao: "aguardar" }
  /** O mês já acabou e a página não tem o arquivo dele: algo mudou na base. */
  | { acao: "arquivo_ausente" };

/** Depois da virada do mês a base ainda regrava o arquivo do mês anterior (o de outubro/2026 foi regravado em 5/11). */
const CARENCIA_DO_FIM_DO_MES_DIAS = 7;

/**
 * Decide o que fazer com `dia`, dado `hoje` e os dias que o arquivo do mês dele
 * já tem (null = a página não lista o arquivo do mês). O arquivo só vale como
 * prova de "sem Diário" quando ele passou do dia (traz um dia mais novo) ou
 * quando o mês acabou há mais de uma semana: a base é atualizada em atraso e um
 * dia ainda não publicado não pode virar "sem edição" para sempre.
 */
export function vereditoDoDia(dia: string, hoje: string, diasDoMes: readonly string[] | null): Veredito {
  if (diasDoMes?.includes(dia)) return { acao: "ler" };
  const mesAcabou = dia.slice(0, 7) < hoje.slice(0, 7) && diasEntre(dia, hoje) >= CARENCIA_DO_FIM_DO_MES_DIAS;
  if (diasDoMes === null) return mesAcabou ? { acao: "arquivo_ausente" } : { acao: "aguardar" };
  const maisNovo = diasDoMes.reduce((maior, atual) => (atual > maior ? atual : maior), "");
  if ((maisNovo && dia < maisNovo) || mesAcabou) return { acao: "sem_edicao", fimDeSemana: ehFimDeSemana(dia) };
  return { acao: "aguardar" };
}
