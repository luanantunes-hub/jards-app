"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Estrategia = { id: string; texto: string };

const FRASES_LOGIN = [
  "Às vezes o caminho certo é o que parece errado.",
  "O que trava também aponta para algo.",
  "Nem todo recomeço precisa ser do zero.",
  "Um passo enviesado ainda é um passo.",
  "A dúvida também é direção.",
  "Continue pelo lado que você evitou.",
  "O óbvio raramente é o primeiro passo certo.",
  "Volte, mas não pelo mesmo caminho.",
];

function textSizeClass(texto: string) {
  if (texto.length > 90) return "auth-oblique-card__text--sm";
  if (texto.length > 50) return "auth-oblique-card__text--md";
  return "auth-oblique-card__text--lg";
}

function pickThree(list: Estrategia[]) {
  const pool = [...list];
  const picked: Estrategia[] = [];
  while (picked.length < Math.min(3, list.length) && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function pickFrase(exclude?: string) {
  if (FRASES_LOGIN.length === 1) return FRASES_LOGIN[0];
  let next = FRASES_LOGIN[Math.floor(Math.random() * FRASES_LOGIN.length)];
  while (next === exclude) {
    next = FRASES_LOGIN[Math.floor(Math.random() * FRASES_LOGIN.length)];
  }
  return next;
}

export function ObliqueStrategyCard() {
  const [current, setCurrent] = useState<Estrategia[]>([]);
  const [headline, setHeadline] = useState(FRASES_LOGIN[0]);
  const [flipping, setFlipping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const cardsRef = useRef<Estrategia[]>([]);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    function handlePointer(event: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setShowInfo(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showInfo]);

  useEffect(() => {
    setHeadline(pickFrase());

    const supabase = createClient();
    (supabase as any)
      .from("estrategias_obliquas")
      .select("id, texto")
      .then(({ data }: { data: Estrategia[] | null }) => {
        const list = data ?? [];
        cardsRef.current = list;
        if (list.length > 0) setCurrent(pickThree(list));
      });
  }, []);

  function sortear() {
    const list = cardsRef.current;
    if (list.length === 0 || flipping) return;
    setFlipping(true);
    setTimeout(() => {
      setCurrent(pickThree(list));
      setHeadline((prev) => pickFrase(prev));
      setFlipping(false);
    }, 200);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={infoRef} className="relative mb-3 flex shrink-0 items-center gap-1.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-black/40">Estratégias Oblíquas</p>
        <button
          type="button"
          onClick={() => setShowInfo((value) => !value)}
          aria-expanded={showInfo}
          aria-label="Sobre as Estratégias Oblíquas"
          className="auth-oblique-info-trigger"
        >
          ?
        </button>

        {showInfo && (
          <div role="tooltip" className="auth-oblique-info-panel">
            Um baralho criado por Brian Eno e Peter Schmidt em 1975. Cada carta traz uma instrução ou observação oblíqua para ajudar a sair de um impasse criativo — sorteie uma quando o caminho não estiver óbvio.
          </div>
        )}
      </div>
      <h2
        className={`mb-1 max-w-[16ch] shrink-0 text-[clamp(1.6rem,2.8vw,2.35rem)] font-bold leading-[1.08] tracking-[-.03em] text-[#282525] transition-opacity duration-200 motion-reduce:transition-none ${flipping ? "opacity-0" : "opacity-100"}`}
      >
        {headline}
      </h2>

      <button
        type="button"
        onClick={sortear}
        aria-label="Sortear novas cartas"
        className="auth-oblique-spread"
      >
        {current.map((card, i) => (
          <span
            key={i}
            className={`auth-oblique-card auth-oblique-spread__card auth-oblique-spread__card--${i} ${flipping ? "auth-oblique-card--flipping" : ""}`}
            style={{ transitionDelay: `${i * 45}ms` }}
          >
            <span className="auth-oblique-card__mark" aria-hidden="true" />
            <span className={`auth-oblique-card__text ${textSizeClass(card.texto)}`}>{card.texto}</span>
          </span>
        ))}
      </button>

      <div className="auth-oblique-scene" role="img" aria-label="Tamanduá reclinado em um divã, de olhos fechados" />
    </div>
  );
}
