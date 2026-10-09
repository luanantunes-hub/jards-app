"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { cargaDosHorarios, CONTRATACOES, DIAS_DA_GRADE_RH, horariosDaSemana, horasBr, numeroDaCarga } from "@/lib/prestacao/grade-rh";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { ContratacaoDoCargo, PrestacaoCargo } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

export type ItemParaCargo = { id: string; nome: string; deRh: boolean };

/** Cria ou edita um cargo da grade de RH: item do orçamento, quantidade, horários, carga e contratação; atribuições e formação em "Mais detalhes". */
export function CargoModal({ prestacaoId, cargo, itens, ordem, onClose, onSaved }: {
  prestacaoId: string;
  cargo: PrestacaoCargo | null;
  itens: readonly ItemParaCargo[];
  ordem: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const c = cargo;
  const [nome, setNome] = useState(c?.cargo ?? "");
  const [noId, setNoId] = useState(c?.no_id ?? "");
  const [quantidade, setQuantidade] = useState(String(c?.quantidade ?? 1));
  const [horarios, setHorarios] = useState<string[]>(horariosDaSemana(c?.horarios));
  const cargaInicial = numeroDaCarga(c?.carga_semanal);
  const [carga, setCarga] = useState(cargaInicial === null ? "" : String(cargaInicial).replace(".", ","));
  const [contratacao, setContratacao] = useState<ContratacaoDoCargo | "">(c?.contratacao ?? "");
  const [atribuicoes, setAtribuicoes] = useState(c?.atribuicoes ?? "");
  const [formacao, setFormacao] = useState(c?.formacao ?? "");
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(c?.atribuicoes || c?.formacao));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const soma = cargaDosHorarios(horarios);
  const cargaEscrita = numeroDaCarga(carga);
  const opcoesDeItem = useMemo(() => {
    const deRh = itens.filter(i => i.deRh);
    const outros = itens.filter(i => !i.deRh);
    return [
      { value: "", label: "Sem item do orçamento" },
      ...deRh.map(i => ({ value: i.id, label: i.nome })),
      ...outros.map(i => ({ value: i.id, label: i.nome })),
    ];
  }, [itens]);

  function escolherItem(id: string) {
    setNoId(id);
    // Sem nome ainda, o cargo leva o nome do item.
    if (!nome.trim() && id) setNome(itens.find(i => i.id === id)?.nome ?? "");
  }

  async function salvar() {
    setErro("");
    if (!nome.trim()) { setErro("Dê o nome do cargo (ex.: Professor de educação física)."); return; }
    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd < 1) { setErro("A quantidade é um número inteiro, a partir de 1."); return; }
    if (carga.trim() && (cargaEscrita === null || cargaEscrita < 0 || cargaEscrita > 168)) { setErro("A carga horária semanal vai de 0 a 168 horas."); return; }
    const dados = {
      cargo: nome.trim(),
      no_id: noId || null,
      quantidade: qtd,
      horarios: horarios.map(h => h.trim()),
      carga_semanal: carga.trim() ? cargaEscrita : null,
      contratacao: contratacao || null,
      atribuicoes: atribuicoes.trim() || null,
      formacao: formacao.trim() || null,
    };
    setSalvando(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const db = supabase as any;
    const { error } = c
      ? await db.from("prestacao_cargos").update(dados).eq("id", c.id)
      : await db.from("prestacao_cargos").insert({ ...dados, prestacao_id: prestacaoId, ordem });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar o cargo")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={c ? "Editar cargo" : "Novo cargo"}
      subtitulo="Um cargo da grade horária dos recursos humanos"
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
            {c ? "Salvar" : "Adicionar à grade"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={ROTULO}>Item do orçamento</span>
          <Dropdown value={noId} onChange={escolherItem} ariaLabel="Item do orçamento" placeholder="Escolha o item que paga o cargo" options={opcoesDeItem} />
          <span className="mt-1 block text-[0.625rem] text-black/35">Com o item, o Jards confere quem foi pago no cargo e o documento de cada pagamento.</span>
        </div>
        <label>
          <span className={ROTULO}>Cargo</span>
          <input value={nome} onChange={e => setNome(e.target.value)} maxLength={200} placeholder="Ex.: Professor de educação física" className={CAMPO} autoFocus={!c} />
        </label>
        <label>
          <span className={ROTULO}>Quantidade de contratados</span>
          <input value={quantidade} onChange={e => setQuantidade(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" className={CAMPO} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Forma de contratação</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de contratação">
            {CONTRATACOES.map(f => {
              const ativo = contratacao === f.valor;
              return (
                <button
                  key={f.valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setContratacao(ativo ? "" : f.valor)}
                  className={`min-h-10 rounded border px-2 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${ativo ? "bg-[#0D0D0D] text-white" : "bg-white text-black/70 hover:bg-black/[.04]"}`}
                  style={{ borderColor: ativo ? "#0D0D0D" : "rgba(13,13,13,.12)" }}
                >
                  <span className="block text-[0.75rem] font-medium">{f.rotulo}</span>
                  <span className={`block text-[0.625rem] ${ativo ? "text-white/70" : "text-black/40"}`}>{f.descricao}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Horário de cada dia</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DIAS_DA_GRADE_RH.map((dia, i) => (
              <label key={dia} className="flex items-center gap-2">
                <span className="w-[3.75rem] shrink-0 text-[0.6875rem] text-black/55">{dia}</span>
                <input
                  value={horarios[i]}
                  onChange={e => setHorarios(atual => atual.map((h, j) => (j === i ? e.target.value.slice(0, 60) : h)))}
                  placeholder={i < 5 ? "08:00-12:00" : ""}
                  aria-label={`Horário de ${dia.toLowerCase()}`}
                  className={`${CAMPO} h-9`}
                />
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[0.625rem] text-black/40">
            Deixe vazio o dia sem trabalho; dois turnos vão juntos (08:00-12:00 e 14:00-18:00).
            {soma.ilegiveis.length ? ` Não deu para somar: ${soma.ilegiveis.join(", ").toLowerCase()}.` : soma.horas ? ` Os horários somam ${horasBr(soma.horas)} por semana.` : ""}
          </p>
        </fieldset>

        <label>
          <span className={ROTULO}>Carga horária semanal (horas)</span>
          <input value={carga} onChange={e => setCarga(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))} inputMode="decimal" placeholder={soma.horas ? String(soma.horas).replace(".", ",") : "Ex.: 20"} className={CAMPO} />
        </label>
        <div className="flex items-end">
          {soma.horas > 0 && !soma.ilegiveis.length && cargaEscrita !== soma.horas && (
            <button type="button" onClick={() => setCarga(String(soma.horas).replace(".", ","))}
              className="h-10 rounded px-2 text-[0.75rem] text-black/55 underline decoration-black/20 underline-offset-2 transition hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              Usar a soma dos horários ({horasBr(soma.horas)})
            </button>
          )}
        </div>

        <div className="border-t pt-3 sm:col-span-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes}
            className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-black/55 transition hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <ChevronDown size={13} aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
            Mais detalhes
          </button>
          {maisDetalhes && (
            <div className="mt-3 grid grid-cols-1 gap-4">
              <label>
                <span className={ROTULO}>Atribuições</span>
                <textarea value={atribuicoes} onChange={e => setAtribuicoes(e.target.value)} maxLength={1000} rows={2} placeholder="As responsabilidades do cargo"
                  className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
              </label>
              <label>
                <span className={ROTULO}>Formação acadêmica</span>
                <input value={formacao} onChange={e => setFormacao(e.target.value)} maxLength={300} placeholder="A escolaridade exigida do contratado" className={CAMPO} />
              </label>
            </div>
          )}
        </div>

        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B] sm:col-span-2" style={{ borderColor: "rgba(178,59,59,.35)" }}>{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
