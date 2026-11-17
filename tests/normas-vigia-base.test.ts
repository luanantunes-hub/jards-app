import assert from "node:assert/strict";
import test from "node:test";
import {
  arquivoDaSecao1,
  diaDoArquivo,
  diasDoZip,
  diasEntre,
  diasPendentes,
  edicaoDoArquivo,
  ehFimDeSemana,
  enderecoDaPaginaDoMes,
  somarDias,
  tipoDaEntrada,
  vereditoDoDia,
  xmlsDoDia,
  type Descompactar,
} from "../supabase/functions/_shared/vigia-base-dados";

// Trecho da página de novembro/2026 da base aberta (um .zip por seção do Diário).
const PAGINA_DE_NOVEMBRO = `<ul>
<li> <a href="https://www.in.gov.br/documents/49035712/741444604/S03112026_Atualizado122527.zip/86e7463f-e2e1-7899-683f-25d0d7767b32?version=1.0&amp;t=1794421670100&amp;download=true"> S03112026_Atualizado122527.zip </a> </li>
<li> <a href="https://www.in.gov.br/documents/49035712/741444604/S02112026_Atualizado122327.zip/6dca782b-96e5-3490-0008-2366848eda0b?version=1.0&amp;t=1794421656760&amp;download=true"> S02112026_Atualizado122327.zip </a> </li>
<li> <a href="https://www.in.gov.br/documents/49035712/741444604/S01112026_Atualizado122210.zip/58e62126-7a9a-97b4-0872-7df291499424?version=1.0&amp;t=1794421664967&amp;download=true"> S01112026_Atualizado122210.zip </a> </li>
</ul>`;

test("monta o endereço da página do mês, com acento codificado", () => {
  assert.equal(
    enderecoDaPaginaDoMes("2026-11-11"),
    "https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados?ano=2026&mes=Novembro",
  );
  assert.equal(
    enderecoDaPaginaDoMes("2027-03-05"),
    "https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados?ano=2027&mes=Mar%C3%A7o",
  );
});

test("acha o arquivo da seção 1 do mês e a versão dele", () => {
  const arquivo = arquivoDaSecao1(PAGINA_DE_NOVEMBRO, "2026-11-11");
  assert.ok(arquivo);
  assert.equal(
    arquivo.url,
    "https://www.in.gov.br/documents/49035712/741444604/S01112026_Atualizado122210.zip/58e62126-7a9a-97b4-0872-7df291499424?version=1.0&t=1794421664967&download=true",
  );
  assert.equal(arquivo.versao, "/documents/49035712/741444604/S01112026_Atualizado122210.zip/58e62126-7a9a-97b4-0872-7df291499424?t=1794421664967");
});

