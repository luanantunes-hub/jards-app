"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { DIAS_DA_SEMANA, hora, nomeDoNucleo, type NucleoDoLocal } from "@/lib/prestacao/grade";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoTurma } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

/** Cria ou edita uma turma da grade: núcleo, modalidade, alunos, dias e horário; observações em "Mais detalhes". */
export function TurmaModal({ prestacaoId, turma, locais, modalidades, ordem, onClose, onSaved }: {
  prestacaoId: string;
  turma: PrestacaoTurma | null;
  locais: readonly NucleoDoLocal[];
  modalidades: readonly string[];
  ordem: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const t = turma;
  const [nome, setNome] = useState(t?.nome ?? "");
  const [localId, setLocalId] = useState(t?.local_id ?? (locais.length === 1 ? locais[0].id : ""));
  const [modalidade, setModalidade] = useState(t?.modalidade ?? (modalidades.length === 1 ? modalidades[0] : ""));
  const [alunos, setAlunos] = useState(t?.alunos === null || t?.alunos === undefined ? "" : String(t.alunos));
  const [dias, setDias] = useState<number[]>(t?.dias ?? []);
  const [inicio, setInicio] = useState(hora(t?.hora_inicio));
  const [fim, setFim] = useState(hora(t?.hora_fim));
  const [equipe, setEquipe] = useState(t?.equipe ?? "");
  const [observacoes, setObservacoes] = useState(t?.observacoes ?? "");
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(t?.observacoes));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const alternar = (dia: number) => setDias(atual => (atual.includes(dia) ? atual.filter(d => d !== dia) : [...atual, dia].sort()));

  async function salvar() {
    setErro("");
    if (!nome.trim()) { setErro("Dê um nome à turma (ex.: Turma A, Sub-13 manhã)."); return; }
    const quantos = alunos.trim() === "" ? null : Number(alunos);
    if (quantos !== null && (!Number.isInteger(quantos) || quantos < 0)) { setErro("A quantidade de alunos é um número inteiro."); return; }
    if (inicio && fim && fim <= inicio) { setErro("O horário de término vem depois do início."); return; }
    const dados = {
      nome: nome.trim(),
      local_id: localId || null,
      modalidade: modalidade.trim() || null,
      alunos: quantos,
      dias,
      hora_inicio: inicio || null,
      hora_fim: fim || null,
      equipe: equipe.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    setSalvando(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const db = supabase as any;
    const { error } = t
      ? await db.from("prestacao_turmas").update(dados).eq("id", t.id)
      : await db.from("prestacao_turmas").insert({ ...dados, prestacao_id: prestacaoId, ordem });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a turma")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={t ? "Editar turma" : "Nova turma"}
      subtitulo="Uma turma da grade semanal do núcleo"
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
            {t ? "Salvar" : "Adicionar à grade"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label>
          <span className={ROTULO}>Turma</span>
          <input value={nome} onChange={e => setNome(e.target.value)} maxLength={120} placeholder="Ex.: Turma A, Sub-13 manhã" className={CAMPO} autoFocus={!t} />
        </label>
        <div>
          <span className={ROTULO}>Núcleo</span>
          <Dropdown
            value={localId}
            onChange={setLocalId}
            ariaLabel="Núcleo"
            placeholder={locais.length ? "Escolha o núcleo" : "Cadastre os locais na aba Objeto"}
            options={[{ value: "", label: "Sem núcleo" }, ...locais.map(l => ({ value: l.id, label: nomeDoNucleo(l) }))]}
          />
        </div>
        <label>
          <span className={ROTULO}>Modalidade</span>
          <input value={modalidade} onChange={e => setModalidade(e.target.value)} maxLength={120} placeholder="Ex.: Atletismo" className={CAMPO} list="modalidades-da-grade" />
          <datalist id="modalidades-da-grade">{modalidades.map(m => <option key={m} value={m} />)}</datalist>
        </label>
        <label>
          <span className={ROTULO}>Alunos</span>
          <input value={alunos} onChange={e => setAlunos(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="Quantidade" className={CAMPO} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Dias da semana</legend>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
            {DIAS_DA_SEMANA.map(d => {
              const ativo = dias.includes(d.dia);
              return (
                <button
                  key={d.dia}
                  type="button"
                  onClick={() => alternar(d.dia)}
                  aria-pressed={ativo}
                  aria-label={d.nome}
                  className={`h-10 min-w-11 rounded border px-2.5 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${ativo ? "bg-[#0D0D0D] text-white" : "bg-white text-black/55 hover:bg-black/[.04] hover:text-black/80"}`}
                  style={{ borderColor: ativo ? "#0D0D0D" : "rgba(13,13,13,.12)" }}
                >
                  {d.curto}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label>
          <span className={ROTULO}>Das</span>
          <input type="time" value={inicio} onChange={e => setInicio(e.target.value)} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Às</span>
          <input type="time" value={fim} onChange={e => setFim(e.target.value)} className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Equipe e profissionais</span>
          <input value={equipe} onChange={e => setEquipe(e.target.value)} maxLength={500} placeholder="Ex.: 1 professor de educação física e 1 monitor" className={CAMPO} />
        </label>

        <div className="border-t pt-3 sm:col-span-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes}
            className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-black/55 transition hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <ChevronDown size={13} aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
            Mais detalhes
          </button>
          {maisDetalhes && (
            <label className="mt-3 block">
              <span className={ROTULO}>Observações</span>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} maxLength={1000} rows={2}
                className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
            </label>
          )}
        </div>

        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B] sm:col-span-2" style={{ borderColor: "rgba(178,59,59,.35)" }}>{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
