"use client";

import { useEffect, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso } from "@/components/ticketeria/FolhasDosEventos";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import type { Bloco } from "@/lib/ticketeria/site";
import { avisoDeRestaurado, lerVersoes, linhasDasVersoes, mensagemDoErroDeRestaurar, quandoDaVersao, MAX_VERSOES_GUARDADAS, type VersaoDaLista } from "@/lib/ticketeria/versoes-site";

// A folha "Versões da página": as versões que já estiveram no ar (e os rascunhos guardados antes de restaurar), com Restaurar no rascunho. Desenho aprovado pelo dono em 20/11/2026.

const LINK = "rounded-xl text-[0.75rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

export function VersoesSheet({ paginaId, titulo, publicados, podeEditar, onClose, onRestaurado }: { paginaId: string; titulo: string; publicados: Bloco[] | null; podeEditar: boolean; onClose: () => void; onRestaurado: (aviso: string) => void }) {
  const [versoes, setVersoes] = useState<VersaoDaLista[] | "erro" | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_versoes").select("id, origem, blocos, created_at").eq("pagina_id", paginaId).order("created_at", { ascending: false }).limit(MAX_VERSOES_GUARDADAS);
      if (ativo) setVersoes(error ? "erro" : lerVersoes(data));
    })();
    return () => { ativo = false; };
  }, [paginaId]);

  async function restaurar(id: string, quando: string) {
    setTrabalhando(true);
    setErro(null);
    const { data, error } = await clienteDaTicketeria(createClient()).rpc("fn_ticketeria_site_restaurar_versao", { p_versao: id });
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeRestaurar(error)); return; }
    const guardado = Boolean(data && typeof data === "object" && (data as { guardado?: unknown }).guardado === true);
    onRestaurado(avisoDeRestaurado(quando, guardado));
    onClose();
  }

  const lista = Array.isArray(versoes) ? versoes : [];
  const linhas = linhasDasVersoes(lista, publicados);

  return (
    <TopSheet titulo="Versões da página" onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className="rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/55 transition hover:text-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Fechar</button>}>
      <div className="space-y-3">
        <p className="text-[0.75rem] text-black/55">{titulo} · volte a uma versão que já esteve no ar. Ficam as {MAX_VERSOES_GUARDADAS} mais recentes.</p>
        {erro && <Aviso texto={erro} />}
        {versoes === null && <p className="text-[0.8125rem] text-black/55">Carregando…</p>}
        {versoes === "erro" && <Aviso texto="Não foi possível carregar as versões. Tente de novo." />}
        {Array.isArray(versoes) && (linhas.length === 0
          ? <p className="text-[0.8125rem] text-black/55">Ainda não há versões: a primeira é guardada quando você publicar esta página.</p>
          : (
            <ul className="space-y-1.5">
              {linhas.map(l => {
                const quando = quandoDaVersao(lista.find(v => v.id === l.id)?.created_at ?? new Date().toISOString());
                return (
                  <li key={l.id} className={`rounded-xl border px-3 py-2 ${l.noAr ? "border-[#2E8932]/30" : "border-black/[.1]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="text-[0.8125rem] text-[#282525]">{l.titulo}</p><p className="mt-0.5 text-[0.6875rem] text-black/55">{l.subtitulo}</p></div>
                      {l.noAr
                        ? <span className="shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: "#2E893247", color: "#2E8932" }}>NO AR AGORA</span>
                        : podeEditar && confirmando !== l.id && <button type="button" onClick={() => { setErro(null); setConfirmando(l.id); }} disabled={trabalhando} className={`shrink-0 ${LINK}`}>Restaurar</button>}
                    </div>
                    {confirmando === l.id && (
                      <div className="mt-2 border-t border-black/[.08] pt-2">
                        <p className="text-[0.75rem] leading-relaxed text-black/70">Trocar o rascunho pela versão de <span className="text-[#282525]">{l.guardada ? l.titulo.replace("Rascunho guardado · ", "") : l.titulo.toLowerCase()}</span>? O que está no ar não muda até você publicar, e o rascunho de agora fica guardado nesta lista.</p>
                        <div className="mt-2 flex items-center justify-end gap-4">
                          <button type="button" onClick={() => setConfirmando(null)} disabled={trabalhando} className="text-[0.75rem] text-black/45 transition hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
                          <button type="button" onClick={() => void restaurar(l.id, quando)} disabled={trabalhando} className="rounded-xl bg-[#6450D2] px-3 py-1.5 text-[0.75rem] font-normal text-white transition hover:bg-[#5342BA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">{trabalhando ? "Restaurando…" : "Restaurar no rascunho"}</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
      </div>
    </TopSheet>
  );
}
