import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Block = {
  id: string;
  type: "paragraph" | "heading2" | "heading3" | "image" | "quote";
  content?: string;
  url?: string;
  alt?: string;
  caption?: string;
};

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function renderBlock(block: Block) {
  switch (block.type) {
    case "heading2":
      return (
        <h2 key={block.id} className="text-2xl font-bold text-[#0D0D0D] mt-8 mb-3 leading-snug">
          {block.content}
        </h2>
      );
    case "heading3":
      return (
        <h3 key={block.id} className="text-lg font-semibold text-[#0D0D0D] mt-6 mb-2">
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
            <img
              src={block.url}
              alt={block.alt ?? ""}
              className="w-full rounded-lg object-cover max-h-96"
              style={{ border: "1px solid rgba(13,13,13,.06)" }}
            />
          )}
          {block.caption && (
            <figcaption className="text-center text-xs text-black/35 mt-2">{block.caption}</figcaption>
          )}
        </figure>
      );
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

  return (
    <main className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <article className="max-w-2xl mx-auto px-6 py-16">
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
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: "rgba(114,89,181,.08)", color: "#7259B5" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl font-bold text-[#0D0D0D] leading-tight mb-4 tracking-tight">
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
              className="w-full max-h-80 object-cover"
            />
          </div>
        )}

        {/* Divider */}
        <div className="h-px mb-8" style={{ background: "rgba(13,13,13,.08)" }} />

        {/* Content */}
        <div className="prose-content">
          {blocks.map((block) => renderBlock(block))}
        </div>
      </article>
    </main>
  );
}
