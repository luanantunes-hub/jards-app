"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Search, type LucideIcon } from "lucide-react";
import { TituloComFrase } from "@/components/list/TituloComFrase";
import { DURACAO_DO_BRILHO_MS, QUADROS_PARA_ACHAR_A_FOLHA, folhaQueDesceuDoTopo } from "@/lib/brilho-da-folha";
import type { SecaoComFrase } from "@/lib/frases-das-secoes";

/** Cabeçalho de coluna de tabela conforme DESIGN.md: 10px, peso 500, caixa alta, tracking .08em. */
export const LIST_HEADER_CELL = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35";

/** Com `secao`, o topo segue o painel: o título vira a etiqueta pequena e a frase do dia da seção ocupa o lugar dele. */
export function ListPageHeader({ eyebrow, title, description, summary, actions, secao }: { eyebrow: string; title: string; description?: ReactNode; summary?: ReactNode; actions?: ReactNode; secao?: SecaoComFrase }) {
  return <header className="shrink-0 border-b px-4 pb-5 pt-6 md:px-8 md:pt-8" style={{borderColor:"rgba(13,13,13,.08)"}}><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div>{secao ? <TituloComFrase secao={secao} titulo={title} /> : <><p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/30">{eyebrow}</p><h1 className="mt-1 text-[1.75rem] font-bold tracking-[-.025em] text-[#282525] [text-wrap:balance]">{title}</h1></>}{description && <p className="mt-1.5 max-w-xl text-[0.8125rem] text-black/45">{description}</p>}</div><div className="flex flex-wrap items-center gap-3 lg:justify-end">{summary}{actions}</div></div></header>;
}

const COR_ALERTA = { ambar: "#B07A14", vermelho: "#D94A4A" } as const;

/** Converte o `tone` antigo (cor no número) no alerta equivalente, que pinta só o ícone. */
const ALERTA_DO_TOM: Record<string, keyof typeof COR_ALERTA> = {
  "#9a6a10": "ambar",
  "#b07a14": "ambar",
  "#b23b3b": "vermelho",
  "#d94a4a": "vermelho",
  "#d94e4e": "vermelho",
};

/**
 * Número do cabeçalho da lista: valor em tinta, texto neutro. O ícone opcional
 * fica cinza; só um estado de alerta (`alerta`) pinta o ícone, nunca o número.
 * `tone` está obsoleto: âmbar ou vermelho viram um ícone de alerta na cor; outros tons são ignorados.
 */
export function ListSummary({ strong, children, icone, alerta, tone }: { strong: ReactNode; children: ReactNode; icone?: LucideIcon; alerta?: keyof typeof COR_ALERTA; /** @deprecated use `icone` + `alerta` */ tone?: string }) {
  const alertaFinal = alerta ?? (tone ? ALERTA_DO_TOM[tone.toLowerCase()] : undefined);
  const Icone = icone ?? (alertaFinal ? AlertCircle : undefined);
  const conteudo = <><span className="font-semibold tabular-nums text-[#282525]">{strong}</span> {children}</>;
  if (!Icone) return <span className="text-[0.75rem] text-black/40">{conteudo}</span>;
  return <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-black/40"><Icone size={12} strokeWidth={1.75} aria-hidden="true" className={alertaFinal ? "shrink-0" : "shrink-0 text-black/40"} style={alertaFinal ? { color: COR_ALERTA[alertaFinal] } : undefined}/><span>{conteudo}</span></span>;
}

export function ListToolbar({ children, search }: { children?: ReactNode; search?: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-3 border-b bg-white px-4 py-3 md:px-8 lg:flex-row lg:items-center lg:justify-between" style={{borderColor:"rgba(13,13,13,.06)"}}><div className="flex max-w-full items-center gap-2 overflow-x-auto">{children}</div>{search}</div>;
}

export function ListSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block w-full shrink-0 lg:w-[18.75rem]"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/25"/><input type="search" aria-label={placeholder} value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder} className="h-9 w-full rounded border border-black/10 bg-white pl-9 pr-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/10"/></label>;
}

export function ListContent({ children, className }: { children: ReactNode; className?: string }) { return <main className={`flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6 ${className ?? ""}`}>{children}</main>; }
export function ListTableSurface({ children, className }: { children: ReactNode; className?: string }) { return <div className={`overflow-x-auto rounded border bg-white ${className ?? ""}`} style={{borderColor:"rgba(13,13,13,.08)"}}>{children}</div>; }

/** Medidas, tipografia e pressionar comuns às ações do cabeçalho e das seções. */
const ACAO_DE_LISTA = "flex h-9 items-center gap-1.5 rounded border text-[0.75rem] font-medium active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

type AcaoDeLista = { children: ReactNode; onClick: () => void; disabled?: boolean };

type BrilhoNaFolha = { chave: number; esquerda: number; largura: number };

/**
 * Ação principal da página ou da seção: criar ou iniciar o objeto principal. Roxo noite do hero da
 * landing (#1C0E33) com volume discreto (degradê, luz de 1px no topo, sombra curta), texto branco e
 * sem contorno em volta. O botão fica parado: no hover só clareia um tom, ao pressionar afunda.
 * Quando o clique abre uma folha que desce do topo, uma luz violeta passa uma vez pela borda de
 * cima dela e some (`.brilho-da-folha`). O visual está em app/globals.css. Uma por contexto:
 * quando há duas lado a lado, a outra é `SecondaryListAction`.
 */
export function PrimaryListAction({ children, onClick, disabled = false }: AcaoDeLista) {
  const [brilho, setBrilho] = useState<BrilhoNaFolha | null>(null);

  useEffect(() => {
    if (!brilho) return;
    const fim = window.setTimeout(() => setBrilho(null), DURACAO_DO_BRILHO_MS);
    return () => window.clearTimeout(fim);
  }, [brilho]);

  function clicar() {
    const antes = new Set(document.querySelectorAll('[role="dialog"]'));
    onClick();
    // A folha monta depois do clique: procura por alguns quadros a que nasceu no topo.
    const procurar = (restam: number) => requestAnimationFrame(() => {
      const folha = folhaQueDesceuDoTopo(antes, document.querySelectorAll('[role="dialog"]'), (caixa) => caixa.getBoundingClientRect().top);
      if (folha) {
        const { left, width } = folha.getBoundingClientRect();
        setBrilho({ chave: Date.now(), esquerda: left, largura: width });
      } else if (restam > 0) {
        procurar(restam - 1);
      }
    });
    procurar(QUADROS_PARA_ACHAR_A_FOLHA);
  }

  return (
    <>
      <button type="button" onClick={clicar} disabled={disabled} className={`${ACAO_DE_LISTA} acao-principal border-transparent px-4 text-white transition-transform duration-150`}>{children}</button>
      {brilho && createPortal(<span key={brilho.chave} aria-hidden="true" className="brilho-da-folha" style={{ left: brilho.esquerda, width: brilho.largura }} />, document.body)}
    </>
  );
}

/** Ação de apoio ao lado da principal (copiar, exportar…): branca, com borda leve e hover cinza. */
export function SecondaryListAction({ children, onClick, disabled = false }: AcaoDeLista) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`${ACAO_DE_LISTA} transition border-black/12 bg-white px-3.5 text-[#282525] hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]`}>{children}</button>;
}

/**
 * Estado vazio padrão: explica o que falta e oferece a próxima ação.
 * Use `filtered` quando há dados, mas os filtros não encontraram nada.
 */
export function ListEmptyState({ icon: Icon, title, description, action, filtered = false, onClearFilters }: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  filtered?: boolean;
  onClearFilters?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      {Icon && <Icon size={28} className="mb-3 text-black/15" aria-hidden="true" />}
      <p className="text-[0.875rem] font-semibold text-black/55">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">{description}</p>}
      {(action || (filtered && onClearFilters)) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {filtered && onClearFilters && (
            <button type="button" onClick={onClearFilters} className="h-9 rounded px-3 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              Limpar filtros
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
