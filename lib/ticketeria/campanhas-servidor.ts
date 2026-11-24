import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { sugerirMarcacao, type Marcacao } from "@/lib/ticketeria/campanhas";
import type { DiaDeCampanha } from "@/lib/ticketeria/midia/meta";

type Admin = SupabaseClient<Database>;
const LOTE = 500;
const PAGINA = 1000;

/**
 * Grava o gasto por campanha que uma leitura trouxe (Meta ou Google): o nome de cada campanha (sem mexer na marcação já feita), o gasto por dia e, para campanha nova sem marcação, a
 * sugestão pelo nome (o nome de um evento da loja ou uma palavra de marca). Falhar aqui não deve derrubar a leitura do gasto da conta: quem chama trata o erro.
 */
export async function gravarCampanhas(admin: Admin, conexaoId: string, campanhas: DiaDeCampanha[]): Promise<void> {
  if (campanhas.length === 0) return;
  const t = clienteDaTicketeria(admin);
  const { data: c } = await t.from("ticketeria_conexoes_midia").select("organization_id, loja_id, provedor").eq("id", conexaoId).maybeSingle();
  if (!c || (c.provedor !== "meta" && c.provedor !== "google_ads")) return;
  const canal = c.provedor === "google_ads" ? "google-ads" : "meta-ads";
  const nomes = new Map<string, string>();
  for (const d of campanhas) nomes.set(d.campanha_id, d.campanha);
  const linhas = [...nomes].map(([id, nome]) => ({ organization_id: c.organization_id, loja_id: c.loja_id, conexao_id: conexaoId, canal, campanha_externa_id: id, nome, updated_at: new Date().toISOString() }));
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await t.from("ticketeria_campanhas").upsert(linhas.slice(i, i + LOTE), { onConflict: "conexao_id,campanha_externa_id" });
    if (error) throw new Error(error.message);
  }
  const { data: gravadas, error: erroDasGravadas } = await t.from("ticketeria_campanhas").select("id, campanha_externa_id, nome, marcacao, sugerida").eq("conexao_id", conexaoId).limit(5000);
  if (erroDasGravadas) throw new Error(erroDasGravadas.message);
  const idDe = new Map((gravadas ?? []).map(g => [g.campanha_externa_id, g.id]));
  // O gasto por campanha e dia (somado se vier repetido).
  const porDia = new Map<string, { campanha_id: string; dia: string; gasto_centavos: number }>();
  for (const d of campanhas) {
    const id = idDe.get(d.campanha_id);
    if (!id) continue;
    const chave = `${id}|${d.dia}`;
    const antes = porDia.get(chave);
    porDia.set(chave, { campanha_id: id, dia: d.dia, gasto_centavos: (antes?.gasto_centavos ?? 0) + d.gasto_centavos });
  }
  const dias = [...porDia.values()].map(d => ({ ...d, organization_id: c.organization_id, loja_id: c.loja_id }));
  for (let i = 0; i < dias.length; i += LOTE) {
    const { error } = await t.from("ticketeria_campanhas_diaria").upsert(dias.slice(i, i + LOTE), { onConflict: "campanha_id,dia" });
    if (error) throw new Error(error.message);
  }
  // A sugestão pelo nome, só para quem ainda não tem marcação.
  const semMarcacao = (gravadas ?? []).filter(g => g.marcacao === null);
  if (semMarcacao.length === 0) return;
  const [{ data: eventos }, { data: loja }] = await Promise.all([
    t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", c.loja_id),
    t.from("ticketeria_lojas").select("nome").eq("id", c.loja_id).maybeSingle(),
  ]);
  for (const g of semMarcacao) {
    const s = sugerirMarcacao(g.nome, eventos ?? [], loja?.nome ?? "");
    if (!s) continue;
    const { error } = await t.from("ticketeria_campanhas").update({ marcacao: s.marcacao, evento_id: s.eventoId, sugerida: true }).eq("id", g.id).is("marcacao", null);
    if (error) throw new Error(error.message);
  }
}

export type CampanhaParaATela = { id: string; nome: string; canal: string; gasto90dias: number; marcacao: Marcacao | null; eventoId: string | null; sugerida: boolean };

/** As campanhas da loja, com o gasto dos últimos 90 dias, da que mais gastou para a que menos. */
export async function campanhasDaLoja(admin: Admin, lojaId: string, hoje: string): Promise<CampanhaParaATela[]> {
  const t = clienteDaTicketeria(admin);
  const { data: campanhas, error } = await t.from("ticketeria_campanhas").select("id, nome, canal, marcacao, evento_id, sugerida").eq("loja_id", lojaId).limit(5000);
  if (error) throw new Error(error.message);
  const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - 90 * 86400000).toISOString().slice(0, 10);
  const gasto = new Map<string, number>();
  for (let de = 0; ; de += PAGINA) {
    const { data, error: erroDoGasto } = await t.from("ticketeria_campanhas_diaria").select("campanha_id, gasto_centavos").eq("loja_id", lojaId).gte("dia", desde).order("dia", { ascending: true }).range(de, de + PAGINA - 1);
    if (erroDoGasto) throw new Error(erroDoGasto.message);
    for (const d of data ?? []) gasto.set(d.campanha_id, (gasto.get(d.campanha_id) ?? 0) + Number(d.gasto_centavos));
    if ((data ?? []).length < PAGINA) break;
  }
  return (campanhas ?? []).map(c => ({ id: c.id, nome: c.nome, canal: c.canal, gasto90dias: gasto.get(c.id) ?? 0, marcacao: (c.marcacao as Marcacao | null), eventoId: c.evento_id, sugerida: c.sugerida }))
    .sort((a, b) => b.gasto90dias - a.gasto90dias || a.nome.localeCompare(b.nome));
}

/** O gasto de MARCA por dia e canal (campanhas marcadas como marca), para o modelo separar a marca dos eventos. */
export async function gastoDaMarca(admin: Admin, lojaId: string): Promise<{ dia: string; canal: string; centavos: number }[]> {
  const t = clienteDaTicketeria(admin);
  const { data: marcas, error } = await t.from("ticketeria_campanhas").select("id, canal").eq("loja_id", lojaId).eq("marcacao", "marca").limit(5000);
  if (error) throw new Error(error.message);
  if (!marcas || marcas.length === 0) return [];
  const canalDe = new Map(marcas.map(m => [m.id, m.canal]));
  const saida: { dia: string; canal: string; centavos: number }[] = [];
  const ids = [...canalDe.keys()];
  for (let i = 0; i < ids.length; i += 150) {
    for (let de = 0; ; de += PAGINA) {
      const { data, error: erroDoGasto } = await t.from("ticketeria_campanhas_diaria").select("campanha_id, dia, gasto_centavos").in("campanha_id", ids.slice(i, i + 150)).order("dia", { ascending: true }).range(de, de + PAGINA - 1);
      if (erroDoGasto) throw new Error(erroDoGasto.message);
      for (const d of data ?? []) saida.push({ dia: d.dia, canal: canalDe.get(d.campanha_id) as string, centavos: Number(d.gasto_centavos) });
      if ((data ?? []).length < PAGINA) break;
    }
  }
  return saida;
}
