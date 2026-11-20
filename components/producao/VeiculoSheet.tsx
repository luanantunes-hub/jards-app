"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CATEGORIAS_DO_VEICULO, COMBUSTIVEIS_DO_VEICULO, CONTRATACOES_DO_VEICULO, TIPOS_DE_DOCUMENTO_DO_VEICULO } from "@/lib/producao/estados";
import type { CategoriaDoVeiculo, CombustivelDoVeiculo, ContratacaoDoVeiculo, TipoDeDocumentoDoVeiculo } from "@/lib/producao/estados";
import {
  lerDocumentoDoVeiculo, lerVeiculo, ROTULO_DA_CATEGORIA_DO_VEICULO, ROTULO_DA_CONTRATACAO, ROTULO_DO_COMBUSTIVEL,
  ROTULO_DO_DOCUMENTO_DO_VEICULO, situacaoDoDocumento, type SituacaoDoDocumento,
} from "@/lib/producao/veiculos";
import { diaEMes } from "@/lib/producao/agenda";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

export type DocumentoDoVeiculo = { id: string; tipo: TipoDeDocumentoDoVeiculo; numero: string | null; validade: string | null; observacoes: string | null };
export type VeiculoEditavel = {
  id: string; nome: string; placa: string | null; modelo: string | null; ano: number | null; categoria: CategoriaDoVeiculo; combustivel: CombustivelDoVeiculo;
  contratacao: ContratacaoDoVeiculo; fornecedor: string | null; consumo_km_por_litro: number | null; capacidade_carga_kg: number | null;
  capacidade_volume_m3: number | null; lugares: number | null; notas: string | null; arquivado: boolean; documentos: DocumentoDoVeiculo[];
};

const emTexto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

const COR_DA_SITUACAO: Record<SituacaoDoDocumento, { texto: string; cor: string | null }> = {
  sem_validade: { texto: "sem validade", cor: null }, em_dia: { texto: "em dia", cor: null }, vence_em_breve: { texto: "vence em breve", cor: "#B07A14" }, vencido: { texto: "vencido", cor: "#B23B3B" },
};

