// A bilheteria (venda de ingressos na porta do evento): a conta ligada só à loja, fora dos papéis da organização. Só lógica: sem banco e sem tela.
// O banco decide (fn_ticketeria_bilheteiro_atual); aqui a resposta é conferida e as frases da tela de entrada ficam num lugar só.

export type BilheteiroDaLoja = { id: string; lojaId: string; loja: string; nome: string };

/** O que fn_ticketeria_bilheteiro_atual devolveu, conferido; item fora do formato é ignorado. */
export function lerBilheteiros(resposta: unknown): BilheteiroDaLoja[] {
  if (!Array.isArray(resposta)) return [];
  const saida: BilheteiroDaLoja[] = [];
  for (const bruto of resposta) {
    const b = (bruto && typeof bruto === "object" ? bruto : {}) as { id?: unknown; loja_id?: unknown; loja?: unknown; nome?: unknown };
    if (typeof b.id === "string" && typeof b.loja_id === "string" && typeof b.loja === "string" && typeof b.nome === "string") saida.push({ id: b.id, lojaId: b.loja_id, loja: b.loja, nome: b.nome });
  }
  return saida;
}

/** Os endereços da bilheteria. */
export const ENTRADA_DA_BILHETERIA = "/bilheteria/entrar";
export const INICIO_DA_BILHETERIA = "/bilheteria";

/** Por que a pessoa voltou para a tela de entrada (o `?motivo=` do endereço). */
export type MotivoDaEntrada = "outra-conta" | "desligada";

export function motivoDaEntrada(valor: string | null | undefined): MotivoDaEntrada | null {
  return valor === "outra-conta" || valor === "desligada" ? valor : null;
}

export function frasesDaEntrada(motivo: MotivoDaEntrada | null): string | null {
  if (motivo === "outra-conta") return "Esta conta não é de uma bilheteria. Peça a quem organiza o evento para cadastrar o seu e-mail.";
  if (motivo === "desligada") return "O seu acesso à bilheteria foi desligado. Fale com quem organiza o evento.";
  return null;
}

/** O erro do login numa frase (o Supabase devolve o código em inglês). */
export function mensagemDoLogin(erro: { code?: string; message?: string; status?: number }): string {
  if (erro.code === "invalid_credentials" || /invalid login credentials/i.test(erro.message ?? "")) return "E-mail ou senha incorretos.";
  if (erro.code === "email_not_confirmed") return "Confirme o e-mail antes de entrar.";
  if (erro.status === 429 || erro.code === "over_request_rate_limit") return "Muitas tentativas. Espere um minuto e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo.";
}

// ─── O cadastro de quem vende (a tela do produtor) ──────────────────────────

/** Uma pessoa da bilheteria, como a lista do produtor a mostra. */
export type BilheteiroParaLista = { id: string; nome: string; email: string | null; ativo: boolean; criadoEm: string };

/** A lista que a rota devolve ({ bilheteiros: [...] }), conferida; item fora do formato é ignorado. */
export function lerListaDeBilheteiros(resposta: unknown): BilheteiroParaLista[] {
  const itens = (resposta && typeof resposta === "object" ? (resposta as { bilheteiros?: unknown }).bilheteiros : null);
  if (!Array.isArray(itens)) return [];
  const saida: BilheteiroParaLista[] = [];
  for (const bruto of itens) {
    const b = (bruto && typeof bruto === "object" ? bruto : {}) as { id?: unknown; nome?: unknown; email?: unknown; ativo?: unknown; criado_em?: unknown };
    if (typeof b.id === "string" && typeof b.nome === "string" && typeof b.ativo === "boolean") saida.push({ id: b.id, nome: b.nome, email: typeof b.email === "string" ? b.email : null, ativo: b.ativo, criadoEm: typeof b.criado_em === "string" ? b.criado_em : "" });
  }
  return saida;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOME_MAX = 120;
const EMAIL_MAX = 254;

export type NovoBilheteiro = { nome: string; email: string };
export type Leitura<T> = { ok: true; valor: T } | { ok: false; erro: string };

/** O que o produtor digitou ao cadastrar: nome aparado (1 a 120 letras) e e-mail em minúsculas. */
export function lerNovoBilheteiro(bruto: unknown): Leitura<NovoBilheteiro> {
  const c = (bruto && typeof bruto === "object" ? bruto : {}) as { nome?: unknown; email?: unknown };
  const nome = typeof c.nome === "string" ? c.nome.trim().replace(/\s+/g, " ") : "";
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  if (nome.length < 1) return { ok: false, erro: "Escreva o nome de quem vai vender." };
  if (nome.length > NOME_MAX) return { ok: false, erro: `O nome pode ter até ${NOME_MAX} letras.` };
  if (email.length > EMAIL_MAX || !EMAIL.test(email)) return { ok: false, erro: "Escreva um e-mail válido." };
  return { ok: true, valor: { nome, email } };
}

export type AlteracaoDeBilheteiro = { nome?: string; ativo?: boolean };

/** O que se pode mudar numa pessoa já cadastrada: o nome e ligar ou desligar o acesso. Pelo menos um dos dois. */
export function lerAlteracaoDeBilheteiro(bruto: unknown): Leitura<AlteracaoDeBilheteiro> {
  const c = (bruto && typeof bruto === "object" ? bruto : {}) as { nome?: unknown; ativo?: unknown };
  const saida: AlteracaoDeBilheteiro = {};
  if (c.nome !== undefined) {
    const nome = typeof c.nome === "string" ? c.nome.trim().replace(/\s+/g, " ") : "";
    if (nome.length < 1 || nome.length > NOME_MAX) return { ok: false, erro: `O nome precisa ter de 1 a ${NOME_MAX} letras.` };
    saida.nome = nome;
  }
  if (c.ativo !== undefined) {
    if (typeof c.ativo !== "boolean") return { ok: false, erro: "Escolha ligar ou desligar o acesso." };
    saida.ativo = c.ativo;
  }
  if (saida.nome === undefined && saida.ativo === undefined) return { ok: false, erro: "Nada para mudar." };
  return { ok: true, valor: saida };
}

/** O código de erro da rota do cadastro, numa frase. */
export function mensagemDoErroDoCadastro(codigo: string | null | undefined): string {
  switch (codigo) {
    case "ja_cadastrada": return "Esta pessoa já está cadastrada na bilheteria desta loja.";
    case "convite_pendente": return "Este e-mail já recebeu um convite e ainda não o abriu. Peça para a pessoa abrir o e-mail do convite.";
    case "convite_falhou": return "Não foi possível enviar o convite por e-mail agora. Tente de novo.";
    case "dados_invalidos": return "Confira o nome e o e-mail.";
    case "muitas_tentativas": return "Muitas tentativas. Espere um minuto e tente de novo.";
    case "sem_permissao": return "Só quem edita a Ticketeria pode cadastrar a bilheteria.";
    default: return "Não foi possível salvar agora. Tente de novo.";
  }
}

/** Depois de criar a senha pelo convite, a bilheteira vai para a bilheteria; qualquer outro destino cai no padrão. */
export function destinoDaNovaSenha(next: string | null | undefined): string {
  return next === INICIO_DA_BILHETERIA ? INICIO_DA_BILHETERIA : "/dashboard";
}
