"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { SITUACOES_DA_MATRICULA, SITUACOES_DA_TURMA, type SituacaoDaMatricula, type SituacaoDaTurma } from "@/lib/producao/estados";
import {
  frequenciaDaMatricula, lerAula, lerMatricula, lerTurma, mensagemDoErroDeFormacao, podeCertificar, ROTULO_DA_SITUACAO_DA_MATRICULA, ROTULO_DA_SITUACAO_DA_TURMA, vagasDaTurma,
  type AulaDaTurma, type Matricula, type Presenca, type TurmaDeFormacao,
} from "@/lib/producao/formacao";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const APAGAR = "mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

const Erro = ({ texto }: { texto: string }) => <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;
const hora = (valor: string) => valor.slice(0, 5);

/** Criar ou editar uma turma (nome, período, vagas, frequência mínima para o certificado, situação). */
export function TurmaSheet({ organizationId, turma, onClose, onSalvou }: { organizationId: string; turma: TurmaDeFormacao | null; onClose: () => void; onSalvou: (id: string) => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(turma?.nome ?? "");
  const [inicio, setInicio] = useState(turma?.inicio ?? "");
  const [fim, setFim] = useState(turma?.fim ?? "");
  const [vagas, setVagas] = useState(turma?.vagas ? String(turma.vagas) : "");
  const [frequencia, setFrequencia] = useState(String(turma?.frequencia_minima ?? 75));
  const [situacao, setSituacao] = useState<SituacaoDaTurma>(turma?.situacao ?? "aberta");
  const [notas, setNotas] = useState(turma?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerTurma({ nome, inicio, fim, vagas, frequencia, situacao, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    if (turma) {
      const { error } = await producao.from("producao_turmas").update(leitura.valor).eq("id", turma.id);
      setSalvando(false);
      if (error) { setErro(mensagemDoErroDeFormacao(error)); return; }
      onSalvou(turma.id);
    } else {
      const { data, error } = await producao.from("producao_turmas").insert({ organization_id: organizationId, ...leitura.valor }).select("id").single();
      setSalvando(false);
      if (error || !data) { setErro(mensagemDoErroDeFormacao(error ?? {})); return; }
      onSalvou(data.id);
    }
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!turma) return;
    confirmDelete({
      title: "Apagar turma?",
      description: `“${turma.nome}” sai com as aulas, as matrículas e as presenças. Se só acabou, prefira marcar como concluída.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_turmas").delete().eq("id", turma.id);
        if (error) throw new Error("Não foi possível apagar a turma.");
        onSalvou("");
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={turma ? "Editar turma" : "Nova turma"}
      onClose={onClose}
      footer={fechar => (
        <>
          {turma && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : turma ? "Salvar" : "Criar turma"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div><label className={ROTULO} htmlFor="tur-nome">Nome da turma</label><input id="tur-nome" className={CAMPO} value={nome} maxLength={120} onChange={event => setNome(event.target.value)} disabled={salvando} placeholder="Oficina de iluminação cênica" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="tur-inicio">Começa (opcional)</label><input id="tur-inicio" type="date" className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="tur-fim">Termina (opcional)</label><input id="tur-fim" type="date" className={CAMPO} value={fim} onChange={event => setFim(event.target.value)} disabled={salvando} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="tur-vagas">Vagas (opcional)</label><input id="tur-vagas" inputMode="numeric" className={CAMPO} value={vagas} onChange={event => setVagas(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="Sem limite" /></div>
          <div><label className={ROTULO} htmlFor="tur-freq">Frequência mínima (%)</label><input id="tur-freq" inputMode="numeric" className={CAMPO} value={frequencia} onChange={event => setFrequencia(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
        </div>
        <div>
          <span className={ROTULO}>Situação</span>
          <Dropdown ariaLabel="Situação da turma" value={situacao} onChange={valor => setSituacao(valor as SituacaoDaTurma)} disabled={salvando} options={SITUACOES_DA_TURMA.map(valor => ({ value: valor, label: ROTULO_DA_SITUACAO_DA_TURMA[valor] }))} />
        </div>
        <div><label className={ROTULO} htmlFor="tur-notas">Nota (opcional)</label><input id="tur-notas" className={CAMPO} value={notas} maxLength={300} onChange={event => setNotas(event.target.value)} disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

function AulaSheet({ organizationId, turmaId, aula, onClose, onSalvou }: { organizationId: string; turmaId: string; aula: AulaDaTurma | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [dia, setDia] = useState(aula?.dia ?? "");
  const [inicio, setInicio] = useState(aula ? hora(aula.inicio) : "");
  const [fim, setFim] = useState(aula ? hora(aula.fim) : "");
  const [tema, setTema] = useState(aula?.tema ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerAula({ dia, inicio, fim, tema });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = aula
      ? await producao.from("producao_turma_aulas").update(leitura.valor).eq("id", aula.id)
      : await producao.from("producao_turma_aulas").insert({ organization_id: organizationId, turma_id: turmaId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeFormacao(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!aula) return;
    confirmDelete({
      title: "Apagar aula?",
      description: `A aula de ${diaEMes(aula.dia)} sai da turma com as presenças marcadas nela.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_turma_aulas").delete().eq("id", aula.id);
        if (error) throw new Error("Não foi possível apagar a aula.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={aula ? "Editar aula" : "Nova aula"}
      onClose={onClose}
      footer={fechar => (
        <>
          {aula && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : aula ? "Salvar" : "Criar aula"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div className="grid grid-cols-3 gap-3">
          <div><label className={ROTULO} htmlFor="aula-dia">Dia</label><input id="aula-dia" type="date" className={CAMPO} value={dia} onChange={event => setDia(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="aula-inicio">Começa</label><input id="aula-inicio" type="time" className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="aula-fim">Termina</label><input id="aula-fim" type="time" className={CAMPO} value={fim} onChange={event => setFim(event.target.value)} disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor="aula-tema">Tema (opcional)</label><input id="aula-tema" className={CAMPO} value={tema} maxLength={120} onChange={event => setTema(event.target.value)} disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

function MatriculaSheet({ organizationId, turmaId, matricula, onClose, onSalvou }: { organizationId: string; turmaId: string; matricula: Matricula | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(matricula?.nome ?? "");
  const [email, setEmail] = useState(matricula?.email ?? "");
  const [telefone, setTelefone] = useState(matricula?.telefone ?? "");
  const [situacao, setSituacao] = useState<SituacaoDaMatricula>(matricula?.situacao ?? "inscrito");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerMatricula({ nome, email, telefone, situacao });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = matricula
      ? await producao.from("producao_matriculas").update(leitura.valor).eq("id", matricula.id)
      : await producao.from("producao_matriculas").insert({ organization_id: organizationId, turma_id: turmaId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeFormacao(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!matricula) return;
    confirmDelete({
      title: "Apagar matrícula?",
      description: `${matricula.nome} sai da turma com as presenças marcadas. Se só desistiu, prefira marcar como desistente.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_matriculas").delete().eq("id", matricula.id);
        if (error) throw new Error("Não foi possível apagar a matrícula.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={matricula ? "Editar matrícula" : "Nova matrícula"}
      onClose={onClose}
      footer={fechar => (
        <>
          {matricula && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : matricula ? "Salvar" : "Matricular"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div><label className={ROTULO} htmlFor="mat-nome">Nome do aluno</label><input id="mat-nome" className={CAMPO} value={nome} maxLength={120} onChange={event => setNome(event.target.value)} disabled={salvando} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="mat-email">E-mail (opcional)</label><input id="mat-email" type="email" className={CAMPO} value={email} maxLength={200} onChange={event => setEmail(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="mat-tel">Telefone (opcional)</label><input id="mat-tel" type="tel" className={CAMPO} value={telefone} maxLength={30} onChange={event => setTelefone(event.target.value)} disabled={salvando} /></div>
        </div>
        <div>
          <span className={ROTULO}>Situação</span>
          <Dropdown ariaLabel="Situação da matrícula" value={situacao} onChange={valor => setSituacao(valor as SituacaoDaMatricula)} disabled={salvando} options={SITUACOES_DA_MATRICULA.map(valor => ({ value: valor, label: ROTULO_DA_SITUACAO_DA_MATRICULA[valor] }))} />
        </div>
        <p className="text-[0.6875rem] text-black/45">Só nome e um contato opcional. Sem documento nem dados de saúde.</p>
      </div>
    </TopSheet>
  );
}

/** Uma turma de formação (PD7.10): as aulas, as matrículas, a presença de cada aluno em cada aula, a frequência e o certificado. */
export function FormacaoDaTurma({ organizationId, turma, podeEditar, onTurmaMudou }: { organizationId: string; turma: TurmaDeFormacao; podeEditar: boolean; onTurmaMudou: () => void }) {
  const [aulas, setAulas] = useState<AulaDaTurma[] | null>(null);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [folhaAula, setFolhaAula] = useState<{ aula: AulaDaTurma | null } | null>(null);
  const [folhaMatricula, setFolhaMatricula] = useState<{ matricula: Matricula | null } | null>(null);
  const [turmaAberta, setTurmaAberta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [aul, mat] = await Promise.all([
        producao.from("producao_turma_aulas").select("id, dia, inicio, fim, tema").eq("turma_id", turma.id).order("dia").order("inicio"),
        producao.from("producao_matriculas").select("id, nome, email, telefone, situacao, certificado_emitido_em").eq("turma_id", turma.id).order("nome"),
      ]);
      const ids = (aul.data ?? []).map(aula => aula.id);
      const pre = ids.length > 0 ? await producao.from("producao_presencas").select("aula_id, matricula_id, presente").in("aula_id", ids) : { data: [], error: null };
      if (!ativo) return;
      setAulas(aul.data ?? []);
      setMatriculas(mat.data ?? []);
      setPresencas(pre.data ?? []);
      setErro(aul.error || mat.error || pre.error ? "Não foi possível carregar a turma. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [turma.id, versao]);

  const recarregar = () => setVersao(atual => atual + 1);
  const vagas = useMemo(() => vagasDaTurma(turma, matriculas), [turma, matriculas]);
  const marcas = useMemo(() => new Map(presencas.map(presenca => [`${presenca.aula_id}:${presenca.matricula_id}`, presenca.presente])), [presencas]);

  async function marcar(aula: AulaDaTurma, matricula: Matricula) {
    const chave = `${aula.id}:${matricula.id}`;
    setTrabalhando(chave);
    setErro(null);
    const atual = marcas.get(chave) ?? false;
    const { error } = await clienteDaProducao(createClient()).from("producao_presencas").upsert({ organization_id: organizationId, aula_id: aula.id, matricula_id: matricula.id, presente: !atual }, { onConflict: "aula_id,matricula_id" });
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeFormacao(error)); return; }
    recarregar();
  }

  async function mudarSituacao(matricula: Matricula, situacao: SituacaoDaMatricula) {
    setTrabalhando(matricula.id);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_matriculas").update({ situacao }).eq("id", matricula.id);
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeFormacao(error)); return; }
    recarregar();
  }

  async function certificar(matricula: Matricula, emitir: boolean) {
    setTrabalhando(matricula.id);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_matriculas").update({ certificado_emitido_em: emitir ? new Date().toISOString() : null }).eq("id", matricula.id);
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeFormacao(error)); return; }
    recarregar();
  }

  if (aulas === null) return <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  return (
    <div className="space-y-6">
      {erro && <Erro texto={erro} />}

      <section aria-labelledby="resumo-turma" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="resumo-turma" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Turma</h2>
          <p className="mt-1 text-[0.8125rem] tabular-nums text-black/65">
            {ROTULO_DA_SITUACAO_DA_TURMA[turma.situacao]}
            {turma.inicio ? ` · ${diaEMes(turma.inicio)}${turma.fim ? ` a ${diaEMes(turma.fim)}` : ""}` : ""}
            {` · ${vagas.ocupadas}${turma.vagas ? ` de ${turma.vagas}` : ""} ${vagas.ocupadas === 1 ? "matriculado" : "matriculados"}`}
            {` · certificado com ${turma.frequencia_minima}% de frequência`}
          </p>
          {turma.notas && <p className="mt-0.5 text-[0.75rem] text-black/45">{turma.notas}</p>}
        </div>
        {podeEditar && <button type="button" onClick={() => setTurmaAberta(true)} className={BOTAO}>Editar turma</button>}
      </section>

      <section aria-labelledby="aulas-turma">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="aulas-turma" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Aulas</h2>
          {podeEditar && <button type="button" onClick={() => setFolhaAula({ aula: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Nova aula</button>}
        </div>
        {aulas.length === 0 ? (
          <p className="rounded border bg-white px-5 py-5 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma aula ainda. Crie as aulas para marcar a presença e calcular a frequência.</p>
        ) : (
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {aulas.map(aula => (
              <li key={aula.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <span className="w-28 text-[0.8125rem] tabular-nums text-[#282525]">{diaDaSemana(aula.dia)} {diaEMes(aula.dia)}</span>
                <span className="w-28 text-[0.75rem] tabular-nums text-black/55">{hora(aula.inicio)} às {hora(aula.fim)}</span>
                <span className="min-w-0 flex-1 truncate text-[0.75rem] text-black/55">{aula.tema ?? ""}</span>
                <span className="text-[0.6875rem] text-black/45">{aula.dia <= hoje ? "realizada" : "a realizar"}</span>
                {podeEditar && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaAula({ aula })}>Editar</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="matriculas-turma">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="matriculas-turma" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Matrículas e presença</h2>
          {podeEditar && <button type="button" onClick={() => setFolhaMatricula({ matricula: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Matricular</button>}
        </div>
        {matriculas.length === 0 ? (
          <p className="rounded border bg-white px-5 py-5 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Ninguém matriculado ainda. As vagas da turma, se houver, são conferidas pelo banco.</p>
        ) : (
          <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <table className="w-full border-collapse text-left" style={{ minWidth: `${28 + aulas.length * 3.5}rem` }}>
              <thead>
                <tr className="border-b border-black/[.06]">
                  <th scope="col" className="px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Aluno</th>
                  {aulas.map(aula => <th key={aula.id} scope="col" className="px-2 py-2.5 text-center text-[0.625rem] font-medium tabular-nums uppercase tracking-[.08em] text-black/45" title={aula.tema ?? undefined}>{diaEMes(aula.dia)}</th>)}
                  <th scope="col" className="px-3 py-2.5 text-right text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Frequência</th>
                  <th scope="col" className="px-3 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Situação</th>
                  {podeEditar && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th>}
                </tr>
              </thead>
              <tbody>
                {matriculas.map(matricula => {
                  const frequencia = frequenciaDaMatricula(aulas, presencas, matricula.id, hoje);
                  const certificar_ = podeCertificar(turma, matricula, frequencia);
                  return (
                    <tr key={matricula.id} className="border-b border-black/[.06] align-middle last:border-b-0">
                      <th scope="row" className={`px-4 py-2 text-left text-[0.8125rem] font-medium ${matricula.situacao === "desistente" ? "text-black/40 line-through" : "text-[#282525]"}`}>{matricula.nome}</th>
                      {aulas.map(aula => {
                        const chave = `${aula.id}:${matricula.id}`;
                        const realizada = aula.dia <= hoje;
                        return (
                          <td key={aula.id} className="px-2 py-2 text-center">
                            {realizada
                              ? <input type="checkbox" checked={marcas.get(chave) ?? false} disabled={!podeEditar || trabalhando === chave} onChange={() => void marcar(aula, matricula)} aria-label={`${matricula.nome}, aula de ${diaEMes(aula.dia)}`} className="h-5 w-5 accent-[#282525]" />
                              : <span aria-hidden="true" className="text-black/20">·</span>}
                          </td>
                        );
                      })}
                      <td className={`px-3 py-2 text-right text-[0.8125rem] tabular-nums ${frequencia.percentual === null ? "text-black/30" : "text-[#282525]"}`}>{frequencia.percentual === null ? "—" : `${Math.round(frequencia.percentual)}%`}</td>
                      <td className="px-3 py-2 text-[0.75rem] text-black/65">{matricula.certificado_emitido_em ? "Certificado emitido" : ROTULO_DA_SITUACAO_DA_MATRICULA[matricula.situacao]}</td>
                      {podeEditar && (
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap justify-end gap-1.5">
                            {matricula.situacao === "inscrito" && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === matricula.id} onClick={() => void mudarSituacao(matricula, "confirmado")}>Confirmar</button>}
                            {matricula.situacao !== "desistente" && !matricula.certificado_emitido_em && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === matricula.id} onClick={() => void mudarSituacao(matricula, "desistente")}>Desistiu</button>}
                            {matricula.certificado_emitido_em
                              ? <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === matricula.id} onClick={() => void certificar(matricula, false)}>Tirar certificado</button>
                              : <button type="button" className={BOTAO_PEQUENO} disabled={!certificar_.ok || trabalhando === matricula.id} title={certificar_.ok ? undefined : certificar_.texto} onClick={() => void certificar(matricula, true)}>Emitir certificado</button>}
                            <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaMatricula({ matricula })}>Editar</button>
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {turmaAberta && <TurmaSheet organizationId={organizationId} turma={turma} onClose={() => setTurmaAberta(false)} onSalvou={() => onTurmaMudou()} />}
      {folhaAula && <AulaSheet organizationId={organizationId} turmaId={turma.id} aula={folhaAula.aula} onClose={() => setFolhaAula(null)} onSalvou={recarregar} />}
      {folhaMatricula && <MatriculaSheet organizationId={organizationId} turmaId={turma.id} matricula={folhaMatricula.matricula} onClose={() => setFolhaMatricula(null)} onSalvou={recarregar} />}
    </div>
  );
}
