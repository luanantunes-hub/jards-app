"use client";

import Image from "next/image";
import { ArrowRight, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type Plano = "basico" | "profissional";

type Props = {
  plano: Plano | null;
  onClose: () => void;
};

const PLAN_LABELS: Record<Plano, string> = {
  basico: "Básico",
  profissional: "Profissional",
};

export function BoasVindasPlanoModal({ plano, onClose }: Props) {
  const actionRef = useRef<HTMLButtonElement>(null);

  useModalDismiss(onClose, { enabled: !!plano });

  useEffect(() => {
    if (!plano) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    actionRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [plano]);

  if (!plano) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-plan-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="relative grid max-h-[96dvh] w-full overflow-y-auto rounded-t bg-white shadow-[0_24px_80px_rgba(13,13,13,.18)] sm:max-w-3xl sm:grid-cols-[.92fr_1.08fr] sm:rounded">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar boas-vindas"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded border border-black/10 bg-white text-black/40 transition hover:bg-[#F2F2F2] hover:text-black/70 focus:outline-none focus:ring-2 focus:ring-[#2E8932]/25"
        >
          <X size={16} weight="bold" />
        </button>

        <div className="flex min-h-[250px] items-center justify-center overflow-hidden bg-[#FAFAF9] p-5 sm:min-h-[430px] sm:p-8">
          <Image
            src="/illustrations/tamandua-boas-vindas-plano.png"
            width={1024}
            height={1024}
            priority
            alt="Tamanduá Jards celebrando a assinatura do plano"
            className="h-auto w-full max-w-[330px] object-contain"
          />
        </div>

        <div className="flex flex-col justify-center px-6 pb-8 pt-7 sm:px-10 sm:py-12">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.13em] text-[#2E8932]">
            Plano {PLAN_LABELS[plano]} confirmado
          </p>
          <h2 id="welcome-plan-title" className="max-w-sm text-[30px] font-bold leading-[1.08] tracking-[-.035em] text-[#0D0D0D] sm:text-[36px]">
            Que bom ter você com a gente.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-black/50">
            Seu pagamento foi recebido. Agora você pode encontrar patrocinadores, organizar oportunidades e avançar nas suas captações.
          </p>
          <p className="mt-3 max-w-sm text-xs leading-5 text-black/35">
            Os créditos e benefícios do plano podem levar alguns segundos para aparecer.
          </p>

          <button
            ref={actionRef}
            type="button"
            onClick={onClose}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded bg-[#2E8932] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#26752A] focus:outline-none focus:ring-2 focus:ring-[#2E8932]/30 focus:ring-offset-2 active:scale-[.99] sm:w-fit"
          >
            Explorar patrocinadores
            <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      </section>
    </div>
  );
}
