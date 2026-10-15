"use client";

// Seletor de mesorregiões (várias de uma vez) da tela de Patrocinadores. As opções vêm do banco com o número de
// empresas que a aba da lei lista em cada uma; a tela aplica a escolha como `mesorregiao_id in (…)`.

import { useEffect, useMemo, useState } from "react";
import { MapTrifold } from "@phosphor-icons/react";
import { MultiSelectDropdown } from "@/components/ui/MultiSelectDropdown";
import { createClient } from "@/lib/supabase/client";
import { opcoesDeMesorregiao, podarSelecao, type MesorregiaoComEmpresas } from "@/lib/filtro-mesorregiao";

export type LeiDoFiltro = "cultura" | "esporte" | "ancine" | "saude";

const rotuloVarias = (quantidade: number) => (quantidade === 1 ? "1 mesorregião" : `${quantidade} mesorregiões`);

// Os tipos do banco não declaram as funções com argumentos (o app chama as RPCs sem tipo); aqui só o que esta usa.
type ChamadaRpc = {
  rpc: (fn: "fn_mesorregioes_com_empresas", args: { p_lei: LeiDoFiltro }) => PromiseLike<{ data: MesorregiaoComEmpresas[] | null; error: unknown }>;
};

export function FiltroMesorregiao({ lei, estado, selecionadas, onChange }: {
  lei: LeiDoFiltro;
  /** Sigla do estado escolhido no filtro de estado; vazio = todos. */
  estado: string;
  selecionadas: number[];
  onChange: (ids: number[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  // null enquanto carrega
  const [lista, setLista] = useState<MesorregiaoComEmpresas[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    (supabase as unknown as ChamadaRpc).rpc("fn_mesorregioes_com_empresas", { p_lei: lei }).then(({ data, error }) => {
      if (!cancelado) setLista(error ? [] : data ?? []);
    });
    return () => { cancelado = true; };
  }, [supabase, lei]);

  const opcoes = useMemo(() => (lista ? opcoesDeMesorregiao(lista, estado) : []), [lista, estado]);

  // Trocar o estado, ou a URL trazer um código que não existe, tira da seleção o que deixou de estar na lista.
  useEffect(() => {
    if (!lista) return;
    const podada = podarSelecao(selecionadas, opcoes);
    if (podada !== selecionadas) onChange(podada);
  }, [lista, opcoes, selecionadas, onChange]);

  // Sem lista (falha ao carregar ou tabelas vazias) o filtro não aparece: a tela continua inteira sem ele.
  if (lista && lista.length === 0) return null;

  return (
    <MultiSelectDropdown
      values={selecionadas.map(String)}
      onChange={(valores) => onChange(valores.map(Number))}
      options={opcoes}
      placeholder="Mesorregião"
      rotuloVarias={rotuloVarias}
      ariaLabel="Mesorregiões"
      searchPlaceholder="Buscar mesorregião ou estado…"
      emptyMessage="Nenhuma mesorregião encontrada."
      icon={<MapTrifold size={13} />}
      disabled={!lista}
      className="max-w-[16rem]"
    />
  );
}
