"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { CATEGORIAS_DO_VEICULO } from "@/lib/producao/estados";
import { placaParaExibir, resumoDosDocumentos, ROTULO_DA_CATEGORIA_DO_VEICULO, ROTULO_DA_CONTRATACAO, ROTULO_DO_COMBUSTIVEL, ROTULO_DO_DOCUMENTO_DO_VEICULO } from "@/lib/producao/veiculos";
import { diaEMes } from "@/lib/producao/agenda";
import { chaveDoNome } from "@/lib/dominio";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Select } from "@/components/ui/Select";
import { VeiculoSheet, type VeiculoEditavel } from "@/components/producao/VeiculoSheet";

const numero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Os veículos da produção: o que leva gente e carga, com os documentos e a validade de cada um. */
export default function VeiculosPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [veiculos, setVeiculos] = useState<VeiculoEditavel[] | null>(null);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [arquivados, setArquivados] = useState(false);
  const [folha, setFolha] = useState<{ veiculo?: VeiculoEditavel } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const hoje = new Date().toISOString().slice(0, 10);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_veiculos")
        .select("id, nome, placa, modelo, ano, categoria, combustivel, contratacao, fornecedor, consumo_km_por_litro, capacidade_carga_kg, capacidade_volume_m3, lugares, notas, arquivado, documentos:producao_veiculo_documentos(id, tipo, numero, validade, observacoes)")
        .eq("organization_id", organizationId).order("nome");
      if (!ativo) return;
      setVeiculos(((data ?? []) as unknown as VeiculoEditavel[]).map(veiculo => ({ ...veiculo, documentos: [...(veiculo.documentos ?? [])].sort((a, b) => (a.validade ?? "9999").localeCompare(b.validade ?? "9999")) })));
      setErro(error ? "Não foi possível carregar os veículos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const visiveis = useMemo(() => {
    const chave = chaveDoNome(busca);
    return (veiculos ?? []).filter(veiculo => veiculo.arquivado === arquivados
      && (categoria === "todas" || veiculo.categoria === categoria)
      && (!chave || chaveDoNome(`${veiculo.nome} ${veiculo.placa ?? ""} ${veiculo.modelo ?? ""} ${veiculo.fornecedor ?? ""}`).includes(chave)));
  }, [veiculos, busca, categoria, arquivados]);
  const temArquivados = (veiculos ?? []).some(veiculo => veiculo.arquivado);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Veículos</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">Os veículos que levam a equipe e a carga: próprios, locados ou fretados, com os documentos e a validade.</p>
            </div>
            {podeEditar && <PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Novo veículo</PrimaryListAction>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">Buscar veículo</span>
              <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
              <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar pelo nome, placa ou modelo" className="h-10 w-full rounded border border-black/[.12] bg-white pl-8 pr-3 text-[0.8125rem] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
            </label>
            <Select block={false} aria-label="Filtrar por tipo" value={categoria} onChange={event => setCategoria(event.target.value)} className="h-10 pl-3 pr-8 text-black/60">
              <option value="todas">Todos os tipos</option>
              {CATEGORIAS_DO_VEICULO.map(valor => <option key={valor} value={valor}>{ROTULO_DA_CATEGORIA_DO_VEICULO[valor]}</option>)}
            </Select>
            {temArquivados && (
              <button type="button" onClick={() => setArquivados(atual => !atual)} aria-pressed={arquivados} className={`h-10 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${arquivados ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>Arquivados</button>
            )}
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {veiculos === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : visiveis.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">{veiculos.length === 0 ? "Nenhum veículo cadastrado" : "Nenhum veículo encontrado"}</p>
            {veiculos.length === 0 && <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Cadastre a van, o caminhão ou o ônibus que a produção usa, com a validade do seguro e dos documentos, para ser avisado antes de vencer.</p>}
            {veiculos.length === 0 && podeEditar && <div className="mt-4 flex justify-center"><PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Novo veículo</PrimaryListAction></div>}
          </div>
        ) : (
          <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <ul className="divide-y divide-black/[.06]">
              {visiveis.map(veiculo => {
                const resumo = resumoDosDocumentos(veiculo.documentos, hoje);
                const proximo = resumo.proximo;
                return (
                  <li key={veiculo.id}>
                    <button type="button" onClick={() => podeEditar && setFolha({ veiculo })} disabled={!podeEditar} className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left transition enabled:hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{veiculo.nome}{veiculo.placa ? <span className="ml-2 font-normal tabular-nums text-black/45">{placaParaExibir(veiculo.placa)}</span> : null}</span>
                        <span className="block truncate text-[0.6875rem] text-black/45">{[ROTULO_DA_CATEGORIA_DO_VEICULO[veiculo.categoria], veiculo.modelo, ROTULO_DA_CONTRATACAO[veiculo.contratacao], veiculo.fornecedor, ROTULO_DO_COMBUSTIVEL[veiculo.combustivel]].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="w-16 text-right text-[0.75rem] tabular-nums text-black/55">{veiculo.lugares === null ? "—" : `${numero(veiculo.lugares)} lug.`}</span>
                      <span className="w-20 text-right text-[0.75rem] tabular-nums text-black/55">{veiculo.capacidade_carga_kg === null ? "—" : `${numero(veiculo.capacidade_carga_kg)} kg`}</span>
                      <span className="w-48 text-right text-[0.6875rem]">
                        {proximo?.validade && resumo.vencidos > 0
                          ? <span style={{ color: "#B23B3B" }}>{ROTULO_DO_DOCUMENTO_DO_VEICULO[proximo.tipo]} vencido{resumo.vencidos > 1 ? ` (+${resumo.vencidos - 1})` : ""}</span>
                          : proximo?.validade && resumo.vencemEmBreve > 0
                            ? <span style={{ color: "#B07A14" }}>{ROTULO_DO_DOCUMENTO_DO_VEICULO[proximo.tipo]} vence {diaEMes(proximo.validade)}</span>
                            : <span className="text-black/35">{veiculo.documentos.length === 0 ? "sem documentos" : "documentos em dia"}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </DetailPageContent>

      {folha && organizationId && <VeiculoSheet organizationId={organizationId} veiculo={folha.veiculo} hoje={hoje} onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />}
    </div>
  );
}
