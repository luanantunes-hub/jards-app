"use client";

import { Clock, Mail } from "lucide-react";
import { EtiquetaDeSituacao, EtiquetaSoEuVejo } from "@/components/email/EtiquetaDeConversa";
import { dataCurta, horaCurta, quemNaConversa, type ItemDaLista } from "@/lib/conversas/lista";

const ICONE = { email: Mail, agendado: Clock } as const;

/** Uma linha da lista de Conversas: quem vem primeiro, o assunto embaixo. Vale para e-mail, reunião e agendado. */
export function LinhaDaConversa({ item, nomesDosContatos, selecionada, onAbrir }: {
  item: ItemDaLista;
  /** Nomes dos contatos da conversa, quando é e-mail. */
  nomesDosContatos: readonly string[];
  selecionada: boolean;
  onAbrir: () => void;
}) {
  const Icone = ICONE[item.tipo];
  // Em cima vem com quem é a conversa; embaixo, o assunto.
  const quem = item.tipo === "email" ? quemNaConversa(item.conversa, nomesDosContatos) : `Para ${item.agendado.para.join(", ")}`;
  const titulo = item.tipo === "email" ? item.conversa.assunto : item.agendado.assunto;
  const trecho = item.tipo === "email" ? item.conversa.ultima.snippet?.trim() : null;

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={selecionada ? "true" : undefined}
      className={`relative block w-full border-l-2 px-4 py-3.5 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5] ${selecionada ? "border-l-[#1C0E33] bg-black/[.035]" : "border-l-transparent hover:bg-black/[.015]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[0.8125rem] font-semibold text-[#282525]">
          <Icone size={12} aria-hidden="true" className="shrink-0 text-black/30" />
          <span className="truncate">{quem}</span>
        </p>
        <span className="shrink-0 text-[0.6875rem] tabular-nums text-black/30">{dataCurta(item.quando)}</span>
      </div>
      <p className="mt-1 truncate text-[0.75rem] text-black/55">{titulo}</p>
      {trecho && <p className="mt-1 line-clamp-1 text-[0.6875rem] text-black/35">{trecho}</p>}
      {item.tipo === "email" && (item.conversa.situacao || item.conversa.privada || nomesDosContatos.length === 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.conversa.situacao && <EtiquetaDeSituacao situacao={item.conversa.situacao} />}
          {nomesDosContatos.length === 0 && <EtiquetaSoEuVejo rotulo="Sem contato" />}
          {item.conversa.privada && nomesDosContatos.length > 0 && <EtiquetaSoEuVejo />}
        </div>
      )}
      {item.tipo === "agendado" && (
        <p className="mt-1.5 text-[0.6875rem]" style={{ color: item.agendado.estado === "falhou" ? "#B23B3B" : "rgba(13,13,13,.4)" }}>
          {item.agendado.estado === "falhou" ? `Não saiu: ${item.agendado.erro ?? "erro ao enviar"}` : item.agendado.estado === "enviando" ? "Enviando agora…" : `Sai às ${horaCurta(item.quando)}`}
        </p>
      )}
    </button>
  );
}
