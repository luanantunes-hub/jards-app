import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as app from "../lib/producao/armazenamento";
import * as borda from "../supabase/functions/_shared/producao-caminho";
import {
  expandirCaminho, MODELOS_DE_CAMINHO, ORGANIZACAO, TEMPORADA, ARQUIVO,
} from "./_helpers/producao-caminhos-grade";

// PD0.14: o caminho dos arquivos da produção no bucket "documentos". A regra mora em
// supabase/functions/_shared/producao-caminho.ts (sem imports, para a edge function usar) e o app a expõe por
// lib/producao/armazenamento.ts. O banco repete a forma em fn_producao_caminho_partes: o teste de texto
// tests/producao-arquivos-sql.test.ts compara a expressão, e o teste de banco julga a mesma grade de caminhos.

const {
  montarCaminhoProducao, lerCaminhoProducao, extensaoDoArquivo, extensaoAceita, ehPastaDeArquivo, pastaEhSensivel,
  PASTAS_DE_ARQUIVO, PASTAS_SENSIVEIS, EXTENSOES_ACEITAS, PADRAO_DO_CAMINHO, RAIZ_DOS_ARQUIVOS, BUCKET_DOS_ARQUIVOS,
} = app;

test("o caminho começa pela organização e pela raiz `producoes`, como as regras do bucket leem", () => {
  const caminho = montarCaminhoProducao({
    organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta: "acordos", nomeOriginal: "Contrato Teatro.PDF", arquivoId: ARQUIVO,
  });
  assert.equal(caminho, `${ORGANIZACAO}/producoes/${TEMPORADA}/acordos/${ARQUIVO}.pdf`);
  assert.equal(RAIZ_DOS_ARQUIVOS, "producoes");
  assert.equal(BUCKET_DOS_ARQUIVOS, "documentos");
});

test("sem arquivoId, o identificador é novo a cada chamada e o caminho volta a ser lido", () => {
  const um = montarCaminhoProducao({ organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta: "plantas", nomeOriginal: "palco.dwg" });
  const outro = montarCaminhoProducao({ organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta: "plantas", nomeOriginal: "palco.dwg" });
  assert.notEqual(um, outro);
  assert.equal(lerCaminhoProducao(um)?.extensao, "dwg");
  assert.equal(lerCaminhoProducao(outro)?.pasta, "plantas");
});

test("identificadores em maiúsculas e extensão em maiúsculas saem em minúsculas: um objeto, um jeito de escrever o caminho", () => {
  const caminho = montarCaminhoProducao({
    organizationId: ORGANIZACAO.toUpperCase(), temporadaId: TEMPORADA.toUpperCase(), pasta: "itens", nomeOriginal: "FOTO.JPG", arquivoId: ARQUIVO.toUpperCase(),
  });
  assert.equal(caminho, `${ORGANIZACAO}/producoes/${TEMPORADA}/itens/${ARQUIVO}.jpg`);
});

test("o nome original não entra no caminho (fica só na tabela)", () => {
  const caminho = montarCaminhoProducao({
    organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta: "pessoas", nomeOriginal: "../../Passaporte João Silva 123.456.789-00.pdf",
  });
  assert.ok(!caminho.includes("João") && !caminho.includes("Passaporte") && !caminho.includes(".."));
  assert.ok(caminho.endsWith(".pdf"));
  assert.ok(lerCaminhoProducao(caminho));
});

test("identificador que não é UUID não monta caminho", () => {
  const base = { organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta: "acordos" as const, nomeOriginal: "a.pdf" };
  assert.throws(() => montarCaminhoProducao({ ...base, organizationId: "producoes" }), /Organização inválida/);
  assert.throws(() => montarCaminhoProducao({ ...base, organizationId: `${ORGANIZACAO}/x` }), /Organização inválida/);
  assert.throws(() => montarCaminhoProducao({ ...base, temporadaId: "../x" }), /Temporada inválida/);
  assert.throws(() => montarCaminhoProducao({ ...base, temporadaId: "" }), /Temporada inválida/);
  assert.throws(() => montarCaminhoProducao({ ...base, arquivoId: "nota" }), /Identificador de arquivo inválido/);
  assert.throws(() => montarCaminhoProducao({ ...base, arquivoId: `${ARQUIVO}.pdf` }), /Identificador de arquivo inválido/);
});

test("pasta que não é uma das nove fixas não monta caminho", () => {
  const base = { organizationId: ORGANIZACAO, temporadaId: TEMPORADA, nomeOriginal: "a.pdf" };
  for (const pasta of ["financeiro", "Acordos", "ACORDOS", "", "acordos/", "../pessoas", "pessoas/x", "prestacoes", "atividades"]) {
    assert.throws(() => montarCaminhoProducao({ ...base, pasta: pasta as never }), /Pasta desconhecida/, pasta);
  }
  assert.throws(() => montarCaminhoProducao({ ...base, pasta: undefined as never }), /Pasta desconhecida/);
});

