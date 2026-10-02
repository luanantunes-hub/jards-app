import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Post = {
  id: string;
  titulo: string;
  slug: string;
  tags: string[];
  seo_descricao: string | null;
  imagem_capa: string | null;
  imagem_alt: string | null;
  publicado_em: string | null;
};

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export const metadata = {
  title: "Blog — Jards",
  description: "Insights, descobertas e conversas interessantes sobre captação de recursos.",
};

export default async function BlogPublicPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("blog_posts" as any)
    .select("id, titulo, slug, tags, seo_descricao, imagem_capa, imagem_alt, publicado_em")
    .eq("status", "publicado")
    .order("publicado_em", { ascending: false });

  const list = (posts ?? []) as Post[];

  return (
    <main className="min-h-screen" style={{ background: "#FAFAFA" }}>
      {/* Header */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <p className="text-xs font-bold tracking-[.14em] uppercase text-[#7259B5] mb-3">Blog</p>
        <h1 className="text-4xl font-bold text-[#0D0D0D] tracking-tight leading-tight mb-4">
          Insights, descobertas e conversas<br />sobre captação
        </h1>
        <p className="text-base text-black/45 max-w-xl mx-auto">
          O que aprendemos trabalhando com captação de recursos culturais no Brasil.
        </p>
      </div>

      {/* Posts */}
      <div className="max-w-3xl mx-auto px-6 pb-24 space-y-6">
        {list.length === 0 && (
          <p className="text-center text-sm text-black/35 py-16">Nenhum post publicado ainda.</p>
        )}
        {list.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="flex gap-5 rounded-lg overflow-hidden group transition hover:shadow-sm"
            style={{ border: "1px solid rgba(13,13,13,.08)", background: "white" }}
          >
            {post.imagem_capa && (
              <div className="w-48 flex-shrink-0 overflow-hidden">
                <img
                  src={post.imagem_capa}
                  alt={post.imagem_alt ?? post.titulo}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  style={{ minHeight: 140 }}
                />
              </div>
            )}
            <div className="flex-1 p-5 min-w-0">
              {post.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[0.625rem] font-semibold px-2 py-0.5 rounded"
                      style={{ background: "rgba(114,89,181,.08)", color: "#7259B5" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <h2 className="text-lg font-bold text-[#0D0D0D] leading-snug mb-2 group-hover:text-[#7259B5] transition-colors">
                {post.titulo}
              </h2>
              {post.seo_descricao && (
                <p className="text-sm text-black/45 leading-relaxed line-clamp-2">{post.seo_descricao}</p>
              )}
              {post.publicado_em && (
                <p className="text-xs text-black/30 mt-3">{fmtDate(post.publicado_em)}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
