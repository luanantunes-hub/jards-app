"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Paperclip, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import {
  DESTINACOES_BEM,
  erroDoBem,
  LIMITE_OBSERVACOES_BEM,
  MAXIMO_COTACOES,
  menorCotacao,
  TIPOS_BEM,
  type DestinacaoBem,
  type TipoBem,
} from "@/lib/prestacao/bens";
import { formatarDocumento, limparDocumento } from "@/lib/prestacao/fornecedores";
import { numeroDigitado } from "@/lib/prestacao/objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { CotacaoDoBem, PrestacaoBem } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const BOTAO_SECUNDARIO = "flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

/** Arquivo do formulário: o que já está gravado e, se escolhido, o novo que o substitui. */
type Arquivo = { path: string | null; nome: string | null; novo: File | null };
const arquivoDe = (path: string | null | undefined, nome: string | null | undefined): Arquivo => ({ path: path ?? null, nome: nome ?? null, novo: null });
const temArquivo = (a: Arquivo) => Boolean(a.novo || a.path);

type CotacaoNoForm = { fornecedor: string; valor: string; data: string; arquivo: Arquivo };

export type ItemParaBem = { id: string; nome: string; bemPermanente: boolean };
export type DespesaParaBem = { id: string; nome_arquivo: string | null; no_id: string | null; valor_extraido: number | null; status: string };

/** Escolher arquivo, ver o nome e tirar. */
function CampoArquivo({ rotulo, arquivo, onChange, onAbrir }: {
  rotulo: string;
  arquivo: Arquivo;
  onChange: (a: Arquivo) => void;
  onAbrir: (path: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const nome = arquivo.novo?.name ?? arquivo.nome;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        aria-label={rotulo}
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange({ ...arquivo, novo: f }); e.target.value = ""; }}
      />
      {temArquivo(arquivo) ? (
        <>
          {arquivo.path && !arquivo.novo
            ? <button type="button" onClick={() => onAbrir(arquivo.path!)} className="min-w-0 truncate text-left text-[0.6875rem] text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]">{nome || "Arquivo"}</button>
            : <span className="min-w-0 truncate text-[0.6875rem] text-black/65">{nome}</span>}
          <button type="button" onClick={() => onChange({ path: null, nome: null, novo: null })} aria-label={`Tirar ${rotulo.toLowerCase()}`} className="shrink-0 rounded p-1 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={12} />
          </button>
        </>
      ) : (
        <button type="button" onClick={() => entrada.current?.click()} className={BOTAO_SECUNDARIO} style={{ borderColor: "rgba(13,13,13,.14)" }}>
          <Paperclip size={12} aria-hidden /> Anexar
        </button>
      )}
    </div>
  );
}

/**
 * Registra ou edita um bem permanente: o bem, de onde veio (item e despesa),
 * as cotações e a destinação, com quem recebeu e o aceite quando é doação.
 */
