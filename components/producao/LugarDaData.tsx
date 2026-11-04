"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";

type Espaco = { id: string; nome: string; uf: string | null };
type Sala = { id: string; espaco_id: string; nome: string };

/**
 * O lugar da data (PD1.6): o espaço e a sala. Escolher o espaço sem a sala vale; trocar o espaço limpa a sala
 * (o banco recusa uma sala de outro espaço). Os espaços se cadastram em /producoes/espacos.
 */
export function LugarDaData({ organizationId, dataId, podeEditar }: { organizationId: string; dataId: string; podeEditar: boolean }) {
  const [espacos, setEspacos] = useState<Espaco[] | null>(null);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [espacoId, setEspacoId] = useState("");
  const [salaId, setSalaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [esp, sal, dat] = await Promise.all([
        producao.from("producao_espacos").select("id, nome, uf").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
        producao.from("producao_salas").select("id, espaco_id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
        producao.from("producao_datas").select("espaco_id, sala_id").eq("id", dataId).maybeSingle(),
      ]);
      if (!ativo) return;
      setEspacos((esp.data ?? []) as Espaco[]);
      setSalas((sal.data ?? []) as Sala[]);
      setEspacoId(dat.data?.espaco_id ?? "");
      setSalaId(dat.data?.sala_id ?? "");
      setErro(esp.error || sal.error || dat.error ? "Não foi possível carregar o lugar. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, dataId]);

  async function gravar(novoEspaco: string, novaSala: string) {
    setErro(null);
    const anterior = { espacoId, salaId };
    setEspacoId(novoEspaco);
    setSalaId(novaSala);
    const { error } = await clienteDaProducao(createClient()).from("producao_datas")
      .update({ espaco_id: novoEspaco || null, sala_id: novaSala || null }).eq("id", dataId);
    if (error) { setEspacoId(anterior.espacoId); setSalaId(anterior.salaId); setErro("Não foi possível mudar o lugar. Tente de novo."); }
  }

  if (espacos === null) return null;
  const salasDoEspaco = salas.filter(sala => sala.espaco_id === espacoId);
  const espacoAtual = espacos.find(espaco => espaco.id === espacoId);

  if (!podeEditar) {
    if (!espacoAtual) return null;
    const salaAtual = salas.find(sala => sala.id === salaId);
    return <p className="flex items-center gap-1.5 text-[0.75rem] text-black/55"><MapPin size={13} aria-hidden="true" className="text-black/40" /> {[espacoAtual.nome, salaAtual?.nome].filter(Boolean).join(" · ")}</p>;
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-[16rem]">
          <span className="mb-1.5 flex items-center gap-1.5 text-[0.6875rem] font-medium text-black/55"><MapPin size={12} aria-hidden="true" /> Espaço</span>
          <Dropdown value={espacoId} onChange={valor => void gravar(valor, "")} options={[{ value: "", label: "Sem espaço" }, ...espacos.map(espaco => ({ value: espaco.id, label: espaco.uf ? `${espaco.nome} · ${espaco.uf}` : espaco.nome }))]} />
        </div>
        {salasDoEspaco.length > 0 && (
          <div className="w-full max-w-[14rem]">
            <span className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Sala</span>
            <Dropdown value={salaId} onChange={valor => void gravar(espacoId, valor)} options={[{ value: "", label: "Sem sala" }, ...salasDoEspaco.map(sala => ({ value: sala.id, label: sala.nome }))]} />
          </div>
        )}
        {espacos.length === 0 && <Link href="/producoes/espacos" className="text-[0.75rem] font-medium text-black/55 underline underline-offset-2 hover:text-black/75">Cadastrar um espaço</Link>}
      </div>
      {erro && <p role="alert" className="mt-2 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
    </div>
  );
}
