"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft, Plus, Trash2, GripVertical,
  Type, AlignLeft, Image as ImageIcon, Quote,
  Check, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { Select } from "@/components/ui/Select";

// ─── Block types ────────────────────────────────────────────────────────────

type BlockType = "paragraph" | "heading2" | "heading3" | "image" | "quote";

type Block = {
  id: string;
  type: BlockType;
  content?: string;
  url?: string;
  alt?: string;
  caption?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── Block editor ────────────────────────────────────────────────────────────

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "Parágrafo",
  heading2:  "Título",
  heading3:  "Subtítulo",
  image:     "Imagem",
  quote:     "Citação",
};

const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  paragraph: AlignLeft,
  heading2:  Type,
  heading3:  Type,
  image:     ImageIcon,
  quote:     Quote,
};

function BlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  block: Block;
  onChange: (b: Block) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const inputCls = "w-full bg-transparent outline-none resize-none text-[#282525] placeholder:text-black/25";

  return (
    <div
      className="group flex gap-3 rounded p-3 transition hover:bg-black/[.02]"
      style={{ border: "1px solid transparent" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(13,13,13,.08)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
    >
      {/* Move handle */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 rounded hover:bg-black/[.06] disabled:opacity-20"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-black/40">
            <path d="M5 2L9 7H1L5 2Z" />
          </svg>
        </button>
        <GripVertical size={12} className="text-black/25" />
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 rounded hover:bg-black/[.06] disabled:opacity-20"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-black/40">
            <path d="M5 8L1 3H9L5 8Z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {block.type === "paragraph" && (
          <textarea
            className={`${inputCls} text-sm leading-relaxed`}
            placeholder="Escreva um parágrafo..."
            value={block.content ?? ""}
            rows={3}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
          />
        )}
        {block.type === "heading2" && (
          <input
            className={`${inputCls} text-xl font-bold`}
            placeholder="Título da seção"
            value={block.content ?? ""}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
          />
        )}
        {block.type === "heading3" && (
          <input
            className={`${inputCls} text-base font-semibold`}
            placeholder="Subtítulo"
            value={block.content ?? ""}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
          />
        )}
        {block.type === "quote" && (
          <textarea
            className={`${inputCls} text-sm leading-relaxed italic`}
            placeholder="Citação..."
            value={block.content ?? ""}
            rows={2}
            style={{ borderLeft: "3px solid rgba(114,89,181,.4)", paddingLeft: "0.75rem" }}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
          />
        )}
        {block.type === "image" && (
          <div className="space-y-2">
            <input
              className={`${inputCls} text-sm border-b pb-1`}
              style={{ borderColor: "rgba(13,13,13,.08)" }}
              placeholder="URL da imagem"
              value={block.url ?? ""}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
            />
            <input
              className={`${inputCls} text-xs`}
              placeholder="Texto alternativo (alt)"
              value={block.alt ?? ""}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
            />
            <input
              className={`${inputCls} text-xs`}
              placeholder="Legenda"
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
            />
            {block.url && (
              <img
                src={block.url}
                alt={block.alt ?? ""}
                className="max-h-48 rounded object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
          </div>
        )}
        <p className="text-[0.625rem] text-black/25 mt-1">{BLOCK_LABELS[block.type]}</p>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition hover:bg-black/[.04]"
      >
        <Trash2 size={13} className="text-[#D94E4E]/75" />
      </button>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BlogEditorPage() {
  const router   = useRouter();
  const { slug: id } = useParams<{ slug: string }>();
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();

  const [titulo, setTitulo]           = useState("");
  const [slug, setSlug]               = useState("");
  const [tagsRaw, setTagsRaw]         = useState("");
  const [seoDesc, setSeoDesc]         = useState("");
  const [imgCapa, setImgCapa]         = useState("");
  const [imgAlt, setImgAlt]           = useState("");
  const [status, setStatus]           = useState<"rascunho" | "publicado">("rascunho");
  const [blocks, setBlocks]           = useState<Block[]>([{ id: uid(), type: "paragraph", content: "" }]);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [slugManual, setSlugManual]   = useState(false);
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: perfil } = await (supabase as any)
        .from("profiles")
        .select("jards_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (perfil?.jards_super_admin !== true) { router.push("/dashboard"); return; }

      const { data: post } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("id", id)
        .single();

      if (!post) { router.push("/gerenciar-blog"); return; }

      setTitulo(post.titulo ?? "");
      setSlug(post.slug ?? "");
      setTagsRaw((post.tags ?? []).join(", "));
      setSeoDesc(post.seo_descricao ?? "");
      setImgCapa(post.imagem_capa ?? "");
      setImgAlt(post.imagem_alt ?? "");
      setStatus(post.status ?? "rascunho");

      let parsed: Block[] = [];
      try { parsed = JSON.parse(post.conteudo || "[]"); } catch { parsed = []; }
      if (parsed.length === 0) parsed = [{ id: uid(), type: "paragraph", content: "" }];
      setBlocks(parsed);
      setLoading(false);
    }
    load();
  }, [id]);

  // Auto-slug from title
  useEffect(() => {
    if (!slugManual && titulo) setSlug(slugify(titulo));
  }, [titulo, slugManual]);

  const save = useCallback(async (nextStatus?: "rascunho" | "publicado") => {
    setSaving(true);
    setError(null);
    const s = nextStatus ?? status;
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    const conteudo = JSON.stringify(blocks);

    const { error: err } = await (supabase as any)
      .from("blog_posts")
      .update({ titulo, slug, tags, seo_descricao: seoDesc, imagem_capa: imgCapa, imagem_alt: imgAlt, status: s, conteudo })
      .eq("id", id);

    setSaving(false);
    if (err) { setError(err.message); }
    else { setStatus(s); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }, [titulo, slug, tagsRaw, seoDesc, imgCapa, imgAlt, status, blocks, id, supabase]);

  const addBlock = (type: BlockType) => {
    setBlocks((prev) => [...prev, { id: uid(), type, content: "", url: "", alt: "", caption: "" }]);
  };

  const updateBlock = (idx: number, b: Block) => {
    setBlocks((prev) => { const next = [...prev]; next[idx] = b; return next; });
  };

  const deleteBlock = (idx: number) => {
    setBlocks((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [{ id: uid(), type: "paragraph", content: "" }] : next;
    });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  function handleDelete() {
    confirmDelete({
      title: "Excluir este post?",
      description: "O post sai do blog público e não pode ser recuperado.",
      onConfirm: async () => {
        setDeleting(true);
        try {
          await excluirPorId(supabase, "blog_posts", id);
        } finally {
          setDeleting(false);
        }
        router.push("/gerenciar-blog");
      },
    });
  }

  const inputCls = "w-full px-3 py-2 rounded text-sm outline-none transition bg-white placeholder:text-black/25 focus:ring-1 focus:ring-[#7259B5]/30";
  const inputStyle = { border: "1px solid rgba(13,13,13,.10)" };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 rounded-full border-2 border-[#7259B5] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ background: "white", borderBottom: "1px solid rgba(13,13,13,.08)" }}
      >
        <button
          onClick={() => router.push("/gerenciar-blog")}
          className="flex items-center gap-1.5 text-sm text-black/40 hover:text-[#282525] transition"
        >
          <ChevronLeft size={16} /> Blog
        </button>

        <div className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1 text-xs text-[#D94E4E]">
              <AlertCircle size={12} /> {error}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-[#2E8932]">
              <Check size={12} /> Salvo
            </span>
          )}

          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "rascunho" | "publicado")}
            className="text-xs px-2 py-1.5 rounded outline-none"
            style={{ border: "1px solid rgba(13,13,13,.10)", color: status === "publicado" ? "#2E8932" : "rgba(13,13,13,.45)" }}
          >
            <option value="rascunho">Rascunho</option>
            <option value="publicado">Publicado</option>
          </Select>

          <button
            onClick={() => save()}
            disabled={saving}
            className="px-4 py-1.5 rounded text-sm font-semibold transition"
            style={{ color: "#7259B5", border: "1px solid rgba(114,89,181,.25)", background: "white" }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 rounded text-sm transition hover:bg-black/[.04]"
            style={{ color: "#D94E4E", border: "1px solid rgba(217,78,78,.20)" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-[1fr_17.5rem] gap-6 items-start">
        {/* Main: content */}
        <div>
          {/* Cover image preview */}
          {imgCapa && (
            <div className="mb-6 rounded overflow-hidden" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
              <img
                src={imgCapa}
                alt={imgAlt || "Capa do post"}
                className="w-full max-h-64 object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            </div>
          )}

          {/* Title */}
          <input
            className="w-full text-3xl font-bold text-[#282525] bg-transparent outline-none placeholder:text-black/20 mb-6"
            placeholder="Título do post"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />

          {/* Blocks */}
          <div className="space-y-1">
            {blocks.map((block, idx) => (
              <BlockEditor
                key={block.id}
                block={block}
                onChange={(b) => updateBlock(idx, b)}
                onDelete={() => deleteBlock(idx)}
                onMoveUp={() => moveBlock(idx, -1)}
                onMoveDown={() => moveBlock(idx, 1)}
                isFirst={idx === 0}
                isLast={idx === blocks.length - 1}
              />
            ))}
          </div>

          {/* Add block */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(["paragraph", "heading2", "heading3", "image", "quote"] as BlockType[]).map((type) => {
              const Icon = BLOCK_ICONS[type];
              return (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition hover:bg-black/[.04]"
                  style={{ border: "1px solid rgba(13,13,13,.10)", color: "rgba(13,13,13,.50)" }}
                >
                  <Plus size={11} />
                  <Icon size={11} />
                  {BLOCK_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar: metadata */}
        <div className="space-y-4 rounded p-5 sticky top-16" style={{ background: "white", border: "1px solid rgba(13,13,13,.08)" }}>
          <p className="text-[0.6875rem] font-bold tracking-[.08em] uppercase text-black/30">Metadados</p>

          <div>
            <label className="block text-xs font-medium text-black/50 mb-1">Slug</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-black/30 flex-shrink-0">/blog/</span>
              <input
                className={`${inputCls} flex-1`}
                style={inputStyle}
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                onBlur={(e) => setSlug(slugify(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-black/50 mb-1">Tags</label>
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="captação, patrocínio, cultura"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
            />
            <p className="text-[0.625rem] text-black/30 mt-1">Separadas por vírgula</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-black/50 mb-1">SEO — Descrição</label>
            <textarea
              className={`${inputCls} resize-none`}
              style={inputStyle}
              placeholder="Resumo para mecanismos de busca (até 160 chars)"
              value={seoDesc}
              rows={3}
              maxLength={160}
              onChange={(e) => setSeoDesc(e.target.value)}
            />
            <p className="text-[0.625rem] text-black/30 mt-1">{seoDesc.length}/160</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-black/50 mb-1">Imagem de capa — URL</label>
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="https://..."
              value={imgCapa}
              onChange={(e) => setImgCapa(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-black/50 mb-1">Texto alternativo da imagem</label>
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Descrição da imagem"
              value={imgAlt}
              onChange={(e) => setImgAlt(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
