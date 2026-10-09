"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { limparCnaesAceitos } from "@/lib/prestacao/cnae";
import { CnaesAceitosCampo } from "@/components/prestacao/orcamento/CnaesAceitosCampo";
import {
  gruposDoRegime,
  grupoNoRegime,
  lerValor,
  paisPossiveis,
  rotuloGrupo,
  rotuloTipoNo,
  TIPOS_NO,
  UFS,
  valorDoItem,
  type GrupoCusto,
  type LinhaOrcamento,
  type NoOrcamento,
  type TipoNo,
} from "@/lib/prestacao/orcamento";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "w-full rounded border border-black/[.12] px-3 py-2 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function textoDoNumero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor).replace(".", ",");
}

function numeroOuNulo(texto: string): number | null {
  return texto.trim() === "" ? null : lerValor(texto);
}

export type NoEmEdicao =
  | { modo: "novo"; parentId: string | null; tipo: TipoNo }
  | { modo: "editar"; no: NoOrcamento };

/**
 * Cria ou edita um nó da árvore. O banco confere a estrutura (agrupador da
 * mesma versão, sem ciclo, item com comprovante não vira agrupador) e calcula
 * o total do item quando há valor unitário; a tela mostra a mesma conta.
 */
export function EditorNoOrcamento({ versaoId, raizes, edicao, ordemNova, regime = null, onClose, onSaved }: {
  versaoId: string;
  /** Regime da prestação: os grupos de custo e os nomes vêm dele. */
  regime?: RegimeNormativo | null;
  raizes: LinhaOrcamento[];
  edicao: NoEmEdicao;
  ordemNova: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const titleId = useId();
  useModalDismiss(onClose);

  const inicial = edicao.modo === "editar" ? edicao.no : null;
  const [tipo, setTipo] = useState<TipoNo>(inicial?.tipo ?? (edicao.modo === "novo" ? edicao.tipo : "item"));
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [codigo, setCodigo] = useState(inicial?.codigo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [paiId, setPaiId] = useState(inicial ? inicial.parent_id ?? "" : edicao.modo === "novo" ? edicao.parentId ?? "" : "");
  const [grupo, setGrupo] = useState<string>(inicial?.grupo_custo ?? "");
  const [cnaes, setCnaes] = useState<string[]>(limparCnaesAceitos(inicial?.cnaes_aceitos ?? []));
  const [bemPermanente, setBemPermanente] = useState(Boolean(inicial?.bem_permanente));
  const [uf, setUf] = useState(inicial?.uf ?? "");
  const [municipio, setMunicipio] = useState(inicial?.municipio ?? "");
  const [unidade, setUnidade] = useState(inicial?.unidade ?? "");
  const [quantidade, setQuantidade] = useState(textoDoNumero(inicial?.quantidade));
  const [ocorrencias, setOcorrencias] = useState(textoDoNumero(inicial?.ocorrencias));
  const [unitario, setUnitario] = useState(textoDoNumero(inicial?.valor_unitario));
  const [total, setTotal] = useState(textoDoNumero(inicial ? inicial.valor_total : null));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const pais = paisPossiveis(raizes, inicial?.id ?? null);
  const pai = pais.find(linha => linha.no.id === paiId) ?? null;
  const grupoDeCima = pai?.grupo ?? null;
  const ehItem = tipo === "item";
  const totalCalculado = valorDoItem({
    quantidade: numeroOuNulo(quantidade),
    ocorrencias: numeroOuNulo(ocorrencias),
    valor_unitario: numeroOuNulo(unitario),
    valor_total: lerValor(total),
  });
  const temUnitario = unitario.trim() !== "";

  async function salvar() {
    if (nome.trim().length === 0) { setErro("Dê um nome."); return; }
    if (ehItem && !temUnitario && total.trim() === "") { setErro("Informe o valor total ou o valor unitário."); return; }
    setSalvando(true);
    setErro("");
    const campos = {
      parent_id: paiId || null,
      tipo,
      nome: nome.trim(),
      codigo: codigo.trim() || null,
      descricao: descricao.trim() || null,
      grupo_custo: (grupo || null) as GrupoCusto | null,
      cnaes_aceitos: cnaes.length ? cnaes : null,
      bem_permanente: ehItem && bemPermanente,
      uf: uf || null,
      municipio: municipio.trim() || null,
      unidade: ehItem ? unidade.trim() || null : null,
      quantidade: ehItem ? numeroOuNulo(quantidade) : null,
      ocorrencias: ehItem ? numeroOuNulo(ocorrencias) : null,
      valor_unitario: ehItem ? numeroOuNulo(unitario) : null,
      valor_total: ehItem ? totalCalculado : 0,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do orçamento ainda não estão no tipo Database
    const tabela = (supabase as any).from("prestacao_orcamento_nos");
    const { error } = inicial
      ? await tabela.update(campos).eq("id", inicial.id)
      : await tabela.insert({ ...campos, versao_id: versaoId, ordem: ordemNova });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar")); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-[34rem] flex-col overflow-hidden rounded bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id={titleId} className="text-[0.875rem] font-semibold text-[#282525]">
            {inicial ? `Editar ${rotuloTipoNo(inicial.tipo).toLowerCase()}` : ehItem ? "Novo item" : `Novo agrupador: ${rotuloTipoNo(tipo).toLowerCase()}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1.5 text-black/35 transition hover:bg-black/5 hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
            <div>
              <span className={ROTULO}>Tipo</span>
              <Dropdown
                value={tipo}
                onChange={valor => setTipo(valor as TipoNo)}
                ariaLabel="Tipo do nó"
                options={TIPOS_NO.map(t => ({ value: t.id, label: t.id === "item" ? "Item (tem valor)" : `${t.rotulo} (agrupa)` }))}
              />
            </div>
            <label className="block">
              <span className={ROTULO}>Nome *</span>
              <input autoFocus value={nome} onChange={e => setNome(e.target.value)} className={CAMPO} placeholder={ehItem ? "Ex.: Cachê de ator" : "Ex.: Pré-produção"} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
            <div>
              <span className={ROTULO}>Dentro de</span>
              <Dropdown
                value={paiId}
                onChange={setPaiId}
                ariaLabel="Agrupador onde o nó fica"
                options={[
                  { value: "", label: "Na raiz do orçamento" },
                  ...pais.map(linha => ({
                    value: linha.no.id,
                    label: `${"· ".repeat(linha.nivel)}${linha.no.nome} (${rotuloTipoNo(linha.no.tipo).toLowerCase()})`,
                  })),
                ]}
              />
            </div>
            <label className="block">
              <span className={ROTULO}>Código</span>
              <input value={codigo} onChange={e => setCodigo(e.target.value)} className={CAMPO} placeholder="Opcional" />
            </label>
          </div>

          <div>
            <span className={ROTULO}>Grupo de custo</span>
            <Dropdown
              value={grupo}
              onChange={setGrupo}
              ariaLabel="Grupo de custo"
              options={[
                { value: "", label: grupoDeCima ? `Herdar de cima: ${rotuloGrupo(grupoDeCima, regime)}` : ehItem ? "Sem grupo de custo" : "Sem grupo (cada item define o seu)" },
                ...gruposDoRegime(regime).map(g => ({ value: g.id, label: g.rotulo })),
                // Grupo antigo, fora do regime: continua na lista para não sumir da tela.
                ...(grupo && !grupoNoRegime(grupo, regime) ? [{ value: grupo, label: `${rotuloGrupo(grupo)} (fora do regime)` }] : []),
              ]}
            />
            <p className="mt-1 text-[0.625rem] leading-4 text-black/40">
              {ehItem ? "Os tetos e as bases do regime somam os itens pelo grupo de custo." : "Os itens dentro deste agrupador herdam o grupo, salvo os que tiverem o próprio."}
            </p>
          </div>

          <CnaesAceitosCampo
            valor={cnaes}
            onChange={setCnaes}
            textoDoItem={[nome, descricao].filter(Boolean).join(" ")}
            herdados={{ cnaes: pai?.cnaes ?? [], de: pai?.cnaesDe?.nome ?? null }}
            ehItem={ehItem}
          />

          {ehItem && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded border px-3 py-2.5 transition hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <input
                type="checkbox"
                checked={bemPermanente}
                onChange={e => setBemPermanente(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#7259B5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
              />
              <span>
                <span className="block text-[0.75rem] text-black/75">Bem permanente</span>
                <span className="block text-[0.625rem] leading-4 text-black/40">Equipamento, móvel, obra de arte ou imóvel que fica depois do projeto. Cada despesa deste item pede o bem registrado na aba Bens, com a destinação.</span>
              </span>
            </label>
          )}

          {ehItem && (
            <fieldset className="rounded border p-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <legend className="px-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">Valor</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className={ROTULO}>Unidade</span>
                  <input value={unidade} onChange={e => setUnidade(e.target.value)} className={CAMPO} placeholder="Ex.: mês" />
                </label>
                <label className="block">
                  <span className={ROTULO}>Quantidade</span>
                  <input inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)} className={`${CAMPO} tabular-nums`} />
                </label>
                <label className="block">
                  <span className={ROTULO}>Ocorrências</span>
                  <input inputMode="decimal" value={ocorrencias} onChange={e => setOcorrencias(e.target.value)} className={`${CAMPO} tabular-nums`} />
                </label>
                <label className="block">
                  <span className={ROTULO}>Valor unitário</span>
                  <input inputMode="decimal" value={unitario} onChange={e => setUnitario(e.target.value)} className={`${CAMPO} tabular-nums`} placeholder="R$" />
                </label>
              </div>
              <label className="mt-3 block">
                <span className={ROTULO}>{temUnitario ? "Valor total (quantidade × ocorrências × unitário)" : "Valor total *"}</span>
                {temUnitario ? (
                  <p className="rounded bg-black/[.03] px-3 py-2 text-[0.8125rem] font-medium tabular-nums text-black/70">{fmt(totalCalculado)}</p>
                ) : (
                  <input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} className={`${CAMPO} tabular-nums`} placeholder="R$ 0,00" />
                )}
              </label>
              {inicial && inicial.valor_remanejado !== 0 && (
                <p className="mt-2 text-[0.6875rem] text-black/50">
                  Remanejado {inicial.valor_remanejado > 0 ? "+" : ""}{fmt(inicial.valor_remanejado)} pelas alterações; vigente {fmt(totalCalculado + inicial.valor_remanejado)}.
                </p>
              )}
            </fieldset>
          )}

          {(ehItem || tipo === "local") && (
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <div>
                <span className={ROTULO}>UF</span>
                <Dropdown value={uf} onChange={setUf} ariaLabel="UF" options={[{ value: "", label: "—" }, ...UFS.map(sigla => ({ value: sigla, label: sigla }))]} />
              </div>
              <label className="block">
                <span className={ROTULO}>Município</span>
                <input value={municipio} onChange={e => setMunicipio(e.target.value)} className={CAMPO} />
              </label>
            </div>
          )}

          <label className="block">
            <span className={ROTULO}>Descrição</span>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} className={`${CAMPO} resize-y`} placeholder="Detalhe ou justificativa, como no orçamento aprovado" />
          </label>

          {erro && (
            <p role="alert" className="rounded border px-3 py-2 text-[0.75rem]" style={{ background: "#fff", borderColor: "#D94A4A30", color: "#B23B3B" }}>
              {erro}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-4 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
