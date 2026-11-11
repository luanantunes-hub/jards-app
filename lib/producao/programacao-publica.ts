import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diasDaProgramacaoPublica, type DiaPublico, type SessaoDaGrade } from "@/lib/producao/programacao";
import type { Database } from "@/lib/supabase/types";

// A programação pública de um espaço (PD8.3): /programacao/[código], /embed/programacao/[código] e /api/programacao/[código].
// Sem login: o código do link é a autorização, e só o hash dele fica no banco. O servidor lê com a chave de serviço, então
// cada pedido confere o hash e a revogação, e só devolve o que a função `diasDaProgramacaoPublica` deixa passar: sessões de
// pautas confirmadas, com dia, hora, título e sala.

type Admin = SupabaseClient<Database>;

/** 32 bytes em base64url: o formato que `fn_producao_programacao_criar_link` gera. */
export const CODIGO_DA_PROGRAMACAO = /^[A-Za-z0-9_-]{43}$/;
export const hashDoCodigo = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

/** O dia de hoje no Brasil ("AAAA-MM-DD"): a programação mostra de hoje em diante. */
export const hojeNoBrasil = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Quantas sessões, no máximo, a página devolve de uma vez (o resto é de mais tarde). */
const LIMITE_DE_SESSOES = 500;

export type ProgramacaoPublica = { titulo: string; organizacao: string; espaco: string; dias: DiaPublico[] };

export type ResultadoDaProgramacao = { situacao: "valido"; programacao: ProgramacaoPublica } | { situacao: "inexistente" | "revogado" };

export async function carregarProgramacaoPublica(admin: Admin, codigo: string): Promise<ResultadoDaProgramacao> {
  if (!CODIGO_DA_PROGRAMACAO.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data: link, error } = await producao.from("producao_programacao_links").select("organization_id, espaco_id, titulo, revogado_em").eq("token_hash", hashDoCodigo(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!link) return { situacao: "inexistente" };
  if (link.revogado_em) return { situacao: "revogado" };

  const hoje = hojeNoBrasil();
  const [espaco, organizacao, salas] = await Promise.all([
    producao.from("producao_espacos").select("nome").eq("id", link.espaco_id).maybeSingle(),
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
    producao.from("producao_salas").select("id, nome").eq("espaco_id", link.espaco_id).eq("arquivada", false),
  ]);
  const salaIds = (salas.data ?? []).map(sala => sala.id);
  const pautas = salaIds.length > 0
    ? await producao.from("producao_pautas").select("id, sala_id, titulo, situacao").in("sala_id", salaIds).eq("situacao", "confirmada").gte("fim", hoje)
    : { data: [], error: null };
  const pautaIds = (pautas.data ?? []).map(pauta => pauta.id);
  const sessoes = pautaIds.length > 0
    ? await producao.from("producao_sessoes").select("id, pauta_id, dia, inicio, fim, titulo, notas").in("pauta_id", pautaIds).gte("dia", hoje).order("dia").order("inicio").limit(LIMITE_DE_SESSOES)
    : { data: [], error: null };
  if (espaco.error || salas.error || pautas.error || sessoes.error) throw new Error("não foi possível ler a programação");

  const nomeDoEspaco = espaco.data?.nome ?? "Programação";
  return {
    situacao: "valido",
    programacao: {
      titulo: link.titulo ?? nomeDoEspaco,
      organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "",
      espaco: nomeDoEspaco,
      dias: diasDaProgramacaoPublica((sessoes.data ?? []) as SessaoDaGrade[], pautas.data ?? [], salas.data ?? [], hoje),
    },
  };
}
