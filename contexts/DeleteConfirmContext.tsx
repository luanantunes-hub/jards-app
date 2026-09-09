"use client";
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { Trash2 } from "lucide-react";

type DeleteOptions = {
  title?: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
};

type DeleteConfirmContextType = {
  confirmDelete: (options: DeleteOptions) => void;
};

const DeleteConfirmContext = createContext<DeleteConfirmContextType | null>(null);

export function DeleteConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const optionsRef = useRef<DeleteOptions | null>(null);
  const [, forceRender] = useState(0);

  const confirmDelete = useCallback((opts: DeleteOptions) => {
    optionsRef.current = opts;
    setImgError(false);
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    forceRender(n => n + 1);
  }, []);

  function handleClose() {
    if (loading) return;
    setVisible(false);
    setTimeout(() => setOpen(false), 220);
  }

  async function handleConfirm() {
    if (!optionsRef.current) return;
    setLoading(true);
    await optionsRef.current.onConfirm();
    setLoading(false);
    handleClose();
  }

  const opts = optionsRef.current;

  return (
    <DeleteConfirmContext.Provider value={{ confirmDelete }}>
      {children}

      {open && opts && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{
            background: visible ? "rgba(0,0,0,.42)" : "rgba(0,0,0,0)",
            transition: "background 220ms ease",
          }}
          onClick={handleClose}
        >
          <div
            className="w-full max-w-[360px] overflow-hidden rounded bg-white shadow-2xl"
            style={{
              transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(.97)",
              opacity: visible ? 1 : 0,
              transition: "transform 220ms cubic-bezier(.32,.72,0,1), opacity 220ms ease",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Ilustração */}
            {!imgError && (
              <div className="flex items-end justify-center bg-black/[.02] pt-7 pb-0 overflow-hidden" style={{ height: 168 }}>
                <img
                  src="/mascote-lixeira.png"
                  alt=""
                  className="h-full w-auto object-contain object-bottom"
                  onError={() => setImgError(true)}
                />
              </div>
            )}

            {/* Conteúdo */}
            <div className={`px-6 text-center ${imgError ? "pt-8 pb-4" : "pt-5 pb-4"}`}>
              <h2 className="text-[15px] font-bold text-black/80">
                {opts.title ?? "Excluir este item?"}
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-black/40">
                {opts.description ?? "Apagado de vez, sem volta atrás."}
              </p>
            </div>

            {/* Ações */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: "rgba(13,13,13,.07)" }}
            >
              <button
                onClick={handleClose}
                disabled={loading}
                className="text-[12px] font-medium text-black/35 transition hover:text-black/55"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={loading}
                className="flex items-center gap-1.5 rounded bg-[#D94E4E] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#C04040] active:scale-[.98] disabled:opacity-50"
              >
                <Trash2 size={11} />
                {loading ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DeleteConfirmContext.Provider>
  );
}

export function useDeleteConfirm() {
  const ctx = useContext(DeleteConfirmContext);
  if (!ctx) throw new Error("useDeleteConfirm precisa estar dentro de DeleteConfirmProvider");
  return ctx;
}
