import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TIPOS_DE_IMAGEM } from "../lib/ticketeria/estados";
import { MAX_BYTES_ESCOLHIDO, MAX_BYTES_GUARDADO, MAX_LADO, caminhoDaImagem, descricaoDaImagem, extensaoDoTipo, lerImagens, medidasReduzidas, mensagemDoErroDeImagem, nomeDaImagem, tamanhoEmTexto, urlPublicaDaImagem, validarArquivo } from "../lib/ticketeria/imagens";
import { ErroDaImagem, prepararImagem, type DepsDoNavegador } from "../lib/ticketeria/imagens-navegador";

// A biblioteca de imagens do site (construtor, passo 5). Desenho aprovado pelo dono em 20/11/2026.

const ORG = "0d7d0000-0000-4000-8000-0000000000a0";
const IMG = "0d7d0000-0000-4000-8000-0000000000b1";

test("os tipos guardados são os da lista fechada do banco, e SVG e GIF ficam de fora", () => {
  assert.deepEqual([...TIPOS_DE_IMAGEM], ["image/webp", "image/jpeg", "image/png"]);
  assert.equal(validarArquivo({ type: "image/svg+xml", size: 1000 }).ok, false);
  assert.equal(validarArquivo({ type: "image/gif", size: 1000 }).ok, false);
  assert.equal(validarArquivo({ type: "application/pdf", size: 1000 }).ok, false, "PDF só quando a tela pede (a planta da sala)");
  assert.equal(validarArquivo({ type: "application/pdf", size: 1000 }, { aceitaPdf: true }).ok, true);
  assert.equal(validarArquivo({ type: "image/gif", size: 1000 }, { aceitaPdf: true }).ok, false, "GIF segue de fora, mesmo com PDF aceito");
  assert.equal(validarArquivo({ type: "", size: 1000 }).ok, false);
});

test("o arquivo escolhido: JPG, PNG ou WebP, não vazio, até 15 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.deepEqual(validarArquivo({ type, size: 2_000_000 }), { ok: true }, type);
  assert.equal(MAX_BYTES_ESCOLHIDO, 15 * 1024 * 1024);
  assert.deepEqual(validarArquivo({ type: "image/png", size: MAX_BYTES_ESCOLHIDO }), { ok: true }, "exatamente 15 MB cabe");
  const grande = validarArquivo({ type: "image/png", size: MAX_BYTES_ESCOLHIDO + 1 });
  assert.ok(!grande.ok && /15 MB/.test(grande.erro));
  const vazio = validarArquivo({ type: "image/png", size: 0 });
  assert.ok(!vazio.ok && /vazio/.test(vazio.erro));
  const gif = validarArquivo({ type: "image/gif", size: 10 });
  assert.ok(!gif.ok && /JPG, PNG ou WebP/.test(gif.erro) && /GIF e SVG/.test(gif.erro));
});

test("reduzir: o maior lado nunca passa de 2000, a proporção fica, e imagem pequena não é ampliada", () => {
  assert.deepEqual(medidasReduzidas(4000, 3000), { largura: 2000, altura: 1500 });
  assert.deepEqual(medidasReduzidas(3000, 6000), { largura: 1000, altura: 2000 });
  assert.deepEqual(medidasReduzidas(2000, 2000), { largura: 2000, altura: 2000 });
  assert.deepEqual(medidasReduzidas(800, 600), { largura: 800, altura: 600 });
  assert.deepEqual(medidasReduzidas(10000, 1), { largura: 2000, altura: 1 }, "nunca zero");
  assert.deepEqual(medidasReduzidas(0, 100), { largura: 1, altura: 1 });
  assert.deepEqual(medidasReduzidas(Number.NaN, 5), { largura: 1, altura: 1 });
  assert.equal(MAX_LADO, 2000);
  assert.equal(MAX_BYTES_GUARDADO, 3 * 1024 * 1024);
});

test("o nome da imagem: sem extensão, sem caminho, sem caracteres de controle, até 120 letras; sem nome, 'imagem'", () => {
  assert.equal(nomeDaImagem("fachada-teatro.JPG"), "fachada-teatro");
  assert.equal(nomeDaImagem("C:\\fotos\\elenco 2026.png"), "elenco 2026");
  assert.equal(nomeDaImagem("/tmp/a/b/logo.webp"), "logo");
  assert.equal(nomeDaImagem("  muitos   espaços  .png"), "muitos espaços");
  assert.equal(nomeDaImagem("a\u0000b\u001f.png"), "ab");
  assert.equal(nomeDaImagem(".png"), "imagem");
  assert.equal(nomeDaImagem(""), "imagem");
  assert.equal(nomeDaImagem("x".repeat(200) + ".png").length, 120);
  assert.equal(nomeDaImagem("foto.tar.gz"), "foto.tar", "só a última extensão sai");
});

