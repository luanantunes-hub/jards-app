import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcrescentarBlocoSheet, BlocoNovoSheet, TIPOS_DAS_FOLHAS_NOVAS } from "../components/ticketeria/BlocosNovosSheet";
import { SiteView, type SiteParaDesenhar } from "../components/ticketeria/SiteView";
import { partesDaContagem } from "../lib/ticketeria/contagem";
import { GRUPOS_DE_BLOCOS, ROTULO_DO_TIPO_DE_BLOCO, TIPOS_DE_BLOCO, blocosDoJson, enderecoDoMapa, enderecoDoVideo, lerBloco, lerBlocos, lerVideo, type Bloco } from "../lib/ticketeria/site";

// O construtor, passo 1: os blocos novos (capa, duas colunas, galeria, vídeo, mapa, contagem, perguntas, patrocinadores). Desenhos aprovados pelo dono em 20/11/2026.

const ok = (entrada: unknown): Bloco => { const r = lerBloco(entrada); assert.ok(r.ok, JSON.stringify(r)); return (r as { bloco: Bloco }).bloco; };
const erro = (entrada: unknown): string => { const r = lerBloco(entrada); assert.equal(r.ok, false, JSON.stringify(entrada)); return (r as { erro: string }).erro; };

test("os grupos do seletor cobrem todos os tipos, cada um uma vez, e cada tipo tem rótulo", () => {
  const nosGrupos = GRUPOS_DE_BLOCOS.flatMap(g => [...g.tipos]);
  assert.deepEqual([...nosGrupos].sort(), [...TIPOS_DE_BLOCO].sort());
  assert.equal(new Set(nosGrupos).size, nosGrupos.length);
  assert.deepEqual(GRUPOS_DE_BLOCOS.map(g => g.titulo), ["Conteúdo", "Mídia e local", "Venda e confiança"]);
  for (const t of TIPOS_DE_BLOCO) assert.ok(ROTULO_DO_TIPO_DE_BLOCO[t].length > 0, t);
  assert.equal(TIPOS_DE_BLOCO.length, 16);
});

test("capa: título obrigatório, imagem https opcional, botão com texto e endereço juntos", () => {
  assert.deepEqual(ok({ tipo: "capa", titulo: " Hamlet ", subtitulo: "De 12 a 20", imagem: "https://exemplo.com/f.jpg", botao_rotulo: "Comprar", botao_url: "https://exemplo.com/c" }), { tipo: "capa", titulo: "Hamlet", subtitulo: "De 12 a 20", imagem: "https://exemplo.com/f.jpg", botao_rotulo: "Comprar", botao_url: "https://exemplo.com/c" });
  assert.deepEqual(ok({ tipo: "capa", titulo: "Só título" }), { tipo: "capa", titulo: "Só título", subtitulo: "", imagem: "", botao_rotulo: "", botao_url: "" });
  assert.match(erro({ tipo: "capa", titulo: "" }), /título da capa/);
  assert.match(erro({ tipo: "capa", titulo: "x".repeat(121) }), /título da capa/);
  assert.match(erro({ tipo: "capa", titulo: "x", imagem: "http://inseguro.com/a.jpg" }), /https/);
  assert.match(erro({ tipo: "capa", titulo: "x", imagem: "javascript:alert(1)" }), /https/);
  assert.match(erro({ tipo: "capa", titulo: "x", botao_rotulo: "Ir" }), /juntos/);
  assert.match(erro({ tipo: "capa", titulo: "x", botao_url: "https://a.com" }), /juntos/);
  assert.match(erro({ tipo: "capa", titulo: "x", botao_rotulo: "Ir", botao_url: "http://a.com" }), /https/);
});

test("duas colunas: cada uma é texto ou imagem (com texto alternativo)", () => {
  const b = ok({ tipo: "colunas", esquerda: { tipo: "texto", texto: "Olá" }, direita: { tipo: "imagem", url: "https://a.com/i.png", alt: "Foto" } });
  assert.deepEqual(b, { tipo: "colunas", esquerda: { tipo: "texto", texto: "Olá" }, direita: { tipo: "imagem", url: "https://a.com/i.png", alt: "Foto" } });
  assert.match(erro({ tipo: "colunas", esquerda: { tipo: "texto", texto: "" }, direita: { tipo: "texto", texto: "x" } }), /esquerda/);
  assert.match(erro({ tipo: "colunas", esquerda: { tipo: "texto", texto: "x" }, direita: { tipo: "imagem", url: "https://a.com/i.png", alt: "" } }), /direita/);
  assert.match(erro({ tipo: "colunas", esquerda: { tipo: "video" }, direita: { tipo: "texto", texto: "x" } }), /Escolha texto ou imagem/);
  assert.match(erro({ tipo: "colunas", esquerda: { tipo: "texto", texto: "x" } }), /direita/);
});

