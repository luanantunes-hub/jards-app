"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Upload, FileText, Image, File, FileSpreadsheet, X, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoComprovante, TipoComprovante, StatusComprovante } from "@/lib/supabase/types";
import { useItensDoOrcamento, type ItemDoOrcamento } from "@/hooks/useItensDoOrcamento";
import { Select } from "@/components/ui/Select";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { fetchOrganizationMembers } from "@/lib/organization/members";

const TIPO_META: Record<TipoComprovante, { label: string; color: string; icon: React.ReactNode; hint?: string }> = {
  nfe:             { label: "NF-e",              color: "#7259B5", icon: <FileText size={13} />,      hint: "Emitida em nome do proponente. Para PJ, é o documento principal." },
  recibo:          { label: "Recibo",            color: "#2D72B0", icon: <FileText size={13} />,      hint: "Usado quando NF não é obrigatória. Deve conter descrição do serviço, valor e assinatura." },
  contrato:        { label: "Contrato",          color: "#1A8B7A", icon: <File size={13} />,          hint: "Contrato de prestação de serviços ou fornecimento. Necessário para cessão de direitos." },
  extrato:         { label: "Extrato bancário",  color: "#2D72B0", icon: <FileSpreadsheet size={13} />, hint: "Comprovante do pagamento efetuado (TED/PIX). Deve confirmar a transação." },
  invoice:         { label: "Invoice",           color: "#1A8B7A", icon: <FileText size={13} />,      hint: "Para prestadores estrangeiros. Se em outro idioma, inclua tradução livre." },
  cartao_embarque: { label: "Cartão de embarque", color: "#B07A14", icon: <File size={13} />,         hint: "Para passagens aéreas. Inclua também NF da agência com nome, trecho, data e valor." },
  print_screenshot:{ label: "Print/Screenshot",  color: "#B07A14", icon: <Image size={13} />,         hint: "Para mídia em redes sociais. Inclua NF da plataforma e prints das veiculações." },
  folha_pagamento: { label: "Folha de pagamento", color: "#2E8932", icon: <FileSpreadsheet size={13} />, hint: "Para remuneração de equipe. Acompanhe com guias de encargos quando houver." },
  guia_tributo:    { label: "Guia de tributo",   color: "#2E8932", icon: <File size={13} />,          hint: "ISS, INSS, IR — inclua junto ao comprovante de pagamento." },
  rpa:             { label: "RPA",               color: "#7259B5", icon: <FileText size={13} />,      hint: "Recibo de Pagamento a Autônomo. Para sócios PF prestando serviço ao projeto." },
  foto:            { label: "Foto",              color: "#B07A14", icon: <Image size={13} />,         hint: "Evidência de execução. Fotos devem mostrar banner/marca do projeto visível." },
  planilha:        { label: "Planilha",          color: "#2E8932", icon: <FileSpreadsheet size={13} /> },
  outro:           { label: "Outro",             color: "rgba(13,13,13,.40)", icon: <File size={13} /> },
};

const STATUS_META: Record<StatusComprovante, { label: string; color: string; icon: React.ReactNode }> = {
  pendente:  { label: "Pendente",  color: "#B07A14", icon: <Clock size={11} />        },
  aceito:    { label: "Aceito",    color: "#2E8932", icon: <CheckCircle size={11} />  },
  rejeitado: { label: "Rejeitado", color: "#D94E4E", icon: <AlertCircle size={11} />  },
};

const fmt = (v: number | null) =>
  v !== null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** Item com o agrupador mais próximo, para distinguir nomes repetidos. */
function rotuloDoItem(item: ItemDoOrcamento): string {
  return item.caminho.length ? `${item.caminho[item.caminho.length - 1]} › ${item.nome}` : item.nome;
}