test("o caminho: organização/imagem.extensão, só com ids válidos (o que a regra do storage confere)", () => {
  assert.equal(caminhoDaImagem(ORG, IMG, "image/webp"), `${ORG}/${IMG}.webp`);
  assert.equal(caminhoDaImagem(ORG.toUpperCase(), IMG.toUpperCase(), "image/jpeg"), `${ORG}/${IMG}.jpg`);
  assert.equal(caminhoDaImagem(ORG, IMG, "image/png"), `${ORG}/${IMG}.png`);
  assert.equal(caminhoDaImagem("../x", IMG, "image/webp"), null);
  assert.equal(caminhoDaImagem(ORG, "nao-e-id", "image/webp"), null);
  assert.equal(caminhoDaImagem(ORG, `${IMG}/../x`, "image/webp"), null);
  assert.deepEqual(TIPOS_DE_IMAGEM.map(extensaoDoTipo), ["webp", "jpg", "png"]);
  assert.equal(urlPublicaDaImagem("https://x.supabase.co/", `${ORG}/${IMG}.webp`), `https://x.supabase.co/storage/v1/object/public/ticketeria-site/${ORG}/${IMG}.webp`);
});

test("os textos: tamanho, descrição e a lista lida com cuidado", () => {
  assert.equal(tamanhoEmTexto(500), "500 B");
  assert.equal(tamanhoEmTexto(184_320), "180 KB");
  assert.equal(tamanhoEmTexto(1_258_291), "1,2 MB");
  assert.equal(descricaoDaImagem({ largura: 1600, altura: 900, bytes: 184_320 }), "1600 × 900 · 180 KB");
  const linha = (n: number, extra: Record<string, unknown> = {}) => ({ id: `i${n}`, caminho: `${ORG}/${IMG}.webp`, nome: `foto ${n}`, tipo: "image/webp", bytes: 1000, largura: 10, altura: 10, created_at: new Date(Date.UTC(2026, 10, n)).toISOString(), ...extra });
  assert.deepEqual(lerImagens([linha(1), linha(3), linha(2), linha(4, { tipo: "image/svg+xml" }), linha(5, { bytes: "1" }), null, "x"]).map(i => i.id), ["i3", "i2", "i1"]);
  assert.deepEqual(lerImagens(null), []);
});

test("os erros viram frases: permissão e limite, imagem grande, tipo e o resto", () => {
  assert.match(mensagemDoErroDeImagem({ code: "42501" }), /não pode mudar as imagens.*200 imagens/);
  assert.match(mensagemDoErroDeImagem({ message: "new row violates row-level security policy" }), /não pode mudar/);
  assert.match(mensagemDoErroDeImagem({ statusCode: 403 }), /não pode mudar/);
  assert.match(mensagemDoErroDeImagem({ message: "The object exceeded the maximum allowed size" }), /grande demais/);
  assert.match(mensagemDoErroDeImagem({ statusCode: "413" }), /grande demais/);
  assert.match(mensagemDoErroDeImagem({ message: "mime type image/gif is not supported" }), /JPG, PNG ou WebP/);
  assert.match(mensagemDoErroDeImagem({ message: "outra coisa" }), /Tente de novo/);
});

const arquivo = (tipo = "image/png", tamanho = 1_000_000, nome = "foto.png") => ({ type: tipo, size: tamanho, name: nome }) as File;
const deps = (largura: number, altura: number, resultado: { size: number; type: string } | null, falhaAoAbrir = false): DepsDoNavegador & { pedidos: [number, number][] } => {
  const pedidos: [number, number][] = [];
  return {
    pedidos,
    async abrir() {
      if (falhaAoAbrir) throw new Error("corrompida");
      return { largura, altura, async desenhar(l, a) { pedidos.push([l, a]); return resultado as Blob | null; } };
    },
  };
};

