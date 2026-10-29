import type { SupabaseClient } from "@supabase/supabase-js";

// Um setor como aparece no filtro: o nome mais usado entre as grafias que só
// diferem em maiúsculas, acentos ou espaços, e todas essas grafias, para a
// consulta trazer as empresas de qualquer uma delas.
export interface SetorFiltro {
  label: string;
  variantes: string[];
  total: number;
}

const POR_PAGINA = 1000;

function chave(setor: string): string {
  return setor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function agruparSetores(valores: string[]): SetorFiltro[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const bruto of valores) {
    const k = chave(bruto);
    if (!k) continue;
    const grafias = grupos.get(k) ?? new Map<string, number>();
    grafias.set(bruto, (grafias.get(bruto) ?? 0) + 1);
    grupos.set(k, grafias);
  }
  return [...grupos.values()]
    .map((grafias) => {
      const ordenadas = [...grafias.entries()].sort((a, b) => b[1] - a[1]);
      return {
        label: ordenadas[0][0].replace(/\s+/g, " ").trim(),
        variantes: ordenadas.map(([v]) => v),
        total: ordenadas.reduce((soma, [, n]) => soma + n, 0),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

// O PostgREST devolve no máximo 1000 linhas por consulta; sem paginar, os
// setores das empresas além da milésima ficavam fora do filtro.
export async function carregarSetores(supabase: SupabaseClient): Promise<SetorFiltro[]> {
  const valores: string[] = [];
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const { data, error } = await supabase
      .from("empresas")
      .select("setor")
      .not("setor", "is", null)
      .order("id")
      .range(inicio, inicio + POR_PAGINA - 1);
    if (error || !data) break;
    for (const r of data as { setor: string | null }[]) if (r.setor) valores.push(r.setor);
    if (data.length < POR_PAGINA) break;
  }
  return agruparSetores(valores);
}

export function variantesDoSetor(setores: SetorFiltro[], label: string): string[] {
  return setores.find((s) => s.label === label)?.variantes ?? [label];
}
