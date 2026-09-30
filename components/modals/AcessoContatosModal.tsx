"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import { ClaudeMark, OpenAIMark } from "@/components/icons/AiLogos";

export type AcessoContatosModalVariant = "sem_creditos" | "sem_plano" | "mcp_gpt";

type AcessoContatosModalProps = {
  variant: AcessoContatosModalVariant;
  onClose: () => void;
  onPrimary: () => void;
};

function proximaRenovacao() {
  const hoje = new Date();
  const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  return proximoMes.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
}

const CONTEUDO: Record<
  AcessoContatosModalVariant,
  { eyebrow: string; titulo: string; descricao: string; botao: string }
> = {
  sem_creditos: {
    eyebrow: "Créditos do ciclo",
    titulo: "Seus créditos acabaram por enquanto.",
    descricao:
      "Seu plano continua ativo. Os créditos serão renovados no início do próximo mês. Se precisar continuar agora, você pode comprar créditos adicionais.",
    botao: "Comprar créditos",
  },
  sem_plano: {
    eyebrow: "Acesso aos contatos",
    titulo: "Assine para acessar os contatos-chave.",
    descricao:
      "O acesso aos contatos verificados está disponível nos planos ativos do Jards. Assine para receber créditos mensais e liberar empresas quando precisar.",
    botao: "Assinar um plano",
  },
  mcp_gpt: {
    eyebrow: "Claude e ChatGPT",
    titulo: "Assine para conectar o Jards ao Claude e ao ChatGPT.",
    descricao:
      "A integração via MCP e a Custom GPT do Jards estão disponíveis nos planos ativos. Assine para consultar seus projetos, propostas e contatos direto de um assistente de IA.",
    botao: "Assinar um plano",
  },
};

export function AcessoContatosModal({
  variant,
  onClose,
  onPrimary,
}: AcessoContatosModalProps) {
  const semCreditos = variant === "sem_creditos";
  const accent = semCreditos ? "#B07A14" : "#7259B5";
  const conteudo = CONTEUDO[variant];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/25 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="acesso-contatos-title"
        aria-describedby="acesso-contatos-description"
        className="relative w-full max-w-[480px] overflow-hidden rounded border border-black/10 bg-white shadow-[0_24px_70px_rgba(13,13,13,.16)]"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded border border-black/10 bg-white/90 text-black/35 backdrop-blur transition hover:bg-black/[.04] hover:text-black/60"
        >
          <X size={14} strokeWidth={2} />
        </button>

        <div className="relative h-[230px] border-b border-black/[.06] bg-white sm:h-[250px]">
          <Image
            src={semCreditos ? "/tamandua-sem-creditos.png" : "/tamandua-assine-plano.png"}
            alt={semCreditos
              ? "Tamanduá contando moedas sobre uma mesa"
              : "Tamanduá de terno entrando em uma sala"}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover"
            style={{ objectPosition: semCreditos ? "center 62%" : "center 47%" }}
          />
        </div>

        <div className="px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
          <p
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em]"
            style={{ color: accent }}
          >
            {variant === "mcp_gpt" && (
              <span className="flex items-center gap-1">
                <ClaudeMark size={12} />
                <OpenAIMark size={11} />
              </span>
            )}
            {conteudo.eyebrow}
          </p>

          <h2
            id="acesso-contatos-title"
            className="mt-2 max-w-[390px] text-[22px] font-semibold leading-[1.2] tracking-[-.025em] text-[#0D0D0D]"
          >
            {conteudo.titulo}
          </h2>

          <p
            id="acesso-contatos-description"
            className="mt-3 max-w-[410px] text-[13px] leading-6 text-black/50"
          >
            {conteudo.descricao}
          </p>

          {semCreditos && (
            <div className="mt-5 flex items-center gap-3 border-y border-black/[.06] py-3.5">
              <CalendarDays size={16} strokeWidth={1.8} className="shrink-0 text-black/35" />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[.08em] text-black/30">
                  Próxima renovação
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-black/70">
                  {proximaRenovacao()}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 px-1 text-[12px] font-medium text-black/35 transition hover:text-black/55"
            >
              Agora não
            </button>

            <button
              type="button"
              autoFocus
              onClick={onPrimary}
              className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded border bg-white px-4 text-[12px] font-medium transition hover:bg-black/[.04] active:scale-[.98]"
              style={{ borderColor: `${accent}45`, color: accent }}
            >
              {conteudo.botao}
              <ArrowRight size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
