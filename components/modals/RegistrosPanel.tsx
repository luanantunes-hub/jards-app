"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertCircle, Check, X, Plus, Star, Trash2, Loader2, Search, Files, GripVertical,
} from "lucide-react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { StatusEdital } from "@/lib/supabase/types";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Registro = {
  campo_id:    string;
  campo_nome:  string;
  conteudo:    string | null;
  modelo_texto: string | null;
  tem_modelo:  boolean;
};

type CampoSugestao = {
  id:       string;
  nome:     string;
  tem_modelo: boolean;
  preview:  string;
  modelo_texto: string;
};

type InscricaoInfo = {
  id:              string;
  projeto_id:      string | null;
  empresa_crm_id:  string | null;
  empresa_nome:    string;
  empresa_logo:    string | null;
  empresa_domain?: string | null;
  empresa_site?:   string | null;
  projeto_nome:    string | null;
  valor:           number | null;
  status:          StatusEdital;
};

type Props = {
  inscricao: InscricaoInfo;
  onClose?: () => void;
  onOpenDocumentos?: () => void;
  embedded?: boolean;
};

const STATUS_COLOR: Record<StatusEdital, { bg: string; text: string }> = {
  interesse:  { bg: "rgba(13,13,13,.40)14", text: "rgba(13,13,13,.40)" },
  inscrito:   { bg: "#2D72B014", text: "#2D72B0" },
  em_analise: { bg: "#B07A1414", text: "#B07A14" },
  aprovado:   { bg: "#2E893214", text: "#2E8932" },
  reprovado:  { bg: "#D94E4E14", text: "#D94E4E" },
  cancelado:  { bg: "rgba(13,13,13,.40)14", text: "rgba(13,13,13,.40)" },
};

const STATUS_LABEL: Record<StatusEdital, string> = {
  interesse:  "Interesse",
  inscrito:   "Inscrito",
  em_analise: "Em análise",
  aprovado:   "Aprovado",
  reprovado:  "Reprovado",
  cancelado:  "Cancelado",
};

