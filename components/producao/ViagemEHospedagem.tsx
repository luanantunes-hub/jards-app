"use client";

import { useEffect, useState } from "react";
import { BedDouble, Bus, Pencil, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { horarioDaEscala } from "@/lib/producao/escala";
import { instanteParaHoraLocal } from "@/lib/producao/dia";
import type { TipoDeCartaoDoDia } from "@/lib/producao/estados";

type Cartao = { id: string; tipo: TipoDeCartaoDoDia; titulo: string | null; inicio: string | null; fim: string | null; endereco: string | null; localizador: string | null; notas: string | null };

const TEXTOS: Record<TipoDeCartaoDoDia, { titulo: string; vazio: string; exemplo: string; inicio: string; fim: string; icone: typeof Bus }> = {
  viagem: { titulo: "Viagem do dia", vazio: "Van, voo ou ônibus do dia, com a saída e a chegada.", exemplo: "Van da companhia", inicio: "Saída", fim: "Chegada", icone: Bus },
  hospedagem: { titulo: "Hospedagem", vazio: "O hotel do dia, com a entrada e a saída.", exemplo: "Hotel Central", inicio: "Entrada", fim: "Saída", icone: BedDouble },
};
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/** A hora do lugar da data ("21:30") de um instante guardado, para o campo de hora. */
function horaDoCampo(instante: string | null, fuso: string): string {
  return instante ? instanteParaHoraLocal(instante, fuso).hora : "";
}

/** Um texto vazio vira nulo; senão, sem espaços nas pontas. */
const nulo = (texto: string) => (texto.trim() === "" ? null : texto.trim());

function CartaoSheet({ organizationId, dataId, dia, fuso, tipo, cartao, onClose, onSaved }: {
  organizationId: string; dataId: string; dia: string; fuso: string; tipo: TipoDeCartaoDoDia; cartao: Cartao | null; onClose: () => void; onSaved: () => void;
}) {
  const texto = TEXTOS[tipo];
  const [titulo, setTitulo] = useState(cartao?.titulo ?? "");
  const [inicio, setInicio] = useState(horaDoCampo(cartao?.inicio ?? null, fuso));
  const [fim, setFim] = useState(horaDoCampo(cartao?.fim ?? null, fuso));
  const [endereco, setEndereco] = useState(cartao?.endereco ?? "");
  const [localizador, setLocalizador] = useState(cartao?.localizador ?? "");
  const [notas, setNotas] = useState(cartao?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    if (fim && !inicio) { setErro(`Informe ${texto.inicio === "Saída" ? "a saída" : "a entrada"} antes do fim.`); return; }
    setSalvando(true);
    setErro(null);
    const horario = horarioDaEscala(dia, inicio, fim, fuso);
    const producao = clienteDaProducao(createClient());
    const valores = { titulo: nulo(titulo), inicio: horario.chamada, fim: horario.saida, endereco: nulo(endereco), localizador: nulo(localizador), notas: nulo(notas) };
    const { error } = cartao
      ? await producao.from("producao_cartoes_dia").update(valores).eq("id", cartao.id)
      : await producao.from("producao_cartoes_dia").insert({ ...valores, organization_id: organizationId, data_id: dataId, tipo });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode salvar este cartão." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  async function limpar(fechar: () => void) {
    if (!cartao) return;
    setSalvando(true);
    const { error } = await clienteDaProducao(createClient()).from("producao_cartoes_dia").delete().eq("id", cartao.id);
    setSalvando(false);
    if (error) { setErro("Não foi possível apagar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo={texto.titulo}
      onClose={onClose}
      footer={fechar => (
        <>
          {cartao && <button type="button" onClick={() => void limpar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">Apagar cartão</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : "Salvar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="cartao-titulo">Nome</label>
          <input id="cartao-titulo" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder={texto.exemplo} maxLength={200} disabled={salvando} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="cartao-inicio">{texto.inicio} (opcional)</label>
            <input id="cartao-inicio" type="time" className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="cartao-fim">{texto.fim} (opcional)</label>
            <input id="cartao-fim" type="time" className={CAMPO} value={fim} onChange={event => setFim(event.target.value)} disabled={salvando} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="cartao-endereco">Endereço (opcional)</label>
          <input id="cartao-endereco" className={CAMPO} value={endereco} onChange={event => setEndereco(event.target.value)} maxLength={300} disabled={salvando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="cartao-localizador">Localizador ou reserva (opcional)</label>
          <input id="cartao-localizador" className={CAMPO} value={localizador} onChange={event => setLocalizador(event.target.value)} maxLength={80} disabled={salvando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="cartao-notas">Notas (opcional)</label>
          <textarea id="cartao-notas" rows={3} className="w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={2000} disabled={salvando} />
        </div>
      </div>
    </TopSheet>
  );
}

/** Viagem e hospedagem do dia (PD1.8): um cartão simples de cada, que vai para a folha do dia. */
export function ViagemEHospedagem({ organizationId, data, podeEditar }: {
  organizationId: string;
  data: { id: string; data: string; fuso: string };
  podeEditar: boolean;
}) {
  const [cartoes, setCartoes] = useState<Cartao[] | null>(null);
  const [folha, setFolha] = useState<TipoDeCartaoDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: linhas, error } = await clienteDaProducao(createClient()).from("producao_cartoes_dia")
        .select("id, tipo, titulo, inicio, fim, endereco, localizador, notas").eq("data_id", data.id);
      if (!ativo) return;
      setCartoes((linhas ?? []) as Cartao[]);
      setErro(error ? "Não foi possível carregar a viagem e a hospedagem. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [data.id, versao]);

  return (
    <section aria-labelledby="viagem-e-hospedagem" className="mt-10">
      <h2 id="viagem-e-hospedagem" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Viagem e hospedagem</h2>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(["viagem", "hospedagem"] as const).map(tipo => {
          const texto = TEXTOS[tipo];
          const Icone = texto.icone;
          const cartao = cartoes?.find(item => item.tipo === tipo) ?? null;
          const inicio = horaDoCampo(cartao?.inicio ?? null, data.fuso);
          const fim = horaDoCampo(cartao?.fim ?? null, data.fuso);
          const linhas: [string, string | null][] = cartao ? [
            [texto.inicio, inicio || null], [texto.fim, fim || null], ["Endereço", cartao.endereco], ["Localizador", cartao.localizador], ["Notas", cartao.notas],
          ] : [];
          return (
            <div key={tipo} className="rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 text-[0.875rem] font-semibold text-[#282525]">
                  <Icone size={15} aria-hidden="true" className="shrink-0 text-black/40" />
                  <span className="truncate">{cartao?.titulo ?? texto.titulo}</span>
                </p>
                {podeEditar && cartao && (
                  <button type="button" onClick={() => setFolha(tipo)} aria-label={`Editar ${texto.titulo.toLocaleLowerCase("pt-BR")}`} title="Editar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /></button>
                )}
              </div>
              {cartoes === null ? (
                <div className="mt-3 h-12 rounded bg-black/[.02] motion-safe:animate-pulse" />
              ) : cartao ? (
                <dl className="mt-3 space-y-1.5 text-[0.75rem]">
                  {linhas.filter(([, valor]) => valor).map(([rotulo, valor]) => (
                    <div key={rotulo} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                      <dt className="text-black/45">{rotulo}</dt>
                      <dd className="break-words text-[#282525]">{valor}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="mt-2">
                  <p className="text-[0.75rem] text-black/45">{texto.vazio}</p>
                  {podeEditar && (
                    <button type="button" onClick={() => setFolha(tipo)} className="mt-3 flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]">
                      <Plus size={13} aria-hidden="true" /> Adicionar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {folha && (
        <CartaoSheet organizationId={organizationId} dataId={data.id} dia={data.data} fuso={data.fuso} tipo={folha} cartao={cartoes?.find(item => item.tipo === folha) ?? null}
          onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />
      )}
    </section>
  );
}