/** Cadastro e edição de um veículo; ao editar, os documentos dele (documento do veículo, seguro, ANTT, vistoria) com a validade. */
export function VeiculoSheet({ organizationId, veiculo, hoje, onClose, onSaved }: {
  organizationId: string; veiculo?: VeiculoEditavel; hoje: string; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(veiculo?.nome ?? "");
  const [placa, setPlaca] = useState(veiculo?.placa ?? "");
  const [modelo, setModelo] = useState(veiculo?.modelo ?? "");
  const [ano, setAno] = useState(emTexto(veiculo?.ano));
  const [categoria, setCategoria] = useState<string>(veiculo?.categoria ?? "van");
  const [combustivel, setCombustivel] = useState<string>(veiculo?.combustivel ?? "flex");
  const [contratacao, setContratacao] = useState<string>(veiculo?.contratacao ?? "proprio");
  const [fornecedor, setFornecedor] = useState(veiculo?.fornecedor ?? "");
  const [consumo, setConsumo] = useState(emTexto(veiculo?.consumo_km_por_litro));
  const [carga, setCarga] = useState(emTexto(veiculo?.capacidade_carga_kg));
  const [volume, setVolume] = useState(emTexto(veiculo?.capacidade_volume_m3));
  const [lugares, setLugares] = useState(emTexto(veiculo?.lugares));
  const [notas, setNotas] = useState(veiculo?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoDoVeiculo[]>(veiculo?.documentos ?? []);
  const [tipoNovo, setTipoNovo] = useState<string>("documento_do_veiculo");
  const [numeroNovo, setNumeroNovo] = useState("");
  const [validadeNova, setValidadeNova] = useState("");
  const [erroDoDocumento, setErroDoDocumento] = useState<string | null>(null);
  const [ocupadoComDocumento, setOcupadoComDocumento] = useState(false);

  async function salvar(fechar: () => void) {
    const leitura = lerVeiculo({ nome, placa, modelo, ano, categoria, combustivel, contratacao, fornecedor, consumo, carga, volume, lugares, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = veiculo
      ? await producao.from("producao_veiculos").update(leitura.veiculo).eq("id", veiculo.id)
      : await producao.from("producao_veiculos").insert({ organization_id: organizationId, ...leitura.veiculo });
    setSalvando(false);
    if (error) {
      setErro(error.code === "42501" ? "Você não pode salvar veículos aqui." : error.code === "23505" ? "Já existe um veículo com essa placa." : "Não foi possível salvar. Tente de novo.");
      return;
    }
    onSaved();
    fechar();
  }

  async function arquivar(fechar: () => void) {
    if (!veiculo) return;
    setSalvando(true);
    const { error } = await clienteDaProducao(createClient()).from("producao_veiculos").update({ arquivado: !veiculo.arquivado }).eq("id", veiculo.id);
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!veiculo) return;
    confirmDelete({
      title: "Apagar veículo?",
      description: `"${veiculo.nome}" e os documentos dele saem do cadastro. Para só tirar da lista, use Arquivar.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_veiculos").delete().eq("id", veiculo.id);
        if (error) throw new Error("Não foi possível apagar o veículo.");
        onSaved();
        fechar();
      },
    });
  }

  async function adicionarDocumento() {
    if (!veiculo) return;
    const leitura = lerDocumentoDoVeiculo({ tipo: tipoNovo, numero: numeroNovo, validade: validadeNova, observacoes: "" });
    if (!leitura.ok) { setErroDoDocumento(leitura.erro); return; }
    setOcupadoComDocumento(true);
    setErroDoDocumento(null);
    const { data, error } = await clienteDaProducao(createClient()).from("producao_veiculo_documentos")
      .insert({ organization_id: organizationId, veiculo_id: veiculo.id, ...leitura.documento })
      .select("id, tipo, numero, validade, observacoes").single();
    setOcupadoComDocumento(false);
    if (error || !data) { setErroDoDocumento(error?.code === "42501" ? "Você não pode salvar documentos aqui." : "Não foi possível salvar o documento. Tente de novo."); return; }
    setDocumentos(atual => [...atual, data].sort((a, b) => (a.validade ?? "9999").localeCompare(b.validade ?? "9999")));
    setNumeroNovo("");
    setValidadeNova("");
    onSaved();
  }

  async function removerDocumento(id: string) {
    setOcupadoComDocumento(true);
    setErroDoDocumento(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_veiculo_documentos").delete().eq("id", id);
    setOcupadoComDocumento(false);
    if (error) { setErroDoDocumento("Não foi possível remover o documento. Tente de novo."); return; }
    setDocumentos(atual => atual.filter(documento => documento.id !== id));
    onSaved();
  }

  const campo = (rotulo: string, id: string, valor: string, mudar: (v: string) => void, extra: { placeholder?: string; modo?: "numeric" | "decimal"; tipo?: string; maiusculas?: boolean } = {}) => (
    <div>
      <label className={ROTULO} htmlFor={id}>{rotulo}</label>
      <input id={id} type={extra.tipo ?? "text"} inputMode={extra.modo} className={`${CAMPO}${extra.maiusculas ? " uppercase" : ""}`} value={valor} onChange={event => mudar(event.target.value)} placeholder={extra.placeholder} disabled={salvando} />
    </div>
  );

  return (
    <TopSheet
      titulo={veiculo ? "Editar veículo" : "Novo veículo"}
      onClose={onClose}
      footer={fechar => (
        <>
          {veiculo && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          {veiculo && <button type="button" onClick={() => void arquivar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{veiculo.arquivado ? "Desarquivar" : "Arquivar"}</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : veiculo ? "Salvar" : "Criar veículo"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-[1fr_9rem] gap-3">
          {campo("Nome", "veiculo-nome", nome, setNome, { placeholder: "Van da produção" })}
          {campo("Placa", "veiculo-placa", placa, setPlaca, { placeholder: "ABC1D23", maiusculas: true })}
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          {campo("Modelo", "veiculo-modelo", modelo, setModelo, { placeholder: "Mercedes Sprinter 415" })}
          {campo("Ano", "veiculo-ano", ano, setAno, { modo: "numeric", placeholder: "2021" })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Tipo</span>
            <Dropdown value={categoria} onChange={setCategoria} options={CATEGORIAS_DO_VEICULO.map(valor => ({ value: valor, label: ROTULO_DA_CATEGORIA_DO_VEICULO[valor] }))} />
          </div>
          <div>
            <span className={ROTULO}>Combustível</span>
            <Dropdown value={combustivel} onChange={setCombustivel} options={COMBUSTIVEIS_DO_VEICULO.map(valor => ({ value: valor, label: ROTULO_DO_COMBUSTIVEL[valor] }))} />
          </div>
        </div>
        <div className={`grid gap-3 ${contratacao === "proprio" ? "grid-cols-1" : "grid-cols-2"}`}>
          <div>
            <span className={ROTULO}>Como é contratado</span>
            <Dropdown value={contratacao} onChange={setContratacao} options={CONTRATACOES_DO_VEICULO.map(valor => ({ value: valor, label: ROTULO_DA_CONTRATACAO[valor] }))} />
          </div>
          {contratacao !== "proprio" && campo("Locadora ou empresa de fretamento", "veiculo-fornecedor", fornecedor, setFornecedor)}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {campo("Consumo (km/l)", "veiculo-consumo", consumo, setConsumo, { modo: "decimal", placeholder: "9,5" })}
          {campo("Carga (kg)", "veiculo-carga", carga, setCarga, { modo: "numeric" })}
          {campo("Volume (m³)", "veiculo-volume", volume, setVolume, { modo: "decimal" })}
          {campo("Lugares", "veiculo-lugares", lugares, setLugares, { modo: "numeric" })}
        </div>
        <div>
          <label className={ROTULO} htmlFor="veiculo-notas">Notas</label>
          <textarea id="veiculo-notas" rows={3} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={2000} disabled={salvando} />
        </div>

        {veiculo ? (
          <section aria-labelledby="veiculo-documentos" className="border-t pt-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <h3 id="veiculo-documentos" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Documentos</h3>
            {erroDoDocumento && <p role="alert" className="mb-2 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erroDoDocumento}</p>}
            {documentos.length > 0 && (
              <ul className="mb-3 divide-y divide-black/[.06] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {documentos.map(documento => {
                  const situacao = situacaoDoDocumento(documento.validade, hoje);
                  const aviso = COR_DA_SITUACAO[situacao];
                  return (
                    <li key={documento.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{ROTULO_DO_DOCUMENTO_DO_VEICULO[documento.tipo]}{documento.numero ? ` · ${documento.numero}` : ""}</span>
                        <span className="block text-[0.6875rem] text-black/45">
                          {documento.validade ? `vale até ${diaEMes(documento.validade)} de ${documento.validade.slice(0, 4)}` : "sem validade"}
                          {aviso.cor && <span style={{ color: aviso.cor }}> · {aviso.texto}</span>}
                        </span>
                      </span>
                      <button type="button" onClick={() => void removerDocumento(documento.id)} disabled={ocupadoComDocumento} aria-label={`Remover ${ROTULO_DO_DOCUMENTO_DO_VEICULO[documento.tipo]}`} title="Remover" className="flex h-10 w-10 items-center justify-center rounded text-black/40 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><Trash2 size={14} aria-hidden="true" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="grid grid-cols-[1fr_1fr_9.5rem_auto] items-end gap-2">
              <div>
                <span className={ROTULO}>Tipo</span>
                <Dropdown value={tipoNovo} onChange={setTipoNovo} options={TIPOS_DE_DOCUMENTO_DO_VEICULO.map(valor => ({ value: valor, label: ROTULO_DO_DOCUMENTO_DO_VEICULO[valor] }))} />
              </div>
              <div>
                <label className={ROTULO} htmlFor="documento-numero">Número</label>
                <input id="documento-numero" className={CAMPO} value={numeroNovo} onChange={event => setNumeroNovo(event.target.value)} disabled={ocupadoComDocumento} />
              </div>
              <div>
                <label className={ROTULO} htmlFor="documento-validade">Vale até</label>
                <input id="documento-validade" type="date" className={CAMPO} value={validadeNova} onChange={event => setValidadeNova(event.target.value)} disabled={ocupadoComDocumento} />
              </div>
              <button type="button" onClick={() => void adicionarDocumento()} disabled={ocupadoComDocumento} className="h-10 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/65 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">Adicionar</button>
            </div>
          </section>
        ) : null}
      </div>
    </TopSheet>
  );
}
