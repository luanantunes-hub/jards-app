"use client";

import { Mail } from "lucide-react";
import { EtiquetaDeSituacao, EtiquetaSoEuVejo } from "@/components/email/EtiquetaDeConversa";
import type { Conversa } from "@/lib/email/conversas";

type Props = {
  conversa: Conversa;
  /** Data da última mensagem, já formatada. */
  data: string;
  /** Nomes dos contatos da conversa. */
  contatos: string[];
  canal: string;
  /** Nome de quem sincronizou a conversa, quando conhecido. */
  autor: string | null;
  onAbrir: () => void;
};

/** Uma conversa de e-mail na aba Interações: um item só para o fio inteiro; ao clicar abre a folha "Conversa". */
export function LinhaDeConversa({ conversa, data, contatos, canal, autor, onAbrir }: Props) {
  const total = conversa.mensagens.length;
  const trecho = conversa.ultima.snippet?.trim();
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="block w-full px-5 py-4 text-left transition hover:bg-black/[.015] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-black/[.04] text-black/45" title="Conversa por e-mail">
            <Mail size={10} aria-hidden="true" />
          </span>
          <p className="truncate text-[0.8125rem] font-semibold text-[#282525]">{conversa.assunto}</p>
          {conversa.situacao && <EtiquetaDeSituacao situacao={conversa.situacao} />}
          {conversa.privada && <EtiquetaSoEuVejo />}
        </div>
        <span className="flex-shrink-0 text-[0.6875rem] text-black/30">{data}</span>
      </div>
      {trecho && <p className="mt-2 line-clamp-2 text-[0.75rem] leading-relaxed text-black/50">{trecho}</p>}
      <p className="mt-1 text-[0.625rem] text-black/30">
        {contatos.length > 0 ? contatos.join(", ") : "Empresa"} · {canal} · {total} {total === 1 ? "mensagem" : "mensagens"}
        {autor ? ` · por ${autor}` : ""}
      </p>
    </button>
  );
}