export function BemModal({ prestacaoId, organizationId, bem, inicial, itens, despesas, onClose, onSaved }: {
  prestacaoId: string;
  organizationId: string | null;
  bem: PrestacaoBem | null;
  /** Bem novo a partir de uma despesa (link da verificação ou da despesa). */
  inicial?: { despesa_id?: string | null; no_id?: string | null; descricao?: string; valor?: number | null };
  itens: readonly ItemParaBem[];
  despesas: readonly DespesaParaBem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [descricao, setDescricao] = useState(bem?.descricao ?? inicial?.descricao ?? "");
  const [tipo, setTipo] = useState<TipoBem>(bem?.tipo ?? "equipamento");
  const [quantidade, setQuantidade] = useState(texto(bem?.quantidade ?? 1));
  const [valor, setValor] = useState(texto(bem?.valor ?? inicial?.valor ?? null));
  const [noId, setNoId] = useState(bem?.no_id ?? inicial?.no_id ?? "");
  const [despesaId, setDespesaId] = useState(bem?.despesa_id ?? inicial?.despesa_id ?? "");
  const [patrimonio, setPatrimonio] = useState(bem?.numero_patrimonio ?? "");
  const [registro, setRegistro] = useState(bem?.registro_imovel ?? "");
  const [cotacoes, setCotacoes] = useState<CotacaoNoForm[]>((bem?.cotacoes ?? []).map(c => ({
    fornecedor: c.fornecedor, valor: texto(c.valor), data: c.data ?? "", arquivo: arquivoDe(c.storage_path, c.nome_arquivo),
  })));
  const [destinacao, setDestinacao] = useState<DestinacaoBem | "">(bem?.destinacao ?? "");
  const [destinacaoDescricao, setDestinacaoDescricao] = useState(bem?.destinacao_descricao ?? "");
  const [beneficiario, setBeneficiario] = useState(bem?.beneficiario ?? "");
  const [documento, setDocumento] = useState(bem?.beneficiario_documento ? formatarDocumento(bem.beneficiario_documento) : "");
  const [termo, setTermo] = useState<Arquivo>(arquivoDe(bem?.doacao_storage_path, bem?.doacao_nome_arquivo));
  const [aceite, setAceite] = useState<Arquivo>(arquivoDe(bem?.aceite_storage_path, bem?.aceite_nome_arquivo));
  const [justificativa, setJustificativa] = useState(bem?.justificativa ?? "");
  const [observacoes, setObservacoes] = useState(bem?.observacoes ?? "");
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(bem?.observacoes));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const despesa = despesas.find(d => d.id === despesaId) ?? null;
  const despesasDoItem = despesas.filter(d => d.status !== "rejeitado" && (!noId || d.no_id === noId || d.id === despesaId));
  const pedeCotacao = TIPOS_BEM.find(t => t.id === tipo)?.pedeCotacao ?? false;
  const cotacoesLidas: CotacaoDoBem[] = cotacoes.map(c => ({ fornecedor: c.fornecedor.trim(), valor: numeroDigitado(c.valor) ?? NaN, data: c.data || null }));
  const menor = menorCotacao(cotacoesLidas.filter(c => Number.isFinite(c.valor) && c.valor > 0));
  const pago = despesa?.valor_extraido != null ? Number(despesa.valor_extraido) : numeroDigitado(valor);
  const acimaDaMenor = menor !== null && pago !== null && Number.isFinite(pago) && Math.round(pago * 100) > Math.round(menor.valor * 100);
  const mostrarJustificativa = acimaDaMenor || justificativa.trim().length > 0;

  function escolherDespesa(id: string) {
    setDespesaId(id);
    const d = despesas.find(x => x.id === id);
    if (d?.no_id && !noId) setNoId(d.no_id);
  }

  async function abrir(path: string) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  function mudarCotacao(i: number, campos: Partial<CotacaoNoForm>) {
    setCotacoes(lista => lista.map((c, j) => (j === i ? { ...c, ...campos } : c)));
  }

  async function salvar() {
    const doacao = destinacao === "doacao";
    const campos = {
      tipo,
      descricao: descricao.trim(),
      quantidade: numeroDigitado(quantidade) ?? NaN,
      valor: numeroDigitado(valor),
      numero_patrimonio: patrimonio.trim() || null,
      registro_imovel: tipo === "imovel" ? registro.trim() || null : null,
      cotacoes: cotacoesLidas,
      destinacao: destinacao || null,
      destinacao_descricao: destinacao === "outra" ? destinacaoDescricao.trim() || null : null,
      beneficiario: doacao ? beneficiario.trim() || null : null,
      beneficiario_documento: doacao && documento.trim() ? limparDocumento(documento) : null,
      justificativa: justificativa.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    const problema = erroDoBem(campos);
    if (problema) { setErro(problema); return; }
    const arquivosNovos = [...cotacoes.map(c => c.arquivo), ...(doacao ? [termo, aceite] : [])].filter(a => a.novo);
    if (arquivosNovos.length > 0 && !organizationId) { setErro("Aguarde: a organização da prestação ainda está carregando."); return; }
    setSalvando(true);
    setErro("");

    // Sobe os arquivos novos antes de gravar; se algo falhar, apaga o que subiu.
    const enviados: string[] = [];
    async function enviar(a: Arquivo): Promise<{ path: string | null; nome: string | null }> {
      if (!a.novo) return { path: a.path, nome: a.nome };
      const caminho = montarCaminhoPrestacao({ organizationId: organizationId!, prestacaoId, pasta: { tipo: "bens" }, nomeOriginal: a.novo.name });
      const { error } = await supabase.storage.from("documentos").upload(caminho, a.novo, { upsert: false, contentType: a.novo.type || undefined });
      if (error) throw new Error(`Não foi possível enviar "${a.novo.name}": ${error.message}`);
      enviados.push(caminho);
      return { path: caminho, nome: a.novo.name };
    }
    try {
      const cotacoesGravadas = await Promise.all(cotacoes.map(async (c, i) => {
        const arquivo = await enviar(c.arquivo);
        return { ...cotacoesLidas[i], storage_path: arquivo.path, nome_arquivo: arquivo.nome };
      }));
      const termoGravado = doacao ? await enviar(termo) : { path: null, nome: null };
      const aceiteGravado = doacao ? await enviar(aceite) : { path: null, nome: null };
      const linha = {
        ...campos,
        cotacoes: cotacoesGravadas,
        no_id: noId || null,
        despesa_id: despesaId || null,
        doacao_storage_path: termoGravado.path,
        doacao_nome_arquivo: termoGravado.nome,
        aceite_storage_path: aceiteGravado.path,
        aceite_nome_arquivo: aceiteGravado.nome,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_bens ainda não está no tipo Database
      const tabela = (supabase as any).from("prestacao_bens");
      const { error } = bem
        ? await tabela.update(linha).eq("id", bem.id)
        : await tabela.insert({ ...linha, prestacao_id: prestacaoId });
      if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível salvar o bem"));

      // Gravado: os arquivos que saíram ou foram trocados deixam o bucket.
      const antes = [bem?.doacao_storage_path, bem?.aceite_storage_path, ...(bem?.cotacoes ?? []).map(c => c.storage_path)];
      const agora = new Set([linha.doacao_storage_path, linha.aceite_storage_path, ...cotacoesGravadas.map(c => c.storage_path)]);
      const sobras = antes.filter((p): p is string => Boolean(p) && !agora.has(p!));
      if (sobras.length) await supabase.storage.from("documentos").remove(sobras);
      setSalvando(false);
      onSaved();
    } catch (e) {
      if (enviados.length) await supabase.storage.from("documentos").remove(enviados);
      setSalvando(false);
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o bem.");
    }
  }

  const def = DESTINACOES_BEM.find(d => d.id === destinacao);

  return (
    <ModalPrestacao
      titulo={bem ? "Editar bem" : "Registrar bem"}
      subtitulo="Bem permanente adquirido, produzido ou construído com o projeto"
      onClose={onClose}
      largura="max-w-[40rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {bem ? "Salvar" : "Registrar bem"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ROTULO}>Bem</span>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={300} placeholder="Ex.: Projetor Epson EB-X51" className={CAMPO} autoFocus={!bem} />
        </label>
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown value={tipo} onChange={v => setTipo(v as TipoBem)} ariaLabel="Tipo do bem" options={TIPOS_BEM.map(t => ({ value: t.id, label: t.rotulo }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={ROTULO}>Quantidade</span>
            <input value={quantidade} onChange={e => setQuantidade(e.target.value)} inputMode="numeric" className={`${CAMPO} tabular-nums`} />
          </label>
          <label>
            <span className={ROTULO}>Valor (R$)</span>
            <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder={despesa?.valor_extraido != null ? texto(despesa.valor_extraido) : "0,00"} className={`${CAMPO} tabular-nums`} />
          </label>
        </div>
        <div>
          <span className={ROTULO}>Item do orçamento</span>
          <Dropdown
            value={noId}
            onChange={setNoId}
            ariaLabel="Item do orçamento do bem"
            options={[
              { value: "", label: "Sem item" },
              ...[...itens].sort((a, b) => Number(b.bemPermanente) - Number(a.bemPermanente)).map(i => ({ value: i.id, label: i.bemPermanente ? `${i.nome} · bem permanente` : i.nome })),
            ]}
          />
        </div>
        <div>
          <span className={ROTULO}>Despesa</span>
          <Dropdown
            value={despesaId}
            onChange={escolherDespesa}
            ariaLabel="Despesa que pagou o bem"
            options={[
              { value: "", label: "Sem despesa (produzido com várias)" },
              ...despesasDoItem.map(d => ({ value: d.id, label: `${d.nome_arquivo ?? "Despesa"}${d.valor_extraido != null ? ` · ${reais(Number(d.valor_extraido))}` : ""}` })),
            ]}
          />
        </div>
        {tipo === "imovel" && (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Registro do imóvel</span>
            <textarea value={registro} onChange={e => setRegistro(e.target.value)} rows={2} maxLength={500} placeholder="Cartório, número do registro (matrícula) e folha" className={AREA} />
          </label>
        )}
        <label>
          <span className={ROTULO}>Nº de patrimônio</span>
          <input value={patrimonio} onChange={e => setPatrimonio(e.target.value)} maxLength={100} placeholder="Do inventário, se houver" className={CAMPO} />
        </label>

        {/* Cotações */}
        <fieldset className="rounded border p-3 sm:col-span-2" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <legend className="px-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">Cotações</legend>
          <p className="mb-2 text-[0.625rem] text-black/40">
            {pedeCotacao ? "Até três, com o comprovante de cada uma; a Rouanet pede a cotação de bens móveis e obras de arte (art. 69, VI)." : "Imóvel: a cotação é opcional."}
          </p>
          <ul className="space-y-2">
            {cotacoes.map((c, i) => (
              <li key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_7rem_8.5rem_8rem_auto]">
                <label className="col-span-2 sm:col-span-1">
                  <span className={ROTULO}>Fornecedor</span>
                  <input value={c.fornecedor} onChange={e => mudarCotacao(i, { fornecedor: e.target.value })} maxLength={200} className={CAMPO} />
                </label>
                <label>
                  <span className={ROTULO}>Valor (R$)</span>
                  <input value={c.valor} onChange={e => mudarCotacao(i, { valor: e.target.value })} inputMode="decimal" className={`${CAMPO} tabular-nums`} />
                </label>
                <label>
                  <span className={ROTULO}>Data</span>
                  <input type="date" value={c.data} onChange={e => mudarCotacao(i, { data: e.target.value })} className={`${CAMPO} tabular-nums`} />
                </label>
                <div className="flex h-10 items-center">
                  <CampoArquivo rotulo={`Comprovante da cotação ${i + 1}`} arquivo={c.arquivo} onChange={a => mudarCotacao(i, { arquivo: a })} onAbrir={abrir} />
                </div>
                <button type="button" onClick={() => setCotacoes(lista => lista.filter((_, j) => j !== i))} aria-label={`Excluir a cotação ${i + 1}`} className="flex h-10 w-10 items-center justify-center rounded text-black/30 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
          {cotacoes.length < MAXIMO_COTACOES && (
            <button
              type="button"
              onClick={() => setCotacoes(lista => [...lista, { fornecedor: "", valor: "", data: "", arquivo: arquivoDe(null, null) }])}
              className={`mt-2 ${BOTAO_SECUNDARIO}`}
              style={{ borderColor: "rgba(13,13,13,.14)" }}
            >
              <Plus size={12} aria-hidden /> Adicionar cotação
            </button>
          )}
          {menor && (
            <p className={`mt-2 text-[0.6875rem] ${acimaDaMenor ? "text-[#B07A14]" : "text-black/50"}`}>
              Menor cotação: {reais(menor.valor)} ({menor.fornecedor}){acimaDaMenor && pago !== null ? `; pago ${reais(pago)}` : ""}
            </p>
          )}
        </fieldset>

        {mostrarJustificativa && (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Justificativa{acimaDaMenor ? " — pago acima da menor cotação" : ""}</span>
            <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={2} maxLength={2000} placeholder="Por que esta compra e não a mais barata" className={AREA} />
          </label>
        )}

        {/* Destinação */}
        <div className="sm:col-span-2">
          <span className={ROTULO}>Destinação</span>
          <Dropdown
            value={destinacao}
            onChange={v => setDestinacao(v as DestinacaoBem | "")}
            ariaLabel="Destinação do bem"
            options={[{ value: "", label: "Ainda não definida" }, ...DESTINACOES_BEM.map(d => ({ value: d.id, label: d.rotulo }))]}
          />
          {def && <p className="mt-1 text-[0.625rem] text-black/40">{def.descricao}.</p>}
        </div>
        {destinacao === "outra" && (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Destino do bem</span>
            <textarea value={destinacaoDescricao} onChange={e => setDestinacaoDescricao(e.target.value)} rows={2} maxLength={1000} className={AREA} />
          </label>
        )}
        {destinacao === "doacao" && (
          <>
            <label>
              <span className={ROTULO}>Quem recebeu</span>
              <input value={beneficiario} onChange={e => setBeneficiario(e.target.value)} maxLength={200} placeholder="Entidade que recebeu o bem" className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>CPF ou CNPJ</span>
              <input value={documento} onChange={e => setDocumento(e.target.value)} maxLength={20} placeholder="00.000.000/0000-00" className={`${CAMPO} tabular-nums`} />
            </label>
            <div>
              <span className={ROTULO}>Termo de doação</span>
              <CampoArquivo rotulo="Termo de doação" arquivo={termo} onChange={setTermo} onAbrir={abrir} />
            </div>
            <div>
              <span className={ROTULO}>Aceite de quem recebeu</span>
              <CampoArquivo rotulo="Aceite de quem recebeu" arquivo={aceite} onChange={setAceite} onAbrir={abrir} />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => setMaisDetalhes(v => !v)}
            aria-expanded={maisDetalhes}
            className="flex items-center gap-1 rounded py-1 text-[0.6875rem] text-black/50 transition hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
          >
            <ChevronDown size={12} aria-hidden className={`transition-transform motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
            Mais detalhes
          </button>
          {maisDetalhes && (
            <label className="mt-2 block">
              <span className={ROTULO}>Observações</span>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} maxLength={LIMITE_OBSERVACOES_BEM} placeholder="Até 1.000 caracteres, como no Salic" className={AREA} />
            </label>
          )}
        </div>
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
