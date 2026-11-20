import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { ROTULO_DO_TIPO_DE_BLOCO } from "@/lib/producao/dia";
import type { BlocoDoPalco } from "@/lib/producao/palco-ao-vivo";
import type { TipoBloco } from "@/lib/producao/vocabulario";
import type { Database } from "@/lib/supabase/types";

// A tela de palco (PD7.1), pelo link /palco/[código]. Sem login: o código do link é a autorização, e só o hash dele fica no banco. O servidor
// lê com a chave de serviço, então cada pedido confere o hash, a revogação e a validade, e só devolve o dia, o fuso e os blocos que todos veem
// (sem restrição de grupo e que não estão ocultos): título, hora marcada e quando começou e terminou. Nunca pessoas, contato, nota ou dinheiro.

type Admin = SupabaseClient<Database>;

/** 32 bytes em base64url: o formato que `fn_producao_palco_criar_link` gera. */
export const CODIGO_DO_PALCO = /^[A-Za-z0-9_-]{43}$/;
export const hashDoCodigoDoPalco = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type DadosDoPalco = {
  organizacao: string; temporada: string; dia: string; fuso: string; blocos: BlocoDoPalco[];
  /** A hora do servidor quando a leitura foi feita: a tela corrige o relógio do aparelho por ela. */
  agora: string;
};
export type ResultadoDoPalco =
  | { situacao: "valido"; palco: DadosDoPalco; validoAte: string }
  | { situacao: "inexistente" | "revogado" | "expirado" };

export async function carregarPalco(admin: Admin, codigo: string, agora = new Date()): Promise<ResultadoDoPalco> {
  if (!CODIGO_DO_PALCO.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data: link, error } = await producao.from("producao_palco_links").select("organization_id, data_id, expira_em, revogado_em").eq("token_hash", hashDoCodigoDoPalco(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!link) return { situacao: "inexistente" };
  if (link.revogado_em) return { situacao: "revogado" };
  if (new Date(link.expira_em).getTime() <= agora.getTime()) return { situacao: "expirado" };

  const [data, blocos, organizacao] = await Promise.all([
    producao.from("producao_datas").select("data, fuso, temporada_id").eq("id", link.data_id).maybeSingle(),
    producao.from("producao_blocos").select("id, tipo, titulo, inicio, fim, exibicao, ordem, iniciado_em, terminado_em")
      .eq("data_id", link.data_id).is("visivel_para", null).neq("exibicao", "oculta"),
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
  ]);
  if (data.error || blocos.error) throw new Error("não foi possível ler o dia");
  if (!data.data) return { situacao: "inexistente" };
  const temporada = await producao.from("producao_temporadas").select("titulo").eq("id", data.data.temporada_id).maybeSingle();
  return {
    situacao: "valido",
    palco: {
      organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "",
      temporada: temporada.data?.titulo ?? "",
      dia: data.data.data, fuso: data.data.fuso,
      blocos: (blocos.data ?? []).map(bloco => ({
        id: bloco.id, titulo: bloco.titulo?.trim() || ROTULO_DO_TIPO_DE_BLOCO[bloco.tipo as TipoBloco] || "Bloco",
        inicio: bloco.inicio, fim: bloco.fim, exibicao: bloco.exibicao, ordem: bloco.ordem, iniciado_em: bloco.iniciado_em, terminado_em: bloco.terminado_em,
      })),
      agora: agora.toISOString(),
    },
    validoAte: link.expira_em,
  };
}
