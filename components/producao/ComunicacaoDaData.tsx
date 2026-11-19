"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Pencil, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { TIPOS_DE_COMUNICACAO, type TipoDeComunicacao } from "@/lib/producao/estados";
import {
  kitDeImprensa, lerItemDaComunicacao, mensagemDoErroDaComunicacao, ordenarComunicacao, ROTULO_DA_COMUNICACAO,
  type ItemDaComunicacao,
} from "@/lib/producao/comunicacao";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const AREA = "w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

function ItemSheet({ organizationId, dataId, item, onClose, onSaved }: {
  organizationId: string; dataId: string; item: ItemDaComunicacao | null; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [tipo, setTipo] = useState<TipoDeComunicacao>(item?.tipo ?? "release");
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [texto, setTexto] = useState(item?.texto ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [ordem, setOrdem] = useState(item ? String(item.ordem) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerItemDaComunicacao({ tipo, titulo, texto, url, ordem });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = item
      ? await producao.from("producao_comunicacao").update(leitura.valor).eq("id", item.id)
      : await producao.from("producao_comunicacao").insert({ ...leitura.valor, organization_id: organizationId, data_id: dataId });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDaComunicacao(error)); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!item) return;
    confirmDelete({
      title: "Apagar item?",
      description: "O item sai do kit de imprensa deste dia.",
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_comunicacao").delete().eq("id", item.id);
        if (error) throw new Error("Não foi possível apagar o item.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={item ? "Editar item" : "Novo item"}
      onClose={onClose}
      footer={fechar => (
        <>
          {item && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : item ? "Salvar" : "Guardar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div>
            <span className={ROTULO}>Tipo</span>
            <Dropdown ariaLabel="Tipo" value={tipo} onChange={valor => setTipo(valor as TipoDeComunicacao)} disabled={salvando} options={TIPOS_DE_COMUNICACAO.map(valor => ({ value: valor, label: ROTULO_DA_COMUNICACAO[valor] }))} />
          </div>
          <div><label className={ROTULO} htmlFor="com-titulo">Título</label><input id="com-titulo" autoFocus className={CAMPO} value={titulo} maxLength={200} onChange={event => setTitulo(event.target.value)} disabled={salvando} placeholder="Release de estreia" /></div>
        </div>
        <div><label className={ROTULO} htmlFor="com-texto">Texto</label><textarea id="com-texto" rows={6} className={AREA} value={texto} maxLength={5000} onChange={event => setTexto(event.target.value)} disabled={salvando} placeholder="O release, como vai no e-mail." /></div>
        <div><label className={ROTULO} htmlFor="com-url">Endereço do material</label><input id="com-url" inputMode="url" className={CAMPO} value={url} maxLength={500} onChange={event => setUrl(event.target.value)} disabled={salvando} placeholder="https://…" /></div>
        <div className="w-32"><label className={ROTULO} htmlFor="com-ordem">Ordem</label><input id="com-ordem" inputMode="numeric" className={CAMPO} value={ordem} onChange={event => setOrdem(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="0" /></div>
      </div>
    </TopSheet>
  );
}

/** A comunicação de uma data (PD9.5): o kit de imprensa — release, artes, fotos e clipping — e o texto para copiar. */
export function ComunicacaoDaData({ organizationId, dataId, titulo, podeEditar }: { organizationId: string; dataId: string; titulo: string; podeEditar: boolean }) {
  const [itens, setItens] = useState<ItemDaComunicacao[] | null>(null);
  const [folha, setFolha] = useState<{ item: ItemDaComunicacao | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_comunicacao")
        .select("id, tipo, titulo, texto, url, ordem").eq("data_id", dataId);
      if (!ativo) return;
      setItens(data ?? []);
      setErro(error ? "Não foi possível carregar a comunicação. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [dataId, versao]);

  const ordenados = useMemo(() => ordenarComunicacao(itens ?? []), [itens]);
  const kit = useMemo(() => kitDeImprensa(titulo, ordenados), [titulo, ordenados]);

  async function copiarKit() {
    if (!kit) return;
    try {
      await navigator.clipboard.writeText(kit);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setErro("Não foi possível copiar. Selecione o texto à mão.");
    }
  }

  return (
    <section aria-labelledby="comunicacao" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="comunicacao" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Comunicação</h2>
        <div className="flex items-center gap-2">
          {kit && <button type="button" onClick={() => void copiarKit()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar kit"}</button>}
          {podeEditar && <button type="button" onClick={() => setFolha({ item: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Novo item</button>}
        </div>
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {itens === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : ordenados.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhum material deste dia</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Guarde o release, as artes, as fotos e o clipping para mandar a quem divulga.</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {ordenados.map(item => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3">
              <span className="w-8 shrink-0 pt-0.5 text-[0.6875rem] tabular-nums text-black/35" title="Ordem">{item.ordem}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] font-medium text-[#282525]">{item.titulo}</span>
                <span className="mt-0.5 block text-[0.6875rem] text-black/45">{ROTULO_DA_COMUNICACAO[item.tipo]}</span>
                {item.texto && <span className="mt-1 block whitespace-pre-line text-[0.75rem] text-black/65">{item.texto}</span>}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-[0.75rem] text-[#7259B5] underline-offset-2 hover:underline">
                    {item.url} <ExternalLink size={11} aria-hidden="true" />
                  </a>
                )}
              </span>
              {podeEditar && (
                <button type="button" onClick={() => setFolha({ item })} aria-label={`Editar ${item.titulo}`} title="Editar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {folha && <ItemSheet organizationId={organizationId} dataId={dataId} item={folha.item} onClose={() => setFolha(null)} onSaved={() => { setFolha(null); setVersao(atual => atual + 1); }} />}
    </section>
  );
}
