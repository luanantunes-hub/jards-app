"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carregarDadosDoEnvio, type DadosDoEnvio } from "@/lib/prestacao/dados-do-envio";
import { EVENTO_VERIFICADA } from "@/lib/prestacao/verificar-cliente";

export type { DadosDoEnvio };

/**
 * O que o checklist de envio (P4.1) avalia: o estado da prestação que o motor
 * de checagens usa, as verificações, as contas com os extratos, as marcações
 * e os arquivos do checklist, e as devoluções (P4.4). Lê de novo quando uma verificação termina.
 */
export function useDadosDoEnvio(prestacaoId: string): { dados: DadosDoEnvio | null; erro: string; recarregar: () => Promise<void> } {
  const supabase = useMemo(() => createClient(), []);
  const [lidos, setLidos] = useState<{ prestacaoId: string; dados: DadosDoEnvio | null; erro: string } | null>(null);

  const buscar = useCallback(() => carregarDadosDoEnvio(supabase, prestacaoId), [prestacaoId, supabase]);

  const recarregar = useCallback(async () => {
    const lido = await buscar();
    setLidos({ prestacaoId, ...lido });
  }, [buscar, prestacaoId]);

  useEffect(() => {
    let ativo = true;
    buscar().then(lido => { if (ativo) setLidos({ prestacaoId, ...lido }); });
    const aoVerificar = (e: Event) => {
      if ((e as CustomEvent<{ prestacaoId: string }>).detail?.prestacaoId !== prestacaoId) return;
      buscar().then(lido => { if (ativo) setLidos({ prestacaoId, ...lido }); });
    };
    window.addEventListener(EVENTO_VERIFICADA, aoVerificar);
    return () => { ativo = false; window.removeEventListener(EVENTO_VERIFICADA, aoVerificar); };
  }, [buscar, prestacaoId]);

  const atual = lidos?.prestacaoId === prestacaoId ? lidos : null;
  return { dados: atual?.dados ?? null, erro: atual?.erro ?? "", recarregar };
}
