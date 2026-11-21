import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviaDoSite } from "../components/ticketeria/PreviaDoSite";
import { copiaDeUmaPagina, duplicarBloco, enderecoDaPrevia, medidasDaPrevia, moverBloco, tituloDaCopia } from "../lib/ticketeria/editor-site";
import type { Bloco } from "../lib/ticketeria/site";

// O editor do site, passo 3: arrastar, duplicar bloco e página, e a prévia ao lado. Desenho aprovado pelo dono em 20/11/2026.

test("arrastar: leva o bloco para a nova posição e deixa os outros na ordem; posição estranha não muda nada", () => {
  const l = ["a", "b", "c", "d"];
  assert.deepEqual(moverBloco(l, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moverBloco(l, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moverBloco(l, 1, 2), ["a", "c", "b", "d"]);
  for (const [de, para] of [[1, 1], [-1, 2], [0, 4], [4, 0], [0.5, 1], [Number.NaN, 1]] as [number, number][]) assert.deepEqual(moverBloco(l, de, para), l, `${de}->${para}`);
  assert.notEqual(moverBloco(l, 0, 0), l, "devolve uma cópia: a lista original não é a mesma");
  assert.deepEqual(l, ["a", "b", "c", "d"], "a lista original não muda");
});

test("duplicar um bloco: cópia logo depois, independente do original, e recusa com a página cheia", () => {
  const lista: Bloco[] = [{ tipo: "titulo", texto: "A" }, { tipo: "faq", titulo: "", itens: [{ pergunta: "p", resposta: "r" }] }];
  const r = duplicarBloco(lista, 1);
  assert.ok(r && r.length === 3 && r[1].tipo === "faq" && r[2].tipo === "faq");
  assert.notEqual(r[1], r[2], "a cópia é outro objeto");
  (r[2] as Extract<Bloco, { tipo: "faq" }>).itens[0].pergunta = "mudou";
  assert.equal((r[1] as Extract<Bloco, { tipo: "faq" }>).itens[0].pergunta, "p", "mexer na cópia não mexe no original");
  assert.equal(lista.length, 2, "a lista original não muda");
  assert.equal(duplicarBloco(lista, 0)?.[1]?.tipo, "titulo");
  assert.equal(duplicarBloco(lista, 2), null);
  assert.equal(duplicarBloco(lista, -1), null);
  assert.equal(duplicarBloco(Array.from({ length: 60 }, () => ({ tipo: "titulo", texto: "x" }) as Bloco), 0), null, "60 blocos é o máximo");
  assert.equal(duplicarBloco(Array.from({ length: 59 }, () => ({ tipo: "titulo", texto: "x" }) as Bloco), 0)?.length, 60);
});

test("duplicar a página: título '(cópia)', depois '(cópia 2)', endereço sem repetir, sempre dentro de 120 letras", () => {
  assert.equal(tituloDaCopia("Elenco", ["Início", "Elenco"]), "Elenco (cópia)");
  assert.equal(tituloDaCopia("Elenco", ["Elenco", "Elenco (cópia)"]), "Elenco (cópia 2)");
  assert.equal(tituloDaCopia("Elenco", ["Elenco", "elenco (CÓPIA)", "Elenco (cópia 2)"]), "Elenco (cópia 3)", "sem diferença de maiúsculas");
  const longo = tituloDaCopia("x".repeat(120), []);
  assert.ok(longo.length <= 120 && longo.endsWith(" (cópia)"));
  assert.deepEqual(copiaDeUmaPagina("Quem somos", [{ titulo: "Início", slug: "inicio" }, { titulo: "Quem somos", slug: "quem-somos" }]), { titulo: "Quem somos (cópia)", slug: "quem-somos-copia" });
  assert.deepEqual(copiaDeUmaPagina("Quem somos", [{ titulo: "Quem somos", slug: "quem-somos" }, { titulo: "Quem somos (cópia)", slug: "quem-somos-copia" }]), { titulo: "Quem somos (cópia 2)", slug: "quem-somos-copia-2" });
});

test("a prévia: o celular em tamanho natural e o computador reduzido para caber na coluna de 440 pixels", () => {
  assert.deepEqual(medidasDaPrevia("celular"), { largura: 390, altura: 640, escala: 1, larguraVista: 440, alturaVista: 640 });
  const pc = medidasDaPrevia("computador");
  assert.deepEqual([pc.largura, pc.altura, pc.escala], [1100, 1600, 0.4]);
  assert.equal(pc.largura * pc.escala, pc.larguraVista, "1100 reduzido a 0,4 enche a coluna");
  assert.equal(pc.altura * pc.escala, pc.alturaVista);
  assert.equal(enderecoDaPrevia("s1", "inicio"), "/previa-site/s1");
  assert.equal(enderecoDaPrevia("s1", "quem-somos"), "/previa-site/s1/quem-somos");
});

test("o quadro da prévia: a página de verdade num iframe da própria origem, com a troca celular e computador", () => {
  const html = renderToStaticMarkup(createElement(PreviaDoSite, { siteId: "s1", slug: "quem-somos", versao: 3 }));
  for (const t of ["Prévia do rascunho", "Celular", "Computador", 'src="/previa-site/s1/quem-somos"', 'title="Prévia da página quem-somos"', "se atualiza a cada mudança", 'aria-pressed="true"']) assert.ok(html.includes(t), t);
  assert.ok(html.includes("scale(1)") && html.includes("width:390px"), "começa no celular");
  const pc = renderToStaticMarkup(createElement(PreviaDoSite, { siteId: "s1", slug: "inicio", versao: 0, modoInicial: "computador" }));
  assert.ok(pc.includes("scale(0.4)") && pc.includes("width:1100px") && pc.includes('src="/previa-site/s1"'));
  assert.equal(html.includes("sandbox"), false, "é a própria página do painel, não um site de fora");
});

test("o editor liga arrastar, duplicar bloco, duplicar página e a prévia ao lado; os botões de subir e descer seguem", () => {
  const codigo = readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8");
  for (const t of ["draggable={podeEditar}", "onDragStart", "onDragOver", "onDrop", "reordenar(", 'aria-label="Duplicar o bloco"', "duplicarBloco(", "Duplicar a página", "duplicarPagina()", "copiaDeUmaPagina(", "PreviaDoSite", "telaInteira", 'aria-label="Subir o bloco"', 'aria-label="Descer o bloco"', "Ver em outra aba"]) assert.ok(codigo.includes(t), t);
  assert.ok(codigo.includes("blocos: atual.blocos, descricao: atual.descricao, imagem_url: atual.imagem_url"), "a cópia leva os blocos, a descrição e a imagem, e nasce sem publicar");
  assert.doesNotMatch(codigo, /blocos_publicados: atual/, "a cópia não herda o que está publicado");
});

test("a prévia só abre no próprio painel: o cabeçalho da rota permite a mesma origem e nada mais", () => {
  const next = readFileSync("next.config.ts", "utf8");
  assert.match(next, /source: "\/previa-site\/:path\*"/);
  assert.match(next, /construirContentSecurityPolicy\("'self'"\)/);
  assert.match(next, /\(\?!embed\/\|previa-site\/\)/, "a regra geral deixa a prévia de fora");
});

test("o editor abre em TELA INTEIRA: por cima do painel, o editor à esquerda e a prévia à direita; em tela estreita um botão alterna; fechar volta ao site", () => {
  const editor = readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8");
  for (const t of ["fixed inset-0 z-[45]", "createPortal(tela, document.body)", 'lg:w-[440px]', "lg:flex-row", "<PreviaDoSite siteId={siteId} slug={atual.slug} versao={versao} telaInteira />", "Fechar o editor", "onFechar", "lg:hidden", 'hidden lg:block', 'document.body.style.overflow = "hidden"']) assert.ok(editor.includes(t), t);
  assert.ok(editor.indexOf("Publicar esta página") < editor.indexOf('role="tablist"'), "publicar fica no alto, as páginas logo abaixo");
  const folhas = ["<VersoesSheet", "<AcrescentarBlocoSheet", "<BlocoSheet", "<NovaPaginaSheet"];
  for (const f of folhas) assert.ok(editor.includes(f), `${f} segue ligada (as folhas abrem por cima do editor: z-50)`);
  const pagina = readFileSync("app/(dashboard)/ingressos/site/page.tsx", "utf8");
  assert.ok(pagina.includes("const [editando, setEditando] = useState(false)") && pagina.includes("Abrir o editor") && pagina.includes("{editando && <EditorDoSite") && pagina.includes("onFechar={() => setEditando(false)}"), "a tela do site abre o editor por um botão");
  const html = renderToStaticMarkup(createElement(PreviaDoSite, { siteId: "s1", slug: "inicio", versao: 0, telaInteira: true }));
  for (const t of ["Prévia do rascunho", "Computador", "Celular", "/previa-site/s1", 'class="h-full w-full"']) assert.ok(html.includes(t), t);
  assert.ok(html.indexOf('aria-pressed="true"') < html.indexOf("Computador") + 200, "na tela inteira a prévia abre no tamanho do computador (largura da coluna)");
  const comum = renderToStaticMarkup(createElement(PreviaDoSite, { siteId: "s1", slug: "inicio", versao: 0 }));
  assert.ok(!comum.includes('class="h-full w-full"'), "a prévia da coluna estreita segue como era");
});

test("o painel pode abrir a prévia num quadro: o frame-src da política tem 'self' (sem ele o navegador bloqueava o quadro e a prévia ficava em branco); os botões do alto não colam as palavras", () => {
  const next = readFileSync("next.config.ts", "utf8");
  const frameSrc = /"frame-src ([^"]+)"/.exec(next)?.[1] ?? "";
  assert.ok(frameSrc.startsWith("'self' "), "o quadro da mesma origem é permitido");
  assert.ok(frameSrc.includes("https://js.stripe.com"), "o que já estava continua");
  assert.match(next, /source: "\/\(\(\?!embed\/\|previa-site\/\)\.\*\)", headers: \[\.\.\.cabecalhosComuns, \{ key: "X-Frame-Options", value: "DENY" \}/, "as outras páginas seguem sem poder ser abertas em quadro por outros sites");
  const editor = readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8");
  assert.ok(!/<span className="hidden sm:inline"> /.test(editor), "um espaço no começo de um item de caixa flexível some: as duas versões do texto são inteiras");
  assert.ok(editor.includes('<span className="sm:hidden">Publicar</span><span className="hidden sm:inline">Publicar esta página</span>'));
});
