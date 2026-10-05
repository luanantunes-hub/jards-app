"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { LIST_HEADER_CELL, ListContent, ListEmptyState, ListPageHeader, ListSearch, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { FornecedorModal } from "@/components/prestacao/fornecedores/FornecedorModal";
import { FornecedorDetalhe } from "@/components/prestacao/fornecedores/FornecedorDetalhe";
import { EtiquetaSancoes, EtiquetaSituacao } from "@/components/prestacao/fornecedores/EtiquetasFornecedor";
import { alertasDoFornecedor, formatarDocumento, nomeDoFornecedor, TIPOS_PESSOA, type AlertaFornecedor } from "@/lib/prestacao/fornecedores";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoFornecedor } from "@/lib/supabase/types";

const COLUNAS: ColumnDefinition<string>[] = [
  { id: "fornecedor", label: "Fornecedor", width: "16rem", grow: true, hideable: false },
  { id: "documento", label: "Documento", width: "11rem" },
  { id: "tipo", label: "Tipo", width: "8rem" },
  { id: "situacao", label: "Receita", width: "8.5rem" },
  { id: "sancoes", label: "Sanções", width: "8.5rem" },
  { id: "alertas", label: "Alertas", width: "14rem" },
  { id: "consulta", label: "Consultado em", width: "8.5rem", defaultHidden: true },
];

type Filtro = "todos" | "alerta" | "relacionadas";
type Linha = PrestacaoFornecedor & { nomeExibido: string; alertas: AlertaFornecedor[] };

const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const dataCurta = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const rotuloTipo = (id: string) => TIPOS_PESSOA.find(t => t.id === id)?.rotulo ?? id;

function ResumoAlertas({ alertas }: { alertas: AlertaFornecedor[] }) {
  const graves = alertas.filter(a => a.nivel === "alerta");
  if (graves.length === 0) return <span className="text-[0.6875rem] text-black/25">—</span>;
  return (
    <p className="flex items-start gap-1.5 text-[0.6875rem] text-[#B23B3B]" title={graves.map(a => a.texto).join("\n")}>
      <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
      <span className="line-clamp-2">{graves[0].texto}{graves.length > 1 ? ` (+${graves.length - 1})` : ""}</span>
    </p>
  );
}

