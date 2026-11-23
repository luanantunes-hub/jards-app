import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import type { Destinatario, EntradaParaEnvio } from "@/lib/ticketeria/envios";
import { compradoresPorEvento, eventosEmComum, MIN_PARTE_EM_COMUM } from "@/lib/ticketeria/publico-em-comum";
import {
  LIMITE_PADRAO_POR_SEMANA, PARTE_DA_COMPARACAO, ROTULO_DO_TIPO, TIPOS_DE_PUBLICO, comprasPorPessoa, compraramNoUltimoAno, efeitoDoEnvio, efeitoPorTipo, ingressosDeQuemRecebeu, porLimite,
  porPreferencias, soUltimoAno, sortearComparacao, tipoNoDia, type EfeitoDoEnvio, type EfeitoPorTipo, type Preferencia, type TipoDePublico,
} from "@/lib/ticketeria/envios-controle";

// O grupo de comparação, o limite por semana e as preferências no servidor (lib/ticketeria/envios-controle.ts): o que cada envio pode mandar e o que os envios já trouxeram a mais.

type Admin = SupabaseClient<Database>;
type Compras = ReturnType<typeof comprasPorPessoa>;
const PAGINA = 1000;
const somarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** As compras pagas da loja por pessoa (dia e ingressos), da entrada do Público. */
export const comprasDaEntrada = (e: EntradaParaEnvio): Compras => comprasPorPessoa(e.pedidos.filter(p => p.pago_em).map(p => ({ email: p.comprador_email, dia: diaNoFuso(p.pago_em as string), quantidade: e.quantidadePorPedido[p.id] ?? 0 })));

type EnvioMedido = { id: string; dia: string; canal: string; recebeu: string[]; comparacao: string[] };
/** Os envios por e-mail da loja com quem recebeu (enviado) e quem ficou no grupo de comparação. */
async function enviosComGrupos(admin: Admin, lojaId: string): Promise<EnvioMedido[]> {
  const t = clienteDaTicketeria(admin);
  const { data: envios } = await t.from("ticketeria_envios").select("id, canal, created_at, enviado_em").eq("loja_id", lojaId).eq("canal", "email").order("created_at", { ascending: false }).limit(200);
  const ids = (envios ?? []).map(e => e.id);
  const recebeu = new Map<string, string[]>(), comparacao = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 50) {
    const lote = ids.slice(i, i + 50);
    for (let de = 0; ; de += PAGINA) {
      const { data } = await t.from("ticketeria_envio_destinatarios").select("envio_id, email").in("envio_id", lote).eq("situacao", "enviado").order("id").range(de, de + PAGINA - 1);
      for (const d of data ?? []) (recebeu.get(d.envio_id) ?? recebeu.set(d.envio_id, []).get(d.envio_id)!).push(d.email);
      if ((data ?? []).length < PAGINA) break;
    }
    for (let de = 0; ; de += PAGINA) {
      const { data } = await t.from("ticketeria_envio_comparacao").select("envio_id, email").in("envio_id", lote).order("id").range(de, de + PAGINA - 1);
      for (const d of data ?? []) (comparacao.get(d.envio_id) ?? comparacao.set(d.envio_id, []).get(d.envio_id)!).push(d.email);
      if ((data ?? []).length < PAGINA) break;
    }
  }
  return (envios ?? []).map(e => ({ id: e.id, canal: e.canal, dia: diaNoFuso(e.enviado_em ?? e.created_at), recebeu: recebeu.get(e.id) ?? [], comparacao: comparacao.get(e.id) ?? [] }));
}

export type ParaQuemFunciona = { tipos: (EfeitoPorTipo & { rotulo: string })[]; envios: number; soUltimoAno: { parteDoEfeito: number; menosEmails: number } | null };
/** O que os envios trouxeram a mais (por envio) e para quem o e-mail funciona na casa (somando os envios medidos), com a conta de "só para quem comprou no último ano". */
export async function resultadosDosEnvios(admin: Admin, lojaId: string, entrada: EntradaParaEnvio, hoje: string = diaNoFuso(new Date())): Promise<{ porEnvio: Record<string, { efeito: EfeitoDoEnvio; deQuemRecebeu: number }>; paraQuem: ParaQuemFunciona | null }> {
  const compras = comprasDaEntrada(entrada);
  const envios = await enviosComGrupos(admin, lojaId);
  const porEnvio = Object.fromEntries(envios.map(e => [e.id, { efeito: efeitoDoEnvio(e, compras, hoje), deQuemRecebeu: ingressosDeQuemRecebeu(e.dia, e.recebeu, compras) }]));
  const { tipos, envios: medidos } = efeitoPorTipo(envios, compras, hoje);
  if (medidos === 0) return { porEnvio, paraQuem: null };
  // Quantos e-mails foram para cada tipo (para a conta do "só para quem comprou no último ano").
  const recebimentos = Object.fromEntries(TIPOS_DE_PUBLICO.map(t => [t, 0])) as Record<TipoDePublico, number>;
  for (const e of envios) if (e.comparacao.length > 0 && hoje >= somarDias(e.dia, 90)) for (const x of e.recebeu) recebimentos[tipoNoDia(compras.get(x), e.dia)]++;
  return { porEnvio, paraQuem: { tipos: tipos.map(t => ({ ...t, rotulo: ROTULO_DO_TIPO[t.tipo] })), envios: medidos, soUltimoAno: soUltimoAno(tipos, recebimentos) } };
}

