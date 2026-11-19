/**
 * Triagem de e-mails de quem ainda não é contato.
 *
 * O Jards guarda, só para a pessoa, os e-mails recentes de remetentes desconhecidos. Daí cada remetente pode virar
 * contato (ligado a uma empresa), ter a conversa registrada para a equipe e abrir uma negociação, três passos
 * separados e opcionais. Aqui ficam só as regras puras: quem entra, quem é o "outro lado" da conversa, qual empresa
 * sugerir e como agrupar. A rede e o banco ficam em sincronizar-desconhecidos.ts e nas rotas.
 */
import type { MensagemDeEmail } from "./mensagem";

/** Janela de e-mails de desconhecidos: a de contatos é maior (180 dias), mas aqui o volume não é filtrado por contato. */
export const DIAS_DA_TRIAGEM = 30;
/** Teto de e-mails de desconhecidos guardados por rodada de sincronização. */
export const LIMITE_DA_TRIAGEM = 100;

/** Provedores públicos: o domínio não diz de que empresa a pessoa é. */
export const DOMINIOS_PESSOAIS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.com.br", "hotmail.com", "hotmail.com.br", "live.com", "msn.com",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br",
  "globo.com", "globomail.com", "protonmail.com", "proton.me", "zoho.com", "gmx.com", "aol.com",
]);

/** Partes de endereço de robô: respostas automáticas, avisos de sistema e boletins. */
const PARTE_AUTOMATICA = /(^|[._+-])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|notificacoes?|newsletter|automatico|automated)([._+-]|\d|$)/i;

export function dominioDoEmail(endereco: string | null | undefined): string | null {
  const texto = (endereco ?? "").trim().toLowerCase();
  const arroba = texto.lastIndexOf("@");
  if (arroba <= 0 || arroba === texto.length - 1) return null;
  return texto.slice(arroba + 1);
}

/** Endereço de robô (não responde, boletim, aviso do sistema): não vale a pena virar contato. */
export function enderecoAutomatico(endereco: string | null | undefined): boolean {
  const texto = (endereco ?? "").trim().toLowerCase();
  const arroba = texto.lastIndexOf("@");
  if (arroba <= 0) return false;
  return PARTE_AUTOMATICA.test(texto.slice(0, arroba));
}

function normalizado(endereco: string | null | undefined): string {
  return (endereco ?? "").trim().toLowerCase();
}

type Filtros = {
  /** O e-mail da própria conta conectada. */
  emailDaConta: string;
  /** Endereços que já são contatos da organização. */
  contatos: ReadonlySet<string>;
  /** Remetentes que a pessoa dispensou ou já tratou. */
  tratados: ReadonlySet<string>;
};

/** Esse endereço não entra na triagem? (vazio, a própria pessoa, colega de domínio, robô, contato ou já tratado) */
export function pularNaTriagem(endereco: string | null | undefined, { emailDaConta, contatos, tratados }: Filtros): boolean {
  const alvo = normalizado(endereco);
  if (!alvo || !alvo.includes("@")) return true;
  const conta = normalizado(emailDaConta);
  if (alvo === conta) return true;
  const dominio = dominioDoEmail(alvo);
  const dominioDaConta = dominioDoEmail(conta);
  // Colegas do mesmo domínio de trabalho não são prospecção. Em Gmail e Outlook pessoais o domínio não diz nada.
  if (dominio && dominio === dominioDaConta && !DOMINIOS_PESSOAIS.has(dominio)) return true;
  if (enderecoAutomatico(alvo)) return true;
  return contatos.has(alvo) || tratados.has(alvo);
}

/**
 * O "outro lado" da conversa que a triagem mostra, ou null se não há ninguém para tratar.
 * Recebida: quem enviou. Enviada: o primeiro destinatário (Para ou Cc) que entra na triagem. Se algum destinatário
 * já é contato, a mensagem é da sincronização de contatos, não da triagem.
 */
export function contraparteDaTriagem(mensagem: MensagemDeEmail, filtros: Filtros): string | null {
  if (mensagem.direction === "inbound") {
    return pularNaTriagem(mensagem.from, filtros) ? null : normalizado(mensagem.from);
  }
  const destinatarios = [...mensagem.to, ...mensagem.cc].map(normalizado);
  if (destinatarios.some((endereco) => filtros.contatos.has(endereco))) return null;
  return destinatarios.find((endereco) => !pularNaTriagem(endereco, filtros)) ?? null;
}

