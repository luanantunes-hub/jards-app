"use client";

import { useEffect, useState } from "react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { ExpografiaDaSala } from "@/components/producao/ExpografiaDaSala";

type Espaco = { id: string; nome: string };
type Sala = { id: string; nome: string };

/** Expografia (PD8.5): escolhe o espaço e a sala e planeja as obras de arte da exposição: onde ficam, a altura, a luz e a ordem de montagem. */
export default function ExpografiaPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [espacos, setEspacos] = useState<Espaco[] | null>(null);
  const [espacoId, setEspacoId] = useState("");
  const [salas, setSalas] = useState<Sala[] | null>(null);
  const [salaId, setSalaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome");
      if (!ativo) return;
      setEspacos((data ?? []) as Espaco[]);
      setEspacoId(atual => atual || data?.[0]?.id || "");
      if (error) setErro("Não foi possível carregar os espaços. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!espacoId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_salas").select("id, nome").eq("espaco_id", espacoId).eq("arquivada", false).order("nome");
      if (!ativo) return;
      setSalas((data ?? []) as Sala[]);
      setSalaId(atual => (data ?? []).some(sala => sala.id === atual) ? atual : (data?.[0]?.id ?? ""));
      if (error) setErro("Não foi possível carregar as salas. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [espacoId]);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Expografia</h1>
          <p className="mt-1 max-w-2xl text-[0.75rem] text-black/45">As obras de arte de cada sala de exposição: onde ficam (parede, piso, teto, vitrine), a altura de instalação, a luz e a ordem de montagem, com o andamento da montagem. As obras vêm do Inventário. Termos de empréstimo e seguro vêm nos próximos cortes.</p>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {espacos === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : espacos.length === 0 ? (
          <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Cadastre um espaço com salas para planejar a exposição.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="w-64 max-w-full"><Dropdown ariaLabel="Espaço" value={espacoId} onChange={setEspacoId} options={espacos.map(item => ({ value: item.id, label: item.nome }))} /></div>
              {salas && salas.length > 0 && <div className="w-64 max-w-full"><Dropdown ariaLabel="Sala" value={salaId} onChange={setSalaId} options={salas.map(item => ({ value: item.id, label: item.nome }))} /></div>}
            </div>
            {salas === null ? (
              <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
            ) : salas.length === 0 ? (
              <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Este espaço ainda não tem salas.</p>
            ) : salaId && organizationId ? (
              <ExpografiaDaSala key={salaId} organizationId={organizationId} salaId={salaId} podeEditar={podeEditar} />
            ) : null}
          </>
        )}
      </DetailPageContent>
    </div>
  );
}
