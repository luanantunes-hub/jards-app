// Custo por chamada das funções de IA (P2.10b): cada leitura grava modelo,
// tokens, custo estimado e duração em prestacao_ia_chamadas. O registro
// nunca derruba a leitura: se falhar, fica só no log da função.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { custoDaChamada, usoDaResposta } from "./leitura-documento.ts";

export function emBase64(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export async function registrarChamadaIa(admin: SupabaseClient, chamada: {
  funcao: "extrair-comprovante" | "ler-extrato-pdf";
  organizationId: string | null;
  prestacaoId: string | null;
  userId: string | null;
  modelo: string;
  arquivo: string | null;
  tamanhoBytes: number | null;
  /** Resposta do Gemini (com usageMetadata), quando houve. */
  corpo: unknown;
  inicio: number;
  sucesso: boolean;
  erro?: string | null;
}): Promise<void> {
  const uso = usoDaResposta(chamada.corpo);
  try {
    const { error } = await admin.from("prestacao_ia_chamadas").insert({
      funcao: chamada.funcao,
      organization_id: chamada.organizationId,
      prestacao_id: chamada.prestacaoId,
      user_id: chamada.userId,
      modelo: chamada.modelo,
      arquivo: chamada.arquivo,
      tamanho_bytes: chamada.tamanhoBytes,
      tokens_entrada: uso.entrada,
      tokens_saida: uso.saida,
      tokens_total: uso.total,
      custo_usd: custoDaChamada(Deno.env.get("GOOGLE_AI_PRECOS"), chamada.modelo, uso),
      duracao_ms: Math.max(Date.now() - chamada.inicio, 0),
      sucesso: chamada.sucesso,
      erro: chamada.erro ? chamada.erro.slice(0, 500) : null,
    });
    if (error) console.error("registro da chamada à IA:", error.message);
  } catch (erro) {
    console.error("registro da chamada à IA:", erro);
  }
}
