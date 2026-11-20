"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { EspacoSheet, SalaSheet, type EspacoEditavel, type SalaEditavel } from "@/components/producao/EspacoSheet";

type Folha = { tipo: "espaco"; espaco?: EspacoEditavel } | { tipo: "sala"; espaco: EspacoEditavel; sala?: SalaEditavel };

/** Os espaços da organização (teatro, casa de show, praça, lona…) com as salas de cada um. */
export default function EspacosPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [espacos, setEspacos] = useState<EspacoEditavel[] | null>(null);
  const [salas, setSalas] = useState<SalaEditavel[]>([]);
  const [arquivados, setArquivados] = useState(false);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [esp, sal] = await Promise.all([
        producao.from("producao_espacos").select("id, nome, tipo, proprio, movel, endereco, uf, capacidade, arquivado, municipio_ibge, latitude, longitude").eq("organization_id", organizationId).order("nome"),
        producao.from("producao_salas").select("id, espaco_id, nome, capacidade, arquivada").eq("organization_id", organizationId).order("nome"),
      ]);
      if (!ativo) return;
      setEspacos((esp.data ?? []) as EspacoEditavel[]);
      setSalas((sal.data ?? []) as SalaEditavel[]);
      setErro(esp.error || sal.error ? "Não foi possível carregar os espaços. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const visiveis = useMemo(() => (espacos ?? []).filter(espaco => espaco.arquivado === arquivados), [espacos, arquivados]);
  const temArquivados = (espacos ?? []).some(espaco => espaco.arquivado);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Espaços</h1>
            </div>
            {podeEditar && <PrimaryListAction onClick={() => setFolha({ tipo: "espaco" })}><Plus size={13} aria-hidden="true" /> Novo espaço</PrimaryListAction>}
          </div>
          {temArquivados && (
            <div className="mt-5">
              <button type="button" onClick={() => setArquivados(atual => !atual)} aria-pressed={arquivados} className={`h-10 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${arquivados ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>Arquivados</button>
            </div>
          )}
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {espacos === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : visiveis.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">{espacos.length === 0 ? "Nenhum espaço cadastrado" : "Nenhum espaço aqui"}</p>
            {espacos.length === 0 && <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Cadastre o teatro, a casa de show ou a praça uma vez e use em qualquer data.</p>}
            {espacos.length === 0 && podeEditar && <div className="mt-4 flex justify-center"><PrimaryListAction onClick={() => setFolha({ tipo: "espaco" })}><Plus size={13} aria-hidden="true" /> Novo espaço</PrimaryListAction></div>}
          </div>
        ) : (
          <ul className="space-y-3">
            {visiveis.map(espaco => {
              const dele = salas.filter(sala => sala.espaco_id === espaco.id && !sala.arquivada);
              return (
                <li key={espaco.id} className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <Link href={`/producoes/espacos/${espaco.id}`} className="block truncate text-[0.8125rem] font-medium text-[#282525] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{espaco.nome}</Link>
                      <p className="truncate text-[0.6875rem] text-black/45">
                        {[espaco.tipo, espaco.uf, espaco.capacidade ? `${espaco.capacidade} lugares` : null, espaco.proprio ? "nosso" : null, espaco.movel ? "móvel" : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {podeEditar && (
                      <button type="button" onClick={() => setFolha({ tipo: "espaco", espaco })} aria-label={`Editar ${espaco.nome}`} title="Editar" className="flex h-8 w-8 items-center justify-center rounded text-black/40 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                  <div className="border-t bg-black/[.015] px-4 py-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      {dele.length === 0 && <span className="text-[0.6875rem] text-black/45">Sem salas</span>}
                      {dele.map(sala => (
                        <button key={sala.id} type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "sala", espaco, sala })} className="rounded border border-black/[.12] bg-white px-2.5 py-1 text-[0.6875rem] font-medium text-black/65 transition enabled:hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                          {sala.nome}{sala.capacidade ? ` · ${sala.capacidade}` : ""}
                        </button>
                      ))}
                      {podeEditar && (
                        <button type="button" onClick={() => setFolha({ tipo: "sala", espaco })} className="rounded px-2 py-1 text-[0.6875rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">+ Sala</button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DetailPageContent>

      {folha?.tipo === "espaco" && organizationId && <EspacoSheet organizationId={organizationId} espaco={folha.espaco} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "sala" && organizationId && <SalaSheet organizationId={organizationId} espacoId={folha.espaco.id} sala={folha.sala} onClose={() => setFolha(null)} onSaved={recarregar} />}
    </div>
  );
}
