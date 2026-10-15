"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carregarFuncoes, type ClienteDasPermissoes } from "@/lib/producao/permissoes-banco";
import type { FuncaoNaProducao, FuncoesPorPessoa } from "@/lib/producao/permissoes";

/**
 * As funções que o administrador deu na produção (`producao_funcoes`), por
 * pessoa, para a tela de Equipe mostrar o resumo e abrir o modal com os valores
 * de hoje. `ativo` é falso para quem não administra ou para a organização sem a
 * produção: então nada é consultado, e a tela fica como era.
 *
 * `funcoes` é null até a leitura terminar (e se ela falhar): a tela não deve
 * oferecer a edição sem saber o que a pessoa já tem, para não gravar o padrão
 * por cima de uma função que existe. Pessoa sem registro não aparece no mapa.
 */
export function useFuncoesProducao(organizationId: string | null, ativo: boolean) {
  const [lidas, setLidas] = useState<{ organizationId: string; funcoes: FuncoesPorPessoa } | null>(null);

  useEffect(() => {
    if (!organizationId || !ativo) return;
    let vivo = true;
    carregarFuncoes(createClient() as unknown as ClienteDasPermissoes, organizationId).then(resultado => {
      if (vivo && resultado.ok) setLidas({ organizationId, funcoes: resultado.funcoes });
    });
    return () => { vivo = false; };
  }, [organizationId, ativo]);

  const funcoes = ativo && lidas && lidas.organizationId === organizationId ? lidas.funcoes : null;

  /** Depois de salvar: a tela passa a mostrar o que acabou de ser gravado, sem reler. */
  const atualizar = useCallback((userId: string, funcao: FuncaoNaProducao) => {
    setLidas(atual => (atual ? { ...atual, funcoes: { ...atual.funcoes, [userId]: funcao } } : atual));
  }, []);

  return { funcoes, atualizar };
}
