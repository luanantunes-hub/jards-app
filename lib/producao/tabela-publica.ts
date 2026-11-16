import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { itensParaALocadora, transfersParaATransportadora, type ItemParaALocadora, type TipoDeTabela, type TransferDaTransportadora } from "@/lib/producao/tabelas-publicas";
import type { Database } from "@/lib/supabase/types";

// As tabelas para a transportadora e para a locadora (PD8.6), pelo link /tabela/[código]. Sem login: o código do link é a autorização, e só
// o hash dele fica no banco. O servidor lê com a chave de serviço, então cada pedido confere o hash, a revogação e a validade, e só devolve o
// que `lib/producao/tabelas-publicas.ts` deixa passar.

type Admin = SupabaseClient<Database>;

/** 32 bytes em base64url: o formato que `fn_producao_temporada_criar_link` gera. */
export const CODIGO_DA_TABELA = /^[A-Za-z0-9_-]{43}$/;
export const hashDoCodigoDaTabela = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

/** Quantas linhas, no máximo, a página devolve de uma vez. */
const LIMITE = 1000;

export type TabelaPublica =
  | { tipo: "transfers"; titulo: string; organizacao: string; validoAte: string; filtro: string | null; transfers: TransferDaTransportadora[] }
  | { tipo: "locacao"; titulo: string; organizacao: string; validoAte: string; filtro: string | null; itens: ItemParaALocadora[] };

export type ResultadoDaTabela = { situacao: "valido"; tabela: TabelaPublica } | { situacao: "inexistente" | "revogado" | "expirado" };

export async function carregarTabelaPublica(admin: Admin, codigo: string, agora = new Date()): Promise<ResultadoDaTabela> {
  if (!CODIGO_DA_TABELA.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data: link, error } = await producao.from("producao_temporada_links").select("organization_id, temporada_id, tipo, filtro, expira_em, revogado_em").eq("token_hash", hashDoCodigoDaTabela(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!link) return { situacao: "inexistente" };
  if (link.revogado_em) return { situacao: "revogado" };
  if (new Date(link.expira_em).getTime() <= agora.getTime()) return { situacao: "expirado" };
  if (link.tipo !== "transfers" && link.tipo !== "locacao") return { situacao: "inexistente" };
  const tipo: TipoDeTabela = link.tipo;

  const [temporada, organizacao] = await Promise.all([
    producao.from("producao_temporadas").select("titulo, obra_id").eq("id", link.temporada_id).maybeSingle(),
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
  ]);
  if (temporada.error || !temporada.data) throw new Error("não foi possível ler a temporada");
  const comum = {
    titulo: temporada.data.titulo, organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "",
    validoAte: link.expira_em, filtro: link.filtro,
  };

  if (tipo === "locacao") {
    if (!temporada.data.obra_id) return { situacao: "valido", tabela: { tipo, ...comum, itens: [] } };
    const itens = await producao.from("producao_itens")
      .select("nome, categoria, quantidade, fornecedor, locacao_inicio, locacao_fim, comprimento_cm, largura_cm, altura_cm, peso_kg")
      .eq("organization_id", link.organization_id).eq("obra_id", temporada.data.obra_id).eq("dono", "locado").eq("arquivado", false).is("devolvido_em", null).limit(LIMITE);
    if (itens.error) throw new Error("não foi possível ler os itens");
    return { situacao: "valido", tabela: { tipo, ...comum, itens: itensParaALocadora(itens.data ?? [], link.filtro) } };
  }

  const datas = await producao.from("producao_datas").select("id, data, fuso").eq("temporada_id", link.temporada_id);
  if (datas.error) throw new Error("não foi possível ler as datas");
  const dataIds = (datas.data ?? []).map(data => data.id);
  const deslocamentos = dataIds.length > 0
    ? await producao.from("producao_deslocamentos").select("id, data_id, tipo, origem, destino, saida, chegada, companhia, localizador").in("data_id", dataIds).limit(LIMITE)
    : { data: [], error: null };
  if (deslocamentos.error) throw new Error("não foi possível ler os transfers");
  const deslocamentoIds = (deslocamentos.data ?? []).map(item => item.id);
  const vinculos = deslocamentoIds.length > 0
    ? await producao.from("producao_deslocamento_pessoas").select("deslocamento_id, pessoa_id").in("deslocamento_id", deslocamentoIds)
    : { data: [], error: null };
  if (vinculos.error) throw new Error("não foi possível ler os passageiros");
  const pessoaIds = [...new Set((vinculos.data ?? []).map(item => item.pessoa_id))];
  // Só o nome: telefone, e-mail e documentos não são lidos.
  const pessoas = pessoaIds.length > 0 ? await producao.from("producao_pessoas").select("id, nome").in("id", pessoaIds) : { data: [], error: null };
  if (pessoas.error) throw new Error("não foi possível ler os nomes");
  return { situacao: "valido", tabela: { tipo, ...comum, transfers: transfersParaATransportadora(datas.data ?? [], deslocamentos.data ?? [], vinculos.data ?? [], pessoas.data ?? [], link.filtro) } };
}