export default function FornecedoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const organizationId = useOrganizationId();
  const { confirmDelete } = useDeleteConfirm();

  const [fornecedores, setFornecedores] = useState<PrestacaoFornecedor[]>([]);
  const [podeEditar, setPodeEditar] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [editando, setEditando] = useState<PrestacaoFornecedor | "novo" | null>(null);
  const [aberto, setAberto] = useState<PrestacaoFornecedor | null>(null);

  const buscar = useCallback(async (org: string) => {
    const [lista, papel] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
      (supabase as any).from("prestacao_fornecedores").select("*").eq("organization_id", org),
      supabase.rpc("auth_prestacao_org_pode" as never, { p_org: org, p_acao: "editar" } as never),
    ]);
    return {
      erro: lista.error ? mensagemErroPrestacao(lista.error, "Não foi possível carregar os fornecedores") : "",
      fornecedores: (lista.data ?? []) as PrestacaoFornecedor[],
      podeEditar: papel.data === true,
    };
  }, [supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setFornecedores(dados.fornecedores);
    setPodeEditar(dados.podeEditar);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    buscar(organizationId).then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar, organizationId]);

  const hoje = useMemo(() => new Date(), []);
  const linhas: Linha[] = useMemo(() => fornecedores
    .map(f => ({ ...f, nomeExibido: nomeDoFornecedor(f), alertas: alertasDoFornecedor(f, hoje) }))
    .sort((a, b) => a.nomeExibido.localeCompare(b.nomeExibido, "pt-BR")), [fornecedores, hoje]);

  const termo = semAcento(busca.trim());
  const termoDocumento = busca.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  const comAlerta = (l: Linha) => l.alertas.some(a => a.nivel === "alerta");
  const filtradas = linhas.filter(l =>
    (filtro === "todos" || (filtro === "alerta" ? comAlerta(l) : l.parte_relacionada))
    && (!termo
      || semAcento([l.nomeExibido, l.razao_social, l.nome_fantasia].filter(Boolean).join(" ")).includes(termo)
      || (termoDocumento.length >= 3 && (l.documento ?? "").includes(termoDocumento))));
  const totalComAlerta = linhas.filter(comAlerta).length;
  const totalRelacionadas = linhas.filter(l => l.parte_relacionada).length;
  const hasFilter = filtro !== "todos" || termo !== "";

  function substituir(fornecedor: PrestacaoFornecedor) {
    setFornecedores(atual => atual.some(f => f.id === fornecedor.id)
      ? atual.map(f => (f.id === fornecedor.id ? fornecedor : f))
      : [...atual, fornecedor]);
  }

  function excluir(fornecedor: PrestacaoFornecedor) {
    confirmDelete({
      title: "Excluir fornecedor?",
      description: `"${nomeDoFornecedor(fornecedor)}" sai do cadastro da organização, com os comprovantes guardados.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
        const tabela = (nome: string) => (supabase as any).from(nome);
        const { data: documentos } = await tabela("prestacao_fornecedor_documentos").select("storage_path").eq("fornecedor_id", fornecedor.id);
        const { error } = await tabela("prestacao_fornecedores").delete().eq("id", fornecedor.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir o fornecedor"));
        // Os registros saem com o fornecedor; só então o bucket deixa apagar os arquivos.
        const caminhos = ((documentos ?? []) as { storage_path: string }[]).map(d => d.storage_path);
        if (caminhos.length) await supabase.storage.from("documentos").remove(caminhos);
        setAberto(null);
        setFornecedores(atual => atual.filter(f => f.id !== fornecedor.id));
        setAviso("Fornecedor excluído.");
      },
    });
  }

  const BOTAO_FILTRO = "h-9 shrink-0 rounded border bg-white px-3 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
  const filtros: [Filtro, string, number][] = [
    ["todos", "Todos", linhas.length],
    ["alerta", "Com alerta", totalComAlerta],
    ["relacionadas", "Partes relacionadas", totalRelacionadas],
  ];

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader
        eyebrow="Prestação de contas"
        title="Fornecedores"
        description="Cadastro da organização, com a situação na Receita e as sanções consultadas no TCU."
        summary={!carregando && (
          <>
            <ListSummary strong={linhas.length}>{linhas.length === 1 ? "fornecedor" : "fornecedores"}</ListSummary>
            {totalComAlerta > 0 && <ListSummary strong={totalComAlerta} tone="#B23B3B">com alerta</ListSummary>}
          </>
        )}
        actions={podeEditar && <PrimaryListAction onClick={() => { setAviso(""); setEditando("novo"); }}><Plus size={13} aria-hidden="true" />Novo fornecedor</PrimaryListAction>}
      />

      <ListToolbar search={<ListSearch value={busca} onChange={setBusca} placeholder="Buscar por nome ou documento" />}>
        <div role="group" aria-label="Filtrar fornecedores" className="flex shrink-0 gap-2">
          {filtros.filter(([id, , total]) => id === "todos" || total > 0 || filtro === id).map(([id, rotulo, total]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`${BOTAO_FILTRO} ${filtro === id ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.08] text-black/45 hover:bg-black/[.03]"}`}
            >
              {rotulo} <span className="tabular-nums">({total})</span>
            </button>
          ))}
        </div>
      </ListToolbar>

      <ListContent>
        {aviso && <p role="status" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "rgba(13,13,13,.08)" }}>{aviso}</p>}
        {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "rgba(13,13,13,.08)" }}>{erro}</p>}

        {!carregando && filtradas.length === 0 ? (
          <ListTableSurface>
            <ListEmptyState
              icon={Store}
              title={hasFilter ? "Nenhum fornecedor com esses filtros" : "Nenhum fornecedor cadastrado"}
              description={hasFilter ? undefined : "Cadastre o CNPJ e o Jards consulta a situação na Receita e as sanções no TCU, na CGU e no CNJ."}
              filtered={hasFilter}
              onClearFilters={() => { setFiltro("todos"); setBusca(""); }}
              action={hasFilter || !podeEditar ? undefined : <PrimaryListAction onClick={() => setEditando("novo")}><Plus size={13} aria-hidden="true" />Novo fornecedor</PrimaryListAction>}
            />
          </ListTableSurface>
        ) : (
          <>
            {/* Celular: cartões */}
            <ul className="space-y-2 md:hidden" aria-busy={carregando}>
              {carregando ? Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="h-24 animate-pulse rounded border bg-white motion-reduce:animate-none" style={{ borderColor: "rgba(13,13,13,.08)" }} />
              )) : filtradas.map(l => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => { setAviso(""); setAberto(l); }}
                    className="block w-full rounded border bg-white p-4 text-left transition hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                    style={{ borderColor: "rgba(13,13,13,.08)" }}
                  >
                    <p className="text-[0.8125rem] font-semibold text-black">{l.nomeExibido}</p>
                    <p className="truncate text-[0.6875rem] tabular-nums text-black/40">
                      {[rotuloTipo(l.tipo_pessoa), formatarDocumento(l.documento, { mascararCpf: true })].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <EtiquetaSituacao fornecedor={l} />
                      <EtiquetaSancoes fornecedor={l} />
                    </div>
                    {comAlerta(l) && <div className="mt-2"><ResumoAlertas alertas={l.alertas} /></div>}
                  </button>
                </li>
              ))}
            </ul>

            {/* Telas maiores: tabela com colunas configuráveis */}
            <ListTableSurface className="hidden md:block">
              <ManagedTable storageKey="prestacao-fornecedores" definitions={COLUNAS} className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F9F9F8", borderBottom: "1px solid rgba(13,13,13,.07)" }}>
                    {COLUNAS.map(coluna => (
                      <th key={coluna.id} scope="col" className={`px-4 py-3 text-left ${LIST_HEADER_CELL} whitespace-nowrap`}>{coluna.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carregando ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(13,13,13,.05)" }}>
                      {COLUNAS.map(coluna => (
                        <td key={coluna.id} className="px-4 py-4"><div className="h-3.5 w-3/4 animate-pulse rounded bg-black/[.06] motion-reduce:animate-none" /></td>
                      ))}
                    </tr>
                  )) : filtradas.map(l => (
                    <tr
                      key={l.id}
                      onClick={() => { setAviso(""); setAberto(l); }}
                      className="cursor-pointer transition hover:bg-black/[.025]"
                      style={{ borderBottom: "1px solid rgba(13,13,13,.05)" }}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={event => { event.stopPropagation(); setAviso(""); setAberto(l); }}
                          className="line-clamp-1 text-left text-[0.8125rem] font-semibold text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                        >
                          {l.nomeExibido}
                        </button>
                        {l.nome && l.razao_social && <p className="mt-0.5 line-clamp-1 text-[0.625rem] text-black/35">{l.razao_social}</p>}
                        {l.parte_relacionada && <p className="mt-0.5 text-[0.625rem] text-[#684DB0]">Parte relacionada</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[0.6875rem] tabular-nums text-black/60">{formatarDocumento(l.documento, { mascararCpf: true }) || <span className="text-black/25">—</span>}</td>
                      <td className="px-4 py-3 text-[0.6875rem] text-black/55">{rotuloTipo(l.tipo_pessoa)}</td>
                      <td className="px-4 py-3"><EtiquetaSituacao fornecedor={l} /></td>
                      <td className="px-4 py-3"><EtiquetaSancoes fornecedor={l} /></td>
                      <td className="px-4 py-3"><ResumoAlertas alertas={l.alertas} /></td>
                      <td className="px-4 py-3 text-[0.6875rem] tabular-nums text-black/50">{dataCurta(l.cnpj_consultado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </ManagedTable>
            </ListTableSurface>
          </>
        )}
      </ListContent>

      {aberto && (
        <FornecedorDetalhe
          fornecedor={aberto}
          podeEditar={podeEditar}
          onClose={() => setAberto(null)}
          onEditar={() => { setEditando(aberto); setAberto(null); }}
          onExcluir={() => excluir(aberto)}
          onAtualizado={f => { substituir(f); setAberto(f); }}
        />
      )}
      {editando && organizationId && (
        <FornecedorModal
          organizationId={organizationId}
          fornecedor={editando === "novo" ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={(f, mensagem) => { substituir(f); setEditando(null); setAviso(mensagem); setAberto(f); }}
        />
      )}
    </div>
  );
}
