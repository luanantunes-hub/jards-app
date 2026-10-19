import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { INFOGRAFICOS } from "@/components/blog/infograficos";
import { SumarioBarra, SumarioLateral, type ItemSumario } from "@/components/blog/SumarioRolagem";

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

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function renderBlock(block: Block, ids: Map<number, string>, indice: number) {
  switch (block.type) {
    case "heading2":
      return (
        <h2 key={block.id} id={ids.get(indice)} className={`text-2xl font-bold text-[#282525] mt-8 mb-3 leading-snug ${ANCORA}`}>
          {block.content}
        </h2>
      );
    case "heading3":
      return (
        <h3 key={block.id} className="text-lg font-semibold text-[#282525] mt-6 mb-2">
          {block.content}
        </h3>
      );
    case "quote":
      return (
        <blockquote
          key={block.id}
          className="my-6 pl-5 py-1 italic text-black/55 text-base leading-relaxed"
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
        <p key={block.id} className="text-base text-black/70 leading-relaxed my-4 whitespace-pre-line">
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
    title: `${post.titulo} — Blog Jards`,
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

  const post = data as {
    titulo: string;
    tags: string[];
    seo_descricao: string | null;
    imagem_capa: string | null;
    imagem_alt: string | null;
    conteudo: string;
    publicado_em: string | null;
  };

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
    <main className="min-h-screen" style={{ background: "#FAFAFA" }}>
      {sumario.length > 0 && <SumarioBarra itens={sumario} alvo="artigo" />}
      <div className="xl:grid xl:grid-cols-[1fr_minmax(0,42rem)_1fr]">
      {sumario.length > 0
        ? <aside className="hidden xl:block"><SumarioLateral itens={sumario} alvo="artigo" /></aside>
        : <div className="hidden xl:block" aria-hidden="true" />}
      <article id="artigo" className="max-w-2xl mx-auto px-6 py-16 xl:mx-0 xl:max-w-none">
        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-xs text-black/40 hover:text-[#7259B5] mb-10 transition-colors"
        >
          ← Blog
        </Link>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {post.tags.map((tag: string) => (
              <span
                key={tag}
                className="text-[0.625rem] font-semibold px-2 py-0.5 rounded"
                style={{ background: "#fff", border: "1px solid #7259B547", color: "#7259B5" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl font-bold text-[#282525] leading-tight mb-4 tracking-tight">
          {post.titulo}
        </h1>

        {/* Date */}
        {post.publicado_em && (
          <p className="text-sm text-black/35 mb-8">{fmtDate(post.publicado_em)}</p>
        )}

        {/* Cover */}
        {post.imagem_capa && (
          <div className="mb-10 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(13,13,13,.06)" }}>
            <img
              src={post.imagem_capa}
              alt={post.imagem_alt ?? post.titulo}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        )}

        {/* Divider */}
        <div className="h-px mb-8" style={{ background: "rgba(13,13,13,.08)" }} />

        {/* Content */}
        <div id="introducao" className={`prose-content ${ANCORA}`}>
          {blocks.map((block, i) => renderBlock(block, ids, i))}
        </div>
      </article>
      <div className="hidden xl:block" aria-hidden="true" />
      </div>
    </main>
  );
}
