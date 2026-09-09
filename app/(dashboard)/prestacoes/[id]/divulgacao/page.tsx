"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Megaphone, Check, X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";

type TipoDivulgacao =
  | "cartaz" | "folder" | "banner" | "programa"
  | "website" | "redes_sociais" | "release" | "video" | "outro";

type DivItem = {
  id: string;
  tipo: TipoDivulgacao;
  descricao: string | null;
  data_veiculacao: string | null;
  lei_mencionada: boolean;
  minc_logo: boolean;
  arquivo_url: string | null;
};

const TIPO_LABEL: Record<TipoDivulgacao, string> = {
  cartaz:       "Cartaz",
  folder:       "Folder / Panfleto",
  banner:       "Banner",
  programa:     "Programa",
  website:      "Website",
  redes_sociais:"Redes sociais",
  release:      "Release / Imprensa",
  video:        "Vídeo",
  outro:        "Outro",
};

const EMPTY: Omit<DivItem, "id"> = {
  tipo: "cartaz",
  descricao: "",
  data_veiculacao: "",
  lei_mencionada: false,
  minc_logo: false,
  arquivo_url: "",
};

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const Bool = ({ ok }: { ok: boolean }) =>
  ok
    ? <Check size={12} style={{ color: "#2E8932" }} />
    : <X size={12} style={{ color: "#D94E4E" }} />;

