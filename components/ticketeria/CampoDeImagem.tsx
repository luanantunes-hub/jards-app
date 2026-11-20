"use client";

import { useState } from "react";
import { Image as IconeImagem } from "lucide-react";
import { BibliotecaDeImagens } from "@/components/ticketeria/BibliotecaDeImagens";
import { CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";
import { ESPACO_DAS_IMAGENS } from "@/lib/ticketeria/imagens";

/** O campo de imagem dos formulários do editor: o endereço (https://…), como sempre, e o botão Biblioteca, que abre a folha para enviar ou escolher. `rotulo` vazio: sem rótulo visível (o `ariaLabel` fala por ele). */
export function CampoDeImagem({ id, rotulo, ariaLabel, valor, onChange, organizationId, desabilitado = false, placeholder = "https://", maxLength = 500 }: { id: string; rotulo?: string; ariaLabel?: string; valor: string; onChange: (valor: string) => void; organizationId: string; desabilitado?: boolean; placeholder?: string; maxLength?: number }) {
  const [aberta, setAberta] = useState(false);
  const daBiblioteca = valor.includes(`/storage/v1/object/public/${ESPACO_DAS_IMAGENS}/`);
  return (
    <div>
      {rotulo && <label className={ROTULO} htmlFor={id}>{rotulo}</label>}
      <div className="flex items-center gap-2">
        <input id={id} aria-label={rotulo ? undefined : ariaLabel} className={CAMPO} value={valor} onChange={e => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} disabled={desabilitado} />
        <button type="button" onClick={() => setAberta(true)} disabled={desabilitado} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-black/[.12] px-3 text-[0.75rem] font-normal text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><IconeImagem size={13} aria-hidden="true" /> Biblioteca</button>
      </div>
      {daBiblioteca && (
        <p className="mt-1.5 flex items-center gap-2 text-[0.6875rem] text-black/55">
          {/* eslint-disable-next-line @next/next/no-img-element -- miniatura da própria biblioteca */}
          <img src={valor} alt="" className="h-7 w-10 rounded-[0.4rem] bg-black/[.04] object-cover" /> escolhida da biblioteca
        </p>
      )}
      {aberta && <BibliotecaDeImagens organizationId={organizationId} aoEscolher={url => onChange(url)} onClose={() => setAberta(false)} />}
    </div>
  );
}
