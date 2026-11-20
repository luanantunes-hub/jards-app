"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, Search } from "lucide-react";
import { PROJECT_ICON_COLORS, corDaIdentidade, type IdentityIconOption, type IdentityType } from "./ProjectIdentity";

/**
 * Seletor de identidade no jeito do Notion: os ícones aparecem em cinza; ao
 * clicar num deles, abre grudado nele o mesmo ícone nas cinco cores do Jards,
 * e a escolha é feita ali. Sem bordas: o selecionado ganha só um fundo neutro.
 * Usado no cabeçalho (projeto, proponente, captador) e nos cadastros.
 */
export function IconePicker({
  tipo, valor, cor, iconOptions, saving = false, temLogo = false,
  onEscolher, onRemover, onLogo,
}: {
  tipo: IdentityType;
  valor: string | null;
  cor: string | null;
  iconOptions: readonly IdentityIconOption[];
  saving?: boolean;
  temLogo?: boolean;
  onEscolher: (icone: string, cor: string) => void;
  onRemover?: () => void;
  onLogo?: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<{ key: string; left: number; top: number } | null>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const corasRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const corAtual = corDaIdentidade(cor);

  const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const visiveis = termo
    ? iconOptions.filter(({ label, key }) => `${label} ${key}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(termo))
    : iconOptions;

  // Abriu, já dá para digitar (como no Notion). No toque, não abre o teclado sozinho.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) buscaRef.current?.focus();
  }, []);

  // Mantém o popup das cores dentro da largura do seletor.
  useLayoutEffect(() => {
    if (!aberto || !corasRef.current || !gradeRef.current) return;
    const max = gradeRef.current.clientWidth - corasRef.current.offsetWidth;
    if (aberto.left > max) setAberto(atual => atual && { ...atual, left: Math.max(0, max) });
  }, [aberto]);

  function abrir(key: string, botao: HTMLButtonElement) {
    if (aberto?.key === key) { setAberto(null); return; }
    setAberto({ key, left: botao.offsetLeft - 4, top: botao.offsetTop + botao.offsetHeight + 4 });
  }

  const opcaoAberta = aberto ? iconOptions.find(option => option.key === aberto.key) : undefined;

  return (
    <div className="w-[18rem] max-w-full">
      <div className="flex items-center gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded bg-black/[.04] px-2 text-black/40 focus-within:bg-black/[.06]">
          <Search size={13} aria-hidden className="shrink-0" />
          <input
            ref={buscaRef}
            value={busca}
            onChange={event => { setBusca(event.target.value); setAberto(null); }}
            onKeyDown={event => {
              // Enter abre as cores do primeiro ícone encontrado: dá para escolher só com o teclado.
              if (event.key !== "Enter" || visiveis.length === 0) return;
              event.preventDefault();
              const primeiro = gradeRef.current?.querySelector<HTMLButtonElement>(`[data-icone="${visiveis[0].key}"]`);
              if (primeiro) abrir(visiveis[0].key, primeiro);
            }}
            placeholder="Buscar ícone"
            aria-label="Buscar ícone"
            className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-[#282525] outline-none placeholder:text-black/35"
          />
        </label>
        {onRemover && tipo !== "padrao" && (
          <button type="button" disabled={saving} onClick={onRemover} className="h-8 shrink-0 rounded px-2 text-[0.75rem] text-black/45 transition hover:bg-black/[.04] hover:text-[#282525] disabled:opacity-50">
            Remover
          </button>
        )}
      </div>

      <div ref={gradeRef} className="relative mt-2.5">
        {visiveis.length === 0 ? (
          <p className="py-6 text-center text-[0.75rem] text-black/35">Nenhum ícone com esse nome</p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5" role="group" aria-label="Ícones">
            {visiveis.map(({ key, label, Icon }) => {
              const atual = tipo === "icone" && valor === key;
              const emFoco = aberto?.key === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-icone={key}
                  title={label}
                  aria-label={label}
                  aria-pressed={atual}
                  aria-expanded={emFoco}
                  disabled={saving}
                  onClick={event => abrir(key, event.currentTarget)}
                  className={`flex aspect-square items-center justify-center rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:opacity-50 ${emFoco || atual ? "bg-black/[.06]" : "hover:bg-black/[.04]"}`}
                  style={{ color: atual ? corAtual : "rgba(13,13,13,.55)" }}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden />
                </button>
              );
            })}
          </div>
        )}

        {aberto && opcaoAberta && (
          <div
            ref={corasRef}
            role="group"
            aria-label={`${opcaoAberta.label}: escolha a cor`}
            onKeyDown={event => {
              if (event.key !== "Escape") return;
              event.preventDefault(); event.stopPropagation();
              const icone = aberto.key;
              setAberto(null);
              requestAnimationFrame(() => gradeRef.current?.querySelector<HTMLButtonElement>(`[data-icone="${icone}"]`)?.focus());
            }}
            className="absolute z-10 flex gap-0.5 rounded bg-white p-1 animate-[aparecer_.14s_ease-out] motion-reduce:animate-none"
            style={{ left: aberto.left, top: aberto.top, boxShadow: "var(--elevacao-sombra-2)" }}
          >
            {PROJECT_ICON_COLORS.map(({ key, label, cor: opcaoCor }, indice) => {
              const escolhida = tipo === "icone" && valor === aberto.key && corAtual.toLowerCase() === opcaoCor.toLowerCase();
              return (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={`${opcaoAberta.label} em ${label}`}
                  aria-pressed={escolhida}
                  autoFocus={escolhida || (indice === 0 && !(tipo === "icone" && valor === aberto.key))}
                  disabled={saving}
                  onClick={() => { setAberto(null); onEscolher(aberto.key, opcaoCor); }}
                  className={`flex h-9 w-9 items-center justify-center rounded transition-[background-color,transform] duration-150 hover:scale-110 hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] motion-reduce:hover:scale-100 ${escolhida ? "bg-black/[.06]" : ""}`}
                  style={{ color: opcaoCor }}
                >
                  <opcaoAberta.Icon size={20} strokeWidth={1.9} aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {onLogo && (
        <button type="button" disabled={saving} onClick={onLogo} className="mt-2.5 flex h-8 w-full items-center gap-2 rounded px-2 text-[0.75rem] text-black/55 transition hover:bg-black/[.04] hover:text-[#282525] disabled:opacity-50">
          <ImagePlus size={14} aria-hidden />
          {saving ? "Salvando…" : temLogo ? "Trocar logo" : "Usar logo"}
        </button>
      )}
    </div>
  );
}
