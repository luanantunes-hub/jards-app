"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Link2, Pencil } from "lucide-react";
import { documentoDaFicha, logoParaOPdf } from "@/lib/producao/ficha-pdf";
import { plantasDasSalas } from "@/lib/producao/planta-da-ficha";
import { montarPdf } from "@/lib/producao/pdf-texto";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { resumoDaFichaDaSala, type FichaDaSala, type FichaDoEspaco } from "@/lib/producao/ficha";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { FichaDaSalaSheet, FichaDoEspacoSheet } from "@/components/producao/FichasSheets";
import { EquipamentosDoEspaco, type EquipamentoDaCasa } from "@/components/producao/EquipamentosDoEspaco";
import { EquipeDaCasa } from "@/components/producao/EquipeDaCasa";
import { ProgramacaoPublicaDoEspaco } from "@/components/producao/ProgramacaoPublicaDoEspaco";
import { LinkDaFichaSheet } from "@/components/producao/LinkDaFichaSheet";
import { PlantaDoEspaco } from "@/components/producao/PlantaDoEspaco";
import { equipamentosDaFicha } from "@/lib/producao/equipamentos";

type Espaco = { id: string; nome: string; tipo: string; uf: string | null; endereco: string | null; capacidade: number | null };
type Sala = { id: string; nome: string; capacidade: number | null; arquivada: boolean };

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3"><dt className="text-[0.6875rem] font-medium text-black/45">{rotulo}</dt><dd className="whitespace-pre-wrap text-[0.8125rem] text-[#282525]">{valor}</dd></div>;
}