test("extensão fora da lista não monta caminho: nada que o navegador abra como página ou programa", () => {
  const base = { organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta: "recebidos" as const };
  for (const nome of ["a.html", "a.htm", "a.svg", "a.js", "a.mjs", "a.exe", "a.bat", "a.sh", "a.php", "a.bin", "a.dll", "a.jar", "a.pdf.exe", "semextensao", "a.", ".gitignore", "a.extensaolonga", "a.p d f", "a.tar.gz"]) {
    assert.throws(() => montarCaminhoProducao({ ...base, nomeOriginal: nome }), /Tipo de arquivo não aceito/, nome);
  }
  // O que o app confere antes, para dizer à pessoa o que houve.
  assert.equal(extensaoAceita(extensaoDoArquivo("planta.DWG")), true);
  assert.equal(extensaoAceita(extensaoDoArquivo("pagina.html")), false);
  assert.equal(extensaoAceita(extensaoDoArquivo("semextensao")), false);
  assert.equal(extensaoAceita(undefined), false);
  assert.equal(extensaoAceita("PDF"), false, "a lista é de minúsculas");
});

test("extensão: minúsculas, só letras e números, até 8; senão bin", () => {
  assert.equal(extensaoDoArquivo("semextensao"), "bin");
  assert.equal(extensaoDoArquivo("arquivo.tar.gz"), "gz");
  assert.equal(extensaoDoArquivo("x.p d f"), "bin");
  assert.equal(extensaoDoArquivo("x.extensaolonga"), "bin");
  assert.equal(extensaoDoArquivo("Nota Fiscal 123.PDF"), "pdf");
});

test("a leitura aceita tudo o que a montagem produz: as nove pastas com cada uma das extensões aceitas", () => {
  assert.equal(PASTAS_DE_ARQUIVO.length * EXTENSOES_ACEITAS.length, 270);
  for (const pasta of PASTAS_DE_ARQUIVO) {
    for (const extensao of EXTENSOES_ACEITAS) {
      const caminho = montarCaminhoProducao({ organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta, nomeOriginal: `arquivo.${extensao}`, arquivoId: ARQUIVO });
      assert.equal(caminho, `${ORGANIZACAO}/producoes/${TEMPORADA}/${pasta}/${ARQUIVO}.${extensao}`);
      assert.deepEqual(lerCaminhoProducao(caminho), {
        organizationId: ORGANIZACAO, temporadaId: TEMPORADA, pasta, arquivoId: ARQUIVO, extensao,
      }, caminho);
    }
  }
});

test("a grade de caminhos: a leitura aceita os válidos e recusa o resto (o teste do banco julga a mesma grade)", () => {
  assert.ok(MODELOS_DE_CAMINHO.filter(m => m.valido).length >= 18);
  assert.ok(MODELOS_DE_CAMINHO.filter(m => !m.valido).length >= 40);
  for (const { modelo, valido, porque } of MODELOS_DE_CAMINHO) {
    const caminho = expandirCaminho(modelo);
    const lido = lerCaminhoProducao(caminho);
    if (valido) {
      assert.ok(lido, `${porque}: ${caminho}`);
      assert.equal(lido.organizationId, ORGANIZACAO);
      assert.equal(lido.temporadaId, TEMPORADA);
      assert.equal(lido.arquivoId, ARQUIVO);
    } else {
      assert.equal(lido, null, `${porque}: ${caminho}`);
    }
  }
});

test("a leitura recusa o que não é texto e o que a grade não escreve em uma linha só", () => {
  const valido = `${ORGANIZACAO}/producoes/${TEMPORADA}/acordos/${ARQUIVO}.pdf`;
  assert.ok(lerCaminhoProducao(valido));
  for (const entrada of [null, undefined, 42, true, {}, [], [valido], Buffer.from(valido)]) {
    assert.equal(lerCaminhoProducao(entrada), null, String(entrada));
  }
  // O `$` da expressão não perdoa a quebra de linha no fim, como o do Postgres.
  assert.equal(lerCaminhoProducao(`${valido}\n`), null);
  assert.equal(lerCaminhoProducao(`${valido}\r`), null);
  assert.equal(lerCaminhoProducao(`\n${valido}`), null);
  assert.equal(lerCaminhoProducao(`${valido}\u0000`), null);
  assert.equal(lerCaminhoProducao(`${valido}​`), null);
  assert.equal(lerCaminhoProducao(valido.replace("acordos", "acordos\n")), null);
});

