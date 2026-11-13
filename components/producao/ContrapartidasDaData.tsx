"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import {
  jaViraTarefa, mensagemDoErroDeContrapartida, ordenarContrapartidas, resumoDasContrapartidas, rotuloDaCategoriaDaContrapartida, ROTULO_DO_STATUS_DA_CONTRAPARTIDA, tarefaDaContrapartida,
  type ContrapartidaDaData,
} from "@/lib/producao/contrapartidas";

const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

type Candidata = ContrapartidaDaData;

// O tipo gerado do cliente não aceita atualizar compromissos_cliente (o resto do app usa um cast); aqui o cast é só da ligação com a data.
type LigacaoComADataDoCrm = { update: (valores: { producao_data_id: string | null }) => { eq: (coluna: "id", valor: string) => PromiseLike<{ error: { code?: string; message?: string } | null }> } };
const ligacaoDoCrm = () => (createClient() as unknown as { from: (tabela: "compromissos_cliente") => LigacaoComADataDoCrm }).from("compromissos_cliente");

function LigarSheet({ organizationId, dataId, onClose, onLigou }: { organizationId: string; dataId: string; onClose: () => void; onLigou: () => void }) {
  const [lista, setLista] = useState<Candidata[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ligando, setLigando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await createClient().from("compromissos_cliente").select("id, titulo, categoria, prazo, status")
        .eq("organization_id", organizationId).is("producao_data_id", null).neq("status", "cancelado").order("prazo", { ascending: true, nullsFirst: false }).limit(100);
      if (!ativo) return;
      setLista((data ?? []) as Candidata[]);
      setErro(error ? "Não foi possível carregar os compromissos. Tente de novo." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  async function ligar(compromisso: Candidata) {
    setLigando(compromisso.id);
    setErro(null);
    const { error } = await ligacaoDoCrm().update({ producao_data_id: dataId }).eq("id", compromisso.id);
    setLigando(null);
    if (error) { setErro(mensagemDoErroDeContrapartida(error)); return; }
    onLigou();
    onClose();
  }

  return (
    <TopSheet titulo="Ligar contrapartida a esta data" onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>}>
        <div className="space-y-3">
          {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
          <p className="text-[0.75rem] text-black/55">Compromissos dos patrocinadores que ainda não estão ligados a nenhuma data. Escolha o que se cumpre nesta data (o logo no palco, os convites, o relatório).</p>
          {lista === null ? (
            <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
          ) : lista.length === 0 ? (
            <p className="text-[0.8125rem] text-black/55">Não há compromissos livres para ligar.</p>
          ) : (
            <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              {lista.map(compromisso => (
                <li key={compromisso.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-[0.8125rem] text-[#282525]">{compromisso.titulo}</p>
                    <p className="truncate text-[0.6875rem] text-black/45">{rotuloDaCategoriaDaContrapartida(compromisso.categoria)}{compromisso.prazo ? ` · prazo ${diaEMes(compromisso.prazo)}` : ""}</p>
                  </div>
                  <button type="button" className={BOTAO_PEQUENO} disabled={ligando === compromisso.id} onClick={() => void ligar(compromisso)}>{ligando === compromisso.id ? "Ligando…" : "Ligar"}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
    </TopSheet>
  );
}

/**
 * As contrapartidas dos patrocinadores que se cumprem nesta data (PD9.1): ligadas a partir dos compromissos da Captação. A seção só aparece para
 * quem consegue ler compromissos (tem a Captação): quem só tem a Produção não vê nada do patrocinador, como o banco já garante.
 */
export function ContrapartidasDaData({ organizationId, dataId, podeEditar }: { organizationId: string; dataId: string; podeEditar: boolean }) {
  const [ligadas, setLigadas] = useState<ContrapartidaDaData[] | null>(null);
  const [existeAlgum, setExisteAlgum] = useState(false);
  const [titulosDasTarefas, setTitulosDasTarefas] = useState<string[]>([]);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const crm = createClient();
      const [lig, algum, tar] = await Promise.all([
        crm.from("compromissos_cliente").select("id, titulo, categoria, prazo, status").eq("organization_id", organizationId).eq("producao_data_id", dataId),
        crm.from("compromissos_cliente").select("id").eq("organization_id", organizationId).limit(1),
        clienteDaProducao(crm).from("producao_tarefas").select("titulo").eq("data_id", dataId),
      ]);
      if (!ativo) return;
      setLigadas((lig.data ?? []) as ContrapartidaDaData[]);
      setExisteAlgum((algum.data ?? []).length > 0);
      setTitulosDasTarefas((tar.data ?? []).map(linha => linha.titulo));
      setErro(lig.error ? "Não foi possível carregar as contrapartidas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, dataId, versao]);

  const ordenadas = useMemo(() => ordenarContrapartidas(ligadas ?? []), [ligadas]);
  const resumo = useMemo(() => resumoDasContrapartidas(ligadas ?? []), [ligadas]);
  const recarregar = () => setVersao(atual => atual + 1);

  async function desligar(compromisso: ContrapartidaDaData) {
    setTrabalhando(compromisso.id);
    setErro(null);
    const { error } = await ligacaoDoCrm().update({ producao_data_id: null }).eq("id", compromisso.id);
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeContrapartida(error)); return; }
    recarregar();
  }

  async function virarTarefa(compromisso: ContrapartidaDaData) {
    setTrabalhando(compromisso.id);
    setErro(null);
    const { titulo, prazo } = tarefaDaContrapartida(compromisso);
    const { error } = await clienteDaProducao(createClient()).from("producao_tarefas").insert({ organization_id: organizationId, data_id: dataId, titulo, prazo });
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeContrapartida(error)); return; }
    recarregar();
  }

  // Sem nada ligado e sem nenhum compromisso legível: quem não tem a Captação (ou a organização sem patrocinadores) não vê a seção.
  if (ligadas === null || (ligadas.length === 0 && !existeAlgum)) return null;

  return (
    <section aria-labelledby="contrapartidas" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="contrapartidas" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Contrapartidas dos patrocinadores</h2>
        {podeEditar && <button type="button" onClick={() => setFolha(true)} className={BOTAO}><Link2 size={13} aria-hidden="true" /> Ligar contrapartida</button>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {ordenadas.length === 0 ? (
        <p className="text-[0.75rem] text-black/45">Nenhuma contrapartida ligada a esta data.</p>
      ) : (
        <>
          <p className="mb-2 text-[0.75rem] tabular-nums text-black/55">{resumo.faltam} {resumo.faltam === 1 ? "falta cumprir" : "faltam cumprir"} · {resumo.cumpridas} {resumo.cumpridas === 1 ? "cumprida" : "cumpridas"}{resumo.atrasadas > 0 ? ` · ${resumo.atrasadas} ${resumo.atrasadas === 1 ? "atrasada" : "atrasadas"}` : ""}</p>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {ordenadas.map(compromisso => (
              <li key={compromisso.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                <div className="min-w-0 flex-1 basis-56">
                  <p className={`truncate text-[0.8125rem] ${compromisso.status === "cancelado" ? "text-black/40 line-through" : "font-medium text-[#282525]"}`}>{compromisso.titulo}</p>
                  <p className="truncate text-[0.6875rem] text-black/45">{rotuloDaCategoriaDaContrapartida(compromisso.categoria)}{compromisso.prazo ? ` · prazo ${diaEMes(compromisso.prazo)}` : ""}</p>
                </div>
                <span className={`w-24 text-[0.75rem] ${compromisso.status === "atrasado" ? "font-medium text-[#B23B3B]" : "text-black/65"}`}>{ROTULO_DO_STATUS_DA_CONTRAPARTIDA[compromisso.status]}</span>
                {podeEditar && (
                  <span className="flex gap-1.5">
                    {jaViraTarefa(compromisso, titulosDasTarefas)
                      ? <span className="flex h-8 items-center px-1 text-[0.6875rem] text-black/45">Já é tarefa</span>
                      : <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === compromisso.id} onClick={() => void virarTarefa(compromisso)}>Virar tarefa</button>}
                    <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === compromisso.id} onClick={() => void desligar(compromisso)}>Desligar</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {folha && <LigarSheet organizationId={organizationId} dataId={dataId} onClose={() => setFolha(false)} onLigou={recarregar} />}
    </section>
  );
}
