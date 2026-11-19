"use client";

import { useMemo, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { ComboboxCriavel, type OpcaoCriavel } from "@/components/ui/ComboboxCriavel";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { horarioDaEscala } from "@/lib/producao/escala";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/** Escalar uma pessoa na data: quem (da equipe, ou nova pelo nome), a função no dia, a chamada e a saída, na hora do lugar da data. */
export function EscalarPessoaSheet({ organizationId, dataId, dia, fuso, pessoas, jaEscaladas, onClose, onCreated }: {
  organizationId: string;
  dataId: string;
  dia: string;
  fuso: string;
  pessoas: readonly OpcaoCriavel[];
  /** Quem já está na escala desta data: não aparece para escolher. */
  jaEscaladas: ReadonlySet<string>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [criadas, setCriadas] = useState<OpcaoCriavel[]>([]);
  const [pessoaId, setPessoaId] = useState("");
  const [funcao, setFuncao] = useState("");
  const [chamada, setChamada] = useState("");
  const [saida, setSaida] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = useMemo(() => [...pessoas, ...criadas].filter(pessoa => !jaEscaladas.has(pessoa.id)), [pessoas, criadas, jaEscaladas]);

  async function criarPessoa(nome: string): Promise<string | null> {
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).from("producao_pessoas").insert({ organization_id: organizationId, nome }).select("id").single();
    if (error || !data) {
      // Quem tem o recorte "só onde está vinculado" não cadastra pessoa: a regra do banco recusa.
      setErro(error?.code === "42501" ? "Só quem vê a produção inteira da organização cadastra pessoa nova." : "Não foi possível cadastrar a pessoa. Tente de novo.");
      return null;
    }
    setCriadas(atual => [...atual, { id: data.id, nome }]);
    return data.id;
  }

  async function salvar(fechar: () => void) {
    if (!pessoaId) { setErro("Escolha quem trabalha na data."); return; }
    if (saida && !chamada) { setErro("Informe a chamada antes da saída."); return; }
    setSalvando(true);
    setErro(null);
    const horario = horarioDaEscala(dia, chamada, saida, fuso);
    const { error } = await clienteDaProducao(createClient()).from("producao_escalas").insert({
      organization_id: organizationId, pessoa_id: pessoaId, data_id: dataId, funcao: funcao.trim() || null, chamada: horario.chamada, saida: horario.saida,
    });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "Essa pessoa já está na escala desta data."
        : error.code === "42501" ? "Você não pode escalar essa pessoa nesta data."
        : "Não foi possível escalar. Tente de novo.");
      return;
    }
    onCreated();
    fechar();
  }

  return (
    <TopSheet
      titulo="Escalar pessoa"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Escalando…" : "Escalar"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="escala-pessoa">Pessoa</label>
          <ComboboxCriavel id="escala-pessoa" rotulo="Pessoa" placeholder="Nome de quem trabalha na data" opcoes={opcoes} valor={pessoaId} onChange={setPessoaId} onCriar={criarPessoa} disabled={salvando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="escala-funcao">Função no dia (opcional)</label>
          <input id="escala-funcao" className={CAMPO} value={funcao} onChange={event => setFuncao(event.target.value)} placeholder="Luz, contrarregra, motorista" maxLength={80} disabled={salvando} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="escala-chamada">Chamada (opcional)</label>
            <input id="escala-chamada" type="time" className={CAMPO} value={chamada} onChange={event => setChamada(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="escala-saida">Saída (opcional)</label>
            <input id="escala-saida" type="time" className={CAMPO} value={saida} onChange={event => setSaida(event.target.value)} disabled={salvando} />
          </div>
        </div>
      </div>
    </TopSheet>
  );
}