function fmtValor(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v}`;
}

/* ─── Campo resposta individual ─────────────────────────────────────────── */

function CampoItem({
  reg, inscricaoId, projetoId, onSaved, onDelete, dragHandle,
}: {
  reg: Registro;
  inscricaoId: string;
  projetoId: string | null;
  onSaved: () => void;
  onDelete: () => void;
  dragHandle?: React.ReactNode;
}) {
  const supabase    = createClient();
  const [text,   setText]   = useState(reg.conteudo ?? reg.modelo_texto ?? "");
  const [saving, setSaving] = useState(false);
  const [elev,   setElev]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(
    reg.tem_modelo && (reg.conteudo ?? reg.modelo_texto ?? "") === (reg.modelo_texto ?? "")
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutoSave(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSave(value), 800);
  }

  async function doSave(value: string) {
    setSaving(true);
    const { error: saveError } = await (supabase as any).from("respostas_inscricao").upsert({
      inscricao_id: inscricaoId,
      campo_id:     reg.campo_id,
      conteudo:     value,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "inscricao_id,campo_id" });
    setError(saveError?.message ?? null);
    setSaving(false);
  }

  async function elevarModelo() {
    if (!projetoId || !text.trim()) return;
    setElev(true);
    const { error: modelError } = await (supabase as any).rpc("salvar_resposta_padrao_projeto", {
      p_projeto_id: projetoId,
      p_campo_id: reg.campo_id,
      p_conteudo: text,
    });
    setError(modelError?.message ?? null);
    setElev(false);
    if (!modelError) {
      setIsDefault(true);
      onSaved();
    }
  }

  async function handleDelete() {
    const { error: deleteError } = await (supabase as any).from("respostas_inscricao")
      .delete()
      .eq("inscricao_id", inscricaoId)
      .eq("campo_id", reg.campo_id);
    if (deleteError) { setError(deleteError.message); return; }
    onDelete();
  }

  return (
    <div className="border rounded overflow-hidden" style={{ borderColor: "rgba(13,13,13,.1)" }}>
      {/* Label row */}
      <div className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "rgba(13,13,13,.07)", background: "rgba(13,13,13,.025)" }}>
        <div className="flex min-w-0 items-center gap-2">
          {dragHandle}
          <span className="truncate text-[11px] font-bold text-black/60">{reg.campo_nome}</span>
        </div>
        <div className="flex items-center gap-1">
          {saving && <Loader2 size={10} className="animate-spin text-black/25" />}
          {isDefault && (
            <span className="rounded bg-black/[.05] px-1.5 py-0.5 text-[9px] font-bold text-black">
              resposta padrão
            </span>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setIsDefault(false); scheduleAutoSave(e.target.value); }}
        rows={4}
        className="w-full px-3 py-2.5 text-[13px] text-black/75 resize-none bg-white focus:outline-none placeholder-black/20"
        placeholder="Digite a resposta…"
      />

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-t"
        style={{ borderColor: "rgba(13,13,13,.07)", background: "rgba(13,13,13,.015)" }}>
        <button
          onClick={elevarModelo}
          disabled={elev || !projetoId || !text.trim()}
          className={`flex items-center gap-1.5 text-[10.5px] font-semibold transition disabled:opacity-30 ${isDefault ? "text-black" : "text-black/40 hover:text-black/70"}`}
        >
          {elev ? <Loader2 size={10} className="animate-spin" /> : isDefault ? <Check size={10} /> : <Star size={10} />}
          {isDefault ? "Resposta padrão" : "Eleger como padrão"}
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-[10.5px] font-semibold text-black/30 hover:text-red-500 transition"
        >
          <Trash2 size={10} /> Deletar
        </button>
      </div>
      {error && <div className="flex items-center gap-1.5 border-t border-[#D94E4E]/15 px-3 py-2 text-[10px] text-[#D94E4E]"><AlertCircle size={11}/>{error}</div>}
    </div>
  );
}

function SortableCampoItem(props: Omit<React.ComponentProps<typeof CampoItem>, "dragHandle">) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: props.reg.campo_id });

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className="flex h-6 w-5 shrink-0 touch-none cursor-grab items-center justify-center rounded text-black/20 transition hover:bg-black/[.05] hover:text-black/45 active:cursor-grabbing"
      aria-label={`Reordenar ${props.reg.campo_nome}`}
    >
      <GripVertical size={13} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        position: "relative",
        zIndex: isDragging ? 2 : 1,
      }}
    >
      <CampoItem {...props} dragHandle={dragHandle} />
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────── */

export function RegistrosPanel({ inscricao, onClose, onOpenDocumentos, embedded = false }: Props) {
  const supabase  = createClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const [registros,    setRegistros]    = useState<Registro[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showBusca,    setShowBusca]    = useState(false);
  const [buscaVisible, setBuscaVisible] = useState(false);
  const [searchText,   setSearchText]   = useState("");
  const [sugestoes,    setSugestoes]    = useState<CampoSugestao[]>([]);
  const [loadingSug,   setLoadingSug]   = useState(false);
  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  useModalDismiss(() => onClose?.(), { enabled: !embedded });

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_registros_inscricao", {
        p_inscricao_id: inscricao.id,
        p_projeto_id:   inscricao.projeto_id ?? "00000000-0000-0000-0000-000000000000",
      });
      if (error) throw error;
      setRegistros((data ?? []) as Registro[]);
      setPanelError(null);
    } catch (error) {
      setRegistros([]);
      setPanelError(error instanceof Error ? error.message : "Não foi possível carregar as perguntas.");
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inscricao.id, inscricao.projeto_id]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  function openBusca() {
    setPanelError(null);
    setShowBusca(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setBuscaVisible(true);
      setTimeout(() => searchRef.current?.focus(), 50);
    }));
  }

  function closeBusca() {
    setBuscaVisible(false);
    setTimeout(() => {
      setShowBusca(false);
      setSearchText("");
      setSugestoes([]);
    }, 240);
  }

  useModalDismiss(closeBusca, { enabled: showBusca });

  // Debounced search
  useEffect(() => {
    if (!showBusca) return;
    const t = setTimeout(async () => {
      if (!inscricao.projeto_id) { setSugestoes([]); return; }
      setLoadingSug(true);
      const { data, error } = await (supabase as any).rpc("get_perguntas_projeto", { p_projeto_id: inscricao.projeto_id, p_busca: searchText.trim() });
      if (error) setPanelError(error.message);
      setSugestoes((data ?? []).filter((d: any) => !registros.some(registro => registro.campo_id === d.campo_id)).map((d: any) => ({ id: d.campo_id, nome: d.campo_nome, tem_modelo: d.tem_modelo, modelo_texto: d.modelo_texto ?? "", preview: (d.modelo_texto ?? "").slice(0, 90) })));
      setLoadingSug(false);
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, showBusca, inscricao.projeto_id, registros]);

  async function addCampo(campoId: string) {
    if (!inscricao.projeto_id || adding) return;
    setAdding(true); setPanelError(null);
    const { error } = await (supabase as any).rpc("adicionar_pergunta_inscricao", { p_inscricao_id: inscricao.id, p_projeto_id: inscricao.projeto_id, p_campo_id: campoId });
    if (error) { setPanelError(error.message); setAdding(false); return; }
    closeBusca();
    await fetchRegistros(); setAdding(false);
  }

  async function createAndAdd() {
    if (!searchText.trim() || adding) return;
    setAdding(true); setPanelError(null);
    const { error } = await (supabase as any).rpc("criar_pergunta_inscricao", {
      p_inscricao_id: inscricao.id,
      p_projeto_id: inscricao.projeto_id,
      p_nome: searchText.trim(),
    });
    if (error) { setPanelError(error.message); setAdding(false); return; }
    closeBusca();
    await fetchRegistros(); setAdding(false);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering) return;

    const previous = registros;
    const oldIndex = previous.findIndex(registro => registro.campo_id === active.id);
    const newIndex = previous.findIndex(registro => registro.campo_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(previous, oldIndex, newIndex);
    setRegistros(reordered);
    setReordering(true);
    setPanelError(null);

    const { error } = await (supabase as any).rpc("reordenar_respostas_inscricao", {
      p_inscricao_id: inscricao.id,
      p_campo_ids: reordered.map(registro => registro.campo_id),
    });

    if (error) {
      setRegistros(previous);
      setPanelError(error.message);
    }
    setReordering(false);
  }

  const sc = STATUS_COLOR[inscricao.status] ?? STATUS_COLOR.interesse;

  return (
    <div
      className={embedded ? "w-full" : "fixed inset-0 z-50 flex items-stretch justify-end"}
      style={embedded ? undefined : { background: "rgba(0,0,0,.4)" }}
      onClick={e => { if (!embedded && e.target === e.currentTarget) onClose?.(); }}
    >
      <div role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} aria-label={embedded ? undefined : "Conteúdo preenchido"} className={embedded
        ? "bg-white w-full flex flex-col rounded border overflow-hidden"
        : "bg-white w-full max-w-[680px] flex flex-col h-full shadow-2xl overflow-hidden"
      } style={embedded ? { borderColor: "rgba(13,13,13,.08)" } : undefined}>

        {/* Header empresa */}
        <div className="flex-shrink-0 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-start justify-between mb-3">
            {embedded ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-black/30">Inscrição</p>
                <h2 className="mt-1 text-[17px] font-bold text-black">Conteúdo preenchido</h2>
              </div>
            ) : (
              <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded hover:bg-black/6 text-black/30 hover:text-black/60 transition">
                <X size={14} />
              </button>
            )}
            <div className="flex flex-col items-end gap-1">
              {!embedded && <span className="text-[10px] font-bold px-2.5 py-1 rounded" style={{ background: sc.bg, color: sc.text }}>
                {STATUS_LABEL[inscricao.status]}
              </span>}
              {onOpenDocumentos && (
                <button onClick={onOpenDocumentos}
                  className="flex items-center gap-1 text-[11px] font-semibold text-black/35 hover:text-[#7259B5] transition">
                  <Files size={11} /> Documentos do Projeto +
                </button>
              )}
            </div>
          </div>

          {!embedded && <div className="flex items-center gap-3">
            <CompanyLogo nome={inscricao.empresa_nome} domain={inscricao.empresa_domain} site={inscricao.empresa_site} logo_url={inscricao.empresa_logo} size={36} className="flex-shrink-0" />
            <div>
              <p className="font-bold text-[15px] text-black">{inscricao.empresa_nome}</p>
              <div className="flex items-center gap-3 mt-0.5">
                {inscricao.projeto_nome && (
                  <span className="text-xs text-black/40 font-medium">{inscricao.projeto_nome}</span>
                )}
                {inscricao.valor && (
                  <span className="text-xs font-bold text-black/60">{fmtValor(inscricao.valor)}</span>
                )}
              </div>
            </div>
          </div>}
        </div>

        {/* Conteúdo preenchido */}
        <div className={`${embedded ? "px-6 py-6" : "flex-1 overflow-y-auto px-6 py-5"}`}>
          {panelError && !showBusca && <div role="alert" className="mb-4 flex items-start gap-2 rounded border border-[#D94E4E]/20 px-3 py-2.5 text-[11px] text-[#D94E4E]"><AlertCircle size={13} className="mt-0.5 shrink-0"/>{panelError}</div>}
          {loading ? (
            <div className="py-10 text-center text-xs text-black/30">Carregando…</div>
          ) : registros.length === 0 ? (
            <div className="py-20 text-center">
              <Plus size={28} className="text-black/10 mx-auto mb-3" />
              <p className="text-sm font-semibold text-black/25">Nenhum conteúdo preenchido</p>
              <p className="text-xs text-black/20 mt-1">Adicione uma pergunta para começar a preencher a inscrição</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={registros.map(registro => registro.campo_id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {registros.map(reg => (
                    <SortableCampoItem
                      key={reg.campo_id}
                      reg={reg}
                      inscricaoId={inscricao.id}
                      projetoId={inscricao.projeto_id}
                      onSaved={fetchRegistros}
                      onDelete={fetchRegistros}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Add button bottom */}
        {!showBusca && (
          <div className="flex-shrink-0 px-6 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <button
              onClick={openBusca}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-black/[.15] bg-white py-3 text-xs font-bold text-black transition hover:bg-black/[.04] active:scale-[.995]"
            >
              <Plus size={12} /> Novo conteúdo
            </button>
          </div>
        )}
      </div>

      {showBusca && (
        <div
          className="fixed inset-0 z-[70] flex items-stretch justify-end transition-colors duration-200"
          style={{ background: buscaVisible ? "rgba(0,0,0,.34)" : "rgba(0,0,0,0)" }}
          onClick={closeBusca}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Novo conteúdo"
            className={`flex h-full w-full max-w-[520px] flex-col rounded-l bg-white shadow-2xl transition-transform duration-200 ease-out ${buscaVisible ? "translate-x-0" : "translate-x-full"}`}
            onClick={event => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <h3 className="text-[15px] font-semibold text-black">Novo conteúdo</h3>
              <button type="button" onClick={closeBusca} className="flex h-8 w-8 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60" aria-label="Fechar">
                <X size={15} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-5">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
                <input
                  ref={searchRef}
                  value={searchText}
                  onChange={event => setSearchText(event.target.value)}
                  placeholder="Buscar ou criar campo…"
                  className="w-full rounded border border-black/[.14] bg-white py-3 pl-9 pr-10 text-[13px] text-black outline-none transition placeholder:text-black/30 focus:border-black/30 focus:ring-2 focus:ring-black/[.05]"
                  onKeyDown={event => {
                    if (event.key === "Escape") { event.preventDefault(); closeBusca(); }
                    if (event.key === "Enter" && sugestoes.length === 0 && searchText.trim()) void createAndAdd();
                  }}
                />
                {loadingSug && <Loader2 size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-black/25" />}
              </div>

              <div className="mt-3 overflow-hidden rounded border border-black/[.09] bg-white">
                {sugestoes.map(sugestao => (
                  <button
                    key={sugestao.id}
                    type="button"
                    onClick={() => void addCampo(sugestao.id)}
                    disabled={adding}
                    className="w-full border-b border-black/[.06] px-4 py-3 text-left transition last:border-0 hover:bg-black/[.03] disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[12.5px] font-semibold text-black/80">{sugestao.nome}</span>
                      {sugestao.tem_modelo && <span className="shrink-0 text-[9px] font-bold text-black/45">Resposta padrão</span>}
                    </div>
                    {sugestao.preview && <p className="mt-1 truncate text-[11px] text-black/35">{sugestao.preview}</p>}
                  </button>
                ))}

                {searchText.trim() && (
                  <button
                    type="button"
                    onClick={() => void createAndAdd()}
                    disabled={adding}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12px] text-black/55 transition hover:bg-black/[.03] disabled:opacity-40"
                  >
                    {adding ? <Loader2 size={12} className="shrink-0 animate-spin" /> : <Plus size={12} className="shrink-0" />}
                    Adicionar <span className="font-semibold text-black">"{searchText}"</span> como novo campo
                  </button>
                )}

                {!loadingSug && sugestoes.length === 0 && !searchText.trim() && (
                  <div className="px-4 py-8 text-center text-[12px] text-black/30">Digite para criar um novo campo</div>
                )}
              </div>

              {!inscricao.projeto_id && <div className="mt-3 flex items-center gap-1.5 text-[11px] text-black/35"><AlertCircle size={12}/>Sem projeto, o campo será usado somente nesta inscrição.</div>}
              {panelError && <div role="alert" className="mt-3 flex items-start gap-1.5 rounded border border-[#D94E4E]/20 px-3 py-2 text-[11px] leading-relaxed text-[#D94E4E]"><AlertCircle size={12} className="mt-0.5 shrink-0"/>{panelError}</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