export default function ComprovantesPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const organizationId = usePrestacaoOrganizacao(id);
  const permissoes = usePermissoesPrestacao(id);
  // Nome de quem avaliou cada comprovante (P0.10).
  const [nomes, setNomes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!organizationId) return;
    fetchOrganizationMembers(organizationId)
      .then(membros => setNomes(Object.fromEntries(membros.map(m => [m.user_id, m.full_name || m.email || "Membro"]))))
      .catch(() => setNomes({}));
  }, [organizationId]);
  const { confirmDelete } = useDeleteConfirm();
  const [erroLista, setErroLista] = useState("");

  const [comprovantes, setComprovantes] = useState<PrestacaoComprovante[]>([]);
  // Itens da versão em uso do orçamento em árvore (P1.6).
  const { itens } = useItensDoOrcamento(id);
  const [periodo, setPeriodo] = useState<{ inicio: string | null; fim: string | null }>({ inicio: null, fim: null });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [uploadError, setUploadError] = useState("");

  type RiscoGlosa = "baixo" | "medio" | "alto";
  const [riscoGlosa, setRiscoGlosa] = useState<RiscoGlosa | null>(null);
  const [motivosGlosa, setMotivosGlosa] = useState<string[]>([]);

  // Form de upload
  const [tipo, setTipo] = useState<TipoComprovante>("nfe");
  const [origem, setOrigem] = useState<"nacional" | "internacional">("nacional");
  const [itemId, setItemId] = useState("");
  const [valorExtraido, setValorExtraido] = useState("");
  const [dataDoc, setDataDoc] = useState("");
  const [descricaoServico, setDescricaoServico] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const fetch = useCallback(async () => {
    const [{ data: comp }, { data: prest }] = await Promise.all([
      (supabase as any).from("prestacao_comprovantes").select("*").eq("prestacao_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("prestacoes_contas").select("data_inicio_execucao, data_fim_execucao").eq("id", id).maybeSingle(),
    ]);
    setComprovantes((comp as PrestacaoComprovante[]) ?? []);
    if (prest) setPeriodo({ inicio: prest.data_inicio_execucao, fim: prest.data_fim_execucao });
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  async function mudarItem(comprovante: PrestacaoComprovante, noId: string) {
    setErroLista("");
    const { error } = await (supabase as any).from("prestacao_comprovantes").update({ no_id: noId || null }).eq("id", comprovante.id);
    if (error) { setErroLista(mensagemErroPrestacao(error, "Não foi possível trocar o item")); return; }
    setComprovantes(lista => lista.map(c => (c.id === comprovante.id ? { ...c, no_id: noId || null } : c)));
  }

  // Caminho do arquivo já enviado ao storage (aguardando confirmação)
  const [storagePath, setStoragePath] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!organizationId) {
      setUploadError("A prestação ainda está carregando. Tente de novo em instantes.");
      return;
    }
    setUploadError("");
    setRiscoGlosa(null);
    setMotivosGlosa([]);
    setPendingFile(file);

    // 1. Sobe o arquivo
    setExtraindo(true);
    setUploadProgress("Enviando arquivo…");
    const path = montarCaminhoPrestacao({
      organizationId,
      prestacaoId: id,
      pasta: { tipo: "comprovantes" },
      nomeOriginal: file.name,
    });
    const { error: storageErr } = await supabase.storage
      .from("documentos")
      .upload(path, file, { upsert: false });

    if (storageErr) {
      console.error("Storage error:", storageErr);
      setUploadError(`Erro no upload: ${storageErr.message}`);
      setExtraindo(false);
      setUploadProgress("");
      return;
    }

    setStoragePath(path);

    // 2. Analisa com IA
    setUploadProgress("Analisando com IA…");
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("extrair-comprovante", {
        body: { storage_path: path, mime_type: file.type, prestacao_id: id },
      });
      if (fnError) {
        let detail = fnError.message;
        const context = (fnError as { context?: Response }).context;
        if (context) {
          try {
            const payload = await context.clone().json();
            detail = [payload.error, payload.provider_message].filter(Boolean).join(": ") || detail;
          } catch {
            // Mantém a mensagem original quando a resposta não for JSON.
          }
        }
        throw new Error(detail);
      }
      if (!fnData || fnData.error) throw new Error(fnData?.error || "Resposta vazia da IA");

      const hasExtractedData =
        fnData.valor != null ||
        Boolean(fnData.data_doc) ||
        Boolean(fnData.descricao_servico) ||
        Boolean(fnData.tipo_sugerido) ||
        Boolean(fnData.rubrica_sugerida_id);

      if (!hasExtractedData) {
        throw new Error("Não foram encontrados campos legíveis no documento");
      }

      if (fnData.valor != null) setValorExtraido(String(fnData.valor));
      if (fnData.data_doc) setDataDoc(String(fnData.data_doc).slice(0, 10));
      if (fnData.descricao_servico) setDescricaoServico(String(fnData.descricao_servico));
      if (fnData.tipo_sugerido && fnData.tipo_sugerido in TIPO_META) {
        setTipo(fnData.tipo_sugerido as TipoComprovante);
      }
      if (fnData.rubrica_sugerida_id && itens.some(it => it.id === fnData.rubrica_sugerida_id)) {
        setItemId(fnData.rubrica_sugerida_id);
      }
      if (["baixo", "medio", "alto"].includes(fnData.risco_glosa)) {
        setRiscoGlosa(fnData.risco_glosa as RiscoGlosa);
      }
      if (Array.isArray(fnData.motivos_glosa)) {
        setMotivosGlosa(fnData.motivos_glosa.map(String));
      }
    } catch (error) {
      console.error("Erro ao extrair comprovante:", error);
      setUploadError(
        error instanceof Error
          ? `A IA não conseguiu preencher os campos: ${error.message}`
          : "A IA não conseguiu analisar este documento. Preencha os campos manualmente.",
      );
    }

    setExtraindo(false);
    setUploadProgress("");
  }

  async function handleUpload() {
    if (!pendingFile || !storagePath) return;
    setUploading(true);
    setUploadProgress("Salvando…");

    const { data: { user } } = await supabase.auth.getUser();

    const { error: insertErro } = await (supabase as any).from("prestacao_comprovantes").insert({
      prestacao_id: id,
      no_id: itemId || null,
      tipo,
      origem,
      nome_arquivo: pendingFile.name,
      storage_path: storagePath,
      valor_extraido: valorExtraido ? Number(valorExtraido) : null,
      data_doc: dataDoc || null,
      descricao_servico: descricaoServico.trim() || null,
      observacao: observacao.trim() || null,
      enviado_por: user?.id ?? null,
      risco_glosa: riscoGlosa || null,
      motivos_glosa: motivosGlosa.length > 0 ? motivosGlosa : [],
    });
    if (insertErro) {
      setUploadError(`Não foi possível salvar o comprovante: ${insertErro.message}`);
      setUploadProgress("");
      setUploading(false);
      return;
    }

    setPendingFile(null);
    setStoragePath(null);
    setValorExtraido("");
    setDataDoc("");
    setDescricaoServico("");
    setObservacao("");
    setOrigem("nacional");
    setItemId("");
    setUploadProgress("");
    setRiscoGlosa(null);
    setMotivosGlosa([]);
    setUploading(false);
    fetch();
  }

  async function cancelarUpload() {
    if (storagePath) {
      await supabase.storage.from("documentos").remove([storagePath]);
    }
    setPendingFile(null);
    setStoragePath(null);
    setValorExtraido("");
    setDataDoc("");
    setDescricaoServico("");
    setObservacao("");
    setOrigem("nacional");
    setItemId("");
    setUploadProgress("");
    setUploadError("");
    setRiscoGlosa(null);
    setMotivosGlosa([]);
    setExtraindo(false);
  }

  function excluir(comprovante: PrestacaoComprovante) {
    confirmDelete({
      title: "Excluir comprovante?",
      description: `"${comprovante.nome_arquivo}" e o arquivo enviado serão apagados.`,
      onConfirm: async () => {
        // Apaga a linha antes do arquivo: se a linha falhar, o arquivo continua acessível.
        const { error } = await (supabase as any).from("prestacao_comprovantes").delete().eq("id", comprovante.id);
        if (error) throw new Error(error.message);
        await supabase.storage.from("documentos").remove([comprovante.storage_path]);
        fetch();
      },
    });
  }

  async function getUrl(path: string) {
    setErroLista("");
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else setErroLista(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  async function mudarStatus(compId: string, status: StatusComprovante) {
    setErroLista("");
    // Aceitar ou rejeitar grava quem e quando, numa função do banco (P0.10).
    const { error } = await (supabase as any).rpc("fn_prestacao_avaliar_comprovante", {
      p_comprovante_id: compId,
      p_status: status,
    });
    if (error) setErroLista(mensagemErroPrestacao(error, "Não foi possível mudar o status"));
    fetch();
  }

  return (
    <div className="px-8 py-6 space-y-5">
      {/* Upload */}
      <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <p className="text-[0.75rem] font-semibold text-black">Enviar comprovante</p>
        </div>
        <div className="p-5">
          {!pendingFile ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded border-2 border-dashed transition hover:border-[#7259B5]/40 hover:bg-black/[.04]"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            >
              <Upload size={20} className="text-black/20" />
              <p className="text-[0.75rem] text-black/40">Clique para selecionar arquivo</p>
              <p className="text-[0.625rem] text-black/25">PDF, imagem, planilha, XML…</p>
            </button>
          ) : (
            <div className="space-y-3">
              {/* Arquivo selecionado */}
              <div className="flex items-center gap-3 p-3 rounded border" style={{ borderColor: "rgba(13,13,13,.10)", background: "#FAFAFA" }}>
                <FileText size={16} className="text-[#7259B5] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[0.75rem] font-medium text-black truncate">{pendingFile.name}</p>
                  <p className="text-[0.625rem] text-black/35">{(pendingFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={cancelarUpload} className="p-1 rounded hover:bg-black/5 text-black/30 hover:text-black/55">
                  <X size={13} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tipo */}
                <div className="col-span-2">
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">Tipo de documento</label>
                  <Select
                    value={tipo}
                    onChange={e => setTipo(e.target.value as TipoComprovante)}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  >
                    <optgroup label="Fiscais">
                      {(["nfe","recibo","rpa","invoice","folha_pagamento","guia_tributo"] as TipoComprovante[]).map(k => (
                        <option key={k} value={k}>{TIPO_META[k].label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Complementares">
                      {(["extrato","contrato","cartao_embarque","print_screenshot","foto","planilha","outro"] as TipoComprovante[]).map(k => (
                        <option key={k} value={k}>{TIPO_META[k].label}</option>
                      ))}
                    </optgroup>
                  </Select>
                  {TIPO_META[tipo].hint && (
                    <p className="text-[0.625rem] mt-1.5 leading-relaxed" style={{ color: "rgba(13,13,13,.38)" }}>
                      {TIPO_META[tipo].hint}
                    </p>
                  )}
                </div>

                {/* Origem */}
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">Origem</label>
                  <div className="flex gap-2">
                    {(["nacional", "internacional"] as const).map(o => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setOrigem(o)}
                        className="flex-1 py-2 rounded border text-[0.6875rem] font-semibold transition capitalize"
                        style={{
                          background: origem === o ? "#fff" : "white",
                          borderColor: origem === o ? "#7259B5" : "rgba(13,13,13,.12)",
                          color: origem === o ? "#7259B5" : "rgba(13,13,13,.45)",
                        }}
                      >
                        {o === "nacional" ? "Nacional" : "Internacional"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rubrica */}
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">Item do orçamento</label>
                  <Select
                    value={itemId}
                    onChange={e => setItemId(e.target.value)}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)", color: itemId ? "#0D0D0D" : "rgba(13,13,13,.35)" }}
                  >
                    <option value="">Sem item</option>
                    {itens.map(it => <option key={it.id} value={it.id}>{rotuloDoItem(it)}</option>)}
                  </Select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">Valor (R$)</label>
                  <input
                    type="number"
                    value={valorExtraido}
                    onChange={e => setValorExtraido(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>

                {/* Data */}
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">Data do documento</label>
                  <input
                    type="date"
                    value={dataDoc}
                    onChange={e => setDataDoc(e.target.value)}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
              </div>

              {/* Descrição do serviço */}
              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">
                  Descrição do serviço
                  {tipo === "nfe" && <span className="ml-1 font-normal text-[#D94E4E]/70">(deve corresponder à rubrica aprovada)</span>}
                </label>
                <input
                  value={descricaoServico}
                  onChange={e => setDescricaoServico(e.target.value)}
                  placeholder={tipo === "cartao_embarque" ? "Passageiros e trechos" : tipo === "invoice" ? "Descrição do serviço prestado (tradução livre)": "Descrição do serviço ou produto"}
                  className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>

              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">Observação</label>
                <input
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Observação"
                  className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>

              {/* Risco de glosa */}
              {riscoGlosa && (
                <div className="rounded border p-3 space-y-1.5"
                  style={{
                    background: riscoGlosa === "alto" ? "#fff" : riscoGlosa === "medio" ? "#fff" : "#fff",
                    borderColor: riscoGlosa === "alto" ? "#D94E4E30" : riscoGlosa === "medio" ? "#B07A1430" : "#2E893230",
                  }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.625rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                      style={{
                        background: riscoGlosa === "alto" ? "#D94E4E" : riscoGlosa === "medio" ? "#B07A14" : "#2E8932",
                        color: "white",
                      }}>
                      Risco de glosa {riscoGlosa === "alto" ? "ALTO" : riscoGlosa === "medio" ? "MÉDIO" : "BAIXO"}
                    </span>
                    <span className="text-[0.625rem] text-black/40">análise da IA</span>
                  </div>
                  {motivosGlosa.length > 0 && (
                    <ul className="space-y-0.5">
                      {motivosGlosa.map((m, i) => (
                        <li key={i} className="text-[0.6875rem] flex items-start gap-1.5"
                          style={{ color: riscoGlosa === "alto" ? "#D94E4E" : riscoGlosa === "medio" ? "#B07A14" : "#2E8932" }}>
                          <span className="mt-0.5">•</span>{m}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Erro de upload */}
              {uploadError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded border text-[0.6875rem]"
                  style={{ background: "#fff", borderColor: "#D94E4E30", color: "#D94E4E" }}>
                  {uploadError}
                </div>
              )}

              {/* Banner IA analisando */}
              {extraindo && (
                <div className="flex items-center gap-2 px-3 py-2 rounded border text-[0.6875rem]"
                  style={{ background: "#fff", borderColor: "#7259B530", color: "#7259B5" }}>
                  <span className="w-3 h-3 border-2 border-[#7259B5]/30 border-t-[#7259B5] rounded-full animate-spin flex-shrink-0" />
                  {uploadProgress || "Analisando documento com IA…"}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={cancelarUpload}
                  disabled={uploading}
                  className="px-3 py-1.5 text-[0.6875rem] text-black/35 hover:text-black/55 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || extraindo}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-[0.75rem] font-semibold text-white rounded transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#7259B5" }}
                >
                  {uploading
                    ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando…</>
                    : <><Upload size={12} /> Enviar</>}
                </button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.xml,.xlsx,.xls,.csv" />
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <p className="text-[0.75rem] font-semibold text-black">
            Documentos enviados
            {comprovantes.length > 0 && <span className="text-black/30 font-normal text-[0.6875rem] ml-1.5">({comprovantes.length})</span>}
          </p>
        </div>

        {erroLista && (
          <p role="alert" className="mx-5 mt-4 px-3 py-2 rounded border text-[0.6875rem]"
            style={{ background: "#fff", borderColor: "#D94E4E30", color: "#D94E4E" }}>
            {erroLista}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-4 h-4 border-2 border-black/10 border-t-[#7259B5] rounded-full animate-spin" />
          </div>
        ) : comprovantes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[0.75rem] text-black/30">Nenhum comprovante enviado ainda.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(13,13,13,.05)" }}>
            {comprovantes.map(c => {
              const tipoM = TIPO_META[c.tipo];
              const statusM = STATUS_META[c.status];
              const rubrica = itens.find(it => it.id === c.no_id);
              return (
                <div key={c.id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-black/[.02] sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
                  {/* Ícone tipo */}
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#fff", border: `1px solid ${tipoM.color}47`, color: tipoM.color }}>
                    {tipoM.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <button
                        onClick={() => getUrl(c.storage_path)}
                        title={c.nome_arquivo}
                        className="flex min-w-0 max-w-xs items-center gap-1 rounded text-[0.75rem] font-semibold text-black transition hover:text-[#7259B5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                      >
                        <span className="truncate">{c.nome_arquivo}</span> <ExternalLink size={10} className="flex-shrink-0 opacity-50" />
                      </button>
                      <span className="shrink-0 whitespace-nowrap text-[0.5625rem] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "#fff", border: `1px solid ${tipoM.color}47`, color: tipoM.color }}>
                        {tipoM.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[0.625rem] text-black/35 flex-wrap">
                      {permissoes.editar && itens.length > 0 ? (
                        <Select
                          value={c.no_id ?? ""}
                          onChange={e => mudarItem(c, e.target.value)}
                          aria-label={`Item do orçamento de ${c.nome_arquivo}`}
                          block={false}
                          className="max-w-[11rem] truncate rounded border px-1.5 py-0.5 text-[0.625rem] focus:outline-none sm:max-w-[16rem]"
                          style={{ borderColor: "rgba(13,13,13,.12)", color: rubrica ? "rgba(13,13,13,.65)" : "#B07A14" }}
                        >
                          <option value="">{c.no_id ? "Item de outra versão" : "Sem item"}</option>
                          {itens.map(it => <option key={it.id} value={it.id}>{rotuloDoItem(it)}</option>)}
                        </Select>
                      ) : (
                        <span>{rubrica ? rotuloDoItem(rubrica) : "Sem item"}</span>
                      )}
                      {c.origem === "internacional" && (
                        <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold" style={{ background: "#fff", border: "1px solid #1A8B7A47", color: "#1A8B7A" }}>Internacional</span>
                      )}
                      {c.valor_extraido !== null && <span className="tabular-nums">{fmt(c.valor_extraido)}</span>}
                      {c.data_doc && <span>{fmtDate(c.data_doc)}</span>}
                      {c.data_doc && (() => {
                        const d = c.data_doc!;
                        const fora =
                          (periodo.inicio && d < periodo.inicio) ||
                          (periodo.fim && d > periodo.fim);
                        return fora ? (
                          <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold"
                            style={{ background: "#fff", border: "1px solid #D94E4E47", color: "#D94E4E" }}>
                            Fora do período
                          </span>
                        ) : null;
                      })()}
                      {c.descricao_servico && <span className="truncate max-w-[12.5rem]">{c.descricao_servico}</span>}
                      {c.observacao && <span className="italic">"{c.observacao}"</span>}
                      {(c as any).risco_glosa && (c as any).risco_glosa !== "baixo" && (
                        <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold uppercase"
                          style={{
                            background: (c as any).risco_glosa === "alto" ? "#fff" : "#fff",
                            color: (c as any).risco_glosa === "alto" ? "#D94E4E" : "#B07A14",
                          }}>
                          Glosa {(c as any).risco_glosa}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + ações: no celular descem para baixo das informações */}
                  <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
                    {c.avaliado_em && (
                      <span className="hidden text-right text-[0.5625rem] leading-tight text-black/35 sm:block">
                        {c.status === "aceito" ? "Aceito" : "Rejeitado"} por {nomes[c.avaliado_por ?? ""] ?? "membro"}
                        <span className="block">{new Date(c.avaliado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                      </span>
                    )}
                    <Select
                      value={c.status}
                      disabled={!permissoes.avaliar}
                      title={permissoes.avaliar ? undefined : "Aceitar ou rejeitar cabe ao administrador, revisor ou responsável"}
                      onChange={e => mudarStatus(c.id, e.target.value as StatusComprovante)}
                      aria-label={`Situação de ${c.nome_arquivo}`}
                      block={false}
                      className="text-[0.625rem] font-semibold px-2 py-1 rounded border focus:outline-none"
                      style={{
                        borderColor: `${statusM.color}30`,
                        color: statusM.color,
                        background: "#fff",
                      }}
                    >
                      {(Object.entries(STATUS_META) as [StatusComprovante, typeof STATUS_META[StatusComprovante]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </Select>
                    <button
                      onClick={() => excluir(c)}
                      aria-label={`Excluir comprovante ${c.nome_arquivo}`}
                      className="p-1.5 rounded hover:bg-black/[.04] text-black/20 hover:text-[#D94E4E] transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
