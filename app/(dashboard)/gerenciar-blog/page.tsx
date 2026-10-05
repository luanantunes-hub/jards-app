"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Globe, Clock, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ListContent, ListEmptyState, ListPageHeader, ListSummary, PrimaryListAction } from "@/components/list/ListPagePrimitives";

type Post = {
  id: string;
  titulo: string;
  slug: string;
  tags: string[];
  status: "rascunho" | "publicado";
  publicado_em: string | null;
  created_at: string;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BlogAdminPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [posts, setPosts]       = useState<Post[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // O blog é da Jards: todo cadastro novo é admin da própria organização.
      const { data: perfil } = await (supabase as any)
        .from("profiles")
        .select("jards_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (perfil?.jards_super_admin !== true) {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);

      const { data } = await (supabase as any)
        .from("blog_posts")
        .select("id, titulo, slug, tags, status, publicado_em, created_at")
        .order("created_at", { ascending: false });
      setPosts(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleNew() {
    setCreating(true);
    setError(null);
    const { data, error: insertError } = await (supabase as any)
      .from("blog_posts")
      .insert({ titulo: "Novo post", slug: `post-${Date.now()}` })
      .select("id")
      .single();
    if (data?.id) { router.push(`/gerenciar-blog/${data.id}`); return; }
    setCreating(false);
    setError(insertError?.message ? `Não foi possível criar o post: ${insertError.message}` : "Não foi possível criar o post. Tente novamente.");
  }

  const publicados = posts.filter(post => post.status === "publicado").length;

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader
        eyebrow="Conteúdo"
        title="Blog"
        summary={isAdmin && !loading && <><ListSummary strong={publicados} tone="#2E8932">{publicados === 1 ? "publicado" : "publicados"}</ListSummary><ListSummary strong={posts.length - publicados}>{posts.length - publicados === 1 ? "rascunho" : "rascunhos"}</ListSummary></>}
        actions={<PrimaryListAction onClick={() => void handleNew()} disabled={creating || !isAdmin}><Plus size={13} aria-hidden="true" />{creating ? "Criando…" : "Novo post"}</PrimaryListAction>}
      />
      <ListContent>
        <div className="mx-auto max-w-4xl">
          {error && <p role="alert" className="mb-4 rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.75rem] text-[#B23A3A]">{error}</p>}
          {!isAdmin || loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Carregando posts">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="h-3 w-20 rounded bg-black/[.06]" />
                  <div className="mt-2 h-4 w-2/3 rounded bg-black/[.06]" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-black/[.04]" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <ListEmptyState
              icon={FileText}
              title="Nenhum post ainda"
              description="Os posts publicados aparecem no blog público do Jards."
              action={<PrimaryListAction onClick={() => void handleNew()} disabled={creating}><Plus size={13} aria-hidden="true" />Escrever o primeiro post</PrimaryListAction>}
            />
          ) : (
            <ul className="space-y-2">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/gerenciar-blog/${post.id}`}
                    className="flex w-full items-start gap-4 rounded border bg-white p-4 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                    style={{ borderColor: "rgba(13,13,13,.08)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="rounded border bg-white px-1.5 py-0.5 text-[0.625rem] font-medium"
                          style={post.status === "publicado" ? { borderColor: "#2E893247", color: "#2E8932" } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.45)" }}
                        >
                          {post.status === "publicado" ? "Publicado" : "Rascunho"}
                        </span>
                        {post.tags?.length > 0 && (
                          <span className="flex items-center gap-1 text-[0.625rem] text-black/35">
                            <Tag size={9} aria-hidden="true" />
                            {post.tags.slice(0, 3).join(", ")}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-[#0D0D0D]">{post.titulo || "Sem título"}</p>
                      <p className="mt-0.5 text-xs text-black/35">/{post.slug}</p>
                    </div>
                    <div className="mt-0.5 flex flex-shrink-0 items-center gap-1 text-[0.6875rem] tabular-nums text-black/30">
                      {post.status === "publicado" ? <Globe size={11} aria-hidden="true" /> : <Clock size={11} aria-hidden="true" />}
                      {post.status === "publicado" ? fmtDate(post.publicado_em) : fmtDate(post.created_at)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ListContent>
    </div>
  );
}
