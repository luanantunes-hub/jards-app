import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { decryptSecret, encryptSecret } from "@/lib/calendar/crypto";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso, rotuloDoCanal } from "@/lib/ticketeria/divulgacao";
import type { BuscarHttp } from "@/lib/ticketeria/midia/meta";
import { PROVEDORES_DE_MIDIA, adaptadorDeMidia, type AdaptadorDeMidia, type ProvedorDeMidia } from "@/lib/ticketeria/midia/provedores";
import { lerConexao, type PortasDaLeitura, type ResultadoDaLeitura } from "@/lib/ticketeria/midia/sincronizar";

type Admin = SupabaseClient<Database>;
const LOTE_DE_LINHAS = 500;

/** O endereço do Jards (o retorno do login tem de ser exatamente o cadastrado no app da plataforma). */
export function origemDoApp(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const buscarNaPlataforma: BuscarHttp = (url, pedido) => fetch(url, { cache: "no-store", method: pedido?.method ?? "GET", headers: pedido?.headers, body: pedido?.body });

/** O adaptador do provedor, ou null: sem as credenciais dele no servidor o conector fica "Em breve". */
export function adaptadorConfigurado(provedor: ProvedorDeMidia): AdaptadorDeMidia | null {
  return adaptadorDeMidia(provedor, process.env, origemDoApp(), buscarNaPlataforma);
}

// ─── A sessão do login (o cookie de 10 minutos que liga a ida e a volta) ────

const COOKIE = "jards_midia_oauth";
export type SessaoDoLogin = { nonce: string; loja: string; usuario: string; provedor: ProvedorDeMidia };

export async function abrirSessaoDoLogin(loja: string, usuario: string, provedor: ProvedorDeMidia): Promise<string> {
  const nonce = randomBytes(16).toString("base64url");
  (await cookies()).set(COOKIE, encryptSecret(JSON.stringify({ nonce, loja, usuario, provedor } satisfies SessaoDoLogin)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return nonce;
}

export async function lerSessaoDoLogin(): Promise<SessaoDoLogin | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;
  try {
    const s = JSON.parse(decryptSecret(bruto)) as Partial<SessaoDoLogin>;
    // Sessão antiga, sem provedor, é do Meta.
    const provedor = (s.provedor ?? "meta") as ProvedorDeMidia;
    return s && typeof s.nonce === "string" && typeof s.loja === "string" && typeof s.usuario === "string" && PROVEDORES_DE_MIDIA.includes(provedor) ? { nonce: s.nonce, loja: s.loja, usuario: s.usuario, provedor } : null;
  } catch { return null; }
}

export async function fecharSessaoDoLogin(): Promise<void> { (await cookies()).delete(COOKIE); }

// ─── As conexões e o gasto lido ─────────────────────────────────────────────

export type ConexaoDaLoja = {
  id: string; situacao: "escolher_conta" | "ativa" | "erro" | "desconectada"; conta_nome: string | null; moeda: string | null;
  ultima_leitura_em: string | null; ultimo_erro: string | null; lido_desde: string | null; gasto_30_dias_centavos: number;
  /** Só no GA4: as visitas dos últimos 30 dias e a origem que mais trouxe (com a parte dela, em %). */
  visitas_30_dias?: number; principal_origem?: { nome: string; porcento: number } | null;
};

export async function conexaoDaLoja(admin: Admin, lojaId: string, provedor: ProvedorDeMidia, hoje: string = diaNoFuso(new Date())): Promise<ConexaoDaLoja | null> {
  const t = clienteDaTicketeria(admin);
  const { data: c } = await t.from("ticketeria_conexoes_midia").select("id, situacao, conta_nome, moeda, ultima_leitura_em, ultimo_erro, lido_desde").eq("loja_id", lojaId).eq("provedor", provedor).maybeSingle();
  if (!c || c.situacao === "desconectada") return null;
  const desde = new Date(`${hoje}T00:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 29);
  const de = desde.toISOString().slice(0, 10);
  const base = { ...c, situacao: c.situacao as ConexaoDaLoja["situacao"] };
  if (provedor === "ga4") {
    const { data: visitas } = await t.from("ticketeria_visitas_diarias").select("canal, origem, sessoes").eq("conexao_id", c.id).gte("dia", de).lte("dia", hoje).limit(50000);
    const porCanal = new Map<string, number>();
    let total = 0;
    for (const v of visitas ?? []) { total += Number(v.sessoes); porCanal.set(v.canal, (porCanal.get(v.canal) ?? 0) + Number(v.sessoes)); }
    const [canal, sessoes] = [...porCanal.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    return { ...base, gasto_30_dias_centavos: 0, visitas_30_dias: total, principal_origem: canal && total > 0 ? { nome: rotuloDoCanal(canal), porcento: Math.round((sessoes / total) * 100) } : null };
  }
  const { data: dias } = await t.from("ticketeria_midia_diaria").select("gasto_centavos").eq("conexao_id", c.id).gte("dia", de).lte("dia", hoje);
  return { ...base, gasto_30_dias_centavos: (dias ?? []).reduce((soma, d) => soma + Number(d.gasto_centavos), 0) };
}

/** As portas da leitura no Supabase (só com a chave de serviço: o token está no Vault). */
export function portasDaLeituraDoSupabase(admin: Admin, adaptador: AdaptadorDeMidia): PortasDaLeitura {
  const t = clienteDaTicketeria(admin);
  return {
    async token(conexao) {
      const { data, error } = await t.rpc("fn_ticketeria_midia_token", { p_conexao: conexao });
      if (error) throw new Error(error.message);
      return typeof data === "string" && data !== "" ? data : null;
    },
    async lerPeriodo(token, conta, de, ate, gerente, conexao) {
      const dados = await adaptador.ler(token, conta, de, ate, gerente);
      // Em lotes: o GA4 pode trazer dezenas de milhares de linhas (uma por dia e origem).
      const linhas: Json[] = (dados.visitas ?? dados.gasto ?? []) as unknown as Json[];
      for (let i = 0; i < linhas.length; i += LOTE_DE_LINHAS) {
        const lote = linhas.slice(i, i + LOTE_DE_LINHAS);
        const { error } = dados.visitas ? await t.rpc("fn_ticketeria_midia_gravar_visitas", { p_conexao: conexao, p_visitas: lote }) : await t.rpc("fn_ticketeria_midia_gravar_dias", { p_conexao: conexao, p_dias: lote });
        if (error) throw new Error(error.message);
      }
      return linhas.length;
    },
    async marcar(conexao, r) {
      const { error } = await t.rpc("fn_ticketeria_midia_marcar", { p_conexao: conexao, p_ok: r.ok, p_erro: r.ok ? null : r.erro, p_token_invalido: r.ok ? false : r.token_invalido, p_lido_desde: r.ok ? r.lido_desde : null });
      if (error) throw new Error(error.message);
    },
  };
}

/** Lê agora o gasto de uma conexão ativa (o provedor vem da própria conexão). Null se a conexão não está ativa ou o provedor não está configurado. */
export async function lerConexaoAgora(admin: Admin, conexaoId: string): Promise<ResultadoDaLeitura | null> {
  const { data: c } = await clienteDaTicketeria(admin).from("ticketeria_conexoes_midia").select("id, provedor, conta_externa_id, conta_gerente_id, ultima_leitura_em, situacao").eq("id", conexaoId).maybeSingle();
  if (!c || c.situacao !== "ativa" || !c.conta_externa_id || !PROVEDORES_DE_MIDIA.includes(c.provedor as ProvedorDeMidia)) return null;
  const adaptador = adaptadorConfigurado(c.provedor as ProvedorDeMidia);
  if (!adaptador) return null;
  return lerConexao(portasDaLeituraDoSupabase(admin, adaptador), { id: c.id, conta_externa_id: c.conta_externa_id, ultima_leitura_em: c.ultima_leitura_em, gerente: c.conta_gerente_id }, diaNoFuso(new Date()), adaptador.fonte);
}
