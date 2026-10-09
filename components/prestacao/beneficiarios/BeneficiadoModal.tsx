"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { LIMITES_DO_BENEFICIADO, lerBeneficios, nomeComparavel, type BeneficiadoNovo } from "@/lib/prestacao/beneficiarios";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoBeneficiario } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const CHIP = "inline-flex min-h-8 items-center gap-1 rounded border bg-white px-2.5 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5]";

const SEXOS = [{ value: "", label: "Não informado" }, { value: "feminino", label: "Feminino" }, { value: "masculino", label: "Masculino" }];
const REDES = [{ value: "", label: "Não informada" }, { value: "publica", label: "Pública" }, { value: "privada", label: "Privada" }];

/** Cria ou edita um beneficiado: o que o formulário conta primeiro; contato e observações em "Mais detalhes". */
export function BeneficiadoModal({ prestacaoId, beneficiado, beneficiosConhecidos, modalidades, onClose, onSaved }: {
  prestacaoId: string;
  beneficiado: PrestacaoBeneficiario | null;
  /** Benefícios que já estão na relação, para marcar sem digitar de novo. */
  beneficiosConhecidos: readonly string[];
  modalidades: readonly string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const b = beneficiado;
  const [nome, setNome] = useState(b?.nome ?? "");
  const [sexo, setSexo] = useState<string>(b?.sexo ?? "");
  const [idade, setIdade] = useState(b?.idade === null || b?.idade === undefined ? "" : String(b.idade));
  const [rede, setRede] = useState(b?.rede_publica === true ? "publica" : b?.rede_publica === false ? "privada" : "");
  const [modalidade, setModalidade] = useState(b?.modalidade ?? (modalidades.length === 1 ? modalidades[0] : ""));
  const [beneficios, setBeneficios] = useState<string[]>(b?.beneficios ?? []);
  const [novoBeneficio, setNovoBeneficio] = useState("");
  const [telefone, setTelefone] = useState(b?.telefone ?? "");
  const [endereco, setEndereco] = useState(b?.endereco ?? "");
  const [observacoes, setObservacoes] = useState(b?.observacoes ?? "");
  // "Mais detalhes" já abre quando há algo preenchido lá dentro.
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(b?.telefone || b?.endereco || b?.observacoes));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const opcoesDeBeneficio = useMemo(() => {
    const vistos = new Set<string>();
    return [...beneficiosConhecidos, ...beneficios].filter(x => {
      const chave = nomeComparavel(x);
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  }, [beneficiosConhecidos, beneficios]);
  const marcado = (x: string) => beneficios.some(y => nomeComparavel(y) === nomeComparavel(x));
  const alternar = (x: string) => setBeneficios(atual => (marcado(x) ? atual.filter(y => nomeComparavel(y) !== nomeComparavel(x)) : [...atual, x]));
  function adicionarBeneficio() {
    const novos = lerBeneficios(novoBeneficio).filter(x => !marcado(x));
    if (novos.length) setBeneficios(atual => [...atual, ...novos].slice(0, LIMITES_DO_BENEFICIADO.beneficios));
    setNovoBeneficio("");
  }

  async function salvar() {
    setErro("");
    const n = nome.trim();
    if (!n) { setErro("Informe o nome."); return; }
    const anos = idade.trim() === "" ? null : Number(idade);
    if (anos !== null && (!Number.isInteger(anos) || anos < 0 || anos > 120)) { setErro("A idade é um número inteiro de 0 a 120."); return; }
    const pendente = lerBeneficios(novoBeneficio).filter(x => !marcado(x));
    const dados: BeneficiadoNovo = {
      nome: n,
      sexo: sexo === "feminino" || sexo === "masculino" ? sexo : null,
      idade: anos,
      rede_publica: rede === "publica" ? true : rede === "privada" ? false : null,
      modalidade: modalidade.trim() || null,
      beneficios: [...beneficios, ...pendente].slice(0, LIMITES_DO_BENEFICIADO.beneficios),
      telefone: telefone.trim() || null,
      endereco: endereco.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    setSalvando(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const db = supabase as any;
    const { error } = b
      ? await db.from("prestacao_beneficiarios").update(dados).eq("id", b.id)
      : await db.from("prestacao_beneficiarios").insert({ ...dados, prestacao_id: prestacaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar o beneficiado")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={b ? "Editar beneficiado" : "Novo beneficiado"}
      subtitulo="Uma pessoa da relação de diretamente beneficiados"
      onClose={onClose}
      largura="max-w-[36rem]"
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
            {b ? "Salvar" : "Adicionar à relação"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ROTULO}>Nome</span>
          <input value={nome} onChange={e => setNome(e.target.value)} maxLength={LIMITES_DO_BENEFICIADO.nome} placeholder="Nome completo" className={CAMPO} autoFocus={!b} />
        </label>
        <div>
          <span className={ROTULO}>Sexo</span>
          <Dropdown value={sexo} onChange={setSexo} options={SEXOS} ariaLabel="Sexo" />
        </div>
        <label>
          <span className={ROTULO}>Idade</span>
          <input value={idade} onChange={e => setIdade(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Anos" className={CAMPO} />
        </label>
        <div>
          <span className={ROTULO}>Rede de ensino</span>
          <Dropdown value={rede} onChange={setRede} options={REDES} ariaLabel="Rede de ensino" />
        </div>
        <label>
          <span className={ROTULO}>Evento ou modalidade</span>
          <input value={modalidade} onChange={e => setModalidade(e.target.value)} maxLength={LIMITES_DO_BENEFICIADO.modalidade} placeholder="Ex.: Atletismo — turma da manhã" className={CAMPO} list="modalidades-da-relacao" />
          <datalist id="modalidades-da-relacao">{modalidades.map(m => <option key={m} value={m} />)}</datalist>
        </label>
        <div className="sm:col-span-2">
          <span className={ROTULO}>Benefícios recebidos</span>
          {opcoesDeBeneficio.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Benefícios recebidos">
              {opcoesDeBeneficio.map(x => {
                const ativo = marcado(x);
                return (
                  <button
                    key={x}
                    type="button"
                    onClick={() => alternar(x)}
                    aria-pressed={ativo}
                    className={`${CHIP} ${ativo ? "text-black" : "text-black/55 hover:bg-black/[.04] hover:text-black/80"}`}
                    style={{ borderColor: ativo ? "rgba(13,13,13,.45)" : "rgba(13,13,13,.12)" }}
                  >
                    {ativo && <Check size={11} aria-hidden />} {x}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={novoBeneficio}
              onChange={e => setNovoBeneficio(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarBeneficio(); } }}
              maxLength={LIMITES_DO_BENEFICIADO.beneficio * 3}
              placeholder="Lanche, transporte, uniforme..."
              aria-label="Outro benefício"
              className={CAMPO}
            />
            <button
              type="button"
              onClick={adicionarBeneficio}
              disabled={!novoBeneficio.trim()}
              className="flex h-10 shrink-0 items-center gap-1 rounded border bg-white px-3 text-[0.6875rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: "rgba(13,13,13,.14)" }}
            >
              <Plus size={12} aria-hidden /> Adicionar
            </button>
          </div>
          <p className="mt-1 text-[0.625rem] text-black/40">O formulário tem 6 colunas de benefício: os mais comuns da relação viram as colunas.</p>
        </div>

        <div className="border-t pt-3 sm:col-span-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes}
            className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-black/55 transition hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <ChevronDown size={13} aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
            Mais detalhes
          </button>
          {maisDetalhes && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className={ROTULO}>Telefone</span>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} maxLength={LIMITES_DO_BENEFICIADO.telefone} inputMode="tel" placeholder="(00) 00000-0000" className={CAMPO} />
              </label>
              <label>
                <span className={ROTULO}>Endereço</span>
                <input value={endereco} onChange={e => setEndereco(e.target.value)} maxLength={LIMITES_DO_BENEFICIADO.endereco} placeholder="Rua, número, bairro, cidade" className={CAMPO} />
              </label>
              <label className="sm:col-span-2">
                <span className={ROTULO}>Observações</span>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} maxLength={LIMITES_DO_BENEFICIADO.observacoes} rows={2} className={AREA} />
              </label>
            </div>
          )}
        </div>

        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B] sm:col-span-2" style={{ borderColor: "rgba(178,59,59,.35)" }}>{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