test("arquivo da seção 1 com nome simples (mês fechado) e sem versão no link", () => {
  const html = `<a href="https://www.in.gov.br/documents/49035712/740172584/S01102026.zip/a1471267-fa46-f071-9ebf-57b4c7bc1a23">S01102026.zip</a>`;
  const arquivo = arquivoDaSecao1(html, "2026-10-28");
  assert.ok(arquivo);
  assert.equal(arquivo.versao, null);
  assert.match(arquivo.url, /\/S01102026\.zip\//);
});

test("não devolve arquivo de outro mês, de outra seção nem de outro site", () => {
  assert.equal(arquivoDaSecao1(PAGINA_DE_NOVEMBRO, "2026-10-28"), null);
  assert.equal(arquivoDaSecao1(PAGINA_DE_NOVEMBRO.replace(/S01112026/g, "S02112026"), "2026-11-11"), null);
  assert.equal(arquivoDaSecao1("<html>sem arquivos</html>", "2026-11-11"), null);
  const forasteiro = `<a href="https://exemplo.com.br/S01112026.zip/x?t=1">x</a>`;
  assert.equal(arquivoDaSecao1(forasteiro, "2026-11-11"), null);
  const semHttps = `<a href="http://www.in.gov.br/documents/1/2/S01112026.zip/x">x</a>`;
  assert.equal(arquivoDaSecao1(semHttps, "2026-11-11"), null);
});

test("lê o dia de publicação pelo nome do arquivo, nos três formatos do .zip", () => {
  assert.equal(diaDoArquivo("20261103/DO1/515_20261103_24398476.xml"), "2026-11-03");
  assert.equal(diaDoArquivo("20261103/DO1E/515_20261103_24398476-2.xml"), "2026-11-03");
  assert.equal(diaDoArquivo("515_20261001_24398476.xml"), "2026-10-01");
  assert.equal(diaDoArquivo("515_20261001_24398476-12.xml"), "2026-10-01");
  assert.equal(diaDoArquivo("2026-10-09-DO1E.zip"), "2026-10-09");
  // Lixo do sistema e imagens da edição não têm dia.
  assert.equal(diaDoArquivo("__MACOSX/._515_20261001_1.xml"), null);
  assert.equal(diaDoArquivo("1_MDICS_9_001.jpg"), null);
  assert.equal(diaDoArquivo("Thumbs.db"), null);
  // Número de matéria que lembra data não engana: vale o primeiro.
  assert.equal(diaDoArquivo("515_20261001_20261231.xml"), "2026-10-01");
  // Mês ou dia impossível não é dia.
  assert.equal(diaDoArquivo("515_20261301_1.xml"), null);
  assert.equal(diaDoArquivo("20261100/DO1/515_20261100_1.xml"), null);
});

test("lê a edição pelo nome do arquivo", () => {
  assert.equal(edicaoDoArquivo("20261103/DO1/515_20261103_1.xml"), "DO1");
  assert.equal(edicaoDoArquivo("20261103/DO1E/515_20261103_1.xml"), "DO1E");
  assert.equal(edicaoDoArquivo("2026-10-09-DO1E.zip"), "DO1E");
  assert.equal(edicaoDoArquivo("515_20261001_1.xml"), null);
});

test("escolhe as entradas do dia nas edições vigiadas", () => {
  const vigiadas = ["DO1", "DO1E"];
  assert.equal(tipoDaEntrada("20261103/DO1/515_20261103_1.xml", "2026-11-03", vigiadas), "xml");
  assert.equal(tipoDaEntrada("20261103/DO1E/515_20261103_2.XML", "2026-11-03", vigiadas), "xml");
  assert.equal(tipoDaEntrada("2026-10-09-DO1E.zip", "2026-10-09", vigiadas), "zip");
  assert.equal(tipoDaEntrada("515_20261001_1.xml", "2026-10-01", vigiadas), "xml");
  // outro dia, imagem, pasta e edição não vigiada ficam de fora
  assert.equal(tipoDaEntrada("20261104/DO1/515_20261104_1.xml", "2026-11-03", vigiadas), null);
  assert.equal(tipoDaEntrada("20261103/DO1/1_MDICS_9_001.jpg", "2026-11-03", vigiadas), null);
  assert.equal(tipoDaEntrada("20261103/", "2026-11-03", vigiadas), null);
  assert.equal(tipoDaEntrada("20261103/DO1E/515_20261103_2.xml", "2026-11-03", ["DO1"]), null);
});

// Descompactador de mentira: entrega as entradas que o filtro aceita, como o unzipSync do fflate.
function falsoZip(entradas: Record<string, string | Record<string, string>>): { zip: Uint8Array; descompactar: Descompactar; chamadas: string[][] } {
  const chamadas: string[][] = [];
  const codificar = (texto: string) => new TextEncoder().encode(texto);
  const zip = codificar("zip-de-teste");
  const descompactar: Descompactar = (dados, opcoes) => {
    const alvo = dados === zip ? entradas : (aninhados.get(dados) ?? {});
    const resultado: Record<string, Uint8Array> = {};
    const vistos: string[] = [];
    for (const [nome, conteudo] of Object.entries(alvo)) {
      vistos.push(nome);
      if (!opcoes.filter({ name: nome })) continue;
      if (typeof conteudo === "string") resultado[nome] = codificar(conteudo);
      else {
        const interno = codificar(`zip-interno:${nome}`);
        aninhados.set(interno, conteudo);
        resultado[nome] = interno;
      }
    }
    chamadas.push(vistos);
    return resultado;
  };
  const aninhados = new Map<Uint8Array, Record<string, string>>();
  return { zip, descompactar, chamadas };
}

const ENTRADAS_DE_OUTUBRO = {
  "1_MDICS_9_001.jpg": "imagem",
  "515_20261008_1.xml": "<a>8/1</a>",
  "515_20261009_2.xml": "<a>9/2</a>",
  "515_20261009_3-1.xml": "<a>9/3</a>",
  "2026-10-09-DO1E.zip": { "515_20261009_9.xml": "<a>9/extra</a>", "leia-me.txt": "x" },
  "515_20261013_4.xml": "<a>13/4</a>",
};

test("lista os dias do .zip sem descompactar nada", () => {
  const { zip, descompactar } = falsoZip(ENTRADAS_DE_OUTUBRO);
  assert.deepEqual(diasDoZip(zip, descompactar), ["2026-10-08", "2026-10-09", "2026-10-13"]);
});

test("lê os XMLs do dia, inclusive os da edição extra empacotada", () => {
  const { zip, descompactar } = falsoZip(ENTRADAS_DE_OUTUBRO);
  const decodificar = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const xmls = xmlsDoDia(zip, "2026-10-09", ["DO1", "DO1E"], descompactar).map(decodificar);
  assert.deepEqual(xmls, ["<a>9/2</a>", "<a>9/3</a>", "<a>9/extra</a>"]);
  assert.deepEqual(xmlsDoDia(zip, "2026-10-13", ["DO1", "DO1E"], descompactar).map(decodificar), ["<a>13/4</a>"]);
  assert.deepEqual(xmlsDoDia(zip, "2026-10-10", ["DO1", "DO1E"], descompactar), []);
});

test("na pasta por dia, a edição extra só entra se for vigiada", () => {
  const { zip, descompactar } = falsoZip({
    "20261103/": "",
    "20261103/DO1/515_20261103_1.xml": "<a>normal</a>",
    "20261103/DO1E/515_20261103_2.xml": "<a>extra</a>",
  });
  const decodificar = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  assert.deepEqual(xmlsDoDia(zip, "2026-11-03", ["DO1", "DO1E"], descompactar).map(decodificar), ["<a>normal</a>", "<a>extra</a>"]);
  assert.deepEqual(xmlsDoDia(zip, "2026-11-03", ["DO1"], descompactar).map(decodificar), ["<a>normal</a>"]);
});

test("soma e compara dias na virada de mês e de ano", () => {
  assert.equal(somarDias("2026-10-31", 1), "2026-11-01");
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(diasEntre("2026-10-22", "2026-11-11"), 20);
  assert.equal(diasEntre("2026-11-11", "2026-11-11"), 0);
  assert.equal(ehFimDeSemana("2026-11-07"), true);
  assert.equal(ehFimDeSemana("2026-11-08"), true);
  assert.equal(ehFimDeSemana("2026-11-09"), false);
});

test("dias pendentes: do início até hoje, sem os já lidos", () => {
  const lidos = new Set(["2026-10-22", "2026-10-24"]);
  assert.deepEqual(diasPendentes("2026-10-22", "2026-10-26", lidos), ["2026-10-23", "2026-10-25", "2026-10-26"]);
  assert.deepEqual(diasPendentes("2026-10-30", "2026-11-02", new Set()), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepEqual(diasPendentes("2026-11-11", "2026-11-11", new Set(["2026-11-11"])), []);
  assert.deepEqual(diasPendentes("2026-11-12", "2026-11-11", new Set()), []);
});

test("veredito: lê o dia que está no arquivo", () => {
  const dias = ["2026-11-03", "2026-11-04", "2026-11-09"];
  assert.deepEqual(vereditoDoDia("2026-11-04", "2026-11-11", dias), { acao: "ler" });
});

test("veredito: dia que o arquivo já passou e não tem é 'sem edição' (fim de semana ou lacuna)", () => {
  const dias = ["2026-11-03", "2026-11-04", "2026-11-09"];
  assert.deepEqual(vereditoDoDia("2026-11-07", "2026-11-11", dias), { acao: "sem_edicao", fimDeSemana: true });
  assert.deepEqual(vereditoDoDia("2026-11-05", "2026-11-11", dias), { acao: "sem_edicao", fimDeSemana: false });
});

test("veredito: dia que o arquivo ainda não alcançou espera, mesmo sendo fim de semana", () => {
  const dias = ["2026-11-03", "2026-11-04", "2026-11-09"];
  assert.deepEqual(vereditoDoDia("2026-11-10", "2026-11-11", dias), { acao: "aguardar" });
  assert.deepEqual(vereditoDoDia("2026-11-11", "2026-11-11", dias), { acao: "aguardar" });
  assert.deepEqual(vereditoDoDia("2026-11-14", "2026-11-15", dias), { acao: "aguardar" });
});

test("veredito: mês que acabou há uma semana ou mais e o arquivo não tem o dia é 'sem edição'", () => {
  const outubro = ["2026-10-28", "2026-10-29"];
  assert.deepEqual(vereditoDoDia("2026-10-30", "2026-11-11", outubro), { acao: "sem_edicao", fimDeSemana: false });
  assert.deepEqual(vereditoDoDia("2026-10-31", "2026-11-11", outubro), { acao: "sem_edicao", fimDeSemana: true });
  // Logo depois da virada, o arquivo do mês ainda pode ser regravado (o de outubro foi, em 5/11).
  assert.deepEqual(vereditoDoDia("2026-10-31", "2026-11-02", outubro), { acao: "aguardar" });
  assert.deepEqual(vereditoDoDia("2026-10-30", "2026-11-05", outubro), { acao: "aguardar" });
  assert.deepEqual(vereditoDoDia("2026-10-30", "2026-11-06", outubro), { acao: "sem_edicao", fimDeSemana: false });
});

test("veredito: página sem o arquivo do mês espera no mês corrente e é problema em mês que acabou", () => {
  assert.deepEqual(vereditoDoDia("2026-12-01", "2026-12-02", null), { acao: "aguardar" });
  assert.deepEqual(vereditoDoDia("2026-10-20", "2026-11-11", null), { acao: "arquivo_ausente" });
  assert.deepEqual(vereditoDoDia("2026-10-28", "2026-11-03", null), { acao: "aguardar" });
  assert.deepEqual(vereditoDoDia("2026-10-28", "2026-11-04", null), { acao: "arquivo_ausente" });
  assert.deepEqual(vereditoDoDia("2026-10-31", "2026-11-02", null), { acao: "aguardar" });
});
