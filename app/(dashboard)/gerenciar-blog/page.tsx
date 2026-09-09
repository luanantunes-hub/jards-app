"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Globe, Clock, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: member } = await (supabase as any)
        .from("organization_members")
        .select("papel")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (member?.papel !== "admin") {
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
    const { data } = await (supabase as any)
      .from("blog_posts")
      .insert({ titulo: "Novo post", slug: `post-${Date.now()}` })
      .select("id")
      .single();
    if (data?.id) router.push(`/gerenciar-blog/${data.id}`);
    else setCreating(false);
  }

  if (!isAdmin || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 rounded-full border-2 border-[#7259B5] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-[#0D0D0D] tracking-tight">Blog</h1>
          <p className="text-sm text-black/40 mt-0.5">{posts.length} {posts.length === 1 ? "post" : "posts"}</p>
        </div>
        <button
          onClick={handleNew}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white transition"
          style={{ background: "#0D0D0D", opacity: creating ? 0.6 : 1 }}
        >
          <Plus size={15} />
          Novo post
        </button>
      </div>

      {/* List */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText size={32} className="text-black/20 mb-3" />
          <p className="text-sm text-black/40">Nenhum post ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => router.push(`/blog/${post.id}`)}
              className="w-full text-left flex items-start gap-4 p-4 rounded border transition hover:bg-black/[.02]"
              style={{ borderColor: "rgba(13,13,13,.08)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={
                      post.status === "publicado"
                        ? { background: "rgba(46,137,50,.10)", color: "#2E8932" }
                        : { background: "rgba(13,13,13,.06)", color: "rgba(13,13,13,.45)" }
                    }
                  >
                    {post.status === "publicado" ? "Publicado" : "Rascunho"}
                  </span>
                  {post.tags?.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-black/35">
                      <Tag size={9} />
                      {post.tags.slice(0, 3).join(", ")}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#0D0D0D] truncate">{post.titulo || "Sem título"}</p>
                <p className="text-xs text-black/35 mt-0.5">/{post.slug}</p>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-black/30 flex-shrink-0 mt-0.5">
                {post.status === "publicado" ? <Globe size={11} /> : <Clock size={11} />}
                {post.status === "publicado" ? fmtDate(post.publicado_em) : fmtDate(post.created_at)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
