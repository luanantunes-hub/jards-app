"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, GripVertical, RotateCcw, Settings2 } from "lucide-react";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { escalaUi } from "@/lib/escala-ui";

export type ColumnDefinition<Id extends string = string> = {
  id: Id;
  label: string;
  hideable?: boolean;
  /** Mantém a coluna disponível no menu, mas fora da visualização inicial. */
  defaultHidden?: boolean;
  width?: string;
  /** Faz a coluna absorver o espaço horizontal restante da tabela. */
  grow?: boolean;
};

type StoredPreferences<Id extends string> = { order: Id[]; hidden: Id[] };

export function useColumnManager<Id extends string>(storageKey: string, definitions: readonly ColumnDefinition<Id>[]) {
  const defaultOrder = useMemo(() => definitions.map(column => column.id), [definitions]);
  const defaultHidden = useMemo(() => definitions.filter(column => column.defaultHidden && column.hideable !== false).map(column => column.id), [definitions]);
  const [order, setOrder] = useState<Id[]>(defaultOrder);
  const [hidden, setHidden] = useState<Id[]>(defaultHidden);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`jards:columns:${storageKey}`) ?? "null") as StoredPreferences<Id> | null;
      if (stored) {
        const valid = new Set(defaultOrder);
        const restored = stored.order.filter(id => valid.has(id));
        setOrder([...restored, ...defaultOrder.filter(id => !restored.includes(id))]);
        setHidden(stored.hidden.filter(id => valid.has(id) && definitions.find(column => column.id === id)?.hideable !== false));
      } else {
        setOrder(defaultOrder);
        setHidden(defaultHidden);
      }
    } catch { /* preferências inválidas voltam ao padrão */ }
    setReady(true);
  }, [defaultHidden, defaultOrder, definitions, storageKey]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(`jards:columns:${storageKey}`, JSON.stringify({ order, hidden } satisfies StoredPreferences<Id>));
  }, [hidden, order, ready, storageKey]);

  const columns = order.map(id => definitions.find(column => column.id === id)).filter((column): column is ColumnDefinition<Id> => Boolean(column));
  const visible = columns.filter(column => !hidden.includes(column.id));
  const toggle = (id: Id) => setHidden(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const move = (source: Id, target: Id) => setOrder(current => { const next = [...current]; const from = next.indexOf(source); const to = next.indexOf(target); if (from < 0 || to < 0 || from === to) return current; next.splice(from, 1); next.splice(to, 0, source); return next; });
  const reset = () => { setOrder(defaultOrder); setHidden(defaultHidden); };
  return { columns, visible, hidden, toggle, move, reset };
}

