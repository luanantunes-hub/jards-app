import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { INFOGRAFICOS } from "@/components/blog/infograficos";
import { SumarioBarra, SumarioLateral, type ItemSumario } from "@/components/blog/SumarioRolagem";
import { Capa, FOCO, Meta, Temas, TITULO_HOVER, fmtData, minutosDeLeitura, type PostResumo } from "@/components/blog/partes";
import BannerCiclo from "@/components/site/BannerCiclo";

type Block = {
  id: string;
  type: "paragraph" | "heading2" | "heading3" | "image" | "quote" | "box" | "destaque" | "infografico";
  content?: string;
  url?: string;
  alt?: string;
  caption?: string;
  title?: string; // box
  label?: string; // box: rótulo pequeno acima do título
  chave?: string; // infografico
};

const ROTULO = "font-(family-name:--font-mono) text-[0.6875rem] font-medium uppercase tracking-[.08em]";
// Os títulos de seção ficam abaixo do menu do site e da barra "Neste texto".
const ANCORA = "scroll-mt-32 xl:scroll-mt-24";

// Âncora legível para cada título de seção ("quando-o-desenvolvimento-..."),
// indexada pela posição do bloco. Nunca repete nem usa um id que a página já
// tem (introdução, artigo, menus).
const IDS_DA_PAGINA = ["introducao", "artigo", "sumario-lista", "menuproduto", "menucelular", "conteudo", "rodape"];
function ancoras(blocks: Block[]) {
  const usados = new Set(IDS_DA_PAGINA);
  const ids = new Map<number, string>();
  blocks.forEach((b, i) => {
    if (b.type !== "heading2" || !b.content?.trim()) return;
    const base = b.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "secao";
    let id = base, n = 1;
    while (usados.has(id)) id = `${base}-${++n}`;
    usados.add(id);
    ids.set(i, id);
  });
  return ids;
}

// Texto da caixa: linhas com "- " viram lista; "Rótulo: texto" destaca o rótulo.
function ConteudoBox({ texto }: { texto: string }) {
  const grupos: { lista: boolean; linhas: string[] }[] = [];
  for (const linha of texto.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const lista = linha.startsWith("- ");
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.lista === lista && lista) ultimo.linhas.push(linha.slice(2));
    else grupos.push({ lista, linhas: [lista ? linha.slice(2) : linha] });
  }
  const comRotulo = (t: string) => {
    const i = t.indexOf(": ");
    if (i < 1 || i > 40) return t;
    return <><strong className="font-semibold text-[#282525]">{t.slice(0, i)}:</strong>{t.slice(i + 1)}</>;
  };
  return (
    <>
      {grupos.map((g, i) => g.lista ? (
        <ul key={i} className="mt-4 flex flex-col gap-3">
          {g.linhas.map((l, j) => (
            <li key={j} className="relative pl-4 text-[0.9375rem] leading-relaxed text-black/70 before:absolute before:top-[0.6em] before:left-0 before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#684DB0]">
              {comRotulo(l)}
            </li>
          ))}
        </ul>
      ) : (
        <p key={i} className="mt-4 text-[0.9375rem] leading-relaxed text-black/70">{comRotulo(g.linhas[0])}</p>
      ))}
    </>
  );
}

