"use client";

import { useEffect, useRef } from "react";

const CAIXA = "h-4 w-4 cursor-pointer align-middle accent-[#684DB0] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

/**
 * Primeira célula de cada linha da lista: a caixa de seleção. A célula inteira é a área de clique (a linha
 * abre o perfil da empresa, a caixa não), então um clique ao redor da caixa também marca.
 */
export function CelulaDeSelecao({ marcada, desabilitada = false, nome, titulo, onAlternar }: {
  marcada: boolean;
  desabilitada?: boolean;
  nome: string;
  titulo?: string;
  onAlternar: () => void;
}) {
  const caixa = useRef<HTMLInputElement>(null);
  return (
    <td
      className="w-10 cursor-pointer text-center align-middle"
      title={titulo}
      onClick={(evento) => {
        evento.stopPropagation();
        if (evento.target === evento.currentTarget) caixa.current?.click();
      }}
    >
      <input
        ref={caixa}
        type="checkbox"
        checked={marcada}
        disabled={desabilitada}
        onChange={onAlternar}
        onClick={(evento) => evento.stopPropagation()}
        aria-label={`Selecionar ${nome}`}
        className={CAIXA}
      />
    </td>
  );
}

/** Caixa do cabeçalho: marca ou desmarca a página inteira; fica pela metade quando só parte está marcada. */
export function CabecalhoDeSelecao({ marcadasNaPagina, totalNaPagina, desabilitada = false, onAlternar }: {
  marcadasNaPagina: number;
  totalNaPagina: number;
  desabilitada?: boolean;
  onAlternar: () => void;
}) {
  const caixa = useRef<HTMLInputElement>(null);
  const todas = totalNaPagina > 0 && marcadasNaPagina === totalNaPagina;
  const parcial = marcadasNaPagina > 0 && !todas;
  useEffect(() => {
    if (caixa.current) caixa.current.indeterminate = parcial;
  }, [parcial]);
  return (
    <th
      className="w-10 cursor-pointer text-center align-middle"
      onClick={(evento) => { if (evento.target === evento.currentTarget) caixa.current?.click(); }}
    >
      <input
        ref={caixa}
        type="checkbox"
        checked={todas}
        disabled={desabilitada || totalNaPagina === 0}
        onChange={onAlternar}
        aria-label="Selecionar todas as empresas da página"
        className={CAIXA}
      />
    </th>
  );
}
