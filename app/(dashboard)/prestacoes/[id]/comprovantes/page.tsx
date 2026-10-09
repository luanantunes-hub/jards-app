"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Upload, FileText, Image, File, FileSpreadsheet, X, CheckCircle, AlertCircle, AlertTriangle, Clock, ExternalLink, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoComprovante, TipoComprovante, StatusComprovante } from "@/lib/supabase/types";
import { useItensDoOrcamento, type ItemDoOrcamento } from "@/hooks/useItensDoOrcamento";
import { Select } from "@/components/ui/Select";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { useFornecedoresDaOrganizacao } from "@/hooks/useFornecedoresDaOrganizacao";
import { DespesaModal } from "@/components/prestacao/despesas/DespesaModal";
import { FornecedorCombobox } from "@/components/prestacao/despesas/FornecedorCombobox";
import { DocumentoLido } from "@/components/prestacao/despesas/DocumentoLido";
import { despesaDoDocumento, ehXml, lerDocumentoFiscal, type AvisoDoDocumento, type DespesaSugerida, type DocumentoFiscalLido, type ParteDoDocumento } from "@/lib/prestacao/documento-fiscal";
import { documentoDaLeituraIa, motivosDaIa, motivosParaMostrar } from "@/lib/prestacao/leitura-ia";
import type { LeituraDoComprovante, MotivoLido } from "@/supabase/functions/_shared/leitura-documento";
import { decodificarArquivo } from "@/lib/prestacao/extrato";
import { alertasDaDespesa, ehDespesa, TIPOS_COMPLEMENTARES, TIPOS_FISCAIS } from "@/lib/prestacao/despesas";
import { nomeDoFornecedor } from "@/lib/prestacao/fornecedores";
import { alertasDosPagamentos, situacaoDosPagamentos } from "@/lib/prestacao/pagamentos";
import { definida } from "@/lib/prestacao/regimes/tipos";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import type { PrestacaoPagamento } from "@/lib/supabase/types";

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
  nfse:            { label: "NFS-e",             color: "#7259B5", icon: <FileText size={13} />,      hint: "Nota de serviço em nome do proponente. Confira as retenções (ISS, INSS e IRRF)." },
  cupom:           { label: "Cupom (NFC-e)",     color: "#2D72B0", icon: <FileText size={13} />,      hint: "Compra no varejo. Alguns regimes só aceitam para valores pequenos." },
  rpci:            { label: "RPCI",              color: "#7259B5", icon: <FileText size={13} />,      hint: "Recibo de pagamento a contribuinte individual, com INSS retido." },
  fatura:          { label: "Fatura",            color: "#2D72B0", icon: <FileText size={13} />,      hint: "Cobrança de serviço contínuo (telefone, energia, locação). De PJ, peça a nota fiscal." },
  apolice:         { label: "Apólice de seguro", color: "#1A8B7A", icon: <File size={13} />,          hint: "Seguro contratado para o projeto, com o período coberto." },
  nota_debito:     { label: "Nota de débito",    color: "#B07A14", icon: <File size={13} />,          hint: "Reembolso ou repasse sem tributo. Não substitui a nota fiscal de serviço." },
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

