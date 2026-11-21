// O REMETENTE DE E-MAIL DE CADA LOJA (a aba "E-mail" do Público): o e-mail de divulgação sai do domínio do produtor ("ingressos@teatroa.com.br"), nunca de um domínio do Jards.
// Este arquivo é só regra, sem rede nem banco: ler o que o produtor digitou, montar o endereço de envio, traduzir o que o provedor diz, fazer a conta da cota do mês e decidir se pode enviar.
// O banco é supabase/migrations/*_ticketeria_remetentes.sql; o provedor, lib/email/resend-dominios.ts.

import type { AssinaturaDoEmail, SituacaoDoRemetente } from "@/lib/ticketeria/estados";

/** O preço da assinatura do e-mail, por mês, em centavos (R$ 32,90). O valor que o produtor paga é o do preço no Stripe; este serve para a tela dizer o mesmo. */
export const PRECO_DO_EMAIL_CENTAVOS = 3290;
/** E-mails de divulgação por mês, por loja, na assinatura. */
export const COTA_PADRAO_DE_EMAILS = 5000;

const DOMINIO = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const ENDERECO = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Domínios de caixa postal gratuita: o produtor não é dono deles, então não dá para provar a posse nem enviar por eles. */
const DOMINIOS_DE_CAIXA_GRATUITA = new Set(["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "proton.me", "protonmail.com"]);
/** Os domínios do próprio Jards: o e-mail do cliente nunca sai por eles. */
const DOMINIOS_DO_JARDS = ["jards.com.br"];

export type Remetente = { dominio: string; endereco_local: string; nome_exibicao: string; responder_para: string | null };
export type LeituraDoRemetente = { ok: true; remetente: Remetente } | { ok: false; problemas: string[] };

/** O que o produtor digitou como domínio, limpo: sem "https://", sem "www.", sem caminho, sem "@" na frente, minúsculo. "" se não sobrou nada. */
export function limparDominio(texto: unknown): string {
  if (typeof texto !== "string") return "";
  let d = texto.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^.*@/, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  return d.replace(/^www\./, "");
}

export function problemaDoDominio(dominio: string): string | null {
  if (!dominio) return "Escreva o domínio do seu site, por exemplo teatro.com.br.";
  if (!DOMINIO.test(dominio) || dominio.length > 253) return "Esse domínio não parece certo. Escreva só o endereço do site, por exemplo teatro.com.br.";
  if (DOMINIOS_DE_CAIXA_GRATUITA.has(dominio)) return "Esse é um serviço de e-mail gratuito, não um domínio seu. Use o domínio do seu site ou da sua empresa.";
  if (DOMINIOS_DO_JARDS.some(d => dominio === d || dominio.endsWith(`.${d}`))) return "Use um domínio seu: o e-mail do seu público tem de sair do seu endereço, não do Jards.";
  return null;
}

/** Lê o corpo do formulário (domínio, endereço, nome que aparece, e-mail das respostas). Tudo o que está errado vem de uma vez, em português. */
export function lerRemetente(bruto: unknown): LeituraDoRemetente {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const problemas: string[] = [];
  const dominio = limparDominio(o.dominio);
  const doDominio = problemaDoDominio(dominio);
  if (doDominio) problemas.push(doDominio);
  const endereco = (typeof o.endereco_local === "string" ? o.endereco_local : "ingressos").trim().toLowerCase().replace(/@.*$/, "");
  if (!ENDERECO.test(endereco)) problemas.push("O começo do endereço só pode ter letras, números, ponto, hífen e sublinhado, por exemplo ingressos.");
  const nome = typeof o.nome_exibicao === "string" ? o.nome_exibicao.replace(/\s+/g, " ").trim() : "";
  if (nome.length < 1 || nome.length > 120) problemas.push("Escreva o nome que aparece para quem recebe, por exemplo o nome do seu teatro.");
  const responderBruto = typeof o.responder_para === "string" ? o.responder_para.trim().toLowerCase() : "";
  if (responderBruto && (responderBruto.length > 254 || !EMAIL.test(responderBruto))) problemas.push("O e-mail para onde vão as respostas não parece certo.");
  if (problemas.length > 0) return { ok: false, problemas };
  return { ok: true, remetente: { dominio, endereco_local: endereco, nome_exibicao: nome, responder_para: responderBruto || null } };
}

/** O campo "from" do e-mail: `Nome <endereco@dominio>`, com o nome sem aspas, sinais de maior/menor, vírgulas nem quebras de linha (que quebrariam o cabeçalho). */
export function enderecoDeEnvio(r: { dominio: string; endereco_local: string; nome_exibicao: string | null }): string {
  const nome = (r.nome_exibicao ?? "").replace(/["<>,;:\\\r\n]/g, " ").replace(/\s+/g, " ").trim();
  const endereco = `${r.endereco_local}@${r.dominio}`;
  return nome ? `${nome} <${endereco}>` : endereco;
}

// ---- O que o provedor devolve ----

export type RegistroDeDns = { registro: string; tipo: string; nome: string; valor: string; prioridade: number | null; situacao: string };

/** Os registros que o produtor precisa criar no provedor do domínio dele, do jeito que o Resend devolve (`records`), reduzidos ao que a tela mostra. */
export function registrosDoProvedor(bruto: unknown): RegistroDeDns[] {
  if (!Array.isArray(bruto)) return [];
  const saida: RegistroDeDns[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.type !== "string" || typeof r.name !== "string" || typeof r.value !== "string") continue;
    saida.push({
      registro: typeof r.record === "string" ? r.record : r.type,
      tipo: r.type.toUpperCase(), nome: r.name, valor: r.value,
      prioridade: typeof r.priority === "number" ? r.priority : null,
      situacao: typeof r.status === "string" ? r.status : "not_started",
    });
  }
  return saida;
}

/** A situação do domínio no provedor, traduzida: só "verified" deixa enviar; "failed" e "temporary_failure" são falha; o resto é "ainda faltam os registros". */
export function situacaoDoDominio(statusDoProvedor: unknown): SituacaoDoRemetente {
  if (statusDoProvedor === "verified") return "verificado";
  if (statusDoProvedor === "failed" || statusDoProvedor === "temporary_failure") return "falhou";
  return "aguardando_dns";
}

// ---- A cota do mês ----

const somarMeses = (data: Date, meses: number): Date => {
  const d = new Date(data.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
};

/** Desde quando conta a cota deste mês: o começo do período da assinatura (o que o cartão paga), rolado para a frente de mês em mês se o aviso do período novo ainda não chegou. Sem período, o dia 1 do mês (UTC). */
export function inicioDaCota(periodoInicio: string | null, agora: Date): Date {
  const base = periodoInicio ? new Date(periodoInicio) : null;
  if (!base || Number.isNaN(base.getTime()) || base.getTime() > agora.getTime()) return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  let inicio = base;
  for (let i = 1; i <= 24; i++) {
    const proximo = somarMeses(base, i);
    if (proximo.getTime() > agora.getTime()) break;
    inicio = proximo;
  }
  return inicio;
}

export type EstadoParaEnviar = { assinatura: AssinaturaDoEmail; situacao: SituacaoDoRemetente; cota_mensal: number };
export type PodeEnviar = { ok: true; restante: number } | { ok: false; motivo: "sem_assinatura" | "sem_dominio" | "dominio_nao_verificado" | "cota_do_mes"; restante: number };

/** Pode mandar `quantidade` e-mails agora? Precisa da assinatura em dia (ativa), do domínio verificado e de cota no mês. */
export function podeEnviar(r: EstadoParaEnviar | null, usadosNoPeriodo: number, quantidade: number): PodeEnviar {
  const restante = r ? Math.max(0, r.cota_mensal - usadosNoPeriodo) : 0;
  if (!r || r.assinatura !== "ativa") return { ok: false, motivo: "sem_assinatura", restante };
  if (r.situacao === "sem_dominio") return { ok: false, motivo: "sem_dominio", restante };
  if (r.situacao !== "verificado") return { ok: false, motivo: "dominio_nao_verificado", restante };
  if (quantidade > restante) return { ok: false, motivo: "cota_do_mes", restante };
  return { ok: true, restante };
}

export const MOTIVOS_DO_REMETENTE: Record<string, string> = {
  sem_assinatura: "Ative o e-mail para enviar.",
  sem_dominio: "Falta escolher o seu domínio.",
  dominio_nao_verificado: "O seu domínio ainda não foi confirmado: faltam os registros no provedor dele.",
  cota_do_mes: "Esse envio passa do limite de e-mails do mês.",
};

/** O que a tela do e-mail recebe: a assinatura, o domínio, os registros de DNS e a cota do mês. Sem os ids do Stripe e do Resend. */
export type RemetenteParaATela = {
  assinatura: AssinaturaDoEmail; periodo_fim: string | null; cancela_no_fim: boolean;
  dominio: string | null; endereco_local: string; nome_exibicao: string | null; responder_para: string | null; situacao: SituacaoDoRemetente; registros: RegistroDeDns[];
  usados: number; cota: number; preco_centavos: number; pode_enviar: boolean;
};

/** O texto para mandar a quem cuida do site do produtor: o que fazer e os registros, um por linha, para colar no e-mail ou no WhatsApp. */
export function textoParaQuemCuidaDoSite(dominio: string, registros: RegistroDeDns[]): string {
  const linhas = registros.map(r => `- Tipo ${r.tipo}${r.prioridade !== null ? ` (prioridade ${r.prioridade})` : ""}\n  Nome: ${r.nome}\n  Valor: ${r.valor}`);
  return [
    `Olá! Preciso que você adicione estes registros de DNS no domínio ${dominio}, para eu poder enviar e-mails por ele.`,
    "Os registros que já existem (o site e o e-mail que usamos hoje) não mudam: só entram estes novos.",
    "",
    ...linhas,
    "",
    "Quando estiverem adicionados, me avise. A confirmação pode levar de alguns minutos a algumas horas.",
  ].join("\n");
}
