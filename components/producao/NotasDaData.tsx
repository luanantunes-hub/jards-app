"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { TopSheet } from "@/components/ui/TopSheet";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";

type Nota = { id: string; texto: string; created_at: string };

const CAMPO = "w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";

function quando(instante: string): string {
  return new Date(instante).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function NovaNotaSheet({ organizationId, dataId, onClose, onCreated }: { organizationId: string; dataId: string; onClose: () => void; onCreated: () => void }) {
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const limpo = texto.trim();
    if (limpo === "") { setErro("Escreva a nota."); return; }
    if (limpo.length > 4000) { setErro("A nota pode ter até 4.000 letras."); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_notas").insert({ organization_id: organizationId, data_id: dataId, texto: limpo });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode criar notas aqui." : "Não foi possível guardar. Tente de novo."); return; }
    onCreated();
    fechar();
  }

  return (
    <TopSheet
      titulo="Nova nota"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Guardando…" : "Guardar nota"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label htmlFor="nota-texto" className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Nota</label>
          <textarea id="nota-texto" autoFocus rows={6} className={CAMPO} value={texto} onChange={event => setTexto(event.target.value)} placeholder="O contratante pediu o rider até sexta" maxLength={4000} disabled={salvando} />
          <p className="mt-1.5 text-[0.6875rem] text-black/45">Só a sua equipe de produção vê. Não aparece na folha do dia.</p>
        </div>
      </div>
    </TopSheet>
  );
}

/** As notas da data (PD1.6): combinados, lembretes e o que o contratante pediu. Internas; não entram na folha da equipe. */
export function NotasDaData({ organizationId, dataId, podeEditar }: { organizationId: string; dataId: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_notas")
        .select("id, texto, created_at").eq("data_id", dataId).order("created_at", { ascending: false });
      if (!ativo) return;
      setNotas((data ?? []) as Nota[]);
      setErro(error ? "Não foi possível carregar as notas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [dataId, versao]);

  function apagar(nota: Nota) {
    confirmDelete({
      title: "Apagar nota?",
      description: "A nota sai desta data.",
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_notas").delete().eq("id", nota.id);
        if (error) throw new Error("Não foi possível apagar a nota.");
        recarregar();
      },
    });
  }

  const botao = podeEditar && <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Nova nota</PrimaryListAction>;

  return (
    <section aria-labelledby="notas-da-data" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="notas-da-data" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Notas</h2>
        {notas !== null && notas.length > 0 && botao}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {notas === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : notas.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma nota nesta data</p>
          {podeEditar && <div className="mt-4 flex justify-center">{botao}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <ul className="divide-y divide-black/[.06]">
            {notas.map(nota => (
              <li key={nota.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-[0.8125rem] text-[#282525]">{nota.texto}</p>
                  <p className="mt-1 text-[0.6875rem] tabular-nums text-black/45">{quando(nota.created_at)}</p>
                </div>
                {podeEditar && (
                  <button type="button" onClick={() => apagar(nota)} aria-label="Apagar nota" title="Apagar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {folha && <NovaNotaSheet organizationId={organizationId} dataId={dataId} onClose={() => setFolha(false)} onCreated={recarregar} />}
    </section>
  );
}
