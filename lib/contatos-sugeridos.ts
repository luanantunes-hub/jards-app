/**
 * Pessoas que o patrocinador já mostra na página dele (responsáveis pelo
 * patrocínio e contatos sugeridos pela comunidade), oferecidas como contato
 * de uma nova negociação. Só entram quando a pessoa pode ver os contatos: o
 * banco devolve os responsáveis mascarados enquanto a empresa não foi
 * desbloqueada, e nesse caso nada é oferecido.
 */

export type ContatoSugerido = {
  /** `responsavel:<id>` ou `sugestao:<id>`. */
  chave: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  linkedin_url: string | null;
  /** Liga o contato criado ao responsável da base (contatos.responsavel_id). */
  responsavel_id: string | null;
};

type ResponsavelBase = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  linkedin_url: string | null;
  mascarado?: boolean;
};

type SugestaoBase = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  linkedin_url: string | null;
  telefone: string | null;
  responsavel_id: string | null;
};

type ContatoSalvo = { nome: string | null; email: string | null; responsavel_id?: string | null };

const normalizar = (texto: string | null | undefined) =>
  (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

function mesmaPessoa(a: { nome: string | null; email: string | null; responsavel_id?: string | null }, b: { nome: string | null; email: string | null; responsavel_id?: string | null }) {
  if (a.responsavel_id && b.responsavel_id) return a.responsavel_id === b.responsavel_id;
  if (a.email && b.email) return normalizar(a.email) === normalizar(b.email);
  return normalizar(a.nome) !== "" && normalizar(a.nome) === normalizar(b.nome);
}

export function contatosSugeridosDoPatrocinador(
  responsaveis: ResponsavelBase[],
  sugestoes: SugestaoBase[],
  podeVerContatos: boolean,
): ContatoSugerido[] {
  if (!podeVerContatos) return [];
  const lista: ContatoSugerido[] = [];
  for (const r of responsaveis) {
    if (r.mascarado || !r.nome?.trim()) continue;
    lista.push({ chave: `responsavel:${r.id}`, nome: r.nome.trim(), cargo: r.cargo, email: r.email, telefone: null, linkedin_url: r.linkedin_url, responsavel_id: r.id });
  }
  for (const s of sugestoes) {
    if (!s.nome?.trim()) continue;
    const candidato: ContatoSugerido = { chave: `sugestao:${s.id}`, nome: s.nome.trim(), cargo: s.cargo, email: s.email, telefone: s.telefone, linkedin_url: s.linkedin_url, responsavel_id: s.responsavel_id };
    if (lista.some(item => mesmaPessoa(item, candidato))) continue;
    lista.push(candidato);
  }
  return lista;
}

/** O contato salvo que corresponde a esta pessoa do patrocinador, se houver. */
export function contatoSalvoCorrespondente<T extends ContatoSalvo>(sugerido: ContatoSugerido, salvos: T[]): T | null {
  return salvos.find(salvo => mesmaPessoa(sugerido, salvo)) ?? null;
}

/** Tira da sugestão quem já está nos contatos salvos da empresa. */
export function semContatosJaSalvos(sugeridos: ContatoSugerido[], salvos: ContatoSalvo[]): ContatoSugerido[] {
  return sugeridos.filter(sugerido => !salvos.some(salvo => mesmaPessoa(sugerido, salvo)));
}

export function rotuloContato(contato: { nome: string; cargo: string | null }) {
  return contato.cargo ? `${contato.nome} · ${contato.cargo}` : contato.nome;
}
