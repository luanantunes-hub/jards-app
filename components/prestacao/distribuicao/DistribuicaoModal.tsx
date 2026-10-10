"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { InputValor } from "@/components/ui/CampoValor";
import { formatarValorBRL } from "@/lib/valor";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import {
  CATEGORIAS_DISTRIBUICAO,
  categoriaDistribuicao,
  COTAS,
  erroDaDistribuicao,
  formatarPercentual,
  LIMITE_JUSTIFICATIVA_DISTRIBUICAO,
  type CategoriaDistribuicao,
  type LimitesDistribuicao,
} from "@/lib/prestacao/distribuicao";
import { formatarDocumento, limparDocumento } from "@/lib/prestacao/fornecedores";
import { numeroDigitado } from "@/lib/prestacao/objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoDistribuicao } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AJUDA = "mt-1 text-[0.625rem] text-black/40";

const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Inteiro digitado ("1.200" vale 1200); vazio é null e o resto é NaN. */
function inteiroDigitado(valor: string): number | null {
  const n = numeroDigitado(valor);
  return n === null ? null : Number.isInteger(n) ? n : NaN;
}

/** O que a categoria significa no regime: a cota em que conta e o limite. */
function ajudaDaCategoria(categoria: CategoriaDistribuicao, limites: LimitesDistribuicao | null): string {
  const def = categoriaDistribuicao(categoria);
  if (!def) return "";
  if (!limites || !def.cota) return def.descricao + ".";
  const cota = COTAS.find(c => c.id === def.cota)!;
  const limite = { patrocinador: limites.patrocinadoresMax, proponente: limites.proponenteMax, social: limites.socialMin, popular: limites.popularMin }[def.cota];
  if (limite === null) return def.descricao + ".";
  const sentido = def.cota === "patrocinador" || def.cota === "proponente" ? "até" : "ao menos";
  return `${def.descricao}. Conta na cota ${cota.rotulo.toLowerCase()}: ${sentido} ${formatarPercentual(limite)} do produto (${cota.dispositivo}).`;
}

