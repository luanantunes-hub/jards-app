"use client";

import Image from "next/image";
import { UserPlus, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

type Props = {
  quantity: number;
  onInvite: () => void;
  onClose: () => void;
};

export function BoasVindasEquipeModal({ quantity, onInvite, onClose }: Props) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const quantityLabel = quantity === 1
    ? "1 usuário extra disponível"
    : `${quantity} usuários extras disponíveis`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    actionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-team-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="relative grid max-h-[96dvh] w-full overflow-y-auto rounded-t bg-white shadow-[0_24px_80px_rgba(13,13,13,.18)] sm:max-w-3xl sm:grid-cols-[1.05fr_.95fr] sm:rounded">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar boas-vindas da equipe"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded border border-black/10 bg-white text-black/40 transition hover:bg-[#F2F2F2] hover:text-black/70 focus:outline-none focus:ring-2 focus:ring-[#2E8932]/25"
        >
          <X size={16} weight="bold" />
        </button>

        <div className="flex min-h-[260px] items-center justify-center overflow-hidden bg-[#FAFAF9] p-4 sm:min-h-[430px] sm:p-7">
          <Image
            src="/illustrations/tamanduas-boas-vindas-equipe.png"
            width={1024}
            height={1024}
            priority
            alt="Equipe de tamanduás Jards celebrando"
            className="h-auto w-full max-w-[390px] object-contain"
          />
        </div>

        <div className="flex flex-col justify-center px-6 pb-8 pt-7 sm:px-9 sm:py-12">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.13em] text-[#2E8932]">
            {quantityLabel}
          </p>
          <h2 id="welcome-team-title" className="max-w-sm text-[30px] font-bold leading-[1.08] tracking-[-.035em] text-[#0D0D0D] sm:text-[36px]">
            Sua equipe ganhou espaço para crescer.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-black/50">
            As novas vagas já estão disponíveis. Convide as pessoas que vão trabalhar com você no Jards.
          </p>

          <button
            ref={actionRef}
            type="button"
            onClick={onInvite}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded bg-[#2E8932] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#27772B] focus:outline-none focus:ring-2 focus:ring-[#2E8932]/30 focus:ring-offset-2 active:scale-[.99] sm:w-fit"
          >
            <UserPlus size={16} weight="bold" />
            Convidar membros
          </button>
        </div>
      </section>
    </div>
  );
}
