"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export function ContatoExportadoModal({ contatoId, nome, empresaNome, onClose }: {
  contatoId: string;
  nome: string;
  empresaNome?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  useModalDismiss(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contato-exportado-title"
        className="w-full max-w-[380px] overflow-hidden rounded-b bg-white shadow-[0_22px_72px_rgba(13,13,13,.2)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2E8932]/15">
            <Check size={26} className="text-black" strokeWidth={2.5} />
          </span>
          <h2 id="contato-exportado-title" className="mt-4 text-[15px] font-bold text-black">Contato salvo</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-black/45">
            <strong className="font-semibold text-black/70">{nome}</strong> foi adicionado aos seus contatos
            {empresaNome ? <> e vinculado a <strong className="font-semibold text-black/70">{empresaNome}</strong></> : null}.
          </p>
        </div>
        <footer className="flex items-center justify-center gap-2 border-t border-black/[.08] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-[12px] font-semibold text-black/35 transition hover:text-black/55"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => router.push(`/contatos/${contatoId}`)}
            className="flex items-center gap-1.5 rounded border border-[#7259B5] px-4 py-2.5 text-[12px] font-bold text-[#7259B5] transition hover:bg-[#7259B5]/5 active:translate-y-px"
          >
            Ir até o contato
            <ArrowRight size={13} />
          </button>
        </footer>
      </div>
    </div>
  );
}