test("as duas pontas são uma só: o app expõe a função de borda, sem copiar nada", async () => {
  // Cada nome exposto pelo app é o mesmo objeto da borda, e o app não esconde nem acrescenta nada.
  assert.deepEqual(Object.keys(app).sort(), Object.keys(borda).filter(nome => nome in app).sort());
  for (const nome of Object.keys(app) as (keyof typeof app)[]) {
    assert.equal(app[nome], (borda as Record<string, unknown>)[nome], `${nome} difere entre o app e a borda`);
  }
  // Tudo o que a borda exporta de útil ao app está no app (ehUuid também é da borda: o app o reexporta).
  const faltam = Object.keys(borda).filter(nome => !(nome in app));
  assert.deepEqual(faltam, [], "a borda exporta algo que o app não expõe");
  // O arquivo do app só reexporta: nenhuma lista, nenhuma função própria.
  const fonteDoApp = await readFile("lib/producao/armazenamento.ts", "utf8");
  const semComentarios = fonteDoApp.replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(semComentarios, /\b(?:const|let|var|function|class)\b/, "o app tem de só reexportar");
  assert.match(semComentarios, /from "@\/supabase\/functions\/_shared\/producao-caminho"/);
  // E a borda não importa nada: roda igual no Deno, no Node e no navegador.
  const fonteDaBorda = await readFile("supabase/functions/_shared/producao-caminho.ts", "utf8");
  assert.doesNotMatch(fonteDaBorda.replace(/\/\/.*$/gm, ""), /^\s*(?:import|export\s+\*?\s*from)\b|\brequire\(|\bimport\(/m, "a função de borda não pode ter imports");
});

test("as listas de pastas e de extensões moram num lugar só e são sãs", () => {
  assert.deepEqual([...PASTAS_DE_ARQUIVO], ["datas", "pessoas", "acordos", "plantas", "itens", "documentos", "deslocamentos", "hospedagem", "recebidos"]);
  assert.equal(new Set(PASTAS_DE_ARQUIVO).size, PASTAS_DE_ARQUIVO.length);
  assert.ok(PASTAS_DE_ARQUIVO.every(pasta => /^[a-z]+$/.test(pasta)), "pasta em minúsculas, sem acento");
  assert.deepEqual([...PASTAS_SENSIVEIS], ["pessoas"]);
  assert.ok(PASTAS_SENSIVEIS.every(pasta => PASTAS_DE_ARQUIVO.includes(pasta)));
  assert.equal(pastaEhSensivel("pessoas"), true);
  assert.deepEqual(PASTAS_DE_ARQUIVO.filter(pasta => pastaEhSensivel(pasta)), ["pessoas"]);
  assert.equal(ehPastaDeArquivo("acordos"), true);
  assert.equal(ehPastaDeArquivo("Acordos"), false);
  assert.equal(ehPastaDeArquivo(undefined), false);

  assert.equal(new Set(EXTENSOES_ACEITAS).size, EXTENSOES_ACEITAS.length);
  // Cada extensão da lista é uma que extensaoDoArquivo sabe produzir (minúsculas, letras e números, até 8).
  for (const extensao of EXTENSOES_ACEITAS) {
    assert.equal(extensaoDoArquivo(`a.${extensao}`), extensao);
    assert.equal(extensaoAceita(extensao), true, extensao);
  }
  // O freio é a lista: nada que abra como página, como programa ou como script entra nela.
  const perigosas = ["html", "htm", "xhtml", "svg", "js", "mjs", "css", "php", "exe", "msi", "bat", "cmd", "com", "scr", "sh", "jar", "dll", "apk", "ps1", "vbs", "swf"];
  assert.deepEqual(EXTENSOES_ACEITAS.filter(extensao => (perigosas as string[]).includes(extensao)), []);
});

test("o padrão do caminho (que o banco repete) é o que a leitura usa", () => {
  const regex = new RegExp(PADRAO_DO_CAMINHO);
  for (const { modelo } of MODELOS_DE_CAMINHO) {
    const caminho = expandirCaminho(modelo);
    assert.equal(regex.test(caminho), lerCaminhoProducao(caminho) !== null, caminho);
  }
  assert.ok(PADRAO_DO_CAMINHO.startsWith("^") && PADRAO_DO_CAMINHO.endsWith("$"), "âncoras nas duas pontas");
  assert.doesNotMatch(PADRAO_DO_CAMINHO, /\(\?[<!=:]/, "só o que o Postgres e o JavaScript escrevem igual: sem lookaround nem grupo nomeado");
  assert.equal([...PADRAO_DO_CAMINHO.matchAll(/(?<!\\)\(/g)].length, 5, "cinco grupos: organização, temporada, pasta, arquivo e extensão");
});
