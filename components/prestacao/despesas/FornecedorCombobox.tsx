"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { PortalMenu, usePortalPosition } from "@/components/ui/ComboboxPortalMenu";
import { formatarDocumento, nomeDoFornecedor } from "@/lib/prestacao/fornecedores";
import type { PrestacaoFornecedor } from "@/lib/supabase/types";

const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Escolhe um fornecedor da organização pelo nome ou pelo documento. */
export function FornecedorCombobox({ fornecedores, valor, onChange, disabled = false, id }: {
  fornecedores: readonly PrestacaoFornecedor[];
  valor: string | null;
  onChange: (fornecedorId: string | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const campoRef = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const posicao = usePortalPosition(campoRef, aberto);
  const escolhido = fornecedores.find(f => f.id === valor) ?? null;

  const opcoes = useMemo(() => {
    const termo = semAcento(busca.trim());
    const digitos = busca.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return [...fornecedores]
      .map(f => ({ f, nome: nomeDoFornecedor(f) }))
      .filter(({ f, nome }) => !termo
        || semAcento([nome, f.razao_social, f.nome_fantasia].filter(Boolean).join(" ")).includes(termo)
        || (digitos.length >= 3 && (f.documento ?? "").includes(digitos)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .slice(0, 50);
  }, [busca, fornecedores]);

  function escolher(fornecedorId: string | null) {
    onChange(fornecedorId);
    setBusca("");
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setDestaque(d => Math.min(d + 1, opcoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque(d => Math.max(d - 1, 0)); }
    else if (e.key === "Enter" && aberto && opcoes[destaque]) { e.preventDefault(); escolher(opcoes[destaque].f.id); }
    else if (e.key === "Escape" && aberto) { e.preventDefault(); setAberto(false); setBusca(""); }
  }

  return (
    <div ref={campoRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-label="Fornecedor"
        disabled={disabled}
        value={aberto ? busca : escolhido ? `${nomeDoFornecedor(escolhido)} · ${formatarDocumento(escolhido.documento, { mascararCpf: escolhido.tipo_pessoa === "pf" })}` : ""}
        placeholder={fornecedores.length ? "Buscar por nome ou CNPJ" : "Nenhum fornecedor cadastrado"}
        onChange={e => { setBusca(e.target.value); setAberto(true); setDestaque(0); }}
        onFocus={() => { setAberto(true); setBusca(""); }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={aoTeclar}
        className="w-full truncate rounded border border-black/[.12] py-2 pl-3 pr-14 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20 disabled:bg-black/[.02] disabled:text-black/50"
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {escolhido && !disabled && (
          <button type="button" onClick={() => escolher(null)} aria-label="Tirar o fornecedor" className="rounded p-1 text-black/30 transition hover:bg-black/[.04] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={12} aria-hidden />
          </button>
        )}
        <ChevronDown size={13} className="pointer-events-none text-black/30" aria-hidden />
      </div>
      {aberto && !disabled && (
        <PortalMenu position={posicao}>
          <ul id={listaId} role="listbox" aria-label="Fornecedores">
            {opcoes.length === 0 && (
              <li className="px-3 py-2 text-[0.75rem] text-black/45">
                Nenhum fornecedor encontrado. Cadastre em{" "}
                <a href="/prestacoes/fornecedores" target="_blank" rel="noopener noreferrer" className="text-[#684DB0] underline-offset-2 hover:underline">Fornecedores</a>.
              </li>
            )}
            {opcoes.map(({ f, nome }, i) => (
              <li key={f.id} role="option" aria-selected={f.id === valor}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => escolher(f.id)}
                  onMouseEnter={() => setDestaque(i)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left transition ${i === destaque ? "bg-black/[.04]" : ""}`}
                >
                  <span className="text-[0.75rem] text-black/80">{nome}</span>
                  <span className="text-[0.625rem] tabular-nums text-black/40">{formatarDocumento(f.documento, { mascararCpf: f.tipo_pessoa === "pf" })}{f.cnae_principal ? ` · CNAE ${f.cnae_principal}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </PortalMenu>
      )}
    </div>
  );
}