/** O espaço com a ficha dele e a ficha técnica de cada sala (PD3.1). */
export default function EspacoPage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [espaco, setEspaco] = useState<Espaco | null | undefined>(undefined);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [fichaDoEspaco, setFichaDoEspaco] = useState<Partial<FichaDoEspaco> | null>(null);
  const [fichasDasSalas, setFichasDasSalas] = useState<Map<string, Partial<FichaDaSala>>>(new Map());
  const [editando, setEditando] = useState<{ tipo: "espaco" } | { tipo: "sala"; sala: Sala } | null>(null);
  const [equipamentos, setEquipamentos] = useState<EquipamentoDaCasa[]>([]);
  const [linkDaFicha, setLinkDaFicha] = useState(false);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [esp, sal, fe] = await Promise.all([
        producao.from("producao_espacos").select("id, nome, tipo, uf, endereco, capacidade").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        producao.from("producao_salas").select("id, nome, capacidade, arquivada").eq("espaco_id", id).eq("arquivada", false).order("nome"),
        producao.from("producao_espaco_fichas").select("funcionamento, acessibilidade, carga_descarga, doca_altura_m, veiculo_max_m, contato_nome, contato_telefone, contato_email, logo_url").eq("espaco_id", id).maybeSingle(),
      ]);
      const ids = (sal.data ?? []).map(sala => sala.id);
      const fs = ids.length > 0
        ? await producao.from("producao_sala_fichas").select("sala_id, palco_boca_m, palco_profundidade_m, palco_altura_m, palco_piso, som_sistema, som_canais_entrada, luz_descricao, luz_refletores, energia_kva, energia_tensao_v, energia_fases, camarins_quantidade, camarins_capacidade, notas").in("sala_id", ids)
        : { data: [] };
      if (!ativo) return;
      setEspaco(esp.error ? null : (esp.data as Espaco | null));
      setSalas((sal.data ?? []) as Sala[]);
      setFichaDoEspaco(fe.data ?? null);
      setFichasDasSalas(new Map((fs.data ?? []).map(({ sala_id, ...resto }) => [sala_id, resto])));
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao]);

  async function baixarPdf() {
    if (!espaco) return;
    const plantas = await plantasDasSalas(clienteDaProducao(createClient()), salas.map(sala => sala.id));
    const documento = documentoDaFicha(espaco, fichaDoEspaco, salas.map(sala => ({ nome: sala.nome, capacidade: sala.capacidade, ficha: fichasDasSalas.get(sala.id) ?? null, planta: plantas.get(sala.id) ?? null })),
      equipamentosDaFicha(equipamentos).map(item => ({ nome: item.nome, quantidade: item.quantidade, sala: salas.find(sala => sala.id === item.sala_id)?.nome ?? null })));
    const bytes = await montarPdf(documento, await logoParaOPdf(documento.logoUrl));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    link.download = `ficha-tecnica-${espaco.nome.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "espaco"}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (espaco === undefined) return <DetailPageSkeleton />;
  if (espaco === null) return <DetailNotFound title="Espaço não encontrado" description="Ele pode ter sido apagado ou você não tem acesso." backHref="/producoes/espacos" backLabel="Voltar aos espaços" />;

  const f = fichaDoEspaco;
  const metros = (n: number | null | undefined) => (n == null ? null : `${n.toLocaleString("pt-BR")} m`);
  const contato = f ? [f.contato_nome, f.contato_telefone, f.contato_email].filter(Boolean).join(" · ") : "";
  const temFicha = Boolean(f && (f.funcionamento || f.acessibilidade || f.carga_descarga || f.doca_altura_m != null || f.veiculo_max_m != null || contato));

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <DetailBackLink href="/producoes/espacos" label="Espaços" />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{espaco.nome}</h1>
            <button type="button" onClick={() => void baixarPdf()} className={BOTAO}><Download size={13} aria-hidden="true" /> Baixar ficha em PDF</button>
            <button type="button" onClick={() => setLinkDaFicha(true)} className={BOTAO}><Link2 size={13} aria-hidden="true" /> Link da ficha</button>
          </div>
          <p className="mt-1 text-[0.75rem] text-black/45">{[espaco.tipo, espaco.uf, espaco.capacidade ? `${espaco.capacidade.toLocaleString("pt-BR")} lugares` : null, espaco.endereco].filter(Boolean).join(" · ")}</p>
        </div>
      </header>
      <DetailPageContent>
        <section aria-labelledby="ficha-do-espaco">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="ficha-do-espaco" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Ficha do espaço</h2>
            {podeEditar && <button type="button" onClick={() => setEditando({ tipo: "espaco" })} className={BOTAO}><Pencil size={13} aria-hidden="true" /> {temFicha ? "Editar" : "Preencher"}</button>}
          </div>
          {!temFicha ? null : (
            <dl className="space-y-3 rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <Linha rotulo="Funcionamento" valor={f?.funcionamento ?? null} />
              <Linha rotulo="Acessibilidade" valor={f?.acessibilidade ?? null} />
              <Linha rotulo="Carga e descarga" valor={f?.carga_descarga ?? null} />
              <Linha rotulo="Altura da doca" valor={metros(f?.doca_altura_m)} />
              <Linha rotulo="Veículo máximo" valor={metros(f?.veiculo_max_m)} />
              <Linha rotulo="Contato" valor={contato || null} />
            </dl>
          )}
        </section>

        <section aria-labelledby="fichas-das-salas" className="mt-10">
          <h2 id="fichas-das-salas" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Salas e fichas técnicas</h2>
          {salas.length === 0 ? (
            <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Este espaço ainda não tem salas. Cadastre em Espaços, com “+ Sala”.</p>
          ) : (
            <ul className="space-y-3">
              {salas.map(sala => {
                const resumo = resumoDaFichaDaSala(fichasDasSalas.get(sala.id) ?? {});
                const ficha = fichasDasSalas.get(sala.id) ?? null;
                return (
                  <li key={sala.id} className="rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-medium text-[#282525]">{sala.nome}</p>
                        <p className="text-[0.6875rem] text-black/45">{sala.capacidade ? `${sala.capacidade.toLocaleString("pt-BR")} lugares` : "Capacidade não informada"}</p>
                      </div>
                      {podeEditar && <button type="button" onClick={() => setEditando({ tipo: "sala", sala })} className={BOTAO}><Pencil size={13} aria-hidden="true" /> {ficha ? "Editar ficha" : "Preencher ficha"}</button>}
                    </div>
                    {resumo.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-[0.75rem] text-black/65">{resumo.map(linha => <li key={linha}>{linha}</li>)}</ul>
                    ) : (
                      <p className="mt-3 text-[0.75rem] text-black/40">Ficha técnica em branco.</p>
                    )}
                    {ficha?.notas && <p className="mt-2 whitespace-pre-wrap text-[0.75rem] text-black/50">{ficha.notas}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {organizationId && <PlantaDoEspaco organizationId={organizationId} espacoId={espaco.id} nomeDoEspaco={espaco.nome} salaIds={salas.map(sala => sala.id)} podeEditar={podeEditar} />}
        {organizationId && <EquipamentosDoEspaco organizationId={organizationId} espacoId={espaco.id} salas={salas} podeEditar={podeEditar} onChange={setEquipamentos} />}
        {organizationId && <ProgramacaoPublicaDoEspaco espacoId={espaco.id} podeEditar={podeEditar} />}
        {organizationId && <EquipeDaCasa organizationId={organizationId} espacoId={espaco.id} podeEditar={podeEditar} />}
      </DetailPageContent>

      {linkDaFicha && <LinkDaFichaSheet espacoId={espaco.id} espaco={espaco.nome} podeEditar={podeEditar} onClose={() => setLinkDaFicha(false)} />}
      {editando?.tipo === "espaco" && organizationId && <FichaDoEspacoSheet organizationId={organizationId} espacoId={espaco.id} ficha={fichaDoEspaco} onClose={() => setEditando(null)} onSaved={recarregar} />}
      {editando?.tipo === "sala" && organizationId && <FichaDaSalaSheet organizationId={organizationId} salaId={editando.sala.id} nomeDaSala={editando.sala.nome} ficha={fichasDasSalas.get(editando.sala.id) ?? null} onClose={() => setEditando(null)} onSaved={recarregar} />}
    </div>
  );
}
