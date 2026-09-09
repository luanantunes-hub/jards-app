"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_STEP = 20;

/**
 * Controla quantos itens mostrar por chave (ex: por coluna de kanban),
 * revelando mais conforme o RevealSentinel daquela chave entra na viewport.
 */
export function useIncrementalReveal(step = DEFAULT_STEP) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const getVisible = useCallback((key: string) => counts[key] ?? step, [counts, step]);

  const reveal = useCallback((key: string) => {
    setCounts(prev => ({ ...prev, [key]: (prev[key] ?? step) + step }));
  }, [step]);

  return { getVisible, reveal };
}

export function RevealSentinel({ onReveal }: { onReveal: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) onReveal(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onReveal]);

  return <div ref={ref} aria-hidden className="h-px w-full" />;
}
