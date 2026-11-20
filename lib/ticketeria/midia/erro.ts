// O erro das fontes de mídia (Meta, Google): por que a leitura falhou, sem texto cru da plataforma (que pode trazer dado do app ou do token). Sem banco e sem rede.

/** Por que a fonte recusou: `token` (venceu ou foi retirado: o produtor conecta de novo), `limite` (muitas chamadas: tentar mais tarde) ou `outro`. */
export class ErroDeMidia extends Error {
  constructor(readonly tipo: "token" | "limite" | "outro", readonly codigo: number | null, readonly subcodigo: number | null) {
    super(`midia:${tipo}:${codigo ?? "-"}`);
    this.name = "ErroDeMidia";
  }
}

/** A frase para o produtor (nunca o texto cru da plataforma). `fonte` é o nome que ele conhece: "Meta", "Google Ads". */
export function fraseDoErro(erro: unknown, fonte: string = "Meta"): { frase: string; tokenInvalido: boolean } {
  if (erro instanceof ErroDeMidia) {
    if (erro.tipo === "token") return { frase: frasePedindoNovaConexao(fonte), tokenInvalido: true };
    if (erro.tipo === "limite") return { frase: `${fonte === "Meta" ? "A Meta" : `O ${fonte}`} pediu para esperar um pouco. O Jards tenta de novo amanhã.`, tokenInvalido: false };
  }
  return { frase: `Não foi possível ler ${fonte === "Meta" ? "o Meta" : `o ${fonte}`} agora. O Jards tenta de novo amanhã.`, tokenInvalido: false };
}

export const frasePedindoNovaConexao = (fonte: string): string => `O acesso ao ${fonte} venceu ou foi retirado. Conecte de novo.`;
