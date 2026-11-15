"use client";

import { useEffect, useState } from "react";
import { ListaDoQueLevar } from "@/components/producao/ListaDoQueLevar";
import { carregarQueLevarDaData, type QueLevarDaData as Dados } from "@/components/producao/carregarQueLevar";

/** O que levar numa data (PD4.4): a lista da sala da data para cada rider da obra. Trocar a sala da data troca a lista. Sem rider para a obra, a seção não aparece. */
export function QueLevarDaData({ organizationId, dataId, podeEditar }: { organizationId: string; dataId: string; podeEditar: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const lido = await carregarQueLevarDaData(dataId);
      if (ativo) setDados(lido);
    })();
    return () => { ativo = false; };
  }, [dataId]);

  if (dados === null || dados.obraId === null) return null;
  // Sem rider ligado à obra: o recurso não está em uso nesta data. Sem sala: a lista não tem contra o que comparar.
  if (dados.salaId !== null && dados.riders.length === 0) return null;

  return (
    <section aria-labelledby="que-levar-da-data" className="mt-10">
      <h2 id="que-levar-da-data" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">O que levar</h2>
      {dados.salaId === null
        ? <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Escolha a sala desta data para ver o que o rider pede e a casa não tem.</p>
        : dados.riders.map(rider => (
          <div key={rider.riderId} className="mb-6 last:mb-0">
            {dados.riders.length > 1 && <p className="mb-1 text-[0.75rem] font-medium text-[#282525]">{rider.riderNome}</p>}
            <ListaDoQueLevar organizationId={organizationId} riderId={rider.riderId} salaId={dados.salaId as string} salaNome={dados.salaNome ?? "a sala"} podeEditar={podeEditar} semTitulo />
          </div>
        ))}
    </section>
  );
}
