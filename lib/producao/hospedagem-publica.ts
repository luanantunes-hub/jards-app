import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { quartosParaOHotel, type ListaParaOHotel } from "@/lib/producao/hospedagem-lista";
import type { Database } from "@/lib/supabase/types";

// A lista de quartos para o hotel (PD8.6), pelo link /hospedagem/[código]. Sem login: o código do link é a autorização, e só o hash
// dele fica no banco. O servidor lê com a chave de serviço, então cada pedido confere o hash, a revogação e a validade, e só devolve
// o que `quartosParaOHotel` deixa passar: hotel, período, localizador e, por quarto, os nomes. Nunca contato, documento, nota ou dinheiro.

type Admin = SupabaseClient<Database>;

/** 32 bytes em base64url: o formato que `fn_producao_hospedagem_criar_link` gera. */
export const CODIGO_DA_HOSPEDAGEM = /^[A-Za-z0-9_-]{43}$/;
export const hashDoCodigoDaHospedagem = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type ResultadoDaListaDoHotel =
  | { situacao: "valido"; lista: ListaParaOHotel; organizacao: string; validoAte: string }
  | { situacao: "inexistente" | "revogado" | "expirado" };

export async function carregarListaDoHotel(admin: Admin, codigo: string, agora = new Date()): Promise<ResultadoDaListaDoHotel> {
  if (!CODIGO_DA_HOSPEDAGEM.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data: link, error } = await producao.from("producao_hospedagem_links").select("organization_id, hospedagem_id, expira_em, revogado_em").eq("token_hash", hashDoCodigoDaHospedagem(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!link) return { situacao: "inexistente" };
  if (link.revogado_em) return { situacao: "revogado" };
  if (new Date(link.expira_em).getTime() <= agora.getTime()) return { situacao: "expirado" };

  const [hospedagem, quartos, ocupantes, organizacao] = await Promise.all([
    producao.from("producao_hospedagens").select("hotel, endereco, entrada, saida, localizador").eq("id", link.hospedagem_id).maybeSingle(),
    producao.from("producao_quartos").select("id, nome, capacidade").eq("hospedagem_id", link.hospedagem_id),
    producao.from("producao_ocupantes").select("quarto_id, pessoa_id").eq("hospedagem_id", link.hospedagem_id),
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
  ]);
  if (hospedagem.error || quartos.error || ocupantes.error) throw new Error("não foi possível ler a hospedagem");
  if (!hospedagem.data) return { situacao: "inexistente" };
  const pessoaIds = [...new Set((ocupantes.data ?? []).map(ocupante => ocupante.pessoa_id))];
  // Só o nome: telefone, e-mail e documentos não são lidos.
  const pessoas = pessoaIds.length > 0 ? await producao.from("producao_pessoas").select("id, nome").in("id", pessoaIds) : { data: [], error: null };
  if (pessoas.error) throw new Error("não foi possível ler os nomes");
  return {
    situacao: "valido",
    lista: quartosParaOHotel(hospedagem.data, quartos.data ?? [], ocupantes.data ?? [], pessoas.data ?? []),
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "",
    validoAte: link.expira_em,
  };
}
