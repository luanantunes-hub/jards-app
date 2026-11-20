/**
 * Marcas que já saíram de cena: o logo.dev devolve o logo de quem ficou com o domínio (Banco Real vira Santander,
 * Unibanco vira Itaú) ou um ícone qualquer. Para esses domínios, o Jards mostra o logo histórico, em domínio
 * público no Wikimedia Commons, guardado em public/exemplos.
 */
export const LOGOS_HISTORICOS: Readonly<Record<string, string>> = {
  "varig.com.br": "/exemplos/varig.png",
  "vasp.com.br": "/exemplos/vasp.png",
  "transbrasil.com.br": "/exemplos/transbrasil.png",
  "cruzeirodosul.aero": "/exemplos/cruzeiro.png",
  "mappin.com.br": "/exemplos/mappin.png",
  "mesbla.com.br": "/exemplos/mesbla.png",
  "banconacional.com.br": "/exemplos/nacional.png",
  "bancoreal.com.br": "/exemplos/real.png",
  "unibanco.com.br": "/exemplos/unibanco.png",
  "bamerindus.com.br": "/exemplos/bamerindus.png",
};
