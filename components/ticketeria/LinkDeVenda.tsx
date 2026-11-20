"use client";

import { useState } from "react";
import { Check, ExternalLink, Link2 } from "lucide-react";

const BOTAO = "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-[0.6875rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]";

/** O endereço da página de compra de uma sessão (sem login, no endereço do Jards). */
export const enderecoDeVenda = (origem: string, sessaoId: string) => `${origem.replace(/\/$/, "")}/comprar/${sessaoId}`;

/** Copiar o link de venda de uma sessão e abrir a página como o comprador a vê. `origem` vem do navegador; nos testes e nas imagens, passada à mão. */
export function LinkDeVenda({ sessaoId, origem, copiadoDeInicio = false }: { sessaoId: string; origem?: string; copiadoDeInicio?: boolean }) {
  const [copiado, setCopiado] = useState(copiadoDeInicio);
  const [erro, setErro] = useState(false);
  const endereco = () => enderecoDeVenda(origem ?? window.location.origin, sessaoId);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(endereco());
      setErro(false);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      setErro(true);
    }
  }

  return (
    <span className="flex items-center gap-1">
      <button type="button" onClick={() => void copiar()} className={BOTAO} aria-live="polite">
        {copiado ? <Check size={12} aria-hidden="true" className="text-[#2E8932]" /> : <Link2 size={12} aria-hidden="true" />}
        {erro ? "Não foi possível copiar" : copiado ? "Link copiado" : "Copiar link de venda"}
      </button>
      <a href={origem ? enderecoDeVenda(origem, sessaoId) : `/comprar/${sessaoId}`} target="_blank" rel="noopener noreferrer" className={BOTAO} aria-label="Abrir a página de venda em outra aba" title="Abrir a página de venda"><ExternalLink size={12} aria-hidden="true" /></a>
    </span>
  );
}
