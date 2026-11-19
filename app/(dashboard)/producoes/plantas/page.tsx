"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Ruler } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { TIPOS_DE_PLANTA, type TipoDePlanta } from "@/lib/producao/estados";
import { lerPlanta, ROTULO_DO_TIPO_DE_PLANTA } from "@/lib/producao/planta";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";

type PlantaDaLista = { id: string; nome: string; tipo: TipoDePlanta; largura_m: number; profundidade_m: number };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function NovaPlantaSheet({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string>("palco");
  const [largura, setLargura] = useState("");
  const [profundidade, setProfundidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const leitura = lerPlanta({ nome, tipo, largura, profundidade });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).from("producao_plantas").insert({ organization_id: organizationId, ...leitura.planta }).select("id").single();
    setSalvando(false);
    if (error || !data) { setErro(error?.code === "42501" ? "Você não pode criar plantas aqui." : "Não foi possível criar. Tente de novo."); return; }
    onCreated(data.id);
  }

  return (
    <TopSheet
      titulo="Nova planta"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Criando…" : "Criar planta"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="planta-nome">Nome</label>
          <input id="planta-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Palco do Teatro Municipal" maxLength={200} disabled={salvando} />
        </div>
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown value={tipo} onChange={setTipo} options={TIPOS_DE_PLANTA.map(valor => ({ value: valor, label: ROTULO_DO_TIPO_DE_PLANTA[valor] }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="planta-largura">Largura (m)</label>
            <input id="planta-largura" inputMode="decimal" className={CAMPO} value={largura} onChange={event => setLargura(event.target.value)} placeholder="12" disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="planta-profundidade">Profundidade (m)</label>
            <input id="planta-profundidade" inputMode="decimal" className={CAMPO} value={profundidade} onChange={event => setProfundidade(event.target.value)} placeholder="8" disabled={salvando} />
          </div>
        </div>
      </div>
    </TopSheet>
  );
}

/** As plantas da produção: o desenho de um palco, sala, hospedagem ou exposição, em metros. */
export default function PlantasPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const router = useRouter();
  const [plantas, setPlantas] = useState<PlantaDaLista[] | null>(null);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_plantas").select("id, nome, tipo, largura_m, profundidade_m").eq("organization_id", organizationId).order("nome");
      if (!ativo) return;
      setPlantas((data ?? []) as PlantaDaLista[]);
      setErro(error ? "Não foi possível carregar as plantas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Plantas</h1>
            </div>
            {podeEditar && <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Nova planta</PrimaryListAction>}
          </div>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {plantas === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : plantas.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma planta ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Crie a planta do palco com as medidas e arraste os itens do inventário para o lugar.</p>
            {podeEditar && <div className="mt-4 flex justify-center"><PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Nova planta</PrimaryListAction></div>}
          </div>
        ) : (
          <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <ul className="divide-y divide-black/[.06]">
              {plantas.map(planta => (
                <li key={planta.id}>
                  <Link href={`/producoes/plantas/${planta.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    <Ruler size={14} aria-hidden="true" className="shrink-0 text-black/40" />
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[#282525]">{planta.nome}</span>
                    <span className="text-[0.6875rem] text-black/45">{ROTULO_DO_TIPO_DE_PLANTA[planta.tipo]}</span>
                    <span className="w-24 text-right text-[0.75rem] tabular-nums text-black/55">{planta.largura_m.toLocaleString("pt-BR")} × {planta.profundidade_m.toLocaleString("pt-BR")} m</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DetailPageContent>
      {folha && organizationId && <NovaPlantaSheet organizationId={organizationId} onClose={() => setFolha(false)} onCreated={id => router.push(`/producoes/plantas/${id}`)} />}
    </div>
  );
}
