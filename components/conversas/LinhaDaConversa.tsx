"use client";

import { Clock } from "lucide-react";
import { EtiquetaDeSituacao, EtiquetaSoEuVejo } from "@/components/email/EtiquetaDeConversa";
import { AvatarDaPessoa } from "@/components/ui/AvatarDaPessoa";
import { dataCurta, enderecoDoOutroLado, horaCurta, quemNaConversa, type ItemDaLista } from "@/lib/conversas/lista";

/**
 * Uma conversa na lista, como cartão: quem escreveu em cima, com o rosto ao lado, e o assunto embaixo.
 * Vale para a conversa de e-mail e para o e-mail que ainda não saiu.
 */
export function LinhaDaConversa({ item, nomesDosContatos, selecionada, onAbrir }: {
  item: ItemDaLista;
  /** Nomes dos contatos da conversa, quando é e-mail. */
  nomesDosContatos: readonly string[];
  selecionada: boolean;
  onAbrir: () => void;
}) {
  const ehEmail = item.tipo === "email";
  const quem = ehEmail ? quemNaConversa(item.conversa, nomesDosContatos) : item.agendado.para[0] ?? "";
  const endereco = ehEmail ? enderecoDoOutroLado(item.conversa) : item.agendado.para[0] ?? null;
  const titulo = ehEmail ? item.conversa.assunto : item.agendado.assunto;
  const trecho = ehEmail ? item.conversa.ultima.snippet?.trim() : null;
  const total = ehEmail ? item.conversa.mensagens.length : 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={selecionada ? "true" : undefined}
      className={`block w-full rounded border px-3.5 py-3 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5] ${
        selecionada ? "border-[#1C0E33]/30 bg-black/[.025]" : "border-black/[.08] bg-white hover:border-black/[.16]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {ehEmail
          ? <AvatarDaPessoa nome={quem} endereco={endereco} tamanho="pequeno" className="mt-0.5" />
          : <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[.05] text-black/35"><Clock size={12} /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-[0.8125rem] font-semibold text-[#282525]">{ehEmail ? quem : `Para ${quem}`}</p>
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-black/30">{dataCurta(item.quando)}</span>
          </div>
          <p className="mt-0.5 truncate text-[0.75rem] text-black/55">
            {titulo}
            {total > 1 && <span className="ml-1.5 tabular-nums text-black/30">{total}</span>}
          </p>
          {trecho && <p className="mt-1 line-clamp-1 text-[0.6875rem] text-black/35">{trecho}</p>}
          {ehEmail && (item.conversa.situacao || item.conversa.privada || nomesDosContatos.length === 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.conversa.situacao && <EtiquetaDeSituacao situacao={item.conversa.situacao} />}
              {nomesDosContatos.length === 0 && <EtiquetaSoEuVejo rotulo="Sem contato" />}
              {item.conversa.privada && nomesDosContatos.length > 0 && <EtiquetaSoEuVejo />}
            </div>
          )}
          {!ehEmail && (
            <p className="mt-1 text-[0.6875rem]" style={{ color: item.agendado.estado === "falhou" ? "#B23B3B" : "rgba(13,13,13,.4)" }}>
              {item.agendado.estado === "falhou"
                ? `Não saiu: ${item.agendado.erro ?? "erro ao enviar"}`
                : item.agendado.estado === "enviando" ? "Enviando agora…" : `Sai às ${horaCurta(item.quando)}`}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
