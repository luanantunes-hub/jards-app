"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { PortalMenu, usePortalPosition } from "@/components/ui/ComboboxPortalMenu";
import { useIndiceCnae } from "@/hooks/useIndiceCnae";
import {
  buscarCnaes,
  descricaoDoCnae,
  formatarCodigoCnae,
  limparCnaesAceitos,
  nivelDoCnae,
  normalizarCnae,
  ROTULO_NIVEL_CNAE,
  sugerirCnaes,
  type IndiceCnae,
} from "@/lib/prestacao/cnae";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";

function descricao(codigo: string, indice: IndiceCnae | null): string | null {
  if (!indice) return null;
  return codigo.length === 7 ? indice.entradas.find(e => e.codigo === codigo)?.descricao ?? null : descricaoDoCnae(codigo, { subclasses: [], niveis: indice.niveis });
}

/**
 * CNAEs aceitos de um item ou agrupador do orçamento: busca por atividade ou
 * código, sugestões pelo nome do item e o que vem herdado de cima.
 */
export function CnaesAceitosCampo({ valor, onChange, textoDoItem, herdados, ehItem }: {
  valor: string[];
  onChange: (cnaes: string[]) => void;
  /** Nome e descrição do item, para as sugestões. */
  textoDoItem: string;
  /** O que vale quando o nó não define: os CNAEs do agrupador mais próximo. */
  herdados: { cnaes: string[]; de: string | null };
  ehItem: boolean;
}) {
  const { indice, erro } = useIndiceCnae();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const campoRef = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const posicao = usePortalPosition(campoRef, aberto && busca.trim().length > 0);

  const resultados = useMemo(() => (indice ? buscarCnaes(busca, indice, 30) : []), [busca, indice]);
  const sugestoes = useMemo(
    () => (indice ? sugerirCnaes(textoDoItem, indice, 8).filter(s => !valor.some(v => s.codigo.startsWith(v))).slice(0, 5) : []),
    [indice, textoDoItem, valor],
  );
  // Sem a tabela, o código digitado ainda entra.
  const codigoDigitado = !indice && normalizarCnae(busca) ? normalizarCnae(busca) : null;

  function adicionar(codigo: string) {
    onChange(limparCnaesAceitos([...valor, codigo]));
    setBusca("");
    setAberto(false);
    setDestaque(0);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setDestaque(d => Math.min(d + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque(d => Math.max(d - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (resultados[destaque]) adicionar(resultados[destaque].codigo);
      else if (codigoDigitado) adicionar(codigoDigitado);
    } else if (e.key === "Escape" && aberto && busca) {
      // O modal só fecha com Escape que ninguém consumiu (useModalDismiss).
      e.preventDefault();
      setAberto(false);
    }
  }

  return (
    <div>
      <span className={ROTULO}>CNAEs aceitos</span>

      {valor.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="CNAEs aceitos">
          {valor.map(c => {
            const texto = descricao(c, indice);
            const nivel = nivelDoCnae(c);
            return (
              <li key={c} className="flex max-w-full items-center gap-1 rounded border bg-white py-1 pl-2 pr-1 text-[0.6875rem] text-black/70" style={{ borderColor: "rgba(13,13,13,.14)" }} title={texto ?? undefined}>
                <span className="shrink-0 tabular-nums text-black/80">{formatarCodigoCnae(c)}</span>
                {nivel && nivel !== "subclasse" && <span className="shrink-0 text-black/40">({ROTULO_NIVEL_CNAE[nivel]})</span>}
                {texto && <span className="truncate text-black/45">{texto}</span>}
                <button type="button" onClick={() => onChange(valor.filter(v => v !== c))} aria-label={`Remover ${formatarCodigoCnae(c)}`} className="shrink-0 rounded p-0.5 text-black/35 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  <X size={11} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : herdados.cnaes.length > 0 ? (
        <p className="mb-2 text-[0.6875rem] text-black/45">
          Herdando de &ldquo;{herdados.de}&rdquo;: <span className="tabular-nums">{herdados.cnaes.map(formatarCodigoCnae).join(", ")}</span>
        </p>
      ) : null}

      <div ref={campoRef} className="relative">
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" aria-hidden />
        <input
          role="combobox"
          aria-expanded={aberto && resultados.length > 0}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-label="Buscar CNAE por atividade ou código"
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); setDestaque(0); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={aoTeclar}
          placeholder={erro ? "Digite o código (ex.: 90.01-9)" : "Buscar por atividade ou código (ex.: teatro, 90.01)"}
          className="w-full rounded border border-black/[.12] py-2 pl-8 pr-3 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20"
        />
      </div>
      {aberto && busca.trim() && (
        <PortalMenu position={posicao}>
          <ul id={listaId} role="listbox" aria-label="CNAEs encontrados">
            {resultados.length === 0 && (
              <li className="px-3 py-2 text-[0.75rem] text-black/45">
                {!indice ? (codigoDigitado ? `Enter para aceitar ${formatarCodigoCnae(codigoDigitado)}` : "Carregando a tabela da CNAE…") : "Nenhuma atividade encontrada."}
              </li>
            )}
            {resultados.map((r, i) => (
              <li key={r.codigo} role="option" aria-selected={i === destaque}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => adicionar(r.codigo)}
                  onMouseEnter={() => setDestaque(i)}
                  className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-[0.75rem] transition ${i === destaque ? "bg-black/[.04]" : ""}`}
                >
                  <span className="shrink-0 tabular-nums text-black/80">{formatarCodigoCnae(r.codigo)}</span>
                  <span className="min-w-0 text-black/60">
                    {r.nivel !== "subclasse" && <span className="mr-1 text-[#684DB0]">{ROTULO_NIVEL_CNAE[r.nivel]} inteira:</span>}
                    {r.descricao}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PortalMenu>
      )}

      {sugestoes.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[0.625rem] text-black/40">Sugestões pelo nome</p>
          <div className="flex flex-wrap gap-1.5">
            {sugestoes.map(s => (
              <button
                key={s.codigo}
                type="button"
                onClick={() => adicionar(s.codigo)}
                title={s.descricao}
                className="flex max-w-full items-center gap-1 rounded border border-dashed bg-white px-2 py-1 text-left text-[0.6875rem] text-black/55 transition hover:border-black/30 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                style={{ borderColor: "rgba(13,13,13,.18)" }}
              >
                <Plus size={11} className="shrink-0" aria-hidden />
                <span className="shrink-0 tabular-nums">{formatarCodigoCnae(s.codigo)}</span>
                <span className="truncate">{s.descricao}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-1.5 text-[0.625rem] leading-4 text-black/40">
        {ehItem
          ? "A despesa confere se o fornecedor tem uma destas atividades na Receita, como principal ou secundária. Vazio: vale o que vier de cima."
          : "Valem para os itens dentro deste agrupador, salvo os que tiverem os próprios."}
        {erro && " A tabela da CNAE não carregou; digite o código."}
      </p>
    </div>
  );
}
