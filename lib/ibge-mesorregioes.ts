// Mesorregiões e municípios do IBGE: o formato que a API de localidades devolve e a conversão para as linhas das
// tabelas `mesorregioes_ibge` e `municipios_ibge`. Puro, sem rede: quem baixa e grava é
// scripts/importar-mesorregioes-ibge.ts.

export type UfIbge = { sigla: string };

export type MesorregiaoIbge = { id: number; nome: string; UF: UfIbge };

export type MunicipioIbge = {
  id: number;
  nome: string;
  // Município criado depois da última revisão das divisões vem sem microrregião (e, portanto, sem mesorregião).
  microrregiao: { mesorregiao: MesorregiaoIbge } | null;
  "regiao-imediata": { id: number; nome: string; "regiao-intermediaria": { UF: UfIbge } } | null;
};

export type LinhaMesorregiao = { id: number; nome: string; uf: string };
export type LinhaMunicipio = { id: number; nome: string; uf: string; mesorregiao_id: number };

export type MunicipioDerivado = { municipio: string; uf: string; mesorregiao: string; regiaoImediata: string };
export type MunicipioSemMesorregiao = { id: number; nome: string; uf: string };

export type ResultadoMunicipios = {
  municipios: LinhaMunicipio[];
  /** Sem mesorregião na API, resolvidos pela região imediata: todos os vizinhos de dentro dela são da mesma. */
  derivados: MunicipioDerivado[];
  /** Sem mesorregião e sem como saber sem chute: a carga não deve seguir com eles. */
  semMesorregiao: MunicipioSemMesorregiao[];
};

// O IBGE aposentou as mesorregiões em 2017: o número não muda mais. Se mudar, alguém precisa olhar antes de gravar.
export const MESORREGIOES_ESPERADAS = 137;
export const MUNICIPIOS_MINIMOS = 5570;

export function linhasDeMesorregioes(mesorregioes: readonly MesorregiaoIbge[]): LinhaMesorregiao[] {
  return mesorregioes.map((m) => ({ id: m.id, nome: m.nome, uf: m.UF.sigla })).sort((a, b) => a.id - b.id);
}

export function linhasDeMunicipios(municipios: readonly MunicipioIbge[]): ResultadoMunicipios {
  const linhas: LinhaMunicipio[] = [];
  // Mesorregiões que aparecem dentro de cada região imediata, pelos municípios que têm microrregião.
  const porRegiaoImediata = new Map<number, Map<number, MesorregiaoIbge>>();

  for (const m of municipios) {
    const meso = m.microrregiao?.mesorregiao;
    if (!meso) continue;
    linhas.push({ id: m.id, nome: m.nome, uf: meso.UF.sigla, mesorregiao_id: meso.id });
    const regiao = m["regiao-imediata"];
    if (!regiao) continue;
    const doRegiao = porRegiaoImediata.get(regiao.id) ?? new Map<number, MesorregiaoIbge>();
    doRegiao.set(meso.id, meso);
    porRegiaoImediata.set(regiao.id, doRegiao);
  }

  const derivados: MunicipioDerivado[] = [];
  const semMesorregiao: MunicipioSemMesorregiao[] = [];
  for (const m of municipios) {
    if (m.microrregiao?.mesorregiao) continue;
    const regiao = m["regiao-imediata"];
    const uf = regiao?.["regiao-intermediaria"].UF.sigla ?? "";
    const candidatas = regiao ? [...(porRegiaoImediata.get(regiao.id)?.values() ?? [])] : [];
    // Só vale quando a região imediata aponta para uma única mesorregião, do mesmo estado do município.
    if (!regiao || candidatas.length !== 1 || candidatas[0].UF.sigla !== uf) {
      semMesorregiao.push({ id: m.id, nome: m.nome, uf });
      continue;
    }
    linhas.push({ id: m.id, nome: m.nome, uf, mesorregiao_id: candidatas[0].id });
    derivados.push({ municipio: m.nome, uf, mesorregiao: candidatas[0].nome, regiaoImediata: regiao.nome });
  }

  return { municipios: linhas.sort((a, b) => a.id - b.id), derivados, semMesorregiao };
}

/** O que está errado na carga, em português; lista vazia quando pode gravar. */
export function problemasDaCarga(
  mesorregioes: readonly LinhaMesorregiao[],
  municipios: readonly LinhaMunicipio[],
  esperado: { mesorregioes: number; municipiosMinimo: number } = { mesorregioes: MESORREGIOES_ESPERADAS, municipiosMinimo: MUNICIPIOS_MINIMOS },
): string[] {
  const problemas: string[] = [];
  if (mesorregioes.length !== esperado.mesorregioes) {
    problemas.push(`Vieram ${mesorregioes.length} mesorregiões; eram esperadas ${esperado.mesorregioes}`);
  }
  if (municipios.length < esperado.municipiosMinimo) {
    problemas.push(`Vieram ${municipios.length} municípios; o Brasil tem pelo menos ${esperado.municipiosMinimo}`);
  }
  const ufDaMesorregiao = new Map(mesorregioes.map((m) => [m.id, m.uf]));
  const idsRepetidos = new Set<number>();
  const vistos = new Set<number>();
  for (const m of municipios) {
    if (vistos.has(m.id)) idsRepetidos.add(m.id);
    vistos.add(m.id);
    const ufMeso = ufDaMesorregiao.get(m.mesorregiao_id);
    if (ufMeso === undefined) problemas.push(`${m.nome}/${m.uf} aponta para a mesorregião ${m.mesorregiao_id}, que não veio na lista`);
    else if (ufMeso !== m.uf) problemas.push(`${m.nome}/${m.uf} está numa mesorregião de ${ufMeso}`);
  }
  if (idsRepetidos.size > 0) problemas.push(`Códigos de município repetidos: ${[...idsRepetidos].join(", ")}`);
  return problemas;
}
