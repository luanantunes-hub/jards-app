import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { equipamentosDaFicha } from "@/lib/producao/equipamentos";
import { documentoDaFicha } from "@/lib/producao/ficha-pdf";
import { fichaDoEspacoParaOLink } from "@/lib/producao/ficha";
import type { DocumentoDoPdf } from "@/lib/producao/pdf-texto";
import type { Database } from "@/lib/supabase/types";

// A ficha técnica do espaço por link (PD3.5): /ficha/[código]. Sem login: o código do link é a autorização, e só o hash dele fica no banco. O servidor
// lê com a chave de serviço, então cada pedido confere o hash, a revogação e a validade. O conteúdo é o do PDF da ficha (`documentoDaFicha`): o espaço,
// uma seção por sala e os equipamentos em uso; o contato do espaço só aparece se o link foi gerado com ele.

type Admin = SupabaseClient<Database>;

/** 32 bytes em base64url: o formato que `fn_producao_ficha_criar_link` gera. */
export const CODIGO_DA_FICHA = /^[A-Za-z0-9_-]{43}$/;
export const hashDoCodigoDaFicha = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type ResultadoDaFichaPublica =
  | { situacao: "valido"; documento: DocumentoDoPdf; organizacao: string; validoAte: string }
  | { situacao: "inexistente" | "revogado" | "expirado" };

export async function carregarFichaPublica(admin: Admin, codigo: string, agora = new Date()): Promise<ResultadoDaFichaPublica> {
  if (!CODIGO_DA_FICHA.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data: link, error } = await producao.from("producao_ficha_links").select("organization_id, espaco_id, expira_em, incluir_contato, revogado_em").eq("token_hash", hashDoCodigoDaFicha(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!link) return { situacao: "inexistente" };
  if (link.revogado_em) return { situacao: "revogado" };
  if (new Date(link.expira_em).getTime() <= agora.getTime()) return { situacao: "expirado" };

  const [espaco, ficha, salas, equipamentos, organizacao] = await Promise.all([
    producao.from("producao_espacos").select("nome, tipo, uf, endereco, capacidade").eq("id", link.espaco_id).eq("arquivado", false).maybeSingle(),
    producao.from("producao_espaco_fichas").select("funcionamento, acessibilidade, carga_descarga, doca_altura_m, veiculo_max_m, contato_nome, contato_telefone, contato_email, logo_url").eq("espaco_id", link.espaco_id).maybeSingle(),
    producao.from("producao_salas").select("id, nome, capacidade").eq("espaco_id", link.espaco_id).eq("arquivada", false).order("nome"),
    producao.from("producao_equipamentos").select("nome, quantidade, estado, sala_id").eq("espaco_id", link.espaco_id),
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
  ]);
  if (espaco.error || ficha.error || salas.error || equipamentos.error) throw new Error("não foi possível ler a ficha");
  if (!espaco.data) return { situacao: "inexistente" };
  const salaIds = (salas.data ?? []).map(sala => sala.id);
  const fichasDasSalas = salaIds.length > 0
    ? await producao.from("producao_sala_fichas").select("sala_id, palco_boca_m, palco_profundidade_m, palco_altura_m, palco_piso, som_sistema, som_canais_entrada, luz_descricao, luz_refletores, energia_kva, energia_tensao_v, energia_fases, camarins_quantidade, camarins_capacidade, notas").in("sala_id", salaIds)
    : { data: [], error: null };
  if (fichasDasSalas.error) throw new Error("não foi possível ler as salas");
  const porSala = new Map((fichasDasSalas.data ?? []).map(({ sala_id, ...resto }) => [sala_id, resto]));
  // O contato do espaço só sai se o link foi gerado com ele.
  const fichaDoEspaco = fichaDoEspacoParaOLink(ficha.data, link.incluir_contato);
  const nomeDaSala = new Map((salas.data ?? []).map(sala => [sala.id, sala.nome]));
  const documento = documentoDaFicha(
    espaco.data, fichaDoEspaco, (salas.data ?? []).map(sala => ({ nome: sala.nome, capacidade: sala.capacidade, ficha: porSala.get(sala.id) ?? null })),
    equipamentosDaFicha(equipamentos.data ?? []).map(item => ({ nome: item.nome, quantidade: item.quantidade, sala: item.sala_id ? nomeDaSala.get(item.sala_id) ?? null : null })),
  );
  return { situacao: "valido", documento, organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "", validoAte: link.expira_em };
}
