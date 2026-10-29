// O destino de um login ou de um convite vem do endereço (?next=...) e só pode ser um caminho do próprio site.
// Conferir só o começo ("/" sem "//") não basta: o navegador ignora tabulação e quebra de linha dentro do
// endereço, então "/\t/outro.site" vira "//outro.site" e leva a pessoa para fora. Por isso o valor é
// interpretado como endereço e só vale se continuar no mesmo site.
const BASE = "https://jards.invalid";

export function destinoInterno(valor: string | string[] | null | undefined, padrao = "/dashboard"): string {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  if (!bruto || !bruto.startsWith("/")) return padrao;
  try {
    const url = new URL(bruto, BASE);
    if (url.origin !== BASE) return padrao;
    const caminho = url.pathname + url.search + url.hash;
    // "/.//outro.site" vira "//outro.site" depois de normalizado.
    return caminho.startsWith("//") ? padrao : caminho;
  } catch {
    return padrao;
  }
}
