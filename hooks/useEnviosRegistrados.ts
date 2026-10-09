"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnvioDaLista } from "@/lib/prestacao/envios";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const CAMPOS = "id, etapa, exercicio, versao, enviado_em, protocolo, sistema, comentario, situacao, registrado_em, reaberto_em, motivo_reabertura, guarda_ate, guarda_marco, retrato_sha256";

/** Os envios registrados da prestação (P4.6), do mais novo para o mais antigo, sem o retrato. */
export function useEnviosRegistrados(prestacaoId: string): { envios: EnvioDaLista[] | null; erro: string; recarregar: () => Promise<void> } {
  const supabase = useMemo(() => createClient(), []);
  const [lidos, setLidos] = useState<{ prestacaoId: string; envios: EnvioDaLista[] | null; erro: string } | null>(null);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_envios ainda não está no tipo Database
    const { data, error } = await (supabase as any).from("prestacao_envios").select(CAMPOS)
      .eq("prestacao_id", prestacaoId).order("registrado_em", { ascending: false });
    return { envios: error ? null : (data ?? []) as EnvioDaLista[], erro: error ? mensagemErroPrestacao(error, "Não foi possível carregar os envios") : "" };
  }, [prestacaoId, supabase]);

  const recarregar = useCallback(async () => {
    const lido = await buscar();
    setLidos({ prestacaoId, ...lido });
  }, [buscar, prestacaoId]);

  useEffect(() => {
    let ativo = true;
    buscar().then(lido => { if (ativo) setLidos({ prestacaoId, ...lido }); });
    return () => { ativo = false; };
  }, [buscar, prestacaoId]);

  const atual = lidos?.prestacaoId === prestacaoId ? lidos : null;
  return { envios: atual?.envios ?? null, erro: atual?.erro ?? "", recarregar };
}
