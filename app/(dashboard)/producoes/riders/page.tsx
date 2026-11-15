"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { criarRiderDaPlanta } from "@/components/producao/criar-rider";

type RiderDaLista = { id: string; nome: string; planta_id: string | null };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function NovoRiderSheet({ organizationId, plantas, onClose, onCreated }: { organizationId: string; plantas: { id: string; nome: string }[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [origem, setOrigem] = useState(plantas.length > 0 ? plantas[0].id : "");
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setErro(null);
    setSalvando(true);
    if (origem) {
      const resultado = await criarRiderDaPlanta(organizationId, origem);
      setSalvando(false);
      if ("erro" in resultado) { setErro(resultado.erro); return; }
      onCreated(resultado.id);
      return;
    }
    const limpo = nome.trim();
    if (limpo === "" || limpo.length > 200) { setSalvando(false); setErro("Dê um nome ao rider (até 200 letras)."); return; }
    const { data, error } = await clienteDaProducao(createClient()).from("producao_riders").insert({ organization_id: organizationId, nome: limpo }).select("id").single();
    setSalvando(false);
    if (error || !data) { setErro(error?.code === "42501" ? "Você não pode criar riders aqui." : "Não foi possível criar. Tente de novo."); return; }
    onCreated(data.id);
  }

  return (
    <TopSheet
      titulo="Novo rider"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void criar()} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Criando…" : "Criar rider"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <span className={ROTULO}>Montar a partir de</span>
          <Dropdown value={origem} onChange={setOrigem} options={[...plantas.map(planta => ({ value: planta.id, label: `Planta: ${planta.nome}` })), { value: "", label: "Rider em branco" }]} />
        </div>
        {!origem && (
          <div>
            <label className={ROTULO} htmlFor="rider-nome">Nome</label>
            <input id="rider-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Rider do show" maxLength={200} disabled={salvando} />
          </div>
        )}
      </div>
    </TopSheet>
  );
}

/** Os riders técnicos da produção: o que a casa precisa providenciar. Nascem do mapa de palco. */
export default function RidersPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const router = useRouter();
  const [riders, setRiders] = useState<RiderDaLista[] | null>(null);
  const [plantas, setPlantas] = useState<{ id: string; nome: string }[]>([]);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [rid, pla] = await Promise.all([
        producao.from("producao_riders").select("id, nome, planta_id").eq("organization_id", organizationId).order("nome"),
        producao.from("producao_plantas").select("id, nome").eq("organization_id", organizationId).order("nome"),
      ]);
      if (!ativo) return;
      setRiders((rid.data ?? []) as RiderDaLista[]);
      setPlantas(pla.data ?? []);
      setErro(rid.error ? "Não foi possível carregar os riders. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Riders</h1>
            </div>
            {podeEditar && <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Novo rider</PrimaryListAction>}
          </div>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {riders === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : riders.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhum rider ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Monte a planta do palco com os canais e a energia e gere o rider com um clique.</p>
            {podeEditar && <div className="mt-4 flex justify-center"><PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Novo rider</PrimaryListAction></div>}
          </div>
        ) : (
          <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <ul className="divide-y divide-black/[.06]">
              {riders.map(rider => (
                <li key={rider.id}>
                  <Link href={`/producoes/riders/${rider.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    <FileText size={14} aria-hidden="true" className="shrink-0 text-black/40" />
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[#282525]">{rider.nome}</span>
                    {rider.planta_id && <span className="text-[0.6875rem] text-black/45">da planta</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DetailPageContent>
      {folha && organizationId && <NovoRiderSheet organizationId={organizationId} plantas={plantas} onClose={() => setFolha(false)} onCreated={id => router.push(`/producoes/riders/${id}`)} />}
    </div>
  );
}