type EmpresaParaSugerir = { id: string; nome: string; site: string | null };
type ContatoParaSugerir = { email: string | null; empresa_crm_id: string | null };

export type SugestaoDeEmpresa = { id: string; nome: string; motivo: "contato" | "site" };

/** O endereço do site da empresa sem protocolo, "www." nem caminho. */
export function dominioDoSite(site: string | null | undefined): string | null {
  const bruto = (site ?? "").trim().toLowerCase();
  if (!bruto) return null;
  try {
    const url = new URL(/^https?:\/\//.test(bruto) ? bruto : `https://${bruto}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Qual empresa do CRM combina com esse e-mail: a de um contato que já usa o mesmo domínio ou a que tem o domínio como
 * site. Domínios públicos (gmail.com etc.) nunca sugerem empresa. É só uma sugestão: a pessoa confirma ou troca.
 */
export function sugerirEmpresa(
  endereco: string,
  empresas: readonly EmpresaParaSugerir[],
  contatos: readonly ContatoParaSugerir[],
): SugestaoDeEmpresa | null {
  const dominio = dominioDoEmail(endereco);
  if (!dominio || DOMINIOS_PESSOAIS.has(dominio)) return null;
  const porId = new Map(empresas.map((empresa) => [empresa.id, empresa]));

  const votos = new Map<string, number>();
  for (const contato of contatos) {
    if (!contato.empresa_crm_id || dominioDoEmail(contato.email) !== dominio) continue;
    votos.set(contato.empresa_crm_id, (votos.get(contato.empresa_crm_id) ?? 0) + 1);
  }
  const maisVotada = [...votos.entries()].sort((a, b) => b[1] - a[1])[0];
  const daEmpresa = maisVotada ? porId.get(maisVotada[0]) : undefined;
  if (daEmpresa) return { id: daEmpresa.id, nome: daEmpresa.nome, motivo: "contato" };

  for (const empresa of empresas) {
    const site = dominioDoSite(empresa.site);
    if (site && (dominio === site || dominio.endsWith(`.${site}`))) return { id: empresa.id, nome: empresa.nome, motivo: "site" };
  }
  return null;
}

export type EmailDeTriagem = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  direction: string | null;
  subject: string | null;
  snippet: string | null;
  sent_at: string | null;
};

export type RemetenteAgrupado = {
  endereco: string;
  /** O nome que o remetente usa, vindo dos e-mails recebidos. */
  nome: string | null;
  total: number;
  emailIds: string[];
  ultimoAssunto: string | null;
  ultimoTrecho: string | null;
  ultimoEm: string | null;
  ultimaDirecao: "inbound" | "outbound" | null;
};

/** Agrupa os e-mails guardados por remetente (o outro lado da conversa), do mais recente para o mais antigo. */
export function agruparPorRemetente(emails: readonly EmailDeTriagem[], enderecos: ReadonlySet<string>): RemetenteAgrupado[] {
  const grupos = new Map<string, RemetenteAgrupado>();
  const ordenados = [...emails].sort((a, b) => Date.parse(b.sent_at ?? "") - Date.parse(a.sent_at ?? "") || 0);
  for (const email of ordenados) {
    const outro = email.direction === "outbound"
      ? [...(email.to_emails ?? []), ...(email.cc_emails ?? [])].map(normalizado).find((endereco) => enderecos.has(endereco))
      : normalizado(email.from_email);
    if (!outro || !enderecos.has(outro)) continue;
    const atual = grupos.get(outro);
    if (!atual) {
      grupos.set(outro, {
        endereco: outro,
        nome: email.direction === "outbound" ? null : email.from_name?.trim() || null,
        total: 1,
        emailIds: [email.id],
        ultimoAssunto: email.subject,
        ultimoTrecho: email.snippet,
        ultimoEm: email.sent_at,
        ultimaDirecao: email.direction === "outbound" ? "outbound" : "inbound",
      });
      continue;
    }
    atual.total += 1;
    atual.emailIds.push(email.id);
    if (!atual.nome && email.direction !== "outbound") atual.nome = email.from_name?.trim() || null;
  }
  return [...grupos.values()];
}

/** Um nome para sugerir no cadastro quando o e-mail não traz: "ana.souza@x.com" vira "Ana Souza". */
export function nomeSugerido(endereco: string, nomeDoEmail: string | null): string {
  if (nomeDoEmail?.trim()) return nomeDoEmail.trim();
  const local = endereco.split("@")[0] ?? "";
  return local
    .split(/[._+-]+/)
    .filter((parte) => parte && !/^\d+$/.test(parte))
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}
