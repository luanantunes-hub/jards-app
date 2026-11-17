"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { BOTAO, CANCELAR, Erro } from "@/components/producao/estilosDoBordero";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import { retornoDaMarca, textoDoRetorno, type BorderoDoRetorno, type LeituraDoRetorno, type SessaoDoRetorno } from "@/lib/producao/retorno-marca";

const numero = (n: number) => n.toLocaleString("pt-BR");
const hojeEmBrasilia = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function Indicador({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div>
      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</p>
      <p className={`mt-1 text-[1.25rem] font-semibold tabular-nums ${valor === "0" ? "text-black/30" : "text-[#282525]"}`}>{valor}</p>
      {apoio && <p className="mt-0.5 text-[0.6875rem] text-black/45">{apoio}</p>}
    </div>
  );
}

/** O retorno de uma marca (PD9.3, primeiro corte): as sessões que ela apresentou, o público e as entradas com credencial, só para a produção, com o texto para colar numa mensagem ao patrocinador. */
export function RetornoDaMarcaSheet({ marca, onClose }: { marca: { id: string; nome: string }; onClose: () => void }) {
  const [dados, setDados] = useState<{ sessoes: SessaoDoRetorno[]; borderos: BorderoDoRetorno[]; leituras: LeituraDoRetorno[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const { data: lidas, error } = await producao.from("producao_sessoes").select("id, dia, titulo, pauta_id").eq("marca_id", marca.id);
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar o retorno. Recarregue a página."); setDados({ sessoes: [], borderos: [], leituras: [] }); return; }
      const ids = (lidas ?? []).map(sessao => sessao.id);
      const pautaIds = [...new Set((lidas ?? []).map(sessao => sessao.pauta_id))];
      const [pautas, borderos, leituras] = await Promise.all([
        pautaIds.length > 0 ? producao.from("producao_pautas").select("id, titulo").in("id", pautaIds) : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
        ids.length > 0 ? producao.from("producao_borderos").select("sessao_id, publico_casa").in("sessao_id", ids) : Promise.resolve({ data: [] as BorderoDoRetorno[] }),
        ids.length > 0 ? producao.from("producao_porta_leituras").select("sessao_id, resultado").in("sessao_id", ids) : Promise.resolve({ data: [] as LeituraDoRetorno[] }),
      ]);
      if (!ativo) return;
      const titulos = new Map((pautas.data ?? []).map(pauta => [pauta.id, pauta.titulo]));
      setDados({
        sessoes: (lidas ?? []).map(sessao => ({ id: sessao.id, dia: sessao.dia, titulo: sessao.titulo?.trim() || titulos.get(sessao.pauta_id) || "Sessão" })),
        borderos: (borderos.data ?? []) as BorderoDoRetorno[],
        leituras: (leituras.data ?? []) as LeituraDoRetorno[],
      });
    })();
    return () => { ativo = false; };
  }, [marca.id]);

  const retorno = useMemo(() => (dados ? retornoDaMarca(dados.sessoes, dados.borderos, dados.leituras, hojeEmBrasilia()) : null), [dados]);

  async function copiar() {
    if (!retorno) return;
    try {
      await navigator.clipboard.writeText(textoDoRetorno(marca.nome, retorno));
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Tente de novo.");
    }
  }

  return (
    <TopSheet
      titulo={`Retorno: ${marca.nome}`}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>
          {retorno && retorno.sessoes > 0 && <button type="button" onClick={() => void copiar()} className={BOTAO}>{copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copiado ? "Texto copiado" : "Copiar texto"}</button>}
        </>
      )}
    >
      <div className="space-y-5">
        {erro && <Erro texto={erro} />}
        {retorno === null ? (
          <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : retorno.sessoes === 0 ? (
          <p className="text-[0.8125rem] text-black/55">Esta marca ainda não apresentou nenhuma sessão. Escolha a marca na sessão da programação para ela aparecer aqui.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <Indicador rotulo="Sessões" valor={numero(retorno.sessoes)} apoio={`${numero(retorno.realizadas)} já ${retorno.realizadas === 1 ? "realizada" : "realizadas"}, ${numero(retorno.proximas)} por vir`} />
              <Indicador rotulo="Público" valor={numero(retorno.publico)} apoio={retorno.semPublico > 0 ? `${numero(retorno.semPublico)} ${retorno.semPublico === 1 ? "sessão sem público informado" : "sessões sem público informado"}` : retorno.comPublico > 0 ? "das sessões realizadas" : undefined} />
              <Indicador rotulo="Entradas com credencial" valor={numero(retorno.entradasPelaPorta)} />
            </div>
            <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              {retorno.linhas.map(linha => (
                <li key={linha.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
                  <span className="w-16 shrink-0 text-[0.75rem] tabular-nums text-black/55">{diaEMes(linha.dia)}</span>
                  <span className="min-w-0 flex-1 basis-40 truncate text-[0.8125rem] text-[#282525]">{linha.titulo}</span>
                  <span className="text-[0.75rem] tabular-nums text-black/55">
                    {!linha.aconteceu ? "por vir" : linha.publico !== null ? `${numero(linha.publico)} ${linha.publico === 1 ? "pessoa" : "pessoas"}` : "sem público informado"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </TopSheet>
  );
}