export function ManagedTable<Id extends string>({ storageKey, definitions, className = "", fitContainer = false, children }: { storageKey: string; definitions: readonly ColumnDefinition<Id>[]; className?: string; fitContainer?: boolean; children: React.ReactNode }) {
  const manager = useColumnManager(storageKey, definitions);
  const tableRef = useRef<HTMLTableElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalRows, setTotalRows] = useState(0);
  const safeKey = storageKey.replace(/[^a-zA-Z0-9_-]/g, "-");
  const visibleOrder = manager.visible.map(column => column.id);
  // Peso da coluna "grow" proporcional à largura mínima: com várias colunas
  // crescendo, nenhuma é alargada além do mínimo enquanto a tabela não cabe.
  const template = manager.visible.map(column => {
    const width = column.width ?? "8.75rem";
    const peso = Number.parseFloat(width);
    return column.grow ? `minmax(${width}, ${Number.isFinite(peso) && peso > 0 ? peso : 1}fr)` : width;
  }).join(" ");
  // Coluna "grow" só ocupa a largura que sobra: contain:inline-size impede que o
  // texto mais longo dela (min-width:max-content da tabela) a alargue.
  const rules = definitions.map((column, sourceIndex) => {
    const visualIndex = visibleOrder.indexOf(column.id);
    return `.managed-${safeKey} tr > :nth-child(${sourceIndex + 1}){${visualIndex < 0 ? "display:none!important;" : `display:block;order:${visualIndex};${column.grow ? "contain:inline-size;" : ""}`}}`;
  }).join("");
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalRows);

  useEffect(() => {
    const stored = Number(localStorage.getItem(`jards:page-size:${storageKey}`));
    if ([15, 30, 45, 60].includes(stored)) setPageSize(stored);
  }, [storageKey]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const update = () => {
      const rows = Array.from(table.querySelectorAll("tbody > tr"));
      setTotalRows(rows.filter(row => !row.querySelector("td[colspan]")).length);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [children]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  function changePageSize(value: number) {
    setPageSize(value);
    setPage(1);
    localStorage.setItem(`jards:page-size:${storageKey}`, String(value));
  }

  return <div className="relative">
    <div className="flex items-center justify-start border-b px-3 py-2" style={{ borderColor: "rgba(13,13,13,.06)" }}><ColumnManager columns={manager.columns} hidden={manager.hidden} onToggle={manager.toggle} onMove={manager.move} onReset={manager.reset}/></div>
    <div className="overflow-x-auto">
      <style>{`.managed-${safeKey}{display:block;${fitContainer ? "width:100%;min-width:100%" : "min-width:max-content"}}.managed-${safeKey} thead,.managed-${safeKey} tbody{display:block}.managed-${safeKey} tr{display:grid;grid-template-columns:${template};min-width:100%}.managed-${safeKey} tbody>tr{display:none}.managed-${safeKey} tbody>tr:nth-child(n+${start}):nth-child(-n+${page * pageSize}){display:grid}.managed-${safeKey} tr>td[colspan]{display:block!important;grid-column:1/-1!important;order:0!important}.managed-${safeKey} tr>*{min-width:0}${rules}`}</style>
      <table ref={tableRef} className={`managed-${safeKey} ${className}`}>{children}</table>
    </div>
    {totalRows > 0 && <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <div className="flex items-center gap-2 text-[0.6875rem] text-black/40"><span>Exibir</span><CustomDropdown value={String(pageSize)} onChange={value => changePageSize(Number(value))} options={[15, 30, 45, 60].map(value => ({ value: String(value), label: String(value) }))} compact placement="top" className="w-[4.75rem]"/><span>por página</span></div>
      <div className="flex items-center gap-3"><span className="text-[0.6875rem] tabular-nums text-black/40">{start}–{end} de {totalRows}</span><div className="flex items-center gap-1"><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior" className="flex h-9 w-9 items-center justify-center rounded border border-black/10 bg-white text-black/45 transition hover:bg-black/[.04] disabled:opacity-25"><ChevronLeft size={14}/></button><button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} aria-label="Próxima página" className="flex h-9 w-9 items-center justify-center rounded border border-black/10 bg-white text-black/45 transition hover:bg-black/[.04] disabled:opacity-25"><ChevronRight size={14}/></button></div></div>
    </div>}
  </div>;
}

export function ColumnManager<Id extends string>({ columns, hidden, onToggle, onMove, onReset }: { columns: ColumnDefinition<Id>[]; hidden: Id[]; onToggle: (id: Id) => void; onMove: (source: Id, target: Id) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState<Id | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const MENU_WIDTH = 280;

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        left: Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH * escalaUi() - 8),
        top: rect.bottom + 4,
      });
    };
    updatePosition();
    // O menu é renderizado via portal — fica fora da árvore do rootRef no DOM real,
    // então "clicar fora" precisa checar as duas referências, senão qualquer
    // mousedown dentro do próprio menu (ex.: começar a arrastar uma coluna) já
    // conta como clique fora e fecha tudo antes do drag começar.
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return <div ref={rootRef} className="relative">
    <button
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
      aria-label="Configurar visualização da tabela"
      title="Visualização"
      className={`group flex h-8 w-8 items-center justify-center text-black/40 transition-colors hover:text-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 ${open ? "text-black/75" : ""}`}
    >
      <Settings2 size={15} strokeWidth={1.6} className="transition-[stroke-width] group-hover:[stroke-width:2.5]" />
    </button>
    {open && menuPos && createPortal(
      <div ref={menuRef} className="fixed z-50 rounded border border-black/[.09] bg-white p-2 shadow-[0_16px_45px_rgba(13,13,13,.12)]" style={{ left: menuPos.left, top: menuPos.top, width: `${MENU_WIDTH / 16}rem` }}>
        <div className="flex items-center justify-between px-2 pb-2 pt-1"><p className="text-[0.8125rem] font-semibold text-black/70">Colunas da lista</p><button type="button" onClick={onReset} title="Restaurar padrão" className="flex h-8 w-8 items-center justify-center rounded text-black/30 hover:bg-black/[.04] hover:text-black/55"><RotateCcw size={13}/></button></div>
        <div className="max-h-[min(320px,calc(100dvh-490px))] overflow-y-auto">{columns.map(column => {
          const isHidden = hidden.includes(column.id);
          return <div key={column.id} draggable onDragStart={() => setDragging(column.id)} onDragEnd={() => setDragging(null)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragging) onMove(dragging, column.id); setDragging(null); }} className={`flex h-10 items-center gap-2 rounded px-2 transition ${dragging === column.id ? "opacity-40" : "hover:bg-black/[.03]"}`}><GripVertical size={14} className="cursor-grab text-black/20"/><span className="flex-1 truncate text-[0.75rem] font-medium text-black/55">{column.label}</span>{column.hideable === false ? <Check size={13} className="text-black/20"/> : <button type="button" onClick={() => onToggle(column.id)} aria-label={`${isHidden ? "Exibir" : "Ocultar"} ${column.label}`} className={`flex h-7 w-7 items-center justify-center rounded hover:bg-black/[.05] ${isHidden ? "text-black/20" : "text-[#7259B5]"}`}>{isHidden ? <EyeOff size={14}/> : <Eye size={14}/>}</button>}</div>;
        })}</div>
      </div>,
      document.body,
    )}
  </div>;
}
