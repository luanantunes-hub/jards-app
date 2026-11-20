// As marcas que apresentam as sessões da programação pública (plano do módulo, PD12.3, primeiro corte): conferência do formulário com as
// regras do banco e o que a programação pública mostra de cada marca. Sem tela e sem banco.

export type MarcaLida = { nome: string; site_url: string | null; logo_url: string | null };
export type LeituraDaMarca = { ok: true; marca: MarcaLida } | { ok: false; erro: string };

/** Endereço https sem espaços, como o banco aceita (o site até 300 letras, o logo até 500). Vazio é nulo. */
function enderecoHttps(texto: string, limite: number, rotulo: string): { ok: true; valor: string | null } | { ok: false; erro: string } {
  const valor = texto.trim();
  if (valor === "") return { ok: true, valor: null };
  if (!/^https:\/\/[^\s]+$/.test(valor)) return { ok: false, erro: `${rotulo} começa com https:// e não tem espaços.` };
  if (valor.length > limite) return { ok: false, erro: `${rotulo} pode ter até ${limite} letras.` };
  try {
    new URL(valor);
  } catch {
    return { ok: false, erro: `${rotulo} não é um endereço válido.` };
  }
  return { ok: true, valor };
}

/** A marca como o banco aceita: nome de 1 a 120 letras; site e logo opcionais, só https. */
export function lerMarca(c: { nome: string; site: string; logo: string }): LeituraDaMarca {
  const nome = c.nome.trim();
  if (nome === "") return { ok: false, erro: "Informe o nome da marca." };
  if (nome.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras." };
  const site = enderecoHttps(c.site, 300, "O site");
  if (!site.ok) return site;
  const logo = enderecoHttps(c.logo, 500, "O endereço do logo");
  if (!logo.ok) return logo;
  return { ok: true, marca: { nome, site_url: site.valor, logo_url: logo.valor } };
}

/** O que a programação pública mostra de uma marca: só o nome, o site e o logo. */
export type MarcaPublica = { nome: string; site: string | null; logo: string | null };

/** A marca de uma sessão para o público; marca arquivada ou que não existe mais não aparece. */
export function marcaPublicaDaSessao(
  marcaId: string | null | undefined,
  marcas: ReadonlyMap<string, { nome: string; site_url: string | null; logo_url: string | null; arquivada: boolean }>,
): MarcaPublica | null {
  if (!marcaId) return null;
  const marca = marcas.get(marcaId);
  if (!marca || marca.arquivada) return null;
  return { nome: marca.nome, site: marca.site_url, logo: marca.logo_url };
}
