"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, X } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Erro } from "@/components/producao/estilosDoBordero";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import {
  equipamentoDaSala, equipamentoSugerido, listaDoQueLevar, soOQueLevar, textoDoQueLevar, type EquipamentoDaCasa, type LigacaoDaLinha, type LinhaDoRider,
} from "@/lib/producao/levar";

type LigacaoComId = LigacaoDaLinha & { id: string };

const ROTULO_DO_ESTADO: Record<string, string> = { manutencao: "em manutenção", avariado: "avariado", baixado: "baixado" };

/**
 * O que levar para uma sala (PD4.4): cada linha do rider diz se a casa atende. Quem liga a linha ao equipamento da casa é a pessoa (o Jards só sugere o mais parecido);
 * a linha sem equipamento em uso na sala, ou com menos unidades do que pede, entra na lista. Trocar a sala muda a lista.
 */
export function ListaDoQueLevar({ organizationId, riderId, salaId, salaNome, podeEditar, semTitulo = false }: { organizationId: string; riderId: string; salaId: string; salaNome: string; podeEditar: boolean; semTitulo?: boolean }) {
  const [espacoId, setEspacoId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaDoRider[] | null>(null);
  const [equipamentos, setEquipamentos] = useState<EquipamentoDaCasa[]>([]);
  const [ligacoes, setLigacoes] = useState<LigacaoComId[]>([]);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const sala = await producao.from("producao_salas").select("espaco_id").eq("id", salaId).maybeSingle();
      const espaco = sala.data?.espaco_id ?? null;
      const [itens, equipamentosDoEspaco] = await Promise.all([
        producao.from("producao_rider_itens").select("id, secao, texto, quantidade, obrigatorio, ordem").eq("rider_id", riderId).order("ordem").order("created_at"),
        espaco ? producao.from("producao_equipamentos").select("id, nome, categoria, quantidade, estado, sala_id, espaco_id").eq("espaco_id", espaco) : Promise.resolve({ data: [], error: null }),
      ]);
      const ids = (itens.data ?? []).map(item => item.id);
      const lig = ids.length > 0 ? await producao.from("producao_rider_item_equipamentos").select("id, rider_item_id, equipamento_id").in("rider_item_id", ids) : { data: [], error: null };
      if (!ativo) return;
      setEspacoId(espaco);
      setLinhas((itens.data ?? []) as LinhaDoRider[]);
      setEquipamentos((equipamentosDoEspaco.data ?? []) as EquipamentoDaCasa[]);
      setLigacoes((lig.data ?? []) as LigacaoComId[]);
      setErro(sala.error || itens.error || equipamentosDoEspaco.error || lig.error ? "Não foi possível montar a lista. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [riderId, salaId, versao]);

  const daSala = useMemo(() => (espacoId ? equipamentos.filter(item => equipamentoDaSala(item, salaId, espacoId)) : []), [equipamentos, salaId, espacoId]);
  const lista = useMemo(() => (linhas && espacoId ? listaDoQueLevar(linhas, ligacoes, equipamentos, salaId, espacoId) : []), [linhas, ligacoes, equipamentos, salaId, espacoId]);
  const aLevar = useMemo(() => soOQueLevar(lista), [lista]);
  const mudou = () => setVersao(atual => atual + 1);

  async function ligar(linhaId: string, equipamentoId: string) {
    if (equipamentoId === "") return;
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_rider_item_equipamentos").insert({ organization_id: organizationId, rider_item_id: linhaId, equipamento_id: equipamentoId });
    setTrabalhando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode ligar equipamentos a este rider." : "Não foi possível ligar. Tente de novo."); return; }
    mudou();
  }

  async function desligar(linhaId: string, equipamentoId: string) {
    const ligacao = ligacoes.find(item => item.rider_item_id === linhaId && item.equipamento_id === equipamentoId);
    if (!ligacao) return;
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_rider_item_equipamentos").delete().eq("id", ligacao.id);
    setTrabalhando(false);
    if (error) { setErro("Não foi possível tirar a ligação. Tente de novo."); return; }
    mudou();
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(textoDoQueLevar(salaNome, lista)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  if (linhas === null) return <div className="mt-4 h-16 rounded bg-black/[.03] motion-safe:animate-pulse" />;
  if (linhas.length === 0) return null;

  return (
    <div className={semTitulo ? "" : "mt-6"}>
      <div className={`mb-2 flex flex-wrap items-center gap-3 ${semTitulo ? "justify-end" : "justify-between"}`}>
        {!semTitulo && <h3 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">O que levar</h3>}
        <button type="button" onClick={() => void copiar()} className="flex h-8 items-center gap-1.5 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Copy size={11} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar a lista"}</button>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      <p className="mb-2 text-[0.75rem] tabular-nums text-black/55">{aLevar.length === 0 ? "A casa atende todo o rider." : `${aLevar.length} ${aLevar.length === 1 ? "linha" : "linhas"} para levar.`}</p>
      <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {lista.map(item => {
          const ligadosIds = new Set(item.ligados.map(ligado => ligado.id));
          const sugerido = equipamentoSugerido(item.linha.texto, daSala.filter(equipamento => !ligadosIds.has(equipamento.id)));
          const opcoes = daSala.filter(equipamento => !ligadosIds.has(equipamento.id))
            .map(equipamento => ({ value: equipamento.id, label: `${equipamento.nome} · ${equipamento.quantidade} un.${ROTULO_DO_ESTADO[equipamento.estado] ? ` (${ROTULO_DO_ESTADO[equipamento.estado]})` : ""}${equipamento.id === sugerido ? " · sugerido" : ""}`, sugerido: equipamento.id === sugerido }))
            .sort((a, b) => Number(b.sugerido) - Number(a.sugerido));
          const atendida = item.situacao === "atendida";
          return (
            <li key={item.linha.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 flex-1 basis-56 text-[0.8125rem] text-[#282525]"><span className="font-medium">{item.linha.quantidade ? `${item.linha.quantidade}× ` : ""}{item.linha.texto}</span>{item.linha.obrigatorio ? "" : <span className="text-black/45"> · opcional</span>}</p>
                <span className={`rounded border px-2 py-1 text-[0.6875rem] font-medium ${atendida ? "text-black/55" : ""}`} style={atendida ? { borderColor: "rgba(13,13,13,.15)" } : { borderColor: "#B07A1447", color: "#B07A14" }}>
                  {atendida ? "A casa atende" : item.situacao === "parcial" ? `Levar ${item.levar} (a casa tem ${item.oferece})` : `Levar ${item.levar}`}
                </span>
              </div>
              {item.ligados.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {item.ligados.map(ligado => (
                    <li key={ligado.id} className="flex items-center gap-1 rounded border bg-white py-0.5 pl-2.5 pr-0.5 text-[0.75rem] text-[#282525]" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                      {ligado.nome} · {ligado.quantidade} un.{ligado.conta ? "" : ` (não conta: ${ROTULO_DO_ESTADO[equipamentos.find(equipamento => equipamento.id === ligado.id)?.estado ?? ""] ?? "fora de uso"})`}
                      {podeEditar && <button type="button" disabled={trabalhando} onClick={() => void desligar(item.linha.id, ligado.id)} aria-label={`Tirar ${ligado.nome} desta linha`} title="Tirar a ligação" className="flex h-6 w-6 items-center justify-center rounded text-black/40 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><X size={12} aria-hidden="true" /></button>}
                    </li>
                  ))}
                </ul>
              )}
              {podeEditar && opcoes.length > 0 && (
                <div className="mt-2 max-w-sm">
                  <Dropdown ariaLabel={`A casa atende "${item.linha.texto}" com`} value="" disabled={trabalhando} onChange={valor => void ligar(item.linha.id, valor)}
                    options={[{ value: "", label: "A casa atende com…" }, ...opcoes.map(({ value, label }) => ({ value, label }))]} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {daSala.length === 0 && <p className="mt-2 text-[0.75rem] text-black/45">Esta sala ainda não tem equipamentos. Cadastre em Espaços e tudo o que o rider pede entra na lista.</p>}
    </div>
  );
}
