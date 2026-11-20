import type { createClient } from "@/lib/supabase/client";

// O banco devolve no máximo 1.000 linhas por consulta. A lista de setores sai
// da coluna `setor` de `empresas` (uma linha por empresa), então precisa ler
// em páginas: com uma consulta só, os setores que só aparecem depois da linha
// 1.000 sumiam do filtro.
const TAMANHO_PAGINA = 1000;
const LIMITE_PAGINAS = 50;

/** Chave de comparação: ignora maiúsculas, acentos e espaços repetidos. */
export function chaveSetor(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Junta as linhas lidas em uma lista de setores sem repetição ("Indústria" e
 * "indústria" viram um só), na grafia mais usada, em ordem alfabética do
 * português. Valores vazios ou só com espaços são ignorados.
 */
export function agruparSetores(valores: ReadonlyArray<string | null | undefined>): string[] {
  const grafiasPorChave = new Map<string, Map<string, number>>();
  for (const bruto of valores) {
    const grafia = bruto?.replace(/\s+/g, " ").trim();
    if (!grafia) continue;
    const chave = chaveSetor(grafia);
    const grafias = grafiasPorChave.get(chave) ?? new Map<string, number>();
    grafias.set(grafia, (grafias.get(grafia) ?? 0) + 1);
    grafiasPorChave.set(chave, grafias);
  }

  const setores: string[] = [];
  for (const grafias of grafiasPorChave.values()) {
    const [escolhida] = [...grafias.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aMaiuscula = a[0][0] === a[0][0].toUpperCase() ? 0 : 1;
      const bMaiuscula = b[0][0] === b[0][0].toUpperCase() ? 0 : 1;
      return aMaiuscula - bMaiuscula || a[0].localeCompare(b[0], "pt-BR");
    })[0];
    setores.push(escolhida);
  }
  return setores.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

// Todas as grafias lidas na última carga, por chave, para o filtro buscar as
// empresas de qualquer uma delas ("Indústria", "Industria", "indústria ").
let grafiasPorChave = new Map<string, Set<string>>();

/** Grafias do banco que equivalem ao setor escolhido; sem carga, só ele mesmo. */
export function grafiasDoSetor(setor: string): string[] {
  const grafias = grafiasPorChave.get(chaveSetor(setor));
  return grafias ? [...grafias] : [setor];
}

/** Lê todos os setores de `empresas` (em páginas) e devolve a lista sem repetição. */
export async function carregarSetores(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const linhas: Array<string | null> = [];
  for (let pagina = 0; pagina < LIMITE_PAGINAS; pagina++) {
    const inicio = pagina * TAMANHO_PAGINA;
    const { data, error } = await supabase
      .from("empresas")
      .select("setor")
      .not("setor", "is", null)
      .order("id")
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error || !data) break;
    const lidas = data as Array<{ setor: string | null }>;
    for (const linha of lidas) linhas.push(linha.setor);
    if (lidas.length < TAMANHO_PAGINA) break;
  }
  const mapa = new Map<string, Set<string>>();
  for (const linha of linhas) {
    if (!linha?.trim()) continue;
    const chave = chaveSetor(linha);
    mapa.set(chave, (mapa.get(chave) ?? new Set<string>()).add(linha));
  }
  grafiasPorChave = mapa;
  return agruparSetores(linhas);
}
