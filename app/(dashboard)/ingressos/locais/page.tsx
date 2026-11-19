"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationName, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { FUSOS_DO_BRASIL, capacidadeDoLocal } from "@/lib/ticketeria/eventos";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { LocalSheet, SetorSheet, type LocalEditavel, type SetorEditavel } from "@/components/ticketeria/FolhasDosEventos";

type Setor = SetorEditavel & { local_id: string; ordem: number };
type Folha = { tipo: "local"; local?: LocalEditavel } | { tipo: "setor"; local: LocalEditavel; setor?: Setor };

const numero = (n: number) => n.toLocaleString("pt-BR");

/** Os locais da loja (T2) com os setores de cada um e a capacidade (a soma dos setores em uso). */
export default function LocaisPage() {
  const organizationId = useOrganizationId();
  const nomeDaOrganizacao = useOrganizationName();
  const papel = useOrganizationRole();
  const [locais, setLocais] = useState<LocalEditavel[] | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [arquivados, setArquivados] = useState(false);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = podeEditarATicketeria(papel);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const [lo, se] = await Promise.all([
        ticketeria.from("ticketeria_locais").select("id, nome, endereco, cidade, uf, fuso, arquivado").eq("organization_id", organizationId).order("nome"),
        ticketeria.from("ticketeria_setores").select("id, local_id, nome, lugares, ordem, arquivado").eq("organization_id", organizationId).order("ordem").order("nome"),
      ]);
      if (!ativo) return;
      setLocais((lo.data ?? []) as LocalEditavel[]);
      setSetores((se.data ?? []) as Setor[]);
      setErro(lo.error || se.error ? "Não foi possível carregar os locais. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const visiveis = useMemo(() => (locais ?? []).filter(local => local.arquivado === arquivados), [locais, arquivados]);
  const temArquivados = (locais ?? []).some(local => local.arquivado);
  const novo = podeEditar ? <PrimaryListAction onClick={() => setFolha({ tipo: "local" })}><Plus size={13} aria-hidden="true" /> Novo local</PrimaryListAction> : undefined;

  return (
    <>
      <ListPageHeader eyebrow="Ticketeria" title="Locais" actions={locais && locais.length > 0 ? novo : undefined} />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {temArquivados && (
          <div className="mb-4">
            <button type="button" onClick={() => setArquivados(atual => !atual)} aria-pressed={arquivados} className={`h-9 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${arquivados ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>Arquivados</button>
          </div>
        )}
        {locais === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : visiveis.length === 0 ? (
          <ListTableSurface>
            <ListEmptyState icon={MapPin} title={locais.length === 0 ? "Nenhum local ainda" : "Nenhum local aqui"} description={locais.length === 0 ? "Cadastre o teatro, a casa de show ou a praça e os setores dele, com os lugares de cada um. As sessões dos eventos acontecem num local." : undefined} action={locais.length === 0 ? novo : undefined} />
          </ListTableSurface>
        ) : (
          <ul className="space-y-3">
            {visiveis.map(local => {
              const deles = setores.filter(setor => setor.local_id === local.id);
              const capacidade = capacidadeDoLocal(deles);
              const fuso = local.fuso !== "America/Sao_Paulo" ? FUSOS_DO_BRASIL.find(item => item.id === local.fuso)?.curto : null;
              return (
                <li key={local.id} className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{local.nome}</p>
                      <p className="truncate text-[0.6875rem] text-black/45">{[local.cidade && local.uf ? `${local.cidade}, ${local.uf}` : local.cidade ?? local.uf, capacidade > 0 ? `${numero(capacidade)} lugares` : "sem setores", fuso].filter(Boolean).join(" · ")}</p>
                    </div>
                    {podeEditar && (
                      <button type="button" onClick={() => setFolha({ tipo: "local", local })} aria-label={`Editar ${local.nome}`} title="Editar" className="flex h-8 w-8 items-center justify-center rounded text-black/40 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                  <div className="border-t bg-black/[.015] px-4 py-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      {deles.length === 0 && <span className="text-[0.6875rem] text-black/45">Sem setores</span>}
                      {deles.map(setor => (
                        <button key={setor.id} type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "setor", local, setor })} className={`rounded border border-black/[.12] bg-white px-2.5 py-1 text-[0.6875rem] font-medium transition enabled:hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${setor.arquivado ? "text-black/35 line-through" : "text-black/65"}`}>
                          {setor.nome} · {numero(setor.lugares)}
                        </button>
                      ))}
                      {podeEditar && !local.arquivado && (
                        <button type="button" onClick={() => setFolha({ tipo: "setor", local })} className="rounded px-2 py-1 text-[0.6875rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">+ Setor</button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ListContent>
      {folha?.tipo === "local" && organizationId && <LocalSheet organizationId={organizationId} nomeDaOrganizacao={nomeDaOrganizacao} local={folha.local} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "setor" && organizationId && <SetorSheet organizationId={organizationId} localId={folha.local.id} setor={folha.setor} onClose={() => setFolha(null)} onSaved={recarregar} />}
    </>
  );
}
