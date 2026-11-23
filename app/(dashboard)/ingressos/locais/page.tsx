"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationName, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { FUSOS_DO_BRASIL, capacidadeDoLocal } from "@/lib/ticketeria/eventos";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { LocalSheet, type LocalEditavel } from "@/components/ticketeria/FolhasDosEventos";
import { SetorSheet, type SetorEditavel } from "@/components/ticketeria/SetorDoLocal";
import { SalaSheet } from "@/components/ticketeria/SalaDoEspaco";
import { MapaDaSalaSheet } from "@/components/ticketeria/MapaDaSalaSheet";
import { salasDoEspaco, type SalaDoEspaco } from "@/lib/ticketeria/salas";

type Setor = SetorEditavel & { local_id: string; sala_id: string; ordem: number };
type Folha = { tipo: "local"; local?: LocalEditavel } | { tipo: "setor"; local: LocalEditavel; sala?: SalaDoEspaco; setor?: Setor } | { tipo: "sala"; local: LocalEditavel; sala?: SalaDoEspaco } | { tipo: "mapa-sala"; local: LocalEditavel; sala: SalaDoEspaco };

const numero = (n: number) => n.toLocaleString("pt-BR");

/** Os locais da loja (T2) com os setores de cada um e a capacidade (a soma dos setores em uso). */
export default function LocaisPage() {
  const organizationId = useOrganizationId();
  const nomeDaOrganizacao = useOrganizationName();
  const papel = useOrganizationRole();
  const [locais, setLocais] = useState<LocalEditavel[] | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [salas, setSalas] = useState<SalaDoEspaco[]>([]);
  const [arquivados, setArquivados] = useState(false);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = podeEditarATicketeria(papel);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const [lo, se, sa] = await Promise.all([

        ticketeria.from("ticketeria_locais").select("id, nome, endereco, cidade, uf, fuso, arquivado").eq("organization_id", organizationId).order("nome"),
        ticketeria.from("ticketeria_setores").select("id, local_id, sala_id, nome, lugares, numerado, corredor_no_meio, ordem, arquivado").eq("organization_id", organizationId).order("ordem").order("nome"),
        ticketeria.from("ticketeria_salas").select("id, local_id, nome, ordem, arquivado").eq("organization_id", organizationId),
      ]);
      if (!ativo) return;
      setLocais((lo.data ?? []) as LocalEditavel[]);
      setSetores((se.data ?? []) as Setor[]);
      setSalas((sa.data ?? []) as SalaDoEspaco[]);
      setErro(lo.error || se.error || sa.error ? "Não foi possível carregar os locais. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const visiveis = useMemo(() => (locais ?? []).filter(local => local.arquivado === arquivados), [locais, arquivados]);
  const temArquivados = (locais ?? []).some(local => local.arquivado);
  const novo = podeEditar ? <PrimaryListAction onClick={() => setFolha({ tipo: "local" })}><Plus size={13} aria-hidden="true" /> Novo local</PrimaryListAction> : undefined;

  // Quantos setores em uso cada sala tem (a sala vazia pode começar de um modelo).
  const setoresPorSala = useMemo(() => { const por: Record<string, number> = {}; for (const setor of setores) if (!setor.arquivado) por[setor.sala_id] = (por[setor.sala_id] ?? 0) + 1; return por; }, [setores]);

  const botaoDoSetor = (setor: Setor, local: LocalEditavel) => (
    <button key={setor.id} type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "setor", local, sala: salas.find(sala => sala.id === setor.sala_id), setor })} className={`rounded-xl border border-black/[.12] bg-white px-2.5 py-1 text-[0.6875rem] font-normal transition enabled:hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${setor.arquivado ? "text-black/35 line-through" : "text-black/65"}`}>
      {setor.nome} · {numero(setor.lugares)}{setor.numerado ? " · numerado" : ""}
    </button>
  );

  return (
    <>
      <ListPageHeader title="Espaços" actions={locais && locais.length > 0 ? novo : undefined} />
      <ListContent>
        {aviso && <p role="status" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{aviso} <button type="button" onClick={() => setAviso(null)} className="ml-1 underline underline-offset-2">Fechar</button></p>}
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {temArquivados && (
          <div className="mb-4">
            <button type="button" onClick={() => setArquivados(atual => !atual)} aria-pressed={arquivados} className={`h-9 rounded-xl border px-3.5 text-[0.75rem] font-normal transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${arquivados ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>Arquivados</button>
          </div>
        )}
        {locais === null ? (
          <div className="h-32 rounded-xl border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : visiveis.length === 0 ? (
          <ListTableSurface>
            <ListEmptyState icon={MapPin} title={locais.length === 0 ? "Nenhum local ainda" : "Nenhum local aqui"} action={locais.length === 0 ? novo : undefined} />
          </ListTableSurface>
        ) : (
          <ul className="space-y-3">
            {visiveis.map(local => {
              const deles = setores.filter(setor => setor.local_id === local.id);
              const salasDele = salasDoEspaco(salas, local.id);
              const capacidade = capacidadeDoLocal(deles);
              const fuso = local.fuso !== "America/Sao_Paulo" ? FUSOS_DO_BRASIL.find(item => item.id === local.fuso)?.curto : null;
              return (
                <li key={local.id} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-[0.8125rem] font-normal text-[#282525]">{local.nome}</p>
                      <p className="truncate text-[0.6875rem] text-black/45">{[local.cidade && local.uf ? `${local.cidade}, ${local.uf}` : local.cidade ?? local.uf, capacidade > 0 ? `${numero(capacidade)} lugares` : "sem setores", fuso].filter(Boolean).join(" · ")}</p>
                    </div>
                    {podeEditar && (
                      <button type="button" onClick={() => setFolha({ tipo: "local", local })} aria-label={`Editar ${local.nome}`} title="Editar" className="flex h-8 w-8 items-center justify-center rounded-xl text-black/40 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                  <div className="border-t bg-black/[.015] px-4 py-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    {salasDele.length <= 1 ? (
                      // Uma sala só: ela é o próprio espaço, e os setores aparecem direto.
                      <div className="flex flex-wrap items-center gap-2">
                        {deles.length === 0 && <span className="text-[0.6875rem] text-black/45">Sem setores{podeEditar && !local.arquivado && salasDele[0] && <> · <button type="button" onClick={() => setFolha({ tipo: "sala", local, sala: salasDele[0] })} className="underline underline-offset-2 hover:text-black/65">começar de um modelo</button></>}</span>}
                        {deles.map(setor => botaoDoSetor(setor, local))}
                        {podeEditar && !local.arquivado && (
                          <>
                            <button type="button" onClick={() => setFolha({ tipo: "setor", local, sala: salasDele[0] })} className="rounded-xl px-2 py-1 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">+ Setor</button>
                            {salasDele[0] && deles.some(setor => setor.numerado && !setor.arquivado) && <button type="button" onClick={() => setFolha({ tipo: "mapa-sala", local, sala: salasDele[0] })} className="rounded-xl px-2 py-1 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Mapa da sala</button>}
                            <button type="button" onClick={() => setFolha({ tipo: "sala", local })} className="rounded-xl px-2 py-1 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">+ Sala</button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {salasDele.map(sala => {
                          const dela = deles.filter(setor => setor.sala_id === sala.id);
                          return (
                            <div key={sala.id} className="flex flex-wrap items-center gap-2">
                              <button type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "sala", local, sala })} title="Editar a sala" className={`min-w-[5.5rem] rounded-xl px-1 py-1 text-left text-[0.6875rem] font-normal transition enabled:hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${sala.arquivado ? "text-black/35 line-through" : "text-[#282525]"}`}>{sala.nome}</button>
                              {dela.length === 0 && <span className="text-[0.6875rem] text-black/45">Sem setores</span>}
                              {dela.map(setor => botaoDoSetor(setor, local))}
                              {podeEditar && !local.arquivado && !sala.arquivado && <button type="button" onClick={() => setFolha({ tipo: "setor", local, sala })} className="rounded-xl px-2 py-1 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">+ Setor</button>}
                              {podeEditar && !local.arquivado && !sala.arquivado && dela.some(setor => setor.numerado && !setor.arquivado) && <button type="button" onClick={() => setFolha({ tipo: "mapa-sala", local, sala })} className="rounded-xl px-2 py-1 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Mapa da sala</button>}
                            </div>
                          );
                        })}
                        {podeEditar && !local.arquivado && <button type="button" onClick={() => setFolha({ tipo: "sala", local })} className="rounded-xl px-1 py-1 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">+ Sala</button>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ListContent>
      {folha?.tipo === "local" && organizationId && <LocalSheet organizationId={organizationId} nomeDaOrganizacao={nomeDaOrganizacao} local={folha.local} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "setor" && organizationId && <SetorSheet organizationId={organizationId} localId={folha.local.id} salaId={folha.setor?.sala_id ?? folha.sala?.id} nomeDoLocal={[folha.local.nome, folha.sala && salasDoEspaco(salas, folha.local.id).length > 1 ? folha.sala.nome : null].filter(Boolean).join(" · ")} setor={folha.setor} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "mapa-sala" && <MapaDaSalaSheet sala={folha.sala} nomeDoLocal={folha.local.nome} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "sala" && organizationId && <SalaSheet organizationId={organizationId} localId={folha.local.id} nomeDoLocal={folha.local.nome} salasDoLocal={salas.filter(sala => sala.local_id === folha.local.id)} setoresPorSala={setoresPorSala} sala={folha.sala} onClose={() => setFolha(null)} onSaved={recarregar} onAviso={setAviso} />}
    </>
  );
}
