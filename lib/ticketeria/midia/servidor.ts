import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { decryptSecret, encryptSecret } from "@/lib/calendar/crypto";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { configDaMeta, lerGastoDiario, type BuscarHttp, type ConfigDaMeta } from "@/lib/ticketeria/midia/meta";
import { lerConexao, type PortasDaLeitura, type ResultadoDaLeitura } from "@/lib/ticketeria/midia/sincronizar";

type Admin = SupabaseClient<Database>;

/** O endereço do Jards (o retorno do login da Meta tem de ser exatamente o cadastrado no app da Meta). */
export function origemDoApp(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/** As credenciais do app da Meta, ou null: sem elas o conector fica "Em breve". */
export function metaConfigurada(): ConfigDaMeta | null {
  return configDaMeta(process.env, origemDoApp());
}

export const buscarNaMeta: BuscarHttp = url => fetch(url, { cache: "no-store" });

// ─── A sessão do login (o cookie de 10 minutos que liga a ida e a volta) ────

const COOKIE = "jards_midia_oauth";
export type SessaoDoLogin = { nonce: string; loja: string; usuario: string };

export async function abrirSessaoDoLogin(loja: string, usuario: string): Promise<string> {
  const nonce = randomBytes(16).toString("base64url");
  (await cookies()).set(COOKIE, encryptSecret(JSON.stringify({ nonce, loja, usuario } satisfies SessaoDoLogin)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return nonce;
}

export async function lerSessaoDoLogin(): Promise<SessaoDoLogin | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;
  try { const s = JSON.parse(decryptSecret(bruto)) as SessaoDoLogin; return s && typeof s.nonce === "string" && typeof s.loja === "string" && typeof s.usuario === "string" ? s : null; } catch { return null; }
}

export async function fecharSessaoDoLogin(): Promise<void> { (await cookies()).delete(COOKIE); }

// ─── As conexões e o gasto lido ─────────────────────────────────────────────

export type ConexaoDaLoja = {
  id: string; situacao: "escolher_conta" | "ativa" | "erro" | "desconectada"; conta_nome: string | null; moeda: string | null;
  ultima_leitura_em: string | null; ultimo_erro: string | null; lido_desde: string | null; gasto_30_dias_centavos: number;
};

export async function conexaoMetaDaLoja(admin: Admin, lojaId: string, hoje: string = diaNoFuso(new Date())): Promise<ConexaoDaLoja | null> {
  const t = clienteDaTicketeria(admin);
  const { data: c } = await t.from("ticketeria_conexoes_midia").select("id, situacao, conta_nome, moeda, ultima_leitura_em, ultimo_erro, lido_desde").eq("loja_id", lojaId).eq("provedor", "meta").maybeSingle();
  if (!c || c.situacao === "desconectada") return null;
  const desde = new Date(`${hoje}T00:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 29);
  const { data: dias } = await t.from("ticketeria_midia_diaria").select("gasto_centavos").eq("conexao_id", c.id).gte("dia", desde.toISOString().slice(0, 10)).lte("dia", hoje);
  return { ...c, situacao: c.situacao as ConexaoDaLoja["situacao"], gasto_30_dias_centavos: (dias ?? []).reduce((soma, d) => soma + Number(d.gasto_centavos), 0) };
}

/** As portas da leitura no Supabase (só com a chave de serviço: o token está no Vault). */
export function portasDaLeituraDoSupabase(admin: Admin, config: ConfigDaMeta): PortasDaLeitura {
  const t = clienteDaTicketeria(admin);
  return {
    async token(conexao) {
      const { data, error } = await t.rpc("fn_ticketeria_midia_token", { p_conexao: conexao });
      if (error) throw new Error(error.message);
      return typeof data === "string" && data !== "" ? data : null;
    },
    lerGasto: (token, conta, de, ate) => lerGastoDiario(config, token, conta, de, ate, buscarNaMeta),
    async gravarDias(conexao, dias) {
      const { error } = await t.rpc("fn_ticketeria_midia_gravar_dias", { p_conexao: conexao, p_dias: dias });
      if (error) throw new Error(error.message);
    },
    async marcar(conexao, r) {
      const { error } = await t.rpc("fn_ticketeria_midia_marcar", { p_conexao: conexao, p_ok: r.ok, p_erro: r.ok ? null : r.erro, p_token_invalido: r.ok ? false : r.token_invalido, p_lido_desde: r.ok ? r.lido_desde : null });
      if (error) throw new Error(error.message);
    },
  };
}

/** Lê agora o gasto de uma conexão ativa. */
export async function lerConexaoAgora(admin: Admin, config: ConfigDaMeta, conexaoId: string): Promise<ResultadoDaLeitura | null> {
  const { data: c } = await clienteDaTicketeria(admin).from("ticketeria_conexoes_midia").select("id, conta_externa_id, ultima_leitura_em, situacao").eq("id", conexaoId).maybeSingle();
  if (!c || c.situacao !== "ativa" || !c.conta_externa_id) return null;
  return lerConexao(portasDaLeituraDoSupabase(admin, config), { id: c.id, conta_externa_id: c.conta_externa_id, ultima_leitura_em: c.ultima_leitura_em }, diaNoFuso(new Date()));
}
