import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { retornoDaMarca, type RetornoDaMarca } from "@/lib/producao/retorno-marca";
import type { Database } from "@/lib/supabase/types";

// O portal do patrocinador (PD9.2), pelo link /patrocinador/[código]. Sem login: o código do link é a autorização, e só o hash dele
// fica no banco. O servidor lê com a chave de serviço, então cada pedido confere o hash, a revogação e a validade, e devolve **só**
// o nome e o logo da marca e as sessões que ela apresenta (dia, hora, título, sala e espaço). Nunca pessoas, contato, dinheiro,
// borderô, outras marcas ou o que não é sessão.

type Admin = SupabaseClient<Database>;

/** 32 bytes em base64url: o formato que `fn_producao_marca_criar_link` gera. */
export const CODIGO_DO_PATROCINADOR = /^[A-Za-z0-9_-]{43}$/;
export const hashDoCodigoDoPatrocinador = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type SessaoDoPortal = { id: string; dia: string; inicio: string; titulo: string; sala: string | null; espaco: string | null; aconteceu: boolean };
export type PortalDoPatrocinador = {
  marca: { nome: string; site_url: string | null; logo_url: string | null };
  retorno: RetornoDaMarca;
  sessoes: SessaoDoPortal[];
};
export type ResultadoDoPortal =
  | { situacao: "valido"; portal: PortalDoPatrocinador; organizacao: string; validoAte: string }
  | { situacao: "inexistente" | "revogado" | "expirado" };

/** O dia de hoje em São Paulo (AAAA-MM-DD): é por ele que a sessão já aconteceu ou está por vir. */
const hojeEmSaoPaulo = (agora: Date) => agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export async function carregarPortalDoPatrocinador(admin: Admin, codigo: string, agora = new Date()): Promise<ResultadoDoPortal> {
  if (!CODIGO_DO_PATROCINADOR.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data: link, error } = await producao.from("producao_marca_links")
    .select("organization_id, marca_id, expira_em, revogado_em").eq("token_hash", hashDoCodigoDoPatrocinador(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!link) return { situacao: "inexistente" };
  if (link.revogado_em) return { situacao: "revogado" };
  if (new Date(link.expira_em).getTime() <= agora.getTime()) return { situacao: "expirado" };

  const [marca, sessoes, organizacao] = await Promise.all([
    producao.from("producao_marcas").select("nome, site_url, logo_url, arquivada").eq("id", link.marca_id).maybeSingle(),
    producao.from("producao_sessoes").select("id, dia, inicio, titulo, pauta_id").eq("marca_id", link.marca_id).order("dia"),
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
  ]);
  if (marca.error || sessoes.error) throw new Error("não foi possível ler o portal");
  // Marca arquivada não tem portal: ela saiu da programação pública.
  if (!marca.data || marca.data.arquivada) return { situacao: "inexistente" };

  // A sala e o espaço de cada sessão, pela pauta. Só o nome dos dois: nada mais da pauta sai daqui.
  const pautaIds = [...new Set((sessoes.data ?? []).map(sessao => sessao.pauta_id))];
  const pautas = pautaIds.length > 0 ? await producao.from("producao_pautas").select("id, sala_id, situacao").in("id", pautaIds) : { data: [], error: null };
  if (pautas.error) throw new Error("não foi possível ler as salas");
  // Pauta que não está confirmada não aparece: é consulta ou pré-reserva, e nada disso é combinado com o patrocinador.
  const confirmadas = new Map((pautas.data ?? []).filter(pauta => pauta.situacao === "confirmada").map(pauta => [pauta.id, pauta.sala_id]));
  const salaIds = [...new Set([...confirmadas.values()])];
  const salas = salaIds.length > 0 ? await producao.from("producao_salas").select("id, nome, espaco_id").in("id", salaIds) : { data: [], error: null };
  if (salas.error) throw new Error("não foi possível ler as salas");
  const espacoIds = [...new Set((salas.data ?? []).map(sala => sala.espaco_id))];
  const espacos = espacoIds.length > 0 ? await producao.from("producao_espacos").select("id, nome").in("id", espacoIds) : { data: [], error: null };
  if (espacos.error) throw new Error("não foi possível ler os espaços");
  const nomeDaSala = new Map((salas.data ?? []).map(sala => [sala.id, sala.nome]));
  const espacoDaSala = new Map((salas.data ?? []).map(sala => [sala.id, sala.espaco_id]));
  const nomeDoEspaco = new Map((espacos.data ?? []).map(espaco => [espaco.id, espaco.nome]));

  const hoje = hojeEmSaoPaulo(agora);
  const daMarca = (sessoes.data ?? []).filter(sessao => confirmadas.has(sessao.pauta_id));
  const lista: SessaoDoPortal[] = daMarca.map(sessao => {
    const salaId = confirmadas.get(sessao.pauta_id) ?? null;
    return {
      id: sessao.id, dia: sessao.dia, inicio: sessao.inicio, titulo: sessao.titulo ?? "",
      sala: salaId ? nomeDaSala.get(salaId) ?? null : null,
      espaco: salaId ? nomeDoEspaco.get(espacoDaSala.get(salaId) ?? "") ?? null : null,
      aconteceu: sessao.dia <= hoje,
    };
  });

  return {
    situacao: "valido",
    portal: {
      marca: { nome: marca.data.nome, site_url: marca.data.site_url, logo_url: marca.data.logo_url },
      retorno: retornoDaMarca(daMarca.map(sessao => ({ id: sessao.id, dia: sessao.dia, titulo: sessao.titulo ?? "" })), hoje),
      sessoes: lista,
    },
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "",
    validoAte: link.expira_em,
  };
}
