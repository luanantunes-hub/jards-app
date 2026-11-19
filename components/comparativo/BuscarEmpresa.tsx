"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export type EmpresaDaBusca = { id: string; nome: string; site: string | null; logo_url: string | null };

/**
 * Busca de empresa no meio da tela, aberta pelo botão "Adicionar empresa". Fecha assim que a pessoa
 * escolhe uma empresa (para outra, ela clica no botão de novo); Esc, clicar fora ou "Fechar" também fecham.
 */
export function BuscarEmpresa({ busca, onBusca, resultados, buscando, onAdicionar, onClose }: {
  busca: string;
  onBusca: (texto: string) => void;
  resultados: EmpresaDaBusca[];
  buscando: boolean;
  onAdicionar: (empresa: EmpresaDaBusca) => void;
  onClose: () => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  useModalDismiss(onClose);
  useEffect(() => { campo.current?.focus(); }, []);

  const termo = busca.trim();
  const dica = termo.length < 2
    ? "Digite pelo menos 2 letras do nome da empresa."
    : buscando ? "Buscando…" : resultados.length === 0 ? "Nenhuma empresa encontrada." : null;

  return (
    <div className="veu fixed inset-0 z-50 flex items-start justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Adicionar empresa ao comparativo" className="folha-desce folha-vidro w-full max-w-lg overflow-hidden max-h-[96dvh]" onClick={(evento) => evento.stopPropagation()}>
        <div className="relative border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/30" aria-hidden="true" />
          <input
            ref={campo}
            type="search"
            value={busca}
            onChange={(evento) => onBusca(evento.target.value)}
            placeholder="Buscar empresa para comparar…"
            aria-label="Buscar empresa para comparar"
            className="w-full bg-white py-4 pl-11 pr-4 text-[0.9375rem] text-[#282525] outline-none placeholder:text-black/30"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {dica ? (
            <p className="px-4 py-8 text-center text-[0.8125rem] text-black/35">{dica}</p>
          ) : (
            resultados.map((empresa) => (
              <button key={empresa.id} type="button" onClick={() => onAdicionar(empresa)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[0.8125rem] text-[#282525] transition hover:bg-black/[.04]">
                <CompanyLogo nome={empresa.nome} site={empresa.site} logo_url={empresa.logo_url} size={26} className="rounded border border-black/8" />
                <span className="truncate">{empresa.nome}</span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-end border-t px-4 py-2.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button type="button" onClick={onClose} className="text-[0.75rem] text-black/35 transition hover:text-black/55">Fechar</button>
        </div>
      </div>
    </div>
  );
}