function renderBlock(block: Block, ids: Map<number, string>, indice: number) {
  switch (block.type) {
    case "heading2":
      return (
        <h2 key={block.id} id={ids.get(indice)} className={`mt-14 mb-4 text-[1.625rem] leading-tight font-bold tracking-[-0.015em] text-balance text-[#282525] ${ANCORA}`}>
          {block.content}
        </h2>
      );
    case "heading3":
      return (
        <h3 key={block.id} className="mt-10 mb-3 text-xl leading-snug font-semibold text-[#282525]">
          {block.content}
        </h3>
      );
    case "quote":
      return (
        <blockquote
          key={block.id}
          className="my-8 py-1 pl-5 text-[1.0625rem] leading-[1.75] italic text-black/60"
          style={{ borderLeft: "3px solid rgba(114,89,181,.4)" }}
        >
          {block.content}
        </blockquote>
      );
    case "image":
      return (
        <figure key={block.id} className="my-8">
          {block.url && (
            // Imagem inteira, sem corte: retratos e cartazes verticais ficam
            // centralizados, com altura limitada.
            <img
              src={block.url}
              alt={block.alt ?? ""}
              loading="lazy"
              decoding="async"
              className="mx-auto block h-auto w-auto max-w-full max-h-[36rem] rounded-lg"
              style={{ border: "1px solid rgba(13,13,13,.06)" }}
            />
          )}
          {block.caption && (
            <figcaption className="text-center text-xs leading-relaxed text-black/45 mt-3">{block.caption}</figcaption>
          )}
        </figure>
      );
    case "destaque":
      // Repete um trecho do próprio texto: leitores de tela já o leram no parágrafo.
      return (
        <div key={block.id} className="my-12" aria-hidden="true">
          <span className="block h-0.5 w-10 bg-[#684DB0]" />
          <p className="mt-5 text-[1.5rem] leading-[1.25] font-bold tracking-[-0.015em] text-balance text-[#282525] sm:text-[1.75rem]">
            {block.content}
          </p>
        </div>
      );
    case "box":
      return (
        <aside key={block.id} className="my-10 rounded border border-black/10 bg-white px-6 py-6">
          {block.label && <p className={`${ROTULO} text-[#684DB0]`}>{block.label}</p>}
          {block.title && <p className="mt-2 text-lg leading-snug font-bold text-balance text-[#282525]">{block.title}</p>}
          {block.content && <ConteudoBox texto={block.content} />}
        </aside>
      );
    case "infografico": {
      const Infografico = block.chave ? INFOGRAFICOS[block.chave] : undefined;
      return Infografico ? <Infografico key={block.id} /> : null;
    }
    default:
      return (
        <p key={block.id} className="my-5 text-[1.0625rem] leading-[1.75] text-pretty whitespace-pre-line text-black/75 sm:text-[1.125rem] sm:leading-[1.7]">
          {block.content}
        </p>
      );
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts" as any)
    .select("titulo, seo_descricao, imagem_capa")
    .eq("slug", slug)
    .eq("status", "publicado")
    .single();

  if (!data) return { title: "Post não encontrado" };
  const post = data as { titulo: string; seo_descricao: string | null; imagem_capa: string | null };

  return {
    title: `${post.titulo} — Jards`,
    description: post.seo_descricao ?? undefined,
    openGraph: post.imagem_capa ? { images: [post.imagem_capa] } : undefined,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("blog_posts" as any)
    .select("*")
    .eq("slug", slug)
    .eq("status", "publicado")
    .single();

  if (!data) notFound();

  const post = data as PostResumo;

  // "Continue lendo": os dois textos publicados mais recentes, fora este.
  const { data: outrosDados } = await supabase
    .from("blog_posts" as any)
    .select("id, titulo, slug, tags, seo_descricao, imagem_capa, imagem_alt, publicado_em, conteudo")
    .eq("status", "publicado")
    .neq("slug", slug)
    .order("publicado_em", { ascending: false })
    .limit(2);
  const outros = (outrosDados ?? []) as PostResumo[];
  const minutos = minutosDeLeitura(post.conteudo);

  let blocks: Block[] = [];
  try { blocks = JSON.parse(post.conteudo || "[]"); } catch { blocks = []; }

  // "Neste texto": a introdução (o que vem antes do primeiro título) e cada
  // título de seção. Só aparece quando o post tem pelo menos duas seções.
  const ids = ancoras(blocks);
  const secoes: ItemSumario[] = blocks.flatMap((b, i) => {
    const id = ids.get(i);
    return id ? [{ id, titulo: b.content!.trim() }] : [];
  });
  // Introdução só quando há conteúdo de verdade antes do primeiro título (o
  // editor começa todo post com um parágrafo vazio).
  const primeiroTitulo = blocks.findIndex((b) => b.type === "heading2");
  const comIntroducao = blocks
    .slice(0, primeiroTitulo < 0 ? blocks.length : primeiroTitulo)
    .some((b) => b.content?.trim() || b.url || b.chave || b.title?.trim());
  const sumario: ItemSumario[] = secoes.length >= 2
    ? [...(comIntroducao ? [{ id: "introducao", titulo: "Introdução" }] : []), ...secoes]
    : [];

  return (
    <main className="min-h-screen">
      {sumario.length > 0 && <SumarioBarra itens={sumario} alvo="artigo" />}
      <div className="xl:grid xl:grid-cols-[1fr_minmax(0,42rem)_1fr]">
      {sumario.length > 0
        ? <aside className="hidden xl:block"><SumarioLateral itens={sumario} alvo="artigo" /></aside>
        : <div className="hidden xl:block" aria-hidden="true" />}
      <article id="artigo" className="mx-auto max-w-2xl px-6 pt-12 pb-16 md:pt-16 xl:mx-0 xl:max-w-none">
        <header>
          <nav aria-label="Trilha" className={`${ROTULO} flex flex-wrap items-baseline gap-x-2 gap-y-1 text-black/55`}>
            <Link href="/publicacoes" className={`hover:text-[#282525] ${FOCO}`}>Publicações</Link>
            {post.tags && post.tags.length > 0 && (
              <>
                <span aria-hidden="true">/</span>
                <Temas tags={post.tags} className="inline" />
              </>
            )}
          </nav>
          <h1 className="mt-5 text-[clamp(2.125rem,4.4vw,3.125rem)] leading-[1.06] font-bold tracking-[-0.03em] text-balance text-[#282525]">
            {post.titulo}
          </h1>
          {post.seo_descricao && (
            <p className="mt-5 text-[1.1875rem] leading-relaxed text-pretty text-black/60">{post.seo_descricao}</p>
          )}
          {(post.publicado_em || minutos) && (
            <p className={`${ROTULO} mt-6 text-black/55`}>
              {post.publicado_em && <time dateTime={post.publicado_em}>{fmtData(post.publicado_em)}</time>}
              {post.publicado_em && minutos && " · "}
              {minutos && `${minutos} min de leitura`}
            </p>
          )}
        </header>

        {post.imagem_capa && (
          <figure className="mt-10">
            <img
              src={post.imagem_capa}
              alt={post.imagem_alt ?? ""}
              fetchPriority="high"
              className="aspect-[4/3] w-full rounded object-cover"
            />
          </figure>
        )}

        <div id="introducao" className={`prose-content mt-10 ${ANCORA}`}>
          {blocks.map((block, i) => renderBlock(block, ids, i))}
        </div>
      </article>
      <div className="hidden xl:block" aria-hidden="true" />
      </div>

      {outros.length > 0 && (
        <section aria-labelledby="continue-lendo" className="mx-auto max-w-pagina px-5 pt-8 md:px-8">
          <h2 id="continue-lendo" className={`${ROTULO} border-t border-black/10 pt-4 text-black/55`}>Continue lendo</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2">
            {outros.map((o) => (
              <li key={o.id}>
                <Link href={`/publicacoes/${o.slug}`} className={`group flex flex-col ${FOCO}`}>
                  <Capa post={o} className="aspect-[16/10]" />
                  <Temas tags={o.tags} className="mt-5" />
                  <h3 className={`mt-2 text-[1.375rem] leading-[1.2] font-bold tracking-[-0.015em] text-balance text-[#282525] ${TITULO_HOVER}`}>
                    {o.titulo}
                  </h3>
                  <Meta post={o} className="mt-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BannerCiclo />
    </main>
  );
}