test("galeria: de 2 a 12 imagens, cada uma com endereço https e texto alternativo", () => {
  const im = (n: number) => ({ url: `https://a.com/${n}.jpg`, alt: `Foto ${n}` });
  assert.equal((ok({ tipo: "galeria", titulo: "Fotos", imagens: [im(1), im(2)] }) as Extract<Bloco, { tipo: "galeria" }>).imagens.length, 2);
  assert.match(erro({ tipo: "galeria", imagens: [im(1)] }), /2 a 12/);
  assert.match(erro({ tipo: "galeria", imagens: Array.from({ length: 13 }, (_, n) => im(n)) }), /2 a 12/);
  assert.match(erro({ tipo: "galeria", imagens: [im(1), { url: "http://a.com/x.jpg", alt: "x" }] }), /Imagem 2.*https/);
  assert.match(erro({ tipo: "galeria", imagens: [im(1), { url: "https://a.com/x.jpg", alt: "" }] }), /Imagem 2.*alternativo/);
  assert.match(erro({ tipo: "galeria" }), /2 a 12/);
});

test("vídeo: só YouTube e Vimeo, em qualquer forma comum de endereço; guarda provedor e id, nunca o endereço", () => {
  const yt = { provedor: "youtube" as const, id: "dQw4w9WgXcQ" };
  for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?si=x", "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "youtube:dQw4w9WgXcQ"]) assert.deepEqual(lerVideo(url), yt, url);
  const vm = { provedor: "vimeo" as const, id: "76979871" };
  for (const url of ["https://vimeo.com/76979871", "https://www.vimeo.com/76979871", "https://player.vimeo.com/video/76979871?h=abc", "vimeo:76979871"]) assert.deepEqual(lerVideo(url), vm, url);
  for (const ruim of ["", "http://youtu.be/dQw4w9WgXcQ", "https://youtu.be/curto", "https://youtube.com.mau.com/watch?v=dQw4w9WgXcQ", "https://mau.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch", "https://vimeo.com/abc", "https://evil.com/?u=https://youtu.be/dQw4w9WgXcQ", "https://u:p@youtu.be/dQw4w9WgXcQ", "youtube:../../x", "vimeo:12", "javascript:alert(1)", "nao é endereço"]) assert.equal(lerVideo(ruim), null, ruim);
  assert.equal(enderecoDoVideo(yt), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(enderecoDoVideo(vm), "https://player.vimeo.com/video/76979871");
  assert.deepEqual(ok({ tipo: "video", titulo: "Trailer", url: "https://youtu.be/dQw4w9WgXcQ" }), { tipo: "video", titulo: "Trailer", provedor: "youtube", id: "dQw4w9WgXcQ" });
  assert.deepEqual(ok({ tipo: "video", titulo: "", provedor: "vimeo", id: "76979871" }), { tipo: "video", titulo: "", provedor: "vimeo", id: "76979871" }, "o bloco guardado volta a ser lido");
  assert.match(erro({ tipo: "video", url: "https://mau.com/x" }), /YouTube ou do Vimeo/);
});

