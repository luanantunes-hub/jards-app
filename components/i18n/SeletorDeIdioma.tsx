"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { COOKIE_DO_IDIOMA, IDIOMAS } from "@/lib/i18n/idiomas";

// O seletor de idioma: lista cada idioma no nome dele mesmo (quem não lê português precisa achar o próprio). Guarda a escolha num cookie
// de um ano e recarrega a página já no idioma novo. Herda a cor do lugar onde está (cabeçalho escuro ou claro).
// O que se vê é o nome do idioma atual; o <select> de verdade fica por cima, invisível, para abrir o menu do próprio aparelho.
export function SeletorDeIdioma() {
  const atual = useLocale();
  const t = useTranslations("ticketeria.seletor");
  const nomeAtual = IDIOMAS.find(i => i.codigo === atual)?.nome ?? atual;

  function trocar(codigo: string) {
    const seguro = typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${COOKIE_DO_IDIOMA}=${encodeURIComponent(codigo)}; path=/; max-age=31536000; samesite=lax${seguro}`;
    location.reload();
  }

  return (
    <label className="relative inline-flex items-center gap-1.5 rounded px-1 py-1 text-[0.8125rem] font-normal has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-current">
      <Globe size={14} aria-hidden className="shrink-0 opacity-80" />
      <span aria-hidden>{nomeAtual}</span>
      <select
        aria-label={t("rotulo")}
        value={atual}
        onChange={e => trocar(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {IDIOMAS.map(i => (
          <option key={i.codigo} value={i.codigo} lang={i.codigo}>{i.nome}</option>
        ))}
      </select>
    </label>
  );
}
