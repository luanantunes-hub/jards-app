/**
 * Domínio de um site, sem protocolo nem "www": é o que o app guarda em empresas_crm.domain_key para buscar o
 * logotipo da empresa. Mesma regra de resolveCompanyDomain (components/CompanyLogo.tsx), que é um arquivo de
 * cliente e não pode ser importado pelas rotas do servidor.
 */
export function resolverDominio(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const texto = valor.trim();
  if (!texto) return null;
  try {
    const url = texto.startsWith("http") ? texto : `https://${texto}`;
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return texto.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0] || null;
  }
}

/** Mesma chave que o app grava em nome_key: minúsculas e sem acentos. */
export function chaveDoNome(nome: string): string {
  return nome.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Para comparar nomes: ignora caixa, acentos e espaços repetidos. */
export function mesmoNome(a: string, b: string): boolean {
  const limpar = (valor: string) => chaveDoNome(valor).replace(/\s+/g, " ");
  return limpar(a) === limpar(b);
}