test("mapa: endereço de 1 a 200 letras; o endereço do mapa é sempre do Google, com o texto protegido", () => {
  assert.deepEqual(ok({ tipo: "mapa", titulo: "", endereco: "Rua Exemplo, 100 & cia" }), { tipo: "mapa", titulo: "", endereco: "Rua Exemplo, 100 & cia" });
  assert.match(erro({ tipo: "mapa", endereco: "" }), /endereço do mapa/);
  assert.match(erro({ tipo: "mapa", endereco: "x".repeat(201) }), /endereço do mapa/);
  const url = enderecoDoMapa("Rua Exemplo, 100 & cia\"><script>");
  assert.ok(url.startsWith("https://www.google.com/maps?q=") && url.endsWith("&output=embed"));
  assert.equal(/[<>" ]/.test(url), false, "nada de caractere solto no endereço do mapa");
});

test("contagem: o instante vira ISO em UTC; sem instante válido, erro; a conta arredonda os minutos para baixo", () => {
  assert.deepEqual(ok({ tipo: "contagem", titulo: "Faltam", ate: "2026-12-12T23:00:00-03:00", depois: "Já começou!" }), { tipo: "contagem", titulo: "Faltam", ate: "2026-12-13T02:00:00.000Z", depois: "Já começou!" });
  for (const ruim of ["", "amanhã", "2026-13-40T00:00:00Z", "12/12/2026"]) assert.match(erro({ tipo: "contagem", ate: ruim }), /dia e a hora/, ruim);
  assert.match(erro({ tipo: "contagem", ate: "2026-12-12T20:00:00Z", depois: "x".repeat(121) }), /frase/);
  const base = Date.parse("2026-12-01T00:00:00Z");
  assert.deepEqual(partesDaContagem(base + (21 * 1440 + 4 * 60 + 12) * 60_000 + 59_000, base), { dias: 21, horas: 4, minutos: 12 });
  assert.deepEqual(partesDaContagem(base + 59_000, base), { dias: 0, horas: 0, minutos: 0 });
  assert.equal(partesDaContagem(base, base), null);
  assert.equal(partesDaContagem(base - 1, base), null);
  assert.equal(partesDaContagem(Number.NaN, base), null);
});

test("perguntas e patrocinadores: limites, textos e links https", () => {
  assert.equal((ok({ tipo: "faq", titulo: "Dúvidas", itens: [{ pergunta: "Posso devolver?", resposta: "Em 7 dias." }] }) as Extract<Bloco, { tipo: "faq" }>).itens.length, 1);
  assert.match(erro({ tipo: "faq", itens: [] }), /1 a 20/);
  assert.match(erro({ tipo: "faq", itens: Array.from({ length: 21 }, () => ({ pergunta: "p", resposta: "r" })) }), /1 a 20/);
  assert.match(erro({ tipo: "faq", itens: [{ pergunta: "p", resposta: "" }] }), /Pergunta 1.*resposta/);
  assert.match(erro({ tipo: "faq", itens: [{ pergunta: "", resposta: "r" }] }), /Pergunta 1.*pergunta/);
  const p = ok({ tipo: "patrocinadores", titulo: "Patrocínio", itens: [{ url: "https://a.com/l.png", alt: "Acme", link: "https://acme.com" }, { url: "https://b.com/l.png", alt: "Beta" }] }) as Extract<Bloco, { tipo: "patrocinadores" }>;
  assert.deepEqual(p.itens.map(i => i.link), ["https://acme.com/", ""]);
  assert.match(erro({ tipo: "patrocinadores", itens: [] }), /1 a 12/);
  assert.match(erro({ tipo: "patrocinadores", itens: [{ url: "https://a.com/l.png", alt: "x", link: "http://a.com" }] }), /Patrocinador 1.*https/);
  assert.match(erro({ tipo: "patrocinadores", itens: [{ url: "https://a.com/l.png", alt: "" }] }), /Patrocinador 1.*alternativo/);
});

test("a página aceita os blocos novos e os antigos juntos, e o que vem do banco passa pela mesma leitura", () => {
  const lista = [{ tipo: "capa", titulo: "A" }, { tipo: "texto", texto: "t" }, { tipo: "mapa", endereco: "Rua X" }, { tipo: "contagem", ate: "2026-12-12T20:00:00Z" }];
  const r = lerBlocos(lista);
  assert.ok(r.ok && r.blocos.length === 4);
  assert.deepEqual(blocosDoJson([...lista, { tipo: "video", url: "https://mau.com/x" }, { tipo: "desconhecido" }]).map(b => b.tipo), ["capa", "texto", "mapa", "contagem"], "o que não passa na leitura some");
});

const site = (blocos: Bloco[]): SiteParaDesenhar => ({ agora: Date.parse("2026-12-01T00:00:00Z"), titulo: "Cia", cor: "#1C0E33", menu: [{ slug: "inicio", titulo: "Início" }], pagina: { slug: "inicio", titulo: "Início", blocos }, programacoes: {} });
const desenhar = (blocos: unknown[]) => renderToStaticMarkup(createElement(SiteView, { site: site(blocosDoJson(blocos)), base: "" }));

test("o site desenha a capa (com e sem imagem), as colunas e a galeria", () => {
  const comImagem = desenhar([{ tipo: "capa", titulo: "Hamlet em temporada", subtitulo: "No Teatro Municipal", imagem: "https://a.com/f.jpg", botao_rotulo: "Comprar ingressos", botao_url: "https://a.com/c" }]);
  assert.ok(comImagem.includes("Hamlet em temporada") && comImagem.includes("No Teatro Municipal") && comImagem.includes('src="https://a.com/f.jpg"') && comImagem.includes("bg-black/55") && comImagem.includes("Comprar ingressos"));
  assert.ok(comImagem.includes('rel="noopener noreferrer"') && comImagem.includes('target="_blank"'));
  const semImagem = desenhar([{ tipo: "capa", titulo: "Só cor" }]);
  assert.ok(semImagem.includes("background-color:#1C0E33") && semImagem.includes("color:#ffffff") && !semImagem.includes("<img") && !semImagem.includes("target=\"_blank\""), "sem imagem e sem botão: nada de imagem nem de link para fora");
  const colunas = desenhar([{ tipo: "colunas", esquerda: { tipo: "texto", texto: "Primeiro\n\nSegundo" }, direita: { tipo: "imagem", url: "https://a.com/i.png", alt: "Foto do elenco" } }]);
  assert.ok(colunas.includes("sm:grid-cols-2") && colunas.includes("<p") && colunas.includes('alt="Foto do elenco"'));
  const galeria = desenhar([{ tipo: "galeria", titulo: "Fotos", imagens: [{ url: "https://a.com/1.jpg", alt: "Um" }, { url: "https://a.com/2.jpg", alt: "Dois" }] }]);
  assert.equal((galeria.match(/<img/g) ?? []).length, 2);
  assert.ok(galeria.includes("Fotos") && galeria.includes('alt="Um"') && galeria.includes('loading="lazy"'));
});

test("o site desenha vídeo e mapa em quadros com permissões mínimas e só dos domínios previstos", () => {
  const html = desenhar([{ tipo: "video", titulo: "Trailer", url: "https://youtu.be/dQw4w9WgXcQ" }, { tipo: "mapa", titulo: "Como chegar", endereco: "Rua Exemplo, 100" }]);
  const quadros = [...html.matchAll(/<iframe[^>]*>/g)].map(m => m[0]);
  assert.equal(quadros.length, 2);
  assert.ok(quadros[0].includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'));
  assert.ok(quadros[1].includes('src="https://www.google.com/maps?q=Rua%20Exemplo%2C%20100&amp;output=embed"'));
  for (const q of quadros) {
    assert.ok(q.includes('sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"') && q.includes('loading="lazy"') && q.includes("title="), q);
    assert.equal(q.includes("allow-top-navigation"), false, "o quadro nunca leva a página a outro lugar");
  }
  assert.ok(html.includes("Rua Exemplo, 100") && html.includes("Como chegar") && html.includes("Trailer"));
  const next = readFileSync("next.config.ts", "utf8");
  const frameSrc = /"frame-src ([^"]+)"/.exec(next)?.[1] ?? "";
  for (const origem of ["https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://www.google.com"]) assert.ok(frameSrc.includes(origem), `frame-src libera ${origem}`);
  assert.ok(frameSrc.includes("https://js.stripe.com"), "o que já estava continua");
});

test("o site desenha contagem, perguntas e patrocinadores", () => {
  const contagem = desenhar([{ tipo: "contagem", titulo: "Faltam", ate: "2026-12-22T04:12:00Z", depois: "Já começou!" }]);
  assert.ok(contagem.includes("Faltam") && contagem.includes("21 dias · 04 h · 12 min") && contagem.includes('role="timer"'));
  const passada = desenhar([{ tipo: "contagem", titulo: "Faltam", ate: "2026-11-30T00:00:00Z", depois: "Já começou!" }]);
  assert.ok(passada.includes("Já começou!") && !passada.includes("role=\"timer\""));
  const umDia = desenhar([{ tipo: "contagem", ate: "2026-12-02T00:30:00Z" }]);
  assert.ok(umDia.includes("1 dia · 00 h · 30 min"));
  const faq = desenhar([{ tipo: "faq", titulo: "Dúvidas", itens: [{ pergunta: "Posso devolver?", resposta: "Em 7 dias.\nPor e-mail." }, { pergunta: "Tem acessibilidade?", resposta: "Sim." }] }]);
  assert.equal((faq.match(/<details/g) ?? []).length, 2);
  assert.ok(faq.includes("<summary") && faq.includes("Posso devolver?") && faq.includes("Por e-mail."));
  const pat = desenhar([{ tipo: "patrocinadores", titulo: "Patrocínio", itens: [{ url: "https://a.com/l.png", alt: "Acme", link: "https://acme.com" }, { url: "https://b.com/l.png", alt: "Beta" }] }]);
  assert.equal((pat.match(/<img/g) ?? []).length, 2);
  assert.equal((pat.match(/target="_blank"/g) ?? []).length, 1, "só o patrocinador com site vira link");
  assert.ok(pat.includes('rel="noopener noreferrer sponsored"') && pat.includes('href="https://acme.com/"') && pat.includes("Patrocínio"));
});

test("o seletor Acrescentar bloco: três grupos, programação e ingressos só quando há de onde tirar", () => {
  const html = (temEspacos: boolean, temEventos: boolean) => renderToStaticMarkup(createElement(AcrescentarBlocoSheet, { temEspacos, temEventos, onEscolher: () => {}, onClose: () => {} }));
  const completo = html(true, true);
  for (const t of ["Acrescentar bloco", "Conteúdo", "Mídia e local", "Venda e confiança", "Capa", "Título", "Texto", "Duas colunas", "Imagem", "Galeria", "Vídeo", "Mapa", "Contato", "Ingressos", "Botão", "Contagem", "Perguntas", "Patrocinadores", "Programação"]) assert.ok(completo.includes(t), t);
  const sem = html(false, false);
  assert.equal(sem.includes("Programação") || sem.includes(">Ingressos<"), false);
  assert.ok(sem.includes("Galeria") && sem.includes("Mapa"));
});

test("as folhas dos blocos novos montam com os campos desenhados", () => {
  const folha = (tipo: Parameters<typeof BlocoNovoSheet>[0]["tipo"], bloco?: Bloco) => renderToStaticMarkup(createElement(BlocoNovoSheet, { tipo, bloco, organizationId: "o1", onClose: () => {}, onSalvar: async () => null }));
  assert.deepEqual([...TIPOS_DAS_FOLHAS_NOVAS].sort(), ["agenda", "capa", "colunas", "contagem", "faq", "galeria", "mapa", "patrocinadores", "video"]);
  const capa = folha("capa");
  for (const t of ["Novo bloco: Capa", "Título", "Subtítulo (opcional)", "Imagem de fundo (https://…, opcional)", "Botão: texto (opcional)", "Botão: para onde leva", "Acrescentar", "Cancelar"]) assert.ok(capa.includes(t), t);
  for (const [tipo, textos] of [["colunas", ["Esquerda", "Direita", "uma em cima da outra"]], ["galeria", ["Imagem 1", "Imagem 2", "Outra imagem", "2 a 12"]], ["video", ["Endereço do vídeo (YouTube ou Vimeo)", "Só YouTube e Vimeo"]], ["mapa", ["Endereço", "mapa do Google"]], ["contagem", ["Dia do fim", "Hora", "Frase depois que acabar", "Brasília"]], ["faq", ["Pergunta 1", "Outra pergunta"]], ["patrocinadores", ["Patrocinador 1", "Outro patrocinador", "Site (https://…, opcional)"]]] as const) {
    const h = folha(tipo);
    for (const t of textos) assert.ok(h.includes(t), `${tipo}: ${t}`);
  }
  const editando = folha("capa", ok({ tipo: "capa", titulo: "Hamlet", subtitulo: "", imagem: "", botao_rotulo: "", botao_url: "" }));
  assert.ok(editando.includes("Editar bloco: Capa") && editando.includes('value="Hamlet"') && editando.includes("Salvar"));
  const contagem = folha("contagem", ok({ tipo: "contagem", titulo: "Faltam", ate: "2026-12-13T02:00:00.000Z", depois: "Já começou!" }));
  assert.ok(contagem.includes('value="2026-12-12"') && contagem.includes('value="23:00"'), "a data volta no fuso de Brasília");
});

test("o editor usa o seletor e as folhas novas, e o resumo de cada bloco novo cabe na lista", () => {
  const editor = readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8");
  for (const t of ["AcrescentarBlocoSheet", "BlocoNovoSheet", "TIPOS_DAS_FOLHAS_NOVAS", 'folha?.tipo === "escolher"']) assert.ok(editor.includes(t), t);
  for (const tipo of ["capa", "colunas", "galeria", "video", "mapa", "contagem", "faq", "patrocinadores"]) assert.ok(editor.includes(`case "${tipo}":`), `resumo de ${tipo}`);
});
