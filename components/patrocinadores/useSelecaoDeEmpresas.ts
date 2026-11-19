"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MAX_SELECAO,
  alternarNaSelecao,
  alternarPaginaNaSelecao,
  type EmpresaDaBase,
  type Selecao,
} from "@/lib/patrocinadores-selecao";

/**
 * As empresas marcadas na lista de patrocinadores. Mora na página (não na aba), então a marcação segue quem
 * troca de aba, de página ou de filtro; só some ao limpar ou depois de levar as empresas para o CRM.
 */
export function useSelecaoDeEmpresas() {
  const [selecao, setSelecao] = useState<Selecao>(() => new Map());

  const alternar = useCallback((empresa: EmpresaDaBase) => setSelecao((atual) => alternarNaSelecao(atual, empresa)), []);
  const alternarPagina = useCallback((pagina: readonly EmpresaDaBase[]) => setSelecao((atual) => alternarPaginaNaSelecao(atual, pagina)), []);
  const limpar = useCallback(() => setSelecao(new Map()), []);

  return useMemo(
    () => ({
      total: selecao.size,
      noLimite: selecao.size >= MAX_SELECAO,
      lista: [...selecao.values()],
      tem: (id: string) => selecao.has(id),
      alternar,
      alternarPagina,
      limpar,
    }),
    [selecao, alternar, alternarPagina, limpar],
  );
}

export type SelecaoDeEmpresas = ReturnType<typeof useSelecaoDeEmpresas>;
