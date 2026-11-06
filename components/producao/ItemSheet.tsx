"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CATEGORIAS_DO_ITEM, DONOS_DO_ITEM } from "@/lib/producao/estados";
import { lerItem, ROTULO_DA_CATEGORIA, ROTULO_DO_DONO } from "@/lib/producao/inventario";
import type { CategoriaDoItem, DonoDoItem } from "@/lib/producao/estados";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

export type ItemEditavel = {
  id: string; nome: string; categoria: CategoriaDoItem; dono: DonoDoItem; espaco_id: string | null; fornecedor: string | null;
  locacao_inicio: string | null; locacao_fim: string | null; quantidade: number; comprimento_cm: number | null; largura_cm: number | null;
  altura_cm: number | null; peso_kg: number | null; serie: string | null; potencia_w: number | null; canais: number | null; notas: string | null;
  arquivado: boolean; valores: { valor_unitario: number | null; valor_locacao: number | null } | null;
};

const emTexto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const moeda = (n: number | null | undefined) => (n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

/** Cadastro e edição de um item do inventário. O valor (R$) só aparece para quem vê o dinheiro. */
export function ItemSheet({ organizationId, item, espacos, comDinheiro, onClose, onSaved }: {
  organizationId: string; item?: ItemEditavel; espacos: { id: string; nome: string }[]; comDinheiro: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(item?.nome ?? "");
  const [categoria, setCategoria] = useState<string>(item?.categoria ?? "outro");
  const [dono, setDono] = useState<string>(item?.dono ?? "producao");
  const [espacoId, setEspacoId] = useState(item?.espaco_id ?? "");
  const [fornecedor, setFornecedor] = useState(item?.fornecedor ?? "");
  const [locacaoInicio, setLocacaoInicio] = useState(item?.locacao_inicio ?? "");
  const [locacaoFim, setLocacaoFim] = useState(item?.locacao_fim ?? "");
  const [quantidade, setQuantidade] = useState(String(item?.quantidade ?? 1));
  const [comprimento, setComprimento] = useState(emTexto(item?.comprimento_cm));
  const [largura, setLargura] = useState(emTexto(item?.largura_cm));
  const [altura, setAltura] = useState(emTexto(item?.altura_cm));
  const [peso, setPeso] = useState(emTexto(item?.peso_kg));
  const [serie, setSerie] = useState(item?.serie ?? "");
  const [potencia, setPotencia] = useState(emTexto(item?.potencia_w));
  const [canais, setCanais] = useState(emTexto(item?.canais));
  const [notas, setNotas] = useState(item?.notas ?? "");
  const [valorUnitario, setValorUnitario] = useState(moeda(item?.valores?.valor_unitario));
  const [valorLocacao, setValorLocacao] = useState(moeda(item?.valores?.valor_locacao));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerItem({ nome, categoria, dono, espacoId, fornecedor, locacaoInicio, locacaoFim, quantidade, comprimento, largura, altura, peso, serie, potencia, canais, notas, valorUnitario, valorLocacao });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    if (leitura.item.dono === "espaco" && !leitura.item.espaco_id) { setErro("Escolha o espaço dono do item."); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    let itemId = item?.id ?? "";
    if (item) {
      const { error } = await producao.from("producao_itens").update(leitura.item).eq("id", item.id);
      if (error) { setSalvando(false); setErro(error.code === "42501" ? "Você não pode salvar itens aqui." : "Não foi possível salvar. Tente de novo."); return; }
    } else {
      const { data, error } = await producao.from("producao_itens").insert({ organization_id: organizationId, ...leitura.item }).select("id").single();
      if (error || !data) { setSalvando(false); setErro(error?.code === "42501" ? "Você não pode criar itens aqui." : "Não foi possível salvar. Tente de novo."); return; }
      itemId = data.id;
    }
    if (comDinheiro) {
      const { error } = await producao.from("producao_itens_valores")
        .upsert({ item_id: itemId, organization_id: organizationId, valor_unitario: leitura.valor_unitario, valor_locacao: leitura.valor_locacao }, { onConflict: "item_id" });
      if (error) { setSalvando(false); setErro("O item foi salvo, mas o valor não. Abra o item para tentar de novo."); onSaved(); return; }
    }
    setSalvando(false);
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!item) return;
    confirmDelete({
      title: "Apagar item?",
      description: `"${item.nome}" sai do inventário e das datas em que está.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_itens").delete().eq("id", item.id);
        if (error) throw new Error("Não foi possível apagar o item.");
        onSaved();
        fechar();
      },
    });
  }

  const campo = (rotulo: string, id: string, valor: string, mudar: (v: string) => void, extra: { placeholder?: string; modo?: "numeric" | "decimal"; tipo?: string } = {}) => (
    <div>
      <label className={ROTULO} htmlFor={id}>{rotulo}</label>
      <input id={id} type={extra.tipo ?? "text"} inputMode={extra.modo} className={CAMPO} value={valor} onChange={event => mudar(event.target.value)} placeholder={extra.placeholder} disabled={salvando} />
    </div>
  );

  return (
    <TopSheet
      titulo={item ? "Editar item" : "Novo item"}
      onClose={onClose}
      footer={fechar => (
        <>
          {item && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : item ? "Salvar" : "Criar item"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          {campo("Item", "item-nome", nome, setNome, { placeholder: "Praticável 2x1" })}
          {campo("Quantidade", "item-quantidade", quantidade, setQuantidade, { modo: "numeric" })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Categoria</span>
            <Dropdown value={categoria} onChange={setCategoria} options={CATEGORIAS_DO_ITEM.map(valor => ({ value: valor, label: ROTULO_DA_CATEGORIA[valor] }))} />
          </div>
          <div>
            <span className={ROTULO}>De quem é</span>
            <Dropdown value={dono} onChange={setDono} options={DONOS_DO_ITEM.map(valor => ({ value: valor, label: ROTULO_DO_DONO[valor] }))} />
          </div>
        </div>
        {dono === "espaco" && (
          <div>
            <span className={ROTULO}>Espaço</span>
            <Dropdown value={espacoId} onChange={setEspacoId} options={[{ value: "", label: "Escolha o espaço" }, ...espacos.map(espaco => ({ value: espaco.id, label: espaco.nome }))]} />
          </div>
        )}
        {dono === "locado" && (
          <div className="grid grid-cols-3 gap-3">
            {campo("Fornecedor", "item-fornecedor", fornecedor, setFornecedor)}
            {campo("Retirada", "item-retirada", locacaoInicio, setLocacaoInicio, { tipo: "date" })}
            {campo("Devolução", "item-devolucao", locacaoFim, setLocacaoFim, { tipo: "date" })}
          </div>
        )}
        <div className="grid grid-cols-4 gap-3">
          {campo("Compr. (cm)", "item-comprimento", comprimento, setComprimento, { modo: "decimal" })}
          {campo("Larg. (cm)", "item-largura", largura, setLargura, { modo: "decimal" })}
          {campo("Alt. (cm)", "item-altura", altura, setAltura, { modo: "decimal" })}
          {campo("Peso (kg)", "item-peso", peso, setPeso, { modo: "decimal" })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {campo("Série", "item-serie", serie, setSerie)}
          {campo("Potência (W)", "item-potencia", potencia, setPotencia, { modo: "numeric" })}
          {campo("Canais", "item-canais", canais, setCanais, { modo: "numeric" })}
        </div>
        {comDinheiro && (
          <div className={`grid gap-3 ${dono === "locado" ? "grid-cols-2" : "grid-cols-1"}`}>
            {campo("Valor por unidade (R$)", "item-valor", valorUnitario, setValorUnitario, { modo: "decimal", placeholder: "1.200,00" })}
            {dono === "locado" && campo("Custo da locação (R$)", "item-locacao", valorLocacao, setValorLocacao, { modo: "decimal", placeholder: "3.500,00" })}
          </div>
        )}
        <div>
          <label className={ROTULO} htmlFor="item-notas">Notas</label>
          <textarea id="item-notas" rows={3} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={2000} disabled={salvando} />
        </div>
      </div>
    </TopSheet>
  );
}
