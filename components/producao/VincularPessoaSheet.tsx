"use client";

import { useMemo, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { ComboboxCriavel, type OpcaoCriavel } from "@/components/ui/ComboboxCriavel";
import { InputValor } from "@/components/ui/CampoValor";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerValorDaEquipe, lerVinculo, ROTULO_DA_SITUACAO_DO_VINCULO } from "@/lib/producao/equipe";
import { SITUACOES_DO_VINCULO, type SituacaoDoVinculo } from "@/lib/producao/estados";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/**
 * Põe uma pessoa na temporada (`temporadaId`) ou na equipe fixa da casa (`espacoId`): a função, o grupo, a situação e,
 * para quem vê o dinheiro, o cachê e a diária. Passe um dos dois.
 */
export function VincularPessoaSheet({ organizationId, temporadaId, espacoId, pessoas, jaVinculadas, comDinheiro, onClose, onCreated }: {
  organizationId: string;
  temporadaId?: string;
  espacoId?: string;
  pessoas: readonly OpcaoCriavel[];
  /** Quem já está no lugar: aparece para escolher só com outra função, então ficam todas. */
  jaVinculadas: ReadonlySet<string>;
  comDinheiro: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [criadas, setCriadas] = useState<OpcaoCriavel[]>([]);
  const [pessoaId, setPessoaId] = useState("");
  const [funcao, setFuncao] = useState("");
  const [grupo, setGrupo] = useState("");
  const [situacao, setSituacao] = useState<SituacaoDoVinculo>("prevista");
  const [cache, setCache] = useState("");
  const [diaria, setDiaria] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = useMemo(() => [...pessoas, ...criadas], [pessoas, criadas]);
  const jaEsta = jaVinculadas.has(pessoaId);
  const daCasa = espacoId !== undefined;
  const lugar = daCasa ? "na casa" : "na temporada";

  async function criarPessoa(nome: string): Promise<string | null> {
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).from("producao_pessoas").insert({ organization_id: organizationId, nome }).select("id").single();
    if (error || !data) { setErro(error?.code === "42501" ? "Só quem vê a produção inteira cadastra pessoa nova." : "Não foi possível cadastrar a pessoa. Tente de novo."); return null; }
    setCriadas(atual => [...atual, { id: data.id, nome }]);
    return data.id;
  }

  async function salvar(fechar: () => void) {
    if (!pessoaId) { setErro("Escolha a pessoa."); return; }
    const vinculo = lerVinculo({ funcao, grupo });
    if (!vinculo.ok) { setErro(vinculo.erro); return; }
    const valorCache = comDinheiro ? lerValorDaEquipe(cache) : { ok: true as const, valor: null };
    const valorDiaria = comDinheiro ? lerValorDaEquipe(diaria) : { ok: true as const, valor: null };
    if (!valorCache.ok) { setErro(`Cachê: ${valorCache.erro}`); return; }
    if (!valorDiaria.ok) { setErro(`Diária: ${valorDiaria.erro}`); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { data, error } = await producao.from("producao_vinculos")
      .insert({ organization_id: organizationId, pessoa_id: pessoaId, temporada_id: daCasa ? null : temporadaId ?? null, espaco_id: daCasa ? espacoId : null, funcao: vinculo.funcao, grupo: vinculo.grupo, situacao })
      .select("id").single();
    if (error || !data) {
      setSalvando(false);
      setErro(error?.code === "23505" ? `Essa pessoa já tem essa função ${lugar}.` : error?.code === "42501" ? "Você não pode vincular essa pessoa." : "Não foi possível vincular. Tente de novo.");
      return;
    }
    if (valorCache.valor !== null || valorDiaria.valor !== null) {
      const { error: erroDoValor } = await producao.from("producao_vinculos_valores")
        .insert({ vinculo_id: data.id, organization_id: organizationId, cache: valorCache.valor, diaria: valorDiaria.valor });
      if (erroDoValor) { setSalvando(false); setErro(`A pessoa entrou ${lugar}, mas o cachê não foi salvo. Abra a linha dela para tentar de novo.`); onCreated(); return; }
    }
    setSalvando(false);
    onCreated();
    fechar();
  }

  return (
    <TopSheet
      titulo={daCasa ? "Pôr pessoa na equipe da casa" : "Pôr pessoa na temporada"}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Salvando…" : daCasa ? "Pôr na equipe" : "Pôr na temporada"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="vinculo-pessoa">Pessoa</label>
          <ComboboxCriavel id="vinculo-pessoa" rotulo="Pessoa" placeholder={daCasa ? "Nome de quem trabalha na casa" : "Nome de quem trabalha na temporada"} opcoes={opcoes} valor={pessoaId} onChange={setPessoaId} onCriar={criarPessoa} disabled={salvando} />
          {jaEsta && <p className="mt-1.5 text-[0.6875rem] text-black/45">Essa pessoa já está {daCasa ? "na equipe da casa" : "na temporada"}. Use outra função para pô-la de novo.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="vinculo-funcao">Função</label>
            <input id="vinculo-funcao" className={CAMPO} value={funcao} onChange={event => setFuncao(event.target.value)} placeholder="Luz, atriz, motorista" maxLength={80} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="vinculo-grupo">Grupo (opcional)</label>
            <input id="vinculo-grupo" className={CAMPO} value={grupo} onChange={event => setGrupo(event.target.value)} placeholder="Técnica, elenco" maxLength={80} disabled={salvando} />
          </div>
        </div>
        <div>
          <span className={ROTULO}>Situação</span>
          <Dropdown ariaLabel="Situação do vínculo" value={situacao} onChange={valor => setSituacao(valor as SituacaoDoVinculo)} disabled={salvando} options={SITUACOES_DO_VINCULO.map(item => ({ value: item, label: ROTULO_DA_SITUACAO_DO_VINCULO[item] }))} />
        </div>
        {comDinheiro && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={ROTULO} htmlFor="vinculo-cache">Cachê (opcional)</label>
              <InputValor id="vinculo-cache" className={CAMPO} value={cache} onChange={setCache} placeholder="0,00" disabled={salvando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="vinculo-diaria">Diária (opcional)</label>
              <InputValor id="vinculo-diaria" className={CAMPO} value={diaria} onChange={setDiaria} placeholder="0,00" disabled={salvando} />
            </div>
          </div>
        )}
      </div>
    </TopSheet>
  );
}
