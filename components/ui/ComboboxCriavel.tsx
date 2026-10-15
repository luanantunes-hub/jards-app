"use client";

// Escolhe um registro ligado (projeto, proponente) pelo nome, ou cria um novo
// digitando o nome e escolhendo `Criar "Nome"` no menu, como pede o DESIGN.md.
// Nada é criado com o campo vazio. O menu sai por portal, para não ser cortado
// pelo modal, e abre acima quando não há espaço embaixo.

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { PortalMenu, usePortalPosition } from "@/components/ui/ComboboxPortalMenu";
import { chaveDoNome, mesmoNome } from "@/lib/dominio";

export type OpcaoCriavel = { id: string; nome: string };

export function ComboboxCriavel({ opcoes, valor, onChange, onCriar, rotulo, placeholder, disabled = false, id }: {
  opcoes: readonly OpcaoCriavel[];
  valor: string;
  onChange: (id: string) => void;
  /** Cria o registro e devolve o id; null quando não deu (quem chama mostra o erro). */
  onCriar: (nome: string) => Promise<string | null>;
  /** Nome do campo, para o leitor de tela ("Projeto"). */
  rotulo: string;
  placeholder: string;
  disabled?: boolean;
  id?: string;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const [criando, setCriando] = useState(false);
  const campoRef = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const posicao = usePortalPosition(campoRef, aberto);
  const escolhido = opcoes.find(o => o.id === valor) ?? null;

  const termo = busca.trim();
  const filtradas = useMemo(() => {
    const chave = chaveDoNome(termo);
    return [...opcoes]
      .filter(o => !chave || chaveDoNome(o.nome).includes(chave))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .slice(0, 50);
  }, [opcoes, termo]);
  const podeCriar = termo.length > 0 && !opcoes.some(o => mesmoNome(o.nome, termo));
  const total = filtradas.length + (podeCriar ? 1 : 0);

  function escolher(idEscolhido: string) {
    onChange(idEscolhido);
    setBusca("");
    setAberto(false);
  }

  async function criar() {
    if (!podeCriar || criando) return;
    setCriando(true);
    const novo = await onCriar(termo);
    setCriando(false);
    if (novo) escolher(novo);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setDestaque(d => Math.min(d + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque(d => Math.max(d - 1, 0)); }
    else if (e.key === "Enter" && aberto) {
      e.preventDefault();
      if (destaque < filtradas.length) escolher(filtradas[destaque].id);
      else void criar();
    } else if (e.key === "Escape" && aberto) { e.preventDefault(); setAberto(false); setBusca(""); }
  }

  return (
    <div ref={campoRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-label={rotulo}
        disabled={disabled || criando}
        value={aberto ? busca : escolhido?.nome ?? ""}
        placeholder={placeholder}
        onChange={e => { setBusca(e.target.value); setAberto(true); setDestaque(0); }}
        onFocus={() => { setAberto(true); setBusca(""); setDestaque(0); }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={aoTeclar}
        className="w-full truncate rounded border border-black/[.12] py-2 pl-3 pr-14 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20 disabled:bg-black/[.02] disabled:text-black/50"
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {escolhido && !disabled && (
          <button type="button" onClick={() => escolher("")} aria-label={`Tirar ${rotulo.toLowerCase()}`} className="rounded p-1 text-black/30 transition hover:bg-black/[.04] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={12} aria-hidden />
          </button>
        )}
        <ChevronDown size={13} className="pointer-events-none text-black/30" aria-hidden />
      </div>
      {aberto && !disabled && (total > 0 || !termo) && (
        <PortalMenu position={posicao}>
          <ul id={listaId} role="listbox" aria-label={rotulo}>
            {total === 0 && (
              <li className="px-3 py-2 text-[0.75rem] text-black/45">Digite o nome para criar.</li>
            )}
            {filtradas.map((o, i) => (
              <li key={o.id} role="option" aria-selected={o.id === valor}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => escolher(o.id)}
                  onMouseEnter={() => setDestaque(i)}
                  className={`w-full px-3 py-2 text-left text-[0.8125rem] text-[#282525] transition ${i === destaque ? "bg-black/[.04]" : ""}`}
                >
                  {o.nome}
                </button>
              </li>
            ))}
            {podeCriar && (
              <li role="option" aria-selected={false} className={filtradas.length ? "border-t border-black/[.08]" : ""}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => void criar()}
                  onMouseEnter={() => setDestaque(filtradas.length)}
                  disabled={criando}
                  className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-[0.8125rem] font-medium text-[#684DB0] transition disabled:opacity-50 ${destaque === filtradas.length ? "bg-black/[.04]" : ""}`}
                >
                  <Plus size={13} aria-hidden />
                  {criando ? "Criando…" : `Criar "${termo}"`}
                </button>
              </li>
            )}
          </ul>
        </PortalMenu>
      )}
    </div>
  );
}
