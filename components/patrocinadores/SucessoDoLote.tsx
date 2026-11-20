"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * O fim de um lote que deu certo: um círculo verde (o verde de salvar e confirmar do Jards) com o check branco sobe
 * do fundo da tela e o check se desenha; passado um instante, `onConcluido` leva a pessoa para a lista do que ela
 * acabou de fazer. Clicar ou apertar Enter ou Esc pula a espera. Escrito, só aparece a `nota` (o que ficou de fora):
 * o resto, o leitor de tela recebe em `texto` e a lista mostra. As animações estão em app/globals.css (sucesso-*).
 */
export function SucessoDoLote({ texto, nota, onConcluido }: { texto: string; nota: string | null; onConcluido: () => void }) {
  const aoConcluir = useRef(onConcluido);
  useEffect(() => {
    aoConcluir.current = onConcluido;
  });

  // Seguir adiante uma vez só, venha do tempo, do clique ou do teclado.
  const feito = useRef(false);
  const concluir = useCallback(() => {
    if (feito.current) return;
    feito.current = true;
    aoConcluir.current();
  }, []);

  useEffect(() => {
    // O check leva ~0,8 s para subir e se desenhar; o resto é o instante de olhar. Com movimento reduzido, tudo
    // aparece de uma vez e a espera é menor. A nota (o que ficou de fora) ganha mais tempo para ser lida.
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const espera = (reduzido ? 900 : 1450) + (nota ? 1500 : 0);
    const prazo = window.setTimeout(concluir, espera);
    const aoApertar = (evento: KeyboardEvent) => {
      if (evento.key === "Enter" || evento.key === "Escape") concluir();
    };
    window.addEventListener("keydown", aoApertar);
    return () => {
      window.clearTimeout(prazo);
      window.removeEventListener("keydown", aoApertar);
    };
  }, [concluir, nota]);

  return createPortal(
    <div
      className="sucesso-veu fixed inset-0 z-[70] flex cursor-default flex-col items-center justify-center gap-5 bg-white/85 backdrop-blur-[2px]"
      onClick={concluir}
    >
      <p className="sr-only" role="status" aria-live="polite">{texto}</p>
      <div className="sucesso-circulo relative" aria-hidden="true">
        <span className="sucesso-aro absolute inset-0 rounded-full border-2 border-[#2E8932]" />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[#2E8932]" style={{ boxShadow: "0 14px 34px -12px rgba(46,137,50,.6)" }}>
          <svg viewBox="0 0 52 52" className="h-14 w-14" fill="none">
            <path className="sucesso-check" pathLength={1} d="M14.5 27.5 L23 36 L38 18.5" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {nota && <p className="max-w-[22rem] px-6 text-center text-[0.8125rem] leading-snug text-black/60" aria-hidden="true">{nota}</p>}
    </div>,
    document.body,
  );
}
