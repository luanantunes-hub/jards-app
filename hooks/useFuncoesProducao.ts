"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carregarFuncoes, type ClienteDasPermissoes } from "@/lib/producao/permissoes-banco";
import type { FuncaoNaProducao, FuncoesPorPessoa } from "@/lib/producao/permissoes";

/**
 * As funções que o administrador deu na produção (`producao_funcoes`), por
 * pessoa, para a tela de Equipe mostrar o resumo de cada linha. `ativo` é falso
 * para quem não administra ou para a organização sem a produção: então nada é
 * consultado, e a tela fica como era.
 *
 * `funcoes` é null até a primeira leitura terminar (e se ela falhar), e pessoa
 * sem registro não aparece no mapa. Quem edita não confia nele: `recarregar` lê
 * de novo, e o modal só abre com o que ela devolve (a página pode ter ficado para
 * trás, como quando outro administrador mexe, ou a pessoa sai e volta, o que
 * apaga o registro). Devolve null quando a leitura falha.
 */
export function useFuncoesProducao(organizationId: string | null, ativo: boolean) {
  const [lidas, setLidas] = useState<{ organizationId: string; funcoes: FuncoesPorPessoa } | null>(null);

  const ler = useCallback(async (): Promise<FuncoesPorPessoa | null> => {
    if (!organizationId) return null;
    const resultado = await carregarFuncoes(createClient() as unknown as ClienteDasPermissoes, organizationId);
    return resultado.ok ? resultado.funcoes : null;
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !ativo) return;
    let vivo = true;
    ler().then(funcoes => {
      if (vivo && funcoes) setLidas({ organizationId, funcoes });
    });
    return () => { vivo = false; };
  }, [organizationId, ativo, ler]);

  const recarregar = useCallback(async (): Promise<FuncoesPorPessoa | null> => {
    const funcoes = await ler();
    if (funcoes && organizationId) setLidas({ organizationId, funcoes });
    return funcoes;
  }, [ler, organizationId]);

  const funcoes = ativo && lidas && lidas.organizationId === organizationId ? lidas.funcoes : null;

  /** Depois de salvar: a tela passa a mostrar o que acabou de ser gravado, sem reler. */
  const atualizar = useCallback((userId: string, funcao: FuncaoNaProducao) => {
    setLidas(atual => (atual ? { ...atual, funcoes: { ...atual.funcoes, [userId]: funcao } } : atual));
  }, []);

  return { funcoes, recarregar, atualizar };
}