export default function DivulgacaoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [items, setItems] = useState<DivItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<DivItem, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("prestacao_divulgacao")
      .select("*")
      .eq("prestacao_id", id)
      .order("created_at");
    if (error) setErro(error.message);
    else {
      setErro(null);
      setItems((data ?? []) as DivItem[]);
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { load(); }, [load]);

  async function salvar() {
    setSaving(true);
    setErro(null);
    const { error } = await (supabase as any).from("prestacao_divulgacao").insert({
      prestacao_id: id,
      tipo: form.tipo,
      descricao: form.descricao || null,
      data_veiculacao: form.data_veiculacao || null,
      lei_mencionada: form.lei_mencionada,
      minc_logo: form.minc_logo,
      arquivo_url: form.arquivo_url || null,
    });
    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setModalOpen(false);
    setForm(EMPTY);
    load();
  }

  async function remover(itemId: string) {
    setDeletingId(itemId);
    setErro(null);
    const { error } = await (supabase as any).from("prestacao_divulgacao").delete().eq("id", itemId);
    setDeletingId(null);
    if (error) {
      setErro(error.message);
      return;
    }
    load();
  }

  const semLei = items.filter(i => !i.lei_mencionada).length;
  const semLogo = items.filter(i => !i.minc_logo).length;

  if (loading) return <div className="p-8 text-[13px] text-black/30">Carregando…</div>;

  return (
    <div className="px-8 py-6 max-w-4xl">

      {erro && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
          Não foi possível concluir a operação: {erro}
        </div>
      )}

      {/* Alertas de conformidade */}
      {semLei > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded border mb-4 text-[12px]"
          style={{ background: "#D94E4E08", borderColor: "#D94E4E30", color: "#D94E4E" }}>
          <span className="font-semibold flex-shrink-0">Atenção:</span>
          <span>
            {semLei} material{semLei > 1 ? "is" : ""} sem menção à Lei Rouanet / Lei de Incentivo à Cultura.
            A lei exige que todos os materiais citem o mecanismo de financiamento.
          </span>
        </div>
      )}
      {semLogo > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded border mb-4 text-[12px]"
          style={{ background: "#B07A1408", borderColor: "#B07A1430", color: "#B07A14" }}>
          <span className="font-semibold flex-shrink-0">Atenção:</span>
          <span>
            {semLogo} material{semLogo > 1 ? "is" : ""} sem logo do MinC.
            O uso da marca do Ministério da Cultura é obrigatório em todo material de divulgação.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-black/45">
          {items.length > 0
            ? `${items.length} material${items.length > 1 ? "is" : ""} cadastrado${items.length > 1 ? "s" : ""}`
            : "Nenhum material cadastrado"}
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#7259B5" }}
        >
          <Plus size={13} /> Adicionar material
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="bg-white rounded border flex flex-col items-center justify-center py-16 text-center"
          style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <Megaphone size={28} className="text-black/15 mb-3" />
          <p className="text-[13px] text-black/35 font-medium">Nenhum material de divulgação</p>
          <p className="text-[11px] text-black/25 mt-1 max-w-xs">
            Registre cartazes, banners, posts e demais materiais usados para divulgar o projeto,
            comprovando o cumprimento das obrigações de divulgação da Lei Rouanet.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                {["Tipo", "Descrição", "Veiculação", "Lei citada", "Logo MinC", "Arquivo", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-black/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-black/[.015] transition"
                  style={{ borderColor: "rgba(13,13,13,.05)" }}>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: "rgba(114,89,181,.08)", color: "#7259B5" }}>
                      {TIPO_LABEL[item.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-black/65 max-w-[200px] truncate">{item.descricao || "—"}</td>
                  <td className="px-4 py-3 text-black/50">{fmtDate(item.data_veiculacao)}</td>
                  <td className="px-4 py-3"><Bool ok={item.lei_mencionada} /></td>
                  <td className="px-4 py-3"><Bool ok={item.minc_logo} /></td>
                  <td className="px-4 py-3">
                    {item.arquivo_url ? (
                      <a href={item.arquivo_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] transition"
                        style={{ color: "#2D72B0" }}>
                        <ExternalLink size={11} /> Ver
                      </a>
                    ) : (
                      <span className="text-black/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => remover(item.id)}
                      disabled={deletingId === item.id}
                      className="text-black/20 hover:text-red-500 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,13,13,.35)" }}
          onClick={e => { if (e.target === e.currentTarget) { setModalOpen(false); setForm(EMPTY); } }}>
          <div className="bg-white rounded w-full max-w-md" style={{ boxShadow: "0 8px 32px rgba(13,13,13,.15)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[13px] font-bold text-black/80">Adicionar material de divulgação</p>
            </div>
            <div className="p-5 space-y-4">

              {/* Tipo */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Tipo de material</label>
                <Select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoDivulgacao }))}
                  className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none bg-white"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                >
                  {(Object.entries(TIPO_LABEL) as [TipoDivulgacao, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Descrição</label>
                <input
                  value={form.descricao ?? ""}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Cartaz A3 impresso, post Instagram 1080×1080…"
                  className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>

              {/* Data e URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Data de veiculação</label>
                  <input
                    type="date"
                    value={form.data_veiculacao ?? ""}
                    onChange={e => setForm(f => ({ ...f, data_veiculacao: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">URL do arquivo</label>
                  <input
                    value={form.arquivo_url ?? ""}
                    onChange={e => setForm(f => ({ ...f, arquivo_url: e.target.value }))}
                    placeholder="https://…"
                    className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 block">Conformidade</label>
                {([
                  { key: "lei_mencionada" as const, label: "Menciona a Lei Rouanet / Lei de Incentivo à Cultura" },
                  { key: "minc_logo" as const, label: "Exibe o logo do Ministério da Cultura (MinC)" },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="accent-[#7259B5]"
                    />
                    <span className="text-[12px] text-black/65">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-end gap-4"
              style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <button
                onClick={() => { setModalOpen(false); setForm(EMPTY); }}
                className="text-[12px] font-medium transition"
                style={{ color: "rgba(13,13,13,.35)" }}
                onMouseOver={e => (e.currentTarget.style.color = "rgba(13,13,13,.55)")}
                onMouseOut={e => (e.currentTarget.style.color = "rgba(13,13,13,.35)")}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={saving}
                className="px-4 py-2 rounded text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "#7259B5" }}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
