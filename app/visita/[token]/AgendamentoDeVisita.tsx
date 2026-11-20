"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import type { VisitaPublica } from "@/lib/producao/visita-publica";
import { TEXTO_DA_CONCORDANCIA_DA_VISITA } from "@/lib/producao/visitas";
import { AvisoDePrivacidade } from "@/components/producao/AvisoDePrivacidade";

const CAMPO = "h-11 w-full rounded border border-black/[.14] bg-white px-3 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.75rem] font-medium text-black/60";
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const rotuloDoHorario = (horario: VisitaPublica["horarios"][number]) => {
  const data = new Date(`${horario.dia}T12:00:00`);
  const vagas = horario.livres === 0 ? "sem vagas" : `${horario.livres} ${horario.livres === 1 ? "vaga" : "vagas"}`;
  return `${DIAS[data.getDay()]} ${horario.dia.slice(8, 10)}/${horario.dia.slice(5, 7)}, ${horario.inicio} às ${horario.fim} (${vagas})`;
};

/** O agendamento de uma visita: o horário (com as vagas), o grupo, o responsável, um contato e quantas pessoas. Sem conta. */
export function AgendamentoDeVisita({ codigo, visita }: { codigo: string; visita: VisitaPublica }) {
  const [horarioId, setHorarioId] = useState("");
  const [grupo, setGrupo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pessoas, setPessoas] = useState("");
  const [observacao, setObservacao] = useState("");
  const [concordou, setConcordou] = useState(false);
  const [site, setSite] = useState(""); // campo escondido: gente de verdade não preenche
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/visita/${encodeURIComponent(codigo)}/agendar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ horario_id: horarioId, grupo, responsavel, email, telefone, pessoas, observacao, concordou, site }),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) { setErro(corpo.error ?? "Não foi possível enviar agora. Tente de novo."); return; }
      setEnviado(true);
    } catch {
      setErro("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8">
      <div className="mx-auto max-w-[30rem]">
        <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{visita.organizacao}</p>
        <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-.01em] text-[#282525]">{visita.titulo ?? "Agendar visita"}</h1>
        <p className="mt-1 text-[0.875rem] text-black/60">Visita de escolas e grupos a <strong className="font-medium text-[#282525]">{visita.espaco}</strong>. Escolha o dia e o horário; a produção confirma depois. Não precisa de conta.</p>

        {enviado ? (
          <div role="status" className="mt-6 rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.1)" }}>
            <Check size={20} aria-hidden="true" className="mx-auto text-[#2E8932]" />
            <p className="mt-2 text-[0.9375rem] font-medium text-[#282525]">Pedido de visita enviado</p>
            <p className="mt-1 text-[0.8125rem] text-black/55">Obrigado! A produção vai analisar e falar com o responsável pelo contato informado.</p>
          </div>
        ) : visita.horarios.length === 0 ? (
          <p className="mt-6 rounded border bg-white px-5 py-6 text-center text-[0.8125rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>Ainda não há horários de visita abertos. Fale com quem enviou o link.</p>
        ) : (
          <form onSubmit={event => { event.preventDefault(); void enviar(); }} className="mt-6 space-y-4">
            <div>
              <span className={ROTULO}>Dia e horário</span>
              <Dropdown ariaLabel="Dia e horário" value={horarioId} onChange={setHorarioId} disabled={enviando}
                options={[{ value: "", label: "Escolha o horário" }, ...visita.horarios.map(horario => ({ value: horario.id, label: rotuloDoHorario(horario) }))]} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="grupo">Escola ou grupo</label>
              <input id="grupo" className={CAMPO} value={grupo} maxLength={120} onChange={event => setGrupo(event.target.value)} disabled={enviando} required />
            </div>
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <div>
                <label className={ROTULO} htmlFor="responsavel">Responsável pelo grupo</label>
                <input id="responsavel" className={CAMPO} value={responsavel} maxLength={120} autoComplete="name" onChange={event => setResponsavel(event.target.value)} disabled={enviando} required />
              </div>
              <div>
                <label className={ROTULO} htmlFor="pessoas">Pessoas</label>
                <input id="pessoas" inputMode="numeric" className={CAMPO} value={pessoas} onChange={event => setPessoas(event.target.value.replace(/\D/g, ""))} disabled={enviando} required />
              </div>
            </div>
            <div>
              <label className={ROTULO} htmlFor="email">E-mail</label>
              <input id="email" type="email" className={CAMPO} value={email} maxLength={200} autoComplete="email" onChange={event => setEmail(event.target.value)} disabled={enviando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="telefone">Telefone ou WhatsApp</label>
              <input id="telefone" type="tel" className={CAMPO} value={telefone} maxLength={30} autoComplete="tel" onChange={event => setTelefone(event.target.value)} disabled={enviando} />
              <p className="mt-1 text-[0.6875rem] text-black/45">Informe pelo menos um: e-mail ou telefone. Conte alunos, professores e acompanhantes em &ldquo;Pessoas&rdquo;.</p>
            </div>
            <div>
              <label className={ROTULO} htmlFor="observacao">Quer avisar algo? (opcional)</label>
              <textarea id="observacao" rows={2} maxLength={300} className="w-full resize-none rounded border border-black/[.14] bg-white px-3 py-2.5 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50"
                value={observacao} onChange={event => setObservacao(event.target.value)} disabled={enviando} placeholder="Por exemplo: o grupo tem cadeirantes." />
              <p className="mt-1 text-[0.6875rem] text-black/45">Não escreva documentos, nomes de alunos ou dados de saúde.</p>
            </div>

            {/* Armadilha para robôs: escondido de quem usa a tela e de leitor de tela. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
              <label htmlFor="site">Não preencha este campo</label>
              <input id="site" tabIndex={-1} autoComplete="off" value={site} onChange={event => setSite(event.target.value)} />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-[0.8125rem] text-black/70">
              <input type="checkbox" checked={concordou} onChange={event => setConcordou(event.target.checked)} disabled={enviando} className="mt-0.5 h-5 w-5 shrink-0 accent-[#282525]" />
              <span>{TEXTO_DA_CONCORDANCIA_DA_VISITA}</span>
            </label>

            {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

            <button type="submit" disabled={enviando || !concordou} className="h-12 w-full rounded bg-[#2E8932] text-[0.9375rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">
              {enviando ? "Enviando…" : "Pedir a visita"}
            </button>
          </form>
        )}
        <AvisoDePrivacidade />
      </div>
    </main>
  );
}