test("preparar a imagem: reduz às medidas certas, devolve WebP (ou JPEG) e recusa o que não serve, com frases", async () => {
  const d = deps(4000, 3000, { size: 400_000, type: "image/webp" });
  const p = await prepararImagem(arquivo(), d);
  assert.deepEqual([p.largura, p.altura, p.tipo], [2000, 1500, "image/webp"]);
  assert.deepEqual(d.pedidos, [[2000, 1500]], "o canvas é desenhado já reduzido");
  assert.equal((await prepararImagem(arquivo(), deps(800, 600, { size: 90_000, type: "image/jpeg" }))).tipo, "image/jpeg", "navegador sem WebP: JPEG");
  const recusa = async (a: File, dd: DepsDoNavegador, esperado: RegExp) => assert.rejects(prepararImagem(a, dd), (e: unknown) => e instanceof ErroDaImagem && esperado.test(e.message));
  await recusa(arquivo("image/gif"), deps(10, 10, { size: 1, type: "image/webp" }), /JPG, PNG ou WebP/);
  await recusa(arquivo("image/png", MAX_BYTES_ESCOLHIDO + 1), deps(10, 10, { size: 1, type: "image/webp" }), /15 MB/);
  await recusa(arquivo(), deps(10, 10, null, true), /corrompida/);
  await recusa(arquivo(), deps(10, 10, null), /neste navegador/);
  await recusa(arquivo(), deps(2000, 2000, { size: MAX_BYTES_GUARDADO + 1, type: "image/webp" }), /grande demais depois de reduzir/);
});

test("a folha envia pelo storage com a regra do banco, desfaz o arquivo se o registro falha e apaga os dois", () => {
  const folha = readFileSync("components/ticketeria/BibliotecaDeImagens.tsx", "utf8");
  for (const t of ["prepararImagem(arquivo, undefined, { aceitaPdf })", ".upload(caminho, pronta.blob", "cacheControl: \"31536000\"", "upsert: false", "ticketeria_site_imagens", ".insert({ id, organization_id: organizationId, caminho", ".remove([caminho])", ".remove([imagem.caminho])", ".delete().eq(\"id\", imagem.id)", "createPortal(", "Usar esta imagem", "Apagar de vez", "Enviar imagem", "Se ela estiver em algum bloco do site, o bloco fica sem a imagem", "tira os dados da foto", "As imagens são públicas", 'application/pdf" : "image/jpeg,image/png,image/webp"}']) assert.ok(folha.includes(t), t);
  const remocaoAntes = folha.indexOf(".remove([imagem.caminho])"), delecao = folha.indexOf(".delete().eq(\"id\", imagem.id)");
  assert.ok(remocaoAntes > 0 && remocaoAntes < delecao, "o arquivo sai antes do registro");
  assert.doesNotMatch(folha, /from "node:|server-only/);
});

test("todo campo de imagem do editor ganhou o botão Biblioteca, e o endereço https continua", () => {
  const campo = readFileSync("components/ticketeria/CampoDeImagem.tsx", "utf8");
  assert.ok(campo.includes("Biblioteca") && campo.includes("escolhida da biblioteca") && campo.includes("aoEscolher={url => onChange(url)}") && campo.includes("placeholder = \"https://\""));
  const editor = readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8");
  const novos = readFileSync("components/ticketeria/BlocosNovosSheet.tsx", "utf8");
  for (const [arquivoDoCodigo, textos] of [[editor, ['id="bl-url" rotulo="Endereço da imagem (https://…) ou da biblioteca"', 'id="seo-imagem"', "organizationId={organizationId}"]], [novos, ["-img`} rotulo=\"Imagem (https", "-sl-${i}", "-gal-${i}", "-pat-${i}", "-url`} ariaLabel={`Endereço da imagem da coluna"]]] as [string, string[]][]) for (const t of textos) assert.ok(arquivoDoCodigo.includes(t), t);
  assert.equal((novos.match(/<CampoDeImagem/g) ?? []).length, 5, "destaque, destaques do carrossel, colunas, galeria e patrocinadores");
  assert.equal(/<input[^>]*Endereço da imagem/.test(novos) || /<input[^>]*Endereço do logo/.test(novos), false, "nenhum campo de imagem ficou sem o botão");
});

test("a migration: espaço público de 3 MB só com webp, jpeg e png; só quem edita envia e apaga; até 200 por organização", () => {
  const sql = readFileSync("supabase/migrations/20261123500000_ticketeria_site_imagens.sql", "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /'ticketeria-site', 'ticketeria-site', true, 3145728, array\['image\/webp', 'image\/jpeg', 'image\/png'\]/);
  assert.doesNotMatch(sql, /svg|gif/i);
  assert.match(sql, /< 200/);
  assert.match(sql, /caminho like organization_id::text \|\| '\/%'/);
  assert.match(sql, /grant select, insert, delete on public\.ticketeria_site_imagens to authenticated;/);
  assert.doesNotMatch(sql, /\bdrop\b/i);
});