const TIPOS_OPCOES = [...TIPOS_FISCAIS, ...TIPOS_COMPLEMENTARES].map(t => ({ value: t, label: TIPO_META[t].label }));

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
  // Despesa v2 (P2.4): fornecedores da organização e o comprovante aberto como despesa.
  const { fornecedores, documentosDe } = useFornecedoresDaOrganizacao(organizationId);
  const [despesaAberta, setDespesaAberta] = useState<PrestacaoComprovante | null>(null);
  const abriuDoLink = useRef(false);
  // Pagamentos (P2.5) e os meios de pagamento do regime da prestação.
  const [pagamentos, setPagamentos] = useState<PrestacaoPagamento[]>([]);
  // Metas do objeto (P3.3): a despesa mostra a meta a que serve.
  const [metas, setMetas] = useState<{ id: string; descricao: string; no_id: string | null }[]>([]);
  // Bens (P3.5): a despesa de item de bem permanente mostra o bem ou pede o registro.
  const [bens, setBens] = useState<{ id: string; descricao: string; despesa_id: string | null; no_id: string | null }[]>([]);
  const [regimeId, setRegimeId] = useState<string | null>(null);
  const regimes = useRegimesPublicados();
  const regime = regimes.find(r => r.id === regimeId)?.regime ?? null;
  const regimePagamentos = regime ? definida(regime.pagamentos) : null;
  // Itens da versão em uso do orçamento em árvore (P1.6).
  const { itens } = useItensDoOrcamento(id);
  const [periodo, setPeriodo] = useState<{ inicio: string | null; fim: string | null }>({ inicio: null, fim: null });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [uploadError, setUploadError] = useState("");


  // Form de upload
  const [tipo, setTipo] = useState<TipoComprovante>("nfe");
  const [origem, setOrigem] = useState<"nacional" | "internacional">("nacional");
  const [itemId, setItemId] = useState("");
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [valorExtraido, setValorExtraido] = useState("");
  const [dataDoc, setDataDoc] = useState("");
  const [descricaoServico, setDescricaoServico] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Documento lido do XML (sem IA) ou pela IA (P2.10), com os motivos que a IA apontou, e o que a
  // leitura confere: o proponente e o número do projeto.
  const [lido, setLido] = useState<{ documento: DocumentoFiscalLido; sugestao: DespesaSugerida; motivos: MotivoLido[] } | null>(null);
  const [dadosFiscais, setDadosFiscais] = useState<{ identificador: string | null; proponente: ParteDoDocumento | null }>({ identificador: null, proponente: null });

  const fetch = useCallback(async () => {
    const [{ data: comp }, { data: prest }, { data: pags }, { data: ms }, { data: bs }] = await Promise.all([
      (supabase as any).from("prestacao_comprovantes").select("*").eq("prestacao_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("prestacoes_contas").select("data_inicio_execucao, data_fim_execucao, regime_id, identificador_oficial, proponente:proponentes(cnpj, nome)").eq("id", id).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
      (supabase as any).from("prestacao_pagamentos").select("*").eq("prestacao_id", id),
      (supabase as any).from("prestacao_metas").select("id, descricao, no_id").eq("prestacao_id", id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_bens ainda não está no tipo Database
      (supabase as any).from("prestacao_bens").select("id, descricao, despesa_id, no_id").eq("prestacao_id", id),
    ]);
    const lista = (comp as PrestacaoComprovante[]) ?? [];
    setComprovantes(lista);
    setPagamentos((pags as PrestacaoPagamento[]) ?? []);
    setMetas(ms ?? []);
    setBens(bs ?? []);
    // Link da fila de pendências (P2.9): ?despesa=<id> abre a despesa, só na primeira leitura.
    if (!abriuDoLink.current) {
      abriuDoLink.current = true;
      const alvo = new URLSearchParams(window.location.search).get("despesa");
      const doLink = alvo ? lista.find(c => c.id === alvo) : null;
      if (doLink) setDespesaAberta(doLink);
    }
    if (prest) {
      setPeriodo({ inicio: prest.data_inicio_execucao, fim: prest.data_fim_execucao });
      setRegimeId(prest.regime_id ?? null);
      setDadosFiscais({
        identificador: prest.identificador_oficial ?? null,
        proponente: prest.proponente ? { documento: prest.proponente.cnpj ?? null, nome: prest.proponente.nome ?? null } : null,
      });
    }
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

  /** Preenche o formulário com o documento lido (XML ou IA) e guarda o que mostrar para conferir. */
  function aplicarLeitura(documento: DocumentoFiscalLido, opcoes: { tipo: boolean; motivos?: MotivoLido[]; avisos?: AvisoDoDocumento[]; item?: string | null }) {
    const sugestao = despesaDoDocumento(documento, {
      fornecedores,
      proponente: dadosFiscais.proponente,
      identificador: dadosFiscais.identificador,
      chavesUsadas: comprovantes.filter(c => c.chave_acesso).map(c => ({ chave: c.chave_acesso!, nome: c.nome_arquivo })),
    });
    const campos = sugestao.campos;
    if (opcoes.tipo && campos.tipo in TIPO_META) setTipo(campos.tipo);
    if (campos.valor_extraido !== null) setValorExtraido(String(campos.valor_extraido));
    if (campos.data_doc) setDataDoc(campos.data_doc);
    if (campos.descricao_servico) setDescricaoServico(campos.descricao_servico);
    if (sugestao.fornecedorId) setFornecedorId(sugestao.fornecedorId);
    if (opcoes.item && itens.some(it => it.id === opcoes.item)) setItemId(opcoes.item);
    setLido({ documento, sugestao: { ...sugestao, avisos: [...(opcoes.avisos ?? []), ...sugestao.avisos] }, motivos: opcoes.motivos ?? [] });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!organizationId) {
      setUploadError("A prestação ainda está carregando. Tente de novo em instantes.");
      return;
    }
    setUploadError("");
    setLido(null);
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

    // 2. XML de NF-e ou NFS-e: lido aqui, sem IA. Formato desconhecido segue para a IA.
    if (ehXml(file)) {
      setUploadProgress("Lendo o XML…");
      const leitura = lerDocumentoFiscal(decodificarArquivo(new Uint8Array(await file.arrayBuffer())));
      if (leitura.ok) {
        aplicarLeitura(leitura.documento, { tipo: true });
        setExtraindo(false);
        setUploadProgress("");
        return;
      }
      if (leitura.codigo !== "desconhecido") {
        setUploadError(`${leitura.motivo} Preencha os campos à mão ou envie outro arquivo.`);
        setExtraindo(false);
        setUploadProgress("");
        return;
      }
    }

    // 3. Analisa com IA
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

      const leituraIa = fnData.leitura as LeituraDoComprovante | undefined;
      if (!leituraIa) throw new Error("Resposta da IA sem leitura");
      const { documento, avisos } = documentoDaLeituraIa(leituraIa);
      if (documento.valor === null && !documento.emissao && !documento.descricao && !leituraIa.tipo) {
        throw new Error("Não foram encontrados campos legíveis no documento");
      }
      aplicarLeitura(documento, {
        tipo: Boolean(leituraIa.tipo),
        motivos: leituraIa.motivos,
        avisos,
        item: leituraIa.item_sugerido_id,
      });
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
      fornecedor_id: fornecedorId,
      tipo,
      origem,
      nome_arquivo: pendingFile.name,
      storage_path: storagePath,
      valor_extraido: valorExtraido ? Number(valorExtraido) : null,
      data_doc: dataDoc || null,
      descricao_servico: descricaoServico.trim() || null,
      observacao: observacao.trim() || null,
      enviado_por: user?.id ?? null,
      // Documento fiscal, retenções e motivos que vieram da leitura (XML ou IA), conferidos na tela.
      ...(lido ? {
        numero_documento: lido.sugestao.campos.numero_documento,
        serie: lido.sugestao.campos.serie,
        chave_acesso: lido.sugestao.campos.chave_acesso,
        iss: lido.sugestao.campos.iss,
        inss: lido.sugestao.campos.inss,
        irrf: lido.sugestao.campos.irrf,
        outras_retencoes: lido.sugestao.campos.outras_retencoes,
        identificacao_projeto: lido.sugestao.campos.identificacao_projeto,
        motivos_ia: lido.motivos,
      } : {}),
    });
    if (insertErro) {
      setUploadError(mensagemErroPrestacao(insertErro, "Não foi possível salvar o comprovante"));
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
    setFornecedorId(null);
    setUploadProgress("");
    setLido(null);
    setUploading(false);
    fetch();
    pedirVerificacao(id);
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
    setFornecedorId(null);
    setUploadProgress("");
    setUploadError("");
    setLido(null);
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
        pedirVerificacao(id);
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
    pedirVerificacao(id);
  }

  return (
    <div className="px-8 py-6 space-y-5">
      {/* Upload: só para quem edita (o leitor e a prestação sem assinatura só consultam) */}
      {permissoes.editar && (
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
                        {TIPOS_FISCAIS.map(k => (
                          <option key={k} value={k}>{TIPO_META[k].label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Complementares">
                        {TIPOS_COMPLEMENTARES.map(k => (
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

                {ehDespesa(tipo) && (
                  <div>
                    <label htmlFor="fornecedor-envio" className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1.5">Fornecedor</label>
                    <FornecedorCombobox id="fornecedor-envio" fornecedores={fornecedores} valor={fornecedorId} onChange={setFornecedorId} />
                  </div>
                )}

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

                {lido && (
                  <DocumentoLido
                    documento={lido.documento}
                    avisos={lido.sugestao.avisos}
                    motivos={motivosParaMostrar(lido.motivos, regime)}
                  />
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
      )}

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
              const fornecedorC = fornecedores.find(f => f.id === c.fornecedor_id) ?? null;
              const alertas = ehDespesa(c.tipo)
                ? alertasDaDespesa({
                  despesa: c,
                  fornecedor: fornecedorC,
                  documentosDoFornecedor: documentosDe(c.fornecedor_id),
                  item: rubrica ? { nome: rubrica.nome, cnaes: rubrica.cnaes, origem: rubrica.cnaesDe } : null,
                  outrasChaves: comprovantes.filter(o => o.id !== c.id && o.chave_acesso).map(o => o.chave_acesso!),
                })
                : [];
              const pagamentosC = pagamentos.filter(p => p.despesa_id === c.id);
              const liquidoC = c.valor_liquido ?? c.valor_extraido;
              if (ehDespesa(c.tipo)) {
                alertas.push(...alertasDosPagamentos({ despesa: c, liquido: liquidoC, fornecedor: fornecedorC, pagamentos: pagamentosC, regime: regimePagamentos }));
              }
              const pagamentoC = situacaoDosPagamentos(liquidoC, pagamentosC);
              const graves = alertas.filter(a => a.nivel === "alerta").length;
              const justificada = graves > 0 && Boolean(c.justificativa?.trim());
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
                        <span className="inline-flex items-center gap-1">
                          {!rubrica && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
                          <Select
                            value={c.no_id ?? ""}
                            onChange={e => mudarItem(c, e.target.value)}
                            aria-label={`Item do orçamento de ${c.nome_arquivo}`}
                            block={false}
                            className="max-w-[11rem] truncate rounded border px-1.5 py-0.5 text-[0.625rem] focus:outline-none sm:max-w-[16rem]"
                            style={{ borderColor: "rgba(13,13,13,.12)", color: rubrica ? "rgba(13,13,13,.65)" : "rgba(13,13,13,.55)" }}
                          >
                            <option value="">{c.no_id ? "Item de outra versão" : "Sem item"}</option>
                            {itens.map(it => <option key={it.id} value={it.id}>{rotuloDoItem(it)}</option>)}
                          </Select>
                        </span>
                      ) : (
                        <span>{rubrica ? rotuloDoItem(rubrica) : "Sem item"}</span>
                      )}
                      {fornecedorC ? (
                        <span className="max-w-[12rem] truncate text-black/55" title={nomeDoFornecedor(fornecedorC)}>{nomeDoFornecedor(fornecedorC)}</span>
                      ) : ehDespesa(c.tipo) && c.tipo !== "guia_tributo" && c.tipo !== "folha_pagamento" ? (
                        <span className="inline-flex items-center gap-1 text-black/55">
                          <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                          Sem fornecedor
                        </span>
                      ) : null}
                      {c.canal === "proponente" && (
                        <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold" style={{ background: "#fff", border: "1px solid #2D72B047", color: "#2D72B0" }}>Enviada pelo cliente</span>
                      )}
                      {c.canal === "email" && (
                        <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold" style={{ background: "#fff", border: "1px solid #2D72B047", color: "#2D72B0" }}>Recebida por e-mail</span>
                      )}
                      {c.contrapartida && (
                        <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold" style={{ background: "#fff", border: "1px solid #0D0D0D2E", color: "#0D0D0DA6" }}>
                          {c.contrapartida === "doacao" ? "Contrapartida por doação" : "Contrapartida"}
                        </span>
                      )}
                      {c.origem === "internacional" && (
                        <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold" style={{ background: "#fff", border: "1px solid #1A8B7A47", color: "#1A8B7A" }}>Internacional</span>
                      )}
                      {c.valor_extraido !== null && <span className="tabular-nums">{fmt(c.valor_extraido)}</span>}
                      {ehDespesa(c.tipo) && (
                        pagamentoC.situacao === "pago" ? <span>Pago</span>
                          : pagamentoC.situacao === "parcial" ? <span className="tabular-nums">Pago {fmt(pagamentoC.pago)}</span>
                            : pagamentoC.situacao === "excedido" ? (
                              <span className="inline-flex items-center gap-1 text-black/55">
                                <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#D94A4A]" />
                                Pago acima do líquido
                              </span>
                            )
                              : <span>A pagar</span>
                      )}
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
                      {motivosDaIa(c.motivos_ia).length > 0 && (
                        <span
                          className="rounded border bg-white px-1.5 py-0.5 text-[0.5625rem] font-medium"
                          style={{ borderColor: "#B07A1447", color: "#B07A14" }}
                          title={motivosDaIa(c.motivos_ia).map(m => m.texto).join("\n")}
                        >
                          IA: {motivosDaIa(c.motivos_ia).length} {motivosDaIa(c.motivos_ia).length === 1 ? "ponto a revisar" : "pontos a revisar"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + ações: no celular descem para baixo das informações */}
                  <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto">
                    <button
                      type="button"
                      onClick={() => setDespesaAberta(c)}
                      aria-label={`Despesa de ${c.nome_arquivo}${graves ? `: ${graves} ${graves === 1 ? "alerta" : "alertas"}${justificada ? " justificados" : ""}` : ""}`}
                      title={justificada ? `Com justificativa: ${c.justificativa}` : undefined}
                      className="flex items-center gap-1 whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                      style={{
                        borderColor: graves && !justificada ? "#D94A4A47" : "rgba(13,13,13,.12)",
                        color: graves && !justificada ? "#B23B3B" : "rgba(13,13,13,.55)",
                      }}
                    >
                      <Receipt size={11} aria-hidden />
                      {graves ? `${graves} ${graves === 1 ? "alerta" : "alertas"}${justificada ? " justificados" : ""}` : "Despesa"}
                    </button>
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

      {despesaAberta && (
        <DespesaModal
          comprovante={despesaAberta}
          tipos={TIPOS_OPCOES}
          itens={itens}
          metas={metas}
          bens={bens}
          fornecedores={fornecedores}
          documentosDe={documentosDe}
          outrasChaves={comprovantes.filter(o => o.id !== despesaAberta.id && o.chave_acesso).map(o => o.chave_acesso!)}
          pagamentos={pagamentos.filter(p => p.despesa_id === despesaAberta.id)}
          regimePagamentos={regimePagamentos}
          regime={regime}
          onPagamentosMudaram={() => { fetch(); pedirVerificacao(id); }}
          podeEditar={permissoes.editar}
          onClose={() => setDespesaAberta(null)}
          onSalvo={atualizado => {
            setComprovantes(lista => lista.map(x => (x.id === atualizado.id ? atualizado : x)));
            setDespesaAberta(null);
            pedirVerificacao(id);
          }}
        />
      )}
    </div>
  );
}