export type PreparoDoEnvio = {
  enviar: Destinatario[]; comparacao: Destinatario[];
  /** Quantas pessoas ficaram de fora pelo limite da semana e pelas preferências; o limite da loja. */ foraPeloLimite: number; foraPelasPreferencias: number; limite: number;
  /** O "Mandar só para elas": quantas das pessoas do segmento compraram no último ano, quando os envios medidos mostram que o e-mail só funciona para elas. */ sugestao: { ficam: number; total: number } | null;
};

/**
 * O que um envio por e-mail manda de fato: o segmento, (se pedido) só quem comprou no último ano, as preferências de cada pessoa, o limite da semana e o sorteio do grupo de comparação.
 * `eventoId` e `diaDaSessao` são da sessão do envio (para "só parecidos" e os dias).
 */
export async function prepararEnvio(admin: Admin, lojaId: string, entrada: EntradaParaEnvio, destinatarios: Destinatario[], o: { eventoId: string; diaDaSemanaDaSessao: number; comparacao: boolean; soUltimoAno: boolean }, hoje: string = diaNoFuso(new Date())): Promise<PreparoDoEnvio> {
  const t = clienteDaTicketeria(admin);
  const compras = comprasDaEntrada(entrada);
  const [{ data: loja }, { data: prefs }, recentes] = await Promise.all([
    t.from("ticketeria_lojas").select("limite_emails_semana").eq("id", lojaId).maybeSingle(),
    t.from("ticketeria_preferencias").select("email, frequencia, dias").eq("loja_id", lojaId),
    recebidosRecentes(admin, lojaId, hoje),
  ]);
  const limite = loja?.limite_emails_semana ?? LIMITE_PADRAO_POR_SEMANA;
  // A sugestão: só quando os envios medidos mostram que o e-mail funciona para quem comprou no último ano e não para os outros.
  const { paraQuem } = await resultadosDosEnvios(admin, lojaId, entrada, hoje);
  const doAno = destinatarios.filter(p => compraramNoUltimoAno(p.email, compras, hoje));
  const sugestao = paraQuem?.soUltimoAno && doAno.length > 0 && doAno.length < destinatarios.length ? { ficam: doAno.length, total: destinatarios.length } : null;
  let pessoas = o.soUltimoAno ? doAno : destinatarios;
  // "Só parecidos": quem comprou o evento do envio ou um evento com público em comum com ele.
  const porEvento = compradoresPorEvento(entrada.pedidos, entrada.eventoIdDaSessao);
  const parecidos = new Set<string>(porEvento.get(o.eventoId) ?? []);
  for (const x of eventosEmComum(porEvento, o.eventoId)) if (x.parte >= MIN_PARTE_EM_COMUM) for (const email of porEvento.get(x.eventoId) ?? []) parecidos.add(email);
  const preferencias = new Map((prefs ?? []).map(p => [p.email, { frequencia: p.frequencia, dias: p.dias } as Preferencia]));
  const pref = porPreferencias(pessoas, preferencias, { diaDaSemanaDaSessao: o.diaDaSemanaDaSessao, parecidos, ultimoRecebido: recentes.ultimo, hoje });
  pessoas = pref.dentro;
  const lim = porLimite(pessoas, recentes.naSemana, limite);
  const sorteio = sortearComparacao(lim.dentro, o.comparacao, () => randomInt(0, 2 ** 32) / 2 ** 32, PARTE_DA_COMPARACAO);
  return { enviar: sorteio.enviar, comparacao: sorteio.comparacao, foraPeloLimite: lim.fora, foraPelasPreferencias: pref.fora, limite, sugestao };
}

/** Quantos e-mails de divulgação da loja cada pessoa recebeu nos últimos 7 dias e o dia do último nos últimos 30 (para o limite e o "menos e-mails"). */
async function recebidosRecentes(admin: Admin, lojaId: string, hoje: string): Promise<{ naSemana: Map<string, number>; ultimo: Map<string, string> }> {
  const t = clienteDaTicketeria(admin);
  const { data: envios } = await t.from("ticketeria_envios").select("id, created_at").eq("loja_id", lojaId).eq("canal", "email").gte("created_at", `${somarDias(hoje, -31)}T00:00:00Z`);
  const naSemana = new Map<string, number>(), ultimo = new Map<string, string>();
  const semana = somarDias(hoje, -7);
  const diaDoEnvio = new Map((envios ?? []).map(e => [e.id, diaNoFuso(e.created_at)]));
  const ids = [...diaDoEnvio.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    for (let de = 0; ; de += PAGINA) {
      const { data } = await t.from("ticketeria_envio_destinatarios").select("envio_id, email").in("envio_id", ids.slice(i, i + 50)).in("situacao", ["pendente", "enviando", "enviado"]).order("id").range(de, de + PAGINA - 1);
      for (const d of data ?? []) {
        const dia = diaDoEnvio.get(d.envio_id) as string;
        if (dia > semana) naSemana.set(d.email, (naSemana.get(d.email) ?? 0) + 1);
        if (!ultimo.has(d.email) || (ultimo.get(d.email) as string) < dia) ultimo.set(d.email, dia);
      }
      if ((data ?? []).length < PAGINA) break;
    }
  }
  return { naSemana, ultimo };
}

/** Grava o grupo de comparação de um envio (as pessoas sorteadas que não recebem). */
export async function gravarComparacao(admin: Admin, organizationId: string, envioId: string, pessoas: Destinatario[]): Promise<void> {
  const t = clienteDaTicketeria(admin);
  for (let i = 0; i < pessoas.length; i += 200) {
    const { error } = await t.from("ticketeria_envio_comparacao").insert(pessoas.slice(i, i + 200).map(p => ({ organization_id: organizationId, envio_id: envioId, email: p.email, nome: p.nome.slice(0, 120) })));
    if (error) throw new Error(error.message);
  }
}
