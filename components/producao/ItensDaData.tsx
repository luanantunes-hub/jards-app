"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { DonoDoItem } from "@/lib/producao/estados";
import { pesoTotalKg, ROTULO_DA_CATEGORIA, totaisDoInventario, volumeM3 } from "@/lib/producao/inventario";
import type { CategoriaDoItem } from "@/lib/producao/estados";

type ItemLido = {
  id: string; nome: string; categoria: CategoriaDoItem; dono: DonoDoItem; quantidade: number;
  comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null;
};
type Ligacao = { id: string; item_id: string; quantidade: number };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const numero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function LevarItemSheet({ organizationId, dataId, disponiveis, onClose, onSaved }: { organizationId: string; dataId: string; disponiveis: ItemLido[]; onClose: () => void; onSaved: () => void }) {
  const [itemId, setItemId] = useState(disponiveis[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState(String(disponiveis[0]?.quantidade ?? 1));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const n = Number(quantidade.trim());
    if (!itemId) { setErro("Escolha o item."); return; }
    if (!Number.isInteger(n) || n < 1 || n > 99999) { setErro("A quantidade é um número inteiro de 1 a 99.999."); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_item_datas").insert({ organization_id: organizationId, item_id: itemId, data_id: dataId, quantidade: n });
    setSalvando(false);
    if (error) { setErro(error.code === "23505" ? "Esse item já está nesta data." : error.code === "42501" ? "Você não pode levar itens a esta data." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo="Levar um item a esta data"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : "Levar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <span className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Item</span>
            <Dropdown value={itemId} onChange={valor => { setItemId(valor); const escolhido = disponiveis.find(item => item.id === valor); if (escolhido) setQuantidade(String(escolhido.quantidade)); }}
              options={disponiveis.map(item => ({ value: item.id, label: `${item.nome} · ${ROTULO_DA_CATEGORIA[item.categoria]}` }))} />
          </div>
          <div>
            <label htmlFor="levar-quantidade" className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Quantidade</label>
            <input id="levar-quantidade" inputMode="numeric" className={CAMPO} value={quantidade} onChange={event => setQuantidade(event.target.value)} disabled={salvando} />
          </div>
        </div>
      </div>
    </TopSheet>
  );
}

/** Os itens do inventário que vão para esta data (PD2.1): quantos, e o volume e o peso que isso dá. */
export function ItensDaData({ organizationId, dataId, podeEditar }: { organizationId: string; dataId: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const [itens, setItens] = useState<ItemLido[] | null>(null);
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [ite, lig] = await Promise.all([
        producao.from("producao_itens").select("id, nome, categoria, dono, quantidade, comprimento_cm, largura_cm, altura_cm, peso_kg").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
        producao.from("producao_item_datas").select("id, item_id, quantidade").eq("data_id", dataId),
      ]);
      if (!ativo) return;
      setItens((ite.data ?? []) as ItemLido[]);
      setLigacoes((lig.data ?? []) as Ligacao[]);
      setErro(ite.error || lig.error ? "Não foi possível carregar os itens. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, dataId, versao]);

  const levados = useMemo(() => {
    const porId = new Map((itens ?? []).map(item => [item.id, item]));
    return ligacoes.flatMap(ligacao => { const item = porId.get(ligacao.item_id); return item ? [{ ligacao, item: { ...item, quantidade: ligacao.quantidade } }] : []; })
      .sort((a, b) => a.item.nome.localeCompare(b.item.nome, "pt-BR"));
  }, [itens, ligacoes]);
  const disponiveis = useMemo(() => (itens ?? []).filter(item => !ligacoes.some(ligacao => ligacao.item_id === item.id)), [itens, ligacoes]);
  const totais = useMemo(() => totaisDoInventario(levados.map(entrada => entrada.item)), [levados]);

  function tirar(ligacao: Ligacao, nome: string) {
    confirmDelete({
      title: "Tirar o item da data?",
      description: `"${nome}" deixa esta data. Ele continua no inventário.`,
      confirmLabel: "Tirar",
      pendingLabel: "Tirando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_item_datas").delete().eq("id", ligacao.id);
        if (error) throw new Error("Não foi possível tirar o item.");
        recarregar();
      },
    });
  }

  if (itens !== null && itens.length === 0 && ligacoes.length === 0) {
    return (
      <section aria-labelledby="itens-da-data" className="mt-10">
        <h2 id="itens-da-data" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Itens</h2>
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhum item no inventário</p>
          <Link href="/producoes/inventario" className="mt-2 inline-block text-[0.75rem] font-medium text-black/60 underline underline-offset-2 hover:text-black/80">Cadastrar no Inventário</Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="itens-da-data" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="itens-da-data" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Itens{levados.length > 0 ? ` · ${numero(totais.volumeM3, 2)} m³ · ${numero(totais.pesoKg, 1)} kg` : ""}</h2>
        {podeEditar && disponiveis.length > 0 && <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Levar item</PrimaryListAction>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {itens === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : levados.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhum item nesta data</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Diga o que vai para esta data: o volume e o peso somam sozinhos.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <ul className="divide-y divide-black/[.06]">
            {levados.map(({ ligacao, item }) => {
              const volume = volumeM3(item), peso = pesoTotalKg(item);
              return (
                <li key={ligacao.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{item.nome}</p>
                    <p className="text-[0.6875rem] text-black/45">{ROTULO_DA_CATEGORIA[item.categoria]}</p>
                  </div>
                  <span className="w-14 text-right text-[0.75rem] tabular-nums text-black/65">{numero(item.quantidade)} un.</span>
                  <span className="hidden w-20 text-right text-[0.75rem] tabular-nums text-black/55 sm:block">{volume === null ? "—" : `${numero(volume, 2)} m³`}</span>
                  <span className="hidden w-20 text-right text-[0.75rem] tabular-nums text-black/55 sm:block">{peso === null ? "—" : `${numero(peso, 1)} kg`}</span>
                  {podeEditar && <button type="button" onClick={() => tirar(ligacao, item.nome)} aria-label={`Tirar ${item.nome} da data`} title="Tirar da data" className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {folha && <LevarItemSheet organizationId={organizationId} dataId={dataId} disponiveis={disponiveis} onClose={() => setFolha(false)} onSaved={recarregar} />}
    </section>
  );
}
