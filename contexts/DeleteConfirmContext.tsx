"use client";
import { createContext, useContext, useState, useCallback, useEffect, useId, useRef, ReactNode } from "react";
import { Trash2 } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  description?: string;
  /** Rótulo do botão de confirmação. Padrão: "Excluir". */
  confirmLabel?: string;
  /** Rótulo exibido enquanto a ação roda. Padrão: "Excluindo…". */
  pendingLabel?: string;
  /** Mascote da lixeira. Desligue em ações que não apagam dados (ex.: desconectar). */
  illustration?: boolean;
};

/**
 * `onConfirm` pode lançar um erro: a mensagem aparece dentro do diálogo,
 * que permanece aberto para nova tentativa ou cancelamento.
 * `blocked` apenas explica por que a exclusão não é possível agora.
 */
type DeleteOptions =
  | (ConfirmOptions & { blocked?: false; onConfirm: () => void | Promise<void> })
  | (ConfirmOptions & { blocked: true; onConfirm?: never });

type DeleteConfirmContextType = {
  confirmDelete: (options: DeleteOptions) => void;
};

const DeleteConfirmContext = createContext<DeleteConfirmContextType | null>(null);

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Não foi possível concluir a ação. Tente novamente.";
}

export function DeleteConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<DeleteOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const confirmDelete = useCallback((next: DeleteOptions) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpts(next);
    setError(null);
    setLoading(false);
    setImgError(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  const handleClose = useCallback(() => {
    if (loading) return;
    setVisible(false);
    closeTimer.current = setTimeout(() => {
      setOpts(null);
      setError(null);
      returnFocusRef.current?.focus?.();
    }, 220);
  }, [loading]);

  async function handleConfirm() {
    if (!opts || opts.blocked) return;
    setLoading(true);
    setError(null);
    try {
      await opts.onConfirm();
    } catch (failure) {
      setError(errorMessage(failure));
      setLoading(false);
      return;
    }
    setLoading(false);
    setVisible(false);
    closeTimer.current = setTimeout(() => {
      setOpts(null);
      returnFocusRef.current?.focus?.();
    }, 220);
  }

  useEffect(() => {
    if (!opts) return;
    // Cancelar recebe o foco: Enter acidental nunca dispara a exclusão.
    cancelRef.current?.focus();
  }, [opts]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      // O React do App Router escuta no próprio document: stopPropagation não
      // impede os listeners de modais (useModalDismiss), preventDefault sim.
      event.preventDefault();
      event.stopPropagation();
      handleClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const blocked = opts?.blocked === true;
  const showIllustration = !blocked && (opts?.illustration ?? true) && !imgError;

  return (
    <DeleteConfirmContext.Provider value={{ confirmDelete }}>
      {children}

      {opts && (
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-colors duration-200 motion-reduce:transition-none ${visible ? "bg-black/40" : "bg-black/0"}`}
          onClick={handleClose}
          onKeyDown={handleKeyDown}
        >
          <div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={opts.description === "" ? undefined : descriptionId}
            className={`w-full max-w-[22.5rem] overflow-hidden rounded bg-white shadow-2xl transition duration-200 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[.97] opacity-0"}`}
            onClick={e => e.stopPropagation()}
          >
            {showIllustration && (
              <div className="flex items-end justify-center overflow-hidden bg-black/[.02] pt-7" style={{ height: "10.5rem" }}>
                <img
                  src="/mascote-lixeira.png"
                  alt=""
                  className="h-full w-auto object-contain object-bottom"
                  onError={() => setImgError(true)}
                />
              </div>
            )}

            <div className={`px-6 text-center ${showIllustration ? "pb-4 pt-5" : "pb-4 pt-8"}`}>
              <h2 id={titleId} className="text-[0.9375rem] font-bold text-black/80 [text-wrap:balance]">
                {opts.title ?? "Excluir este item?"}
              </h2>
              {opts.description !== "" && (
                <p id={descriptionId} className="mt-2 text-[0.75rem] leading-relaxed text-black/45">
                  {opts.description ?? "Apagado de vez, sem volta atrás."}
                </p>
              )}
              {error && (
                <p role="alert" className="mt-3 rounded border border-[#D94E4E]/25 bg-[#D94E4E]/[.05] px-3 py-2 text-left text-[0.75rem] text-[#B23A3A]">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <button
                ref={cancelRef}
                type="button"
                onClick={handleClose}
                disabled={loading}
                className={`rounded px-2 py-2 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50 ${blocked ? "bg-[#282525] px-4 text-white hover:bg-[#3A3535]" : "text-black/45 hover:text-black/70"}`}
              >
                {blocked ? "Entendi" : "Cancelar"}
              </button>
              {!blocked && (
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded bg-[#D94E4E] px-4 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#C04040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E4E] active:scale-[.98] disabled:opacity-50"
                >
                  {(opts.illustration ?? true) && <Trash2 size={11} aria-hidden="true" />}
                  {loading ? (opts.pendingLabel ?? "Excluindo…") : (opts.confirmLabel ?? "Excluir")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DeleteConfirmContext.Provider>
  );
}

/**
 * Fora do DeleteConfirmProvider (ex.: telas administrativas), cai para o
 * diálogo nativo em vez de quebrar a página.
 */
const nativeFallback: DeleteConfirmContextType = {
  confirmDelete(options) {
    const text = [options.title, options.description].filter(Boolean).join("\n\n");
    if (options.blocked) { window.alert(text); return; }
    if (!window.confirm(text || "Excluir este item?")) return;
    void Promise.resolve()
      .then(() => options.onConfirm())
      .catch(failure => window.alert(errorMessage(failure)));
  },
};

export function useDeleteConfirm() {
  return useContext(DeleteConfirmContext) ?? nativeFallback;
}
