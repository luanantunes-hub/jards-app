import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";

// Os textos ficam em messages/<idioma>/<área>.json. Cada área nova entra na lista AREAS e ganha um arquivo em cada idioma.
// O que faltar num idioma aparece em português (nunca o nome da chave): o teste tests/i18n-mensagens.test.ts barra o PR se faltar algo.

export const AREAS = ["ticketeria"] as const;

export type Mensagens = Record<string, unknown>;

async function lerArea(idioma: Idioma, area: string): Promise<Mensagens> {
  return (await import(`../../messages/${idioma}/${area}.json`)).default as Mensagens;
}

function mesclar(base: Mensagens, por_cima: Mensagens): Mensagens {
  const saida: Mensagens = { ...base };
  for (const [chave, valor] of Object.entries(por_cima)) {
    const atual = saida[chave];
    saida[chave] = valor && typeof valor === "object" && atual && typeof atual === "object" ? mesclar(atual as Mensagens, valor as Mensagens) : valor;
  }
  return saida;
}

export async function carregarMensagens(idioma: Idioma): Promise<Mensagens> {
  const origem: Mensagens = {};
  const desejado: Mensagens = {};
  for (const area of AREAS) {
    origem[area] = await lerArea(IDIOMA_PADRAO, area);
    if (idioma !== IDIOMA_PADRAO) desejado[area] = await lerArea(idioma, area);
  }
  return idioma === IDIOMA_PADRAO ? origem : mesclar(origem, desejado);
}
