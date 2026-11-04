"use client";

import { useEffect, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import { copiarBlocosParaOutroDia, type BlocoParaCopiar } from "@/lib/producao/copiar-dia";

type Destino = { id: string; data: string; fuso: string; blocos: number };

/**
 * Copiar o dia para outras datas da mesma temporada: leva os blocos na mesma hora do lugar, sem a confirmação e sem a
 * sala. Datas que já têm blocos mostram quantos têm; os novos entram junto, depois dos que existem.
 */
export function CopiarDiaSheet({ organizationId, temporadaId, dataId, dia, fuso, onClose, onCopied }: {
  organizationId: string; temporadaId: string; dataId: string; dia: string; fuso: string; onClose: () => void; onCopied: () => void;
}) {
  const [destinos, setDestinos] = useState<Destino[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [copiando, setCopiando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [datas, blocos] = await Promise.all([
        producao.from("producao_datas").select("id, data, fuso").eq("temporada_id", temporadaId).neq("id", dataId).order("data"),
        producao.from("producao_blocos").select("data_id").eq("organization_id", organizationId),
      ]);
      if (!ativo) return;
      if (datas.error) { setErro("Não foi possível carregar as datas. Tente de novo."); setDestinos([]); return; }
      const contagem = new Map<string, number>();
      for (const linha of blocos.data ?? []) contagem.set(linha.data_id, (contagem.get(linha.data_id) ?? 0) + 1);
      setDestinos((datas.data ?? []).map(linha => ({ id: linha.id, data: linha.data, fuso: linha.fuso, blocos: contagem.get(linha.id) ?? 0 })));
    })();
    return () => { ativo = false; };
  }, [organizationId, temporadaId, dataId]);

  function alternar(id: string) {
    setMarcadas(atual => { const novo = new Set(atual); if (novo.has(id)) novo.delete(id); else novo.add(id); return novo; });
  }

  async function copiar(fechar: () => void) {
    if (marcadas.size === 0 || !destinos) { setErro("Escolha pelo menos uma data."); return; }
    setCopiando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const origem = await producao.from("producao_blocos")
      .select("inicio, fim, exibicao, tipo, titulo, visivel_para, capacidade, ordem, notas").eq("data_id", dataId);
    if (origem.error || !origem.data || origem.data.length === 0) { setCopiando(false); setErro("Esta data não tem blocos para copiar."); return; }
    const linhas = destinos.filter(destino => marcadas.has(destino.id)).flatMap(destino =>
      copiarBlocosParaOutroDia(origem.data as BlocoParaCopiar[], dia, fuso, destino.data, destino.fuso)
        .map(bloco => ({ ...bloco, organization_id: organizationId, data_id: destino.id, ordem: bloco.ordem + destino.blocos })));
    const { error } = await producao.from("producao_blocos").insert(linhas);
    setCopiando(false);
    if (error) { setErro("Não foi possível copiar. Nada foi gravado; tente de novo."); return; }
    onCopied();
    fechar();
  }

  return (
    <TopSheet
      titulo="Copiar o dia para outras datas"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={copiando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void copiar(fechar)} disabled={copiando || marcadas.size === 0} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{copiando ? "Copiando…" : `Copiar para ${marcadas.size || ""} ${marcadas.size === 1 ? "data" : "datas"}`.replace("  ", " ")}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <p className="text-[0.75rem] text-black/55">Os blocos vão na mesma hora do lugar, sem a confirmação e sem a sala.</p>
        {destinos === null ? (
          <div className="h-20 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : destinos.length === 0 ? (
          <p className="text-[0.8125rem] text-black/45">Esta temporada não tem outras datas.</p>
        ) : (
          <ul className="divide-y divide-black/[.06] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {destinos.map(destino => (
              <li key={destino.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-black/[.02]">
                  <input type="checkbox" checked={marcadas.has(destino.id)} onChange={() => alternar(destino.id)} disabled={copiando} className="h-4 w-4 accent-[#7259B5]" />
                  <span className="flex-1 text-[0.8125rem] text-[#282525]">{diaEMes(destino.data)}</span>
                  <span className="text-[0.6875rem] text-black/45">{destino.blocos === 0 ? "sem blocos" : `${destino.blocos} ${destino.blocos === 1 ? "bloco" : "blocos"}`}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TopSheet>
  );
}
