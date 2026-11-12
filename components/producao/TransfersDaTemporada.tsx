"use client";

import { useEffect, useMemo, useState } from "react";
import { Bus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import { horaLocalParaInstante } from "@/lib/producao/dia";
import { agruparTransfers, camposDoTransfer, dataDoTransfer, hotelDoDia, JANELA_DO_TRANSFER_MIN, rotuloDoGrupo, transferJaCriado, type GrupoDeTransfer } from "@/lib/producao/transfers";
import type { RespostaDoConvite } from "@/lib/producao/estados";

type ConviteParaTransfer = {
  pessoa_id: string; resposta: RespostaDoConvite; chegada_dia: string | null; chegada_hora: string | null; saida_dia: string | null; saida_hora: string | null;
};
type DataDaTemporada = { id: string; data: string; fuso: string };

const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

/**
 * Os transfers sugeridos (PD6.10): quem respondeu "vou" no convite, agrupado por chegada e por saída em horários próximos. Cada grupo
 * vira um deslocamento de van, com as pessoas como passageiras, na data da produção do mesmo dia (ou a mais próxima). Motorista e
 * veículo a produção escolhe depois, no deslocamento.
 */
export function TransfersDaTemporada({ organizationId, temporadaId, convites, nomes, podeEditar }: {
  organizationId: string; temporadaId: string; convites: ConviteParaTransfer[]; nomes: ReadonlyMap<string, string>; podeEditar: boolean;
}) {
  const [datas, setDatas] = useState<DataDaTemporada[] | null>(null);
  const [hospedagens, setHospedagens] = useState<{ hotel: string; entrada: string | null; saida: string | null }[]>([]);
  const [deslocamentos, setDeslocamentos] = useState<{ id: string; data_id: string; origem: string | null; destino: string | null }[]>([]);
  const [passageiros, setPassageiros] = useState<Map<string, string[]>>(new Map());
  const [criando, setCriando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [dat, hos] = await Promise.all([
        producao.from("producao_datas").select("id, data, fuso").eq("temporada_id", temporadaId).order("data"),
        producao.from("producao_hospedagens").select("hotel, entrada, saida").eq("temporada_id", temporadaId).order("entrada", { nullsFirst: false }),
      ]);
      const ids = (dat.data ?? []).map(item => item.id);
      const des = ids.length > 0 ? await producao.from("producao_deslocamentos").select("id, data_id, origem, destino").in("data_id", ids) : { data: [] as { id: string; data_id: string; origem: string | null; destino: string | null }[] };
      const idsDes = (des.data ?? []).map(item => item.id);
      const pas = idsDes.length > 0 ? await producao.from("producao_deslocamento_pessoas").select("deslocamento_id, pessoa_id").in("deslocamento_id", idsDes) : { data: [] as { deslocamento_id: string; pessoa_id: string }[] };
      if (!ativo) return;
      const mapa = new Map<string, string[]>();
      for (const linha of pas.data ?? []) mapa.set(linha.deslocamento_id, [...(mapa.get(linha.deslocamento_id) ?? []), linha.pessoa_id]);
      setDatas(dat.data ?? []);
      setHospedagens(hos.data ?? []);
      setDeslocamentos(des.data ?? []);
      setPassageiros(mapa);
    })();
    return () => { ativo = false; };
  }, [temporadaId, versao]);

  const grupos = useMemo(() => {
    const quemVai = convites.filter(convite => convite.resposta === "vou");
    const chegadas = agruparTransfers(quemVai.map(convite => ({ pessoa_id: convite.pessoa_id, nome: nomes.get(convite.pessoa_id) ?? "Pessoa", dia: convite.chegada_dia, hora: convite.chegada_hora?.slice(0, 5) ?? null })), "chegada");
    const saidas = agruparTransfers(quemVai.map(convite => ({ pessoa_id: convite.pessoa_id, nome: nomes.get(convite.pessoa_id) ?? "Pessoa", dia: convite.saida_dia, hora: convite.saida_hora?.slice(0, 5) ?? null })), "saida");
    return [...chegadas, ...saidas]
      .filter(grupo => !transferJaCriado(grupo, deslocamentos, passageiros))
      .sort((a, b) => a.dia.localeCompare(b.dia) || (a.de ?? "99").localeCompare(b.de ?? "99") || (a.tipo === b.tipo ? 0 : a.tipo === "chegada" ? -1 : 1));
  }, [convites, nomes, deslocamentos, passageiros]);

  async function criar(grupo: GrupoDeTransfer, chave: string) {
    if (!datas) return;
    const data = dataDoTransfer(grupo.dia, datas);
    if (!data) { setErro("A temporada ainda não tem nenhuma data. Crie uma data para receber o transfer."); return; }
    setCriando(chave);
    setErro(null);
    const campos = camposDoTransfer(grupo, hotelDoDia(grupo.dia, hospedagens));
    const producao = clienteDaProducao(createClient());
    const { data: criado, error } = await producao.from("producao_deslocamentos").insert({
      organization_id: organizationId, data_id: data.id, tipo: "van", origem: campos.origem, destino: campos.destino,
      saida: campos.hora ? horaLocalParaInstante(grupo.dia, campos.hora, data.fuso) : null,
    }).select("id").single();
    if (error || !criado) { setCriando(null); setErro(error?.code === "42501" ? "Você não pode criar deslocamentos aqui." : "Não foi possível criar o transfer. Tente de novo."); return; }
    const { error: erroPessoas } = await producao.from("producao_deslocamento_pessoas").insert(grupo.pessoas.map(pessoa => ({ organization_id: organizationId, deslocamento_id: criado.id, pessoa_id: pessoa.id })));
    setCriando(null);
    if (erroPessoas) setErro("O deslocamento foi criado, mas não foi possível pôr as pessoas nele. Abra o deslocamento na data para tentar de novo.");
    setVersao(atual => atual + 1);
  }

  if (datas === null || (grupos.length === 0 && !erro)) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Transfers sugeridos</h3>
      {erro && <p role="alert" className="mb-2 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {grupos.map(grupo => {
          const chave = `${grupo.tipo}-${grupo.dia}-${grupo.de ?? "sem"}`;
          const data = dataDoTransfer(grupo.dia, datas);
          return (
            <li key={chave} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="min-w-0 flex-1 basis-64">
                <span className="block text-[0.8125rem] font-medium text-[#282525]">{rotuloDoGrupo(grupo)}</span>
                <span className="block text-[0.6875rem] text-black/45">{grupo.pessoas.map(pessoa => pessoa.nome).join(", ")}</span>
                <span className="block text-[0.6875rem] text-black/40">{data ? `Vai para a data de ${diaEMes(data.data)}.` : "A temporada não tem datas."}</span>
              </span>
              {podeEditar && data && (
                <button type="button" onClick={() => void criar(grupo, chave)} disabled={criando !== null} className={BOTAO}><Bus size={13} aria-hidden="true" /> {criando === chave ? "Criando…" : "Criar deslocamento"}</button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[0.6875rem] text-black/40">Cada grupo reúne quem chega (ou sai) com até {JANELA_DO_TRANSFER_MIN} minutos de diferença. O motorista e o veículo você escolhe depois, no deslocamento.</p>
    </div>
  );
}
