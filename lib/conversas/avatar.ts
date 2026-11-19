/**
 * As iniciais e a cor de quem aparece nas Conversas. A cor sai do próprio nome, então a mesma pessoa tem sempre
 * a mesma, sem precisar guardar nada — e sai da paleta da identidade do Jards (components/ui/ProjectIdentity).
 */

export const CORES_DO_AVATAR = ["#7C5CD6", "#E8665A", "#DFA024", "#3DA86A", "#3B8BE0"] as const;

const SEM_LETRA = /[^\p{L}\p{N}]+/u;
/** Partículas que não entram nas iniciais: "Ana de Souza" vira AS, não AD. */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "del", "di", "van", "von"]);

/** Até duas letras: a primeira e a última palavra do nome. De um e-mail, as duas primeiras letras da parte antes do @. */
export function iniciaisDe(nome: string | null | undefined, endereco?: string | null): string {
  const limpo = (nome ?? "").trim();
  if (limpo && !limpo.includes("@")) {
    const palavras = limpo.split(SEM_LETRA).filter((parte) => parte && !LIGACOES.has(parte.toLowerCase()));
    if (palavras.length >= 2) return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
    if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  }
  const local = (limpo.includes("@") ? limpo : endereco ?? "").split("@")[0] ?? "";
  const letras = local.split(SEM_LETRA).filter(Boolean);
  if (letras.length >= 2) return (letras[0][0] + letras[1][0]).toUpperCase();
  return (letras[0] ?? "?").slice(0, 2).toUpperCase();
}

/** Sempre a mesma cor para a mesma pessoa: soma estável das letras da chave (o e-mail, quando há). */
export function corDoAvatar(chave: string | null | undefined): string {
  const texto = (chave ?? "").trim().toLowerCase();
  if (!texto) return CORES_DO_AVATAR[0];
  let soma = 0;
  for (let i = 0; i < texto.length; i += 1) soma = (soma * 31 + texto.charCodeAt(i)) % 100_000;
  return CORES_DO_AVATAR[soma % CORES_DO_AVATAR.length];
}
