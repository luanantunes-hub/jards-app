"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { CATEGORIAS_DO_ITEM } from "@/lib/producao/estados";
import { pesoTotalKg, ROTULO_DA_CATEGORIA, ROTULO_DO_DONO, totaisDoInventario, valorTotalDoItem, volumeM3 } from "@/lib/producao/inventario";
import { chaveDoNome } from "@/lib/dominio";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Select } from "@/components/ui/Select";
import { ItemSheet, type ItemEditavel } from "@/components/producao/ItemSheet";

const numero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function Indicador({ rotulo, valor, titulo }: { rotulo: string; valor: string; titulo?: string }) {
  return (
    <div>
      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</p>
      <p title={titulo} className="mt-1 text-[1.125rem] font-semibold tabular-nums text-[#282525]">{valor}</p>
    </div>
  );
}

/** O inventário da produção: o que se carrega e se usa, com o volume, o peso e (para quem vê o dinheiro) o valor. */
export default function InventarioPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [itens, setItens] = useState<ItemEditavel[] | null>(null);
  const [espacos, setEspacos] = useState<{ id: string; nome: string }[]>([]);
  const [comDinheiro, setComDinheiro] = useState(false);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [arquivados, setArquivados] = useState(false);
  const [folha, setFolha] = useState<{ item?: ItemEditavel } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [ite, esp, din] = await Promise.all([
        producao.from("producao_itens")
          .select("id, nome, categoria, dono, espaco_id, fornecedor, locacao_inicio, locacao_fim, quantidade, comprimento_cm, largura_cm, altura_cm, peso_kg, serie, potencia_w, canais, notas, arquivado, valores:producao_itens_valores(valor_unitario, valor_locacao)")
          .eq("organization_id", organizationId).order("nome"),
        producao.from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
        producao.rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" }),
      ]);
      if (!ativo) return;
      type Linha = Omit<ItemEditavel, "valores"> & { valores: ItemEditavel["valores"] | NonNullable<ItemEditavel["valores"]>[] };
      setItens(((ite.data ?? []) as unknown as Linha[]).map(linha => ({ ...linha, valores: Array.isArray(linha.valores) ? linha.valores[0] ?? null : linha.valores })));
      setEspacos(esp.data ?? []);
      setComDinheiro(din.data === true);
      setErro(ite.error || esp.error ? "Não foi possível carregar o inventário. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const visiveis = useMemo(() => {
    const chave = chaveDoNome(busca);
    return (itens ?? []).filter(item => item.arquivado === arquivados
      && (categoria === "todas" || item.categoria === categoria)
      && (!chave || chaveDoNome(`${item.nome} ${item.serie ?? ""} ${item.fornecedor ?? ""}`).includes(chave)));
  }, [itens, busca, categoria, arquivados]);
  const totais = useMemo(() => totaisDoInventario(visiveis), [visiveis]);
  const valor = useMemo(() => visiveis.reduce((soma, item) => soma + valorTotalDoItem(item.quantidade, item.valores), 0), [visiveis]);
  const temArquivados = (itens ?? []).some(item => item.arquivado);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Inventário</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">O que a produção carrega e usa: cenário, figurino, instrumentos, luz, som, vídeo.</p>
            </div>
            {podeEditar && <PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Novo item</PrimaryListAction>}
          </div>
          {itens !== null && visiveis.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
              <Indicador rotulo="Itens" valor={`${numero(totais.itens)} · ${numero(totais.unidades)} un.`} />
              <Indicador rotulo="Volume" valor={`${numero(totais.volumeM3, 2)} m³`} titulo={totais.semMedidas > 0 ? `${totais.semMedidas} item(ns) sem dimensões ou peso ficam fora destes totais` : undefined} />
              <Indicador rotulo="Peso" valor={`${numero(totais.pesoKg, 1)} kg`} />
              {comDinheiro && <Indicador rotulo="Valor" valor={formatarValorCurto(valor)} titulo={formatarValorCompleto(valor)} />}
            </div>
          )}
          {totais.semMedidas > 0 && visiveis.length > 0 && <p className="mt-3 text-[0.6875rem] text-black/45">{totais.semMedidas} {totais.semMedidas === 1 ? "item está" : "itens estão"} sem dimensões ou peso e fica(m) fora do volume e do peso.</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">Buscar item</span>
              <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
              <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar pelo nome, série ou fornecedor" className="h-10 w-full rounded border border-black/[.12] bg-white pl-8 pr-3 text-[0.8125rem] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
            </label>
            <Select block={false} aria-label="Filtrar por categoria" value={categoria} onChange={event => setCategoria(event.target.value)} className="h-10 pl-3 pr-8 text-black/60">
              <option value="todas">Todas as categorias</option>
              {CATEGORIAS_DO_ITEM.map(valorCategoria => <option key={valorCategoria} value={valorCategoria}>{ROTULO_DA_CATEGORIA[valorCategoria]}</option>)}
            </Select>
            {temArquivados && (
              <button type="button" onClick={() => setArquivados(atual => !atual)} aria-pressed={arquivados} className={`h-10 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${arquivados ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>Arquivados</button>
            )}
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {itens === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : visiveis.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">{itens.length === 0 ? "Nenhum item cadastrado" : "Nenhum item encontrado"}</p>
            {itens.length === 0 && <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Cadastre o que viaja com a produção, com tamanho e peso, para saber o volume que o caminhão precisa levar.</p>}
            {itens.length === 0 && podeEditar && <div className="mt-4 flex justify-center"><PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Novo item</PrimaryListAction></div>}
          </div>
        ) : (
          <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <ul className="divide-y divide-black/[.06]">
              {visiveis.map(item => {
                const volume = volumeM3(item), peso = pesoTotalKg(item);
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => podeEditar && setFolha({ item })} disabled={!podeEditar} className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left transition enabled:hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{item.nome}</span>
                        <span className="block truncate text-[0.6875rem] text-black/45">{[ROTULO_DA_CATEGORIA[item.categoria], ROTULO_DO_DONO[item.dono], item.fornecedor, item.serie ? `série ${item.serie}` : null].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="w-14 text-right text-[0.75rem] tabular-nums text-black/65">{numero(item.quantidade)} un.</span>
                      <span className="w-20 text-right text-[0.75rem] tabular-nums text-black/55">{volume === null ? "—" : `${numero(volume, 2)} m³`}</span>
                      <span className="w-20 text-right text-[0.75rem] tabular-nums text-black/55">{peso === null ? "—" : `${numero(peso, 1)} kg`}</span>
                      {comDinheiro && <span className="w-24 text-right text-[0.75rem] tabular-nums text-black/65" title={formatarValorCompleto(valorTotalDoItem(item.quantidade, item.valores))}>{item.valores ? formatarValorCurto(valorTotalDoItem(item.quantidade, item.valores)) : "—"}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </DetailPageContent>

      {folha && organizationId && <ItemSheet organizationId={organizationId} item={folha.item} espacos={espacos} comDinheiro={comDinheiro && podeEditar} onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />}
    </div>
  );
}