/** Cria ou edita uma linha do plano: o previsto primeiro; o realizado e quem recebeu logo abaixo. */
export function DistribuicaoModal({ prestacaoId, linha, produtos, limites, onClose, onSaved }: {
  prestacaoId: string;
  linha: PrestacaoDistribuicao | null;
  /** Produtos que já estão no plano, para escolher sem digitar de novo. */
  produtos: readonly string[];
  limites: LimitesDistribuicao | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [produto, setProduto] = useState(linha?.produto ?? (produtos.length === 1 ? produtos[0] : ""));
  const [categoria, setCategoria] = useState<CategoriaDistribuicao>(linha?.categoria ?? "social");
  const [quantidade, setQuantidade] = useState(texto(linha?.quantidade));
  const [meias, setMeias] = useState(linha?.quantidade_meia ? texto(linha.quantidade_meia) : "");
  const [preco, setPreco] = useState(formatarValorBRL(linha?.preco));
  const [realizada, setRealizada] = useState(texto(linha?.quantidade_realizada));
  const [beneficiario, setBeneficiario] = useState(linha?.beneficiario ?? "");
  const [documento, setDocumento] = useState(linha?.beneficiario_documento ? formatarDocumento(linha.beneficiario_documento) : "");
  const [justificativa, setJustificativa] = useState(linha?.justificativa ?? "");
  const [observacoes, setObservacoes] = useState(linha?.observacoes ?? "");
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(linha?.observacoes));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const def = categoriaDistribuicao(categoria);
  const venda = def?.venda ?? false;
  const quantidadeNum = inteiroDigitado(quantidade);
  const realizadaNum = inteiroDigitado(realizada);
  const precoNum = numeroDigitado(preco);
  const alterada = quantidadeNum !== null && realizadaNum !== null && !Number.isNaN(realizadaNum) && realizadaNum !== quantidadeNum;
  const mostrarJustificativa = alterada || justificativa.trim().length > 0;
  const acimaDoTeto = categoria === "popular" && limites?.precoPopular != null && precoNum !== null && precoNum > limites.precoPopular;
  const outrosProdutos = produtos.filter(p => p.trim().toLowerCase() !== produto.trim().toLowerCase());

  async function salvar() {
    const campos = {
      produto: produto.trim(),
      categoria,
      quantidade: quantidadeNum ?? NaN,
      quantidade_meia: venda ? inteiroDigitado(meias) ?? 0 : 0,
      preco: venda ? precoNum : null,
      quantidade_realizada: realizadaNum,
      beneficiario: def?.pedeBeneficiario ? beneficiario.trim() || null : null,
      beneficiario_documento: def?.pedeBeneficiario && documento.trim() ? limparDocumento(documento) : null,
      justificativa: justificativa.trim() || null,
    };
    const problema = erroDaDistribuicao(campos);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_distribuicao ainda não está no tipo Database
    const tabela = (supabase as any).from("prestacao_distribuicao");
    const dados = { ...campos, observacoes: observacoes.trim() || null };
    const { error } = linha
      ? await tabela.update(dados).eq("id", linha.id)
      : await tabela.insert({ ...dados, prestacao_id: prestacaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a linha do plano")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={linha ? "Editar linha do plano" : "Nova linha do plano"}
      subtitulo="Uma categoria de distribuição de um produto"
      onClose={onClose}
      largura="max-w-[34rem]"
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
            {linha ? "Salvar" : "Adicionar ao plano"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label>
            <span className={ROTULO}>Produto</span>
            <input value={produto} onChange={e => setProduto(e.target.value)} maxLength={200} placeholder="Ex.: Espetáculo Raízes — temporada no Sesc" className={CAMPO} autoFocus={!linha} />
          </label>
          {outrosProdutos.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {outrosProdutos.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProduto(p)}
                  className="rounded border bg-white px-2 py-1 text-[0.625rem] text-black/55 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <span className={ROTULO}>Categoria</span>
          <Dropdown
            value={categoria}
            onChange={v => setCategoria(v as CategoriaDistribuicao)}
            ariaLabel="Categoria da distribuição"
            options={CATEGORIAS_DISTRIBUICAO.map(c => ({ value: c.id, label: c.rotulo }))}
          />
          <p className={AJUDA}>{ajudaDaCategoria(categoria, limites)}</p>
        </div>
        <label>
          <span className={ROTULO}>Quantidade prevista</span>
          <input value={quantidade} onChange={e => setQuantidade(e.target.value)} inputMode="numeric" placeholder="100" className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Realizada</span>
          <input value={realizada} onChange={e => setRealizada(e.target.value)} inputMode="numeric" placeholder="Em branco até a execução" className={`${CAMPO} tabular-nums`} />
        </label>
        {venda && (
          <>
            <label>
              <span className={ROTULO}>Preço do inteiro (R$)</span>
              <InputValor value={preco} onChange={setPreco} placeholder="50,00" className={`${CAMPO} tabular-nums`} />
              {acimaDoTeto && <span className="mt-1 block text-[0.625rem] text-[#B23B3B]">Acima de {reais(limites!.precoPopular!)}, o ingresso não conta como preço popular.</span>}
            </label>
            <label>
              <span className={ROTULO}>Meias-entradas</span>
              <input value={meias} onChange={e => setMeias(e.target.value)} inputMode="numeric" placeholder="0" className={`${CAMPO} tabular-nums`} />
              {limites?.meiaMin != null && <span className={AJUDA + " block"}>Estudantes em ao menos {formatarPercentual(limites.meiaMin)} dos vendidos do produto.</span>}
            </label>
          </>
        )}
        {def?.pedeBeneficiario && (
          <>
            <label>
              <span className={ROTULO}>Quem recebeu</span>
              <input value={beneficiario} onChange={e => setBeneficiario(e.target.value)} maxLength={200} placeholder="Entidade ou escola pública" className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>CPF ou CNPJ</span>
              <input value={documento} onChange={e => setDocumento(e.target.value)} maxLength={20} placeholder="00.000.000/0000-00" className={`${CAMPO} tabular-nums`} />
            </label>
          </>
        )}
        {mostrarJustificativa && (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Justificativa{alterada ? " — o realizado mudou do plano" : ""}</span>
            <textarea
              value={justificativa}
              onChange={e => { setJustificativa(e.target.value); setErro(""); }}
              rows={3}
              maxLength={LIMITE_JUSTIFICATIVA_DISTRIBUICAO}
              placeholder="O que mudou e por quê"
              className={AREA}
            />
          </label>
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
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} maxLength={1000} placeholder="Sessão exclusiva, critério de seleção, ponto de venda…" className={AREA} />
            </label>
          )}
        </div>
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
