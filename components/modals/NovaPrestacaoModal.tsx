"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, FileSpreadsheet, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { InputValor } from "@/components/ui/CampoValor";
import { ComboboxCriavel, type OpcaoCriavel } from "@/components/ui/ComboboxCriavel";
import { chaveDoNome } from "@/lib/dominio";
import { lerValorBRL } from "@/lib/valor";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import {
  PASSOS, previaDoPrazo, tituloSugerido, validarPasso, valorInicial,
  type CaptacaoParaCriacao, type DadosCriacao, type PassoId, type ProjetoParaCriacao,
} from "@/lib/prestacao/criacao";
import { descreverRegra, ROTULO_DO_MARCO } from "@/lib/prestacao/prazo-final";
import { definida, prazoDoRegime } from "@/lib/prestacao/regimes";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

// Criação guiada (P1.4): origem → regime → dados oficiais → orçamento →
// marcos. O primeiro passo cria o rascunho; cada passo seguinte grava o que
// foi preenchido. Fechar no meio deixa o rascunho na lista.

type Props = {
  onClose: () => void;
  onSaved: () => void;
};


const ROTULO = "mb-1.5 block text-[0.625rem] font-semibold uppercase tracking-wide text-black/40";
const CAMPO = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.8125rem] outline-none focus:border-[#7259B5] focus:ring-1 focus:ring-[#7259B5]/20";
const dataBr = (data: string | null) => (data ? data.split("-").reverse().join("/") : "—");

export function NovaPrestacaoModal({ onClose, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const organizationId = useOrganizationId();
  const todosRegimes = useRegimesPublicados();
  // Versões substituídas ficam fora da escolha de uma prestação nova.
  const regimes = useMemo(() => todosRegimes.filter(r => r.publicado), [todosRegimes]);
  const titleId = useId();

  const [passo, setPasso] = useState(0);
  const [prestacaoId, setPrestacaoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [captacoes, setCaptacoes] = useState<CaptacaoParaCriacao[]>([]);
  const [projetos, setProjetos] = useState<ProjetoParaCriacao[]>([]);
  const [proponentes, setProponentes] = useState<OpcaoCriavel[]>([]);
  // Projetos criados aqui, para a escolha achar o projeto antes de a lista ser relida.
  const projetosCriados = useRef(new Map<string, ProjetoParaCriacao>());

  const [captacaoId, setCaptacaoId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [proponenteId, setProponenteId] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [fonteRecurso, setFonteRecurso] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [abrirOrcamento, setAbrirOrcamento] = useState(true);
  const [marcos, setMarcos] = useState({ aprovacao: "", liberacao: "", termo: "" });
  const [dados, setDados] = useState<DadosCriacao>({
    titulo: "", regimeId: "", valorAprovado: "", inicioExecucao: "", fimExecucao: "", prazoInformado: "", justificativa: "",
  });
  const atualizar = (parcial: Partial<DadosCriacao>) => setDados(atual => ({ ...atual, ...parcial }));

  function fechar() {
    // Um rascunho já criado aparece na lista.
    if (prestacaoId) onSaved();
    onClose();
  }
  useModalDismiss(fechar);

  useEffect(() => {
    if (!organizationId) return;
    // Só da organização atual: o RLS mostra captações e projetos de todas as
    // organizações da pessoa, e o vínculo tem de ser com a atual.
    supabase
      .from("captacoes")
      .select("id, titulo, lei, valor_aprovado, valor_solicitado, projeto_id")
      .eq("organization_id", organizationId)
      .eq("status", "aprovado")
      .order("titulo")
      .then(({ data }) => setCaptacoes((data as CaptacaoParaCriacao[] | null) ?? []));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- projetos_crm e proponentes fora do tipo Database
    const sb = supabase as any;
    sb.from("projetos_crm").select("id, nome, proponente_id").eq("organization_id", organizationId).order("nome")
      .then(({ data }: { data: ProjetoParaCriacao[] | null }) => setProjetos(data ?? []));
    sb.from("proponentes").select("id, nome").eq("organization_id", organizationId).order("nome")
      .then(({ data }: { data: { id: string; nome: string }[] | null }) =>
        setProponentes(data ?? []));
  }, [organizationId, supabase]);

  const captacao = captacoes.find(c => c.id === captacaoId) ?? null;
  const regime = regimes.find(r => r.id === dados.regimeId)?.regime ?? null;
  const prazoCalculado = previaDoPrazo(regime, dados.fimExecucao);
  const regraFinal = prazoDoRegime(regime, "prestacaoFinal");
  const aplicabilidade = regime ? definida(regime.aplicabilidade) : null;
  // A mesma lei pode ter mais de uma versão publicada (LIE pela data do
  // protocolo, ANCINE pela da aprovação): o banco sugere a mais recente.
  const outrasVersoes = regime && regime.codigo !== "generico"
    ? regimes.filter(r => r.regime.mecanismo === regime.mecanismo && r.regime.codigo !== regime.codigo).map(r => r.regime.nome)
    : [];
  const atual = PASSOS[passo];

  function escolherCaptacao(id: string) {
    const nova = captacoes.find(c => c.id === id) ?? null;
    setCaptacaoId(id);
    // A negociação traz o projeto, e o projeto traz o proponente.
    const idProjeto = projetoId || nova?.projeto_id || "";
    const projetoDaCaptacao = projetos.find(p => p.id === idProjeto) ?? null;
    if (!projetoId && nova?.projeto_id) setProjetoId(nova.projeto_id);
    if (!proponenteId && projetoDaCaptacao?.proponente_id) setProponenteId(projetoDaCaptacao.proponente_id);
    if (!dados.titulo.trim()) atualizar({ titulo: tituloSugerido(nova, projetoDaCaptacao) });
    if (!dados.valorAprovado) atualizar({ valorAprovado: valorInicial(nova) });
  }

  function escolherProjeto(id: string) {
    const novo = projetos.find(p => p.id === id) ?? projetosCriados.current.get(id) ?? null;
    setProjetoId(id);
    if (!dados.titulo.trim()) atualizar({ titulo: tituloSugerido(captacao, novo) });
    if (novo?.proponente_id && !proponenteId) setProponenteId(novo.proponente_id);
  }

  // Quem usa só a prestação cria o projeto e o proponente aqui mesmo; eles
  // aparecem também na captação, para quem usa os dois módulos.
  async function criarProjeto(nome: string): Promise<string | null> {
    if (!organizationId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- projetos_crm fora do tipo Database
    const { data, error } = await (supabase as any).from("projetos_crm")
      .insert({ nome, nome_key: chaveDoNome(nome), account_id: user?.id, organization_id: organizationId, proponente_id: proponenteId || null })
      .select("id, nome, proponente_id").single();
    if (error || !data) { setErro("Não foi possível criar o projeto. Tente de novo."); return null; }
    setErro(null);
    projetosCriados.current.set(data.id, data);
    setProjetos(atual => [...atual, data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    return data.id;
  }

  async function criarProponente(nome: string): Promise<string | null> {
    if (!organizationId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- proponentes fora do tipo Database
    const { data, error } = await (supabase as any).from("proponentes")
      .insert({ nome, nome_key: chaveDoNome(nome), account_id: user?.id, organization_id: organizationId })
      .select("id, nome").single();
    if (error || !data) { setErro("Não foi possível criar o proponente. Tente de novo."); return null; }
    setErro(null);
    setProponentes(atual => [...atual, data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    return data.id;
  }

  /** Grava o passo atual; devolve false quando não deu. */
  async function gravarPasso(): Promise<boolean> {
    const problema = validarPasso(atual.id, dados, regime);
    if (problema) { setErro(problema); return false; }
    if (!organizationId) { setErro("Selecione uma organização antes de criar a prestação."); return false; }
    setErro(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacoes_contas fora do tipo Database
    const tabela = (supabase as any).from("prestacoes_contas");

    if (atual.id === "origem" && !prestacaoId) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await tabela.insert({
        titulo: dados.titulo.trim(),
        captacao_id: captacaoId || null,
        projeto_id: projetoId || null,
        criado_por: user?.id ?? null,
        organization_id: organizationId,
      }).select("id, regime_id").single();
      if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível criar a prestação")); return false; }
      setPrestacaoId(data.id);
      // O banco sugere o regime pela lei da captação.
      atualizar({ regimeId: data.regime_id ?? "" });
      return true;
    }

    const porPasso: Record<PassoId, Record<string, unknown> | null> = {
      origem: { titulo: dados.titulo.trim(), captacao_id: captacaoId || null, projeto_id: projetoId || null },
      regime: { regime_id: dados.regimeId, identificador_tipo: regime?.identificadorOficial?.tipo ?? null },
      dados: {
        identificador_oficial: identificador.trim() || null,
        identificador_tipo: regime?.identificadorOficial?.tipo ?? null,
        fonte_recurso: fonteRecurso.trim() || null,
        proponente_id: proponenteId || null,
        valor_aprovado: lerValorBRL(dados.valorAprovado).valor,
        observacoes: observacoes.trim() || null,
      },
      importacao: null,
      marcos: {
        data_aprovacao: marcos.aprovacao || null,
        data_liberacao: marcos.liberacao || null,
        data_termo: marcos.termo || null,
        data_inicio_execucao: dados.inicioExecucao || null,
        data_fim_execucao: dados.fimExecucao || null,
        prazo_final_override: dados.prazoInformado || null,
        prazo_final_justificativa: dados.justificativa.trim() || null,
      },
    };
    const campos = porPasso[atual.id];
    if (!campos) return true;

    const { error } = await tabela.update(campos).eq("id", prestacaoId);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar")); return false; }
    // O projeto sem proponente fica com o proponente escolhido na prestação.
    const projeto = projetos.find(p => p.id === projetoId) ?? projetosCriados.current.get(projetoId);
    if (atual.id === "dados" && projeto && !projeto.proponente_id && proponenteId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- projetos_crm fora do tipo Database
      await (supabase as any).from("projetos_crm").update({ proponente_id: proponenteId }).eq("id", projeto.id).is("proponente_id", null);
    }
    return true;
  }

  async function continuar() {
    setSalvando(true);
    const ok = await gravarPasso();
    setSalvando(false);
    if (!ok) return;
    if (passo < PASSOS.length - 1) { setPasso(passo + 1); return; }
    onSaved();
    router.push(`/prestacoes/${prestacaoId}${abrirOrcamento ? "/orcamento" : ""}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-[36rem] flex-col overflow-hidden rounded bg-white border elevacao-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded" style={{ background: "rgba(13,13,13,.04)" }}>
              <ClipboardCheck size={14} className="text-[#7259B5]" />
            </div>
            <div>
              <h2 id={titleId} className="text-[0.875rem] font-semibold text-[#282525]">Nova prestação de contas</h2>
              {prestacaoId && <p className="text-[0.625rem] text-black/40">Rascunho salvo. Você pode fechar e continuar depois.</p>}
            </div>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="rounded p-1.5 text-black/35 transition hover:bg-black/5 hover:text-black/55">
            <X size={15} />
          </button>
        </div>

        {/* Passos */}
        <ol className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-6 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          {PASSOS.map((p, i) => (
            <li key={p.id} className="flex shrink-0 items-center gap-1.5" aria-current={i === passo ? "step" : undefined}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.625rem] ${
                i < passo ? "bg-[#2E8932] text-white" : i === passo ? "bg-[#7259B5] text-white" : "bg-black/[.06] text-black/40"}`}>
                {i < passo ? <Check size={11} /> : i + 1}
              </span>
              <span className={`text-[0.6875rem] ${i === passo ? "text-[#684DB0]" : "text-black/40"}`}>{p.titulo}</span>
              {i < PASSOS.length - 1 && <span className="mx-1 h-px w-4 bg-black/10" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {atual.id === "origem" && (
            <>
              <div>
                <span className={ROTULO}>Negociação aprovada</span>
                <Dropdown
                  value={captacaoId}
                  onChange={escolherCaptacao}
                  ariaLabel="Negociação aprovada"
                  placeholder={captacoes.length ? "Selecionar negociação" : "Nenhuma negociação aprovada"}
                  options={captacoes.map(c => {
                    const nome = c.titulo || projetos.find(p => p.id === c.projeto_id)?.nome || "Negociação";
                    return { value: c.id, label: `${nome}${c.lei ? ` (${c.lei})` : ""}` };
                  })}
                />
                <p className="mt-1 text-[0.625rem] text-black/35">A lei da negociação define o regime sugerido.</p>
              </div>
              <div>
                <span className={ROTULO}>Projeto</span>
                <ComboboxCriavel
                  opcoes={projetos}
                  valor={projetoId}
                  onChange={escolherProjeto}
                  onCriar={criarProjeto}
                  rotulo="Projeto"
                  placeholder={projetos.length ? "Buscar ou criar projeto" : "Digite o nome do projeto"}
                />
                <p className="mt-1 text-[0.625rem] text-black/35">Escolha um projeto ou digite o nome para criar.</p>
              </div>
              <label className="block">
                <span className={ROTULO}>Título <span className="text-[#D94A4A]">*</span></span>
                <input value={dados.titulo} onChange={e => atualizar({ titulo: e.target.value })} placeholder="Ex.: Prestação de contas — Festival de Inverno" className={CAMPO} />
              </label>
            </>
          )}

          {atual.id === "regime" && (
            <>
              <div>
                <span className={ROTULO}>Regime</span>
                <Dropdown
                  value={dados.regimeId}
                  onChange={valor => atualizar({ regimeId: valor })}
                  ariaLabel="Regime"
                  placeholder="Escolher regime"
                  options={regimes.map(r => ({ value: r.id, label: r.regime.nome }))}
                />
              </div>
              {regime && (
                <div className="space-y-1.5 rounded border border-black/[.08] bg-black/[.015] p-3 text-[0.6875rem] leading-5 text-black/55">
                  <p>{regime.normaReferencia}</p>
                  {aplicabilidade && <p>{aplicabilidade.descricao}</p>}
                  {outrasVersoes.length > 0 && (
                    <p className="text-[#B07A14]">Esta lei também tem {outrasVersoes.join(" e ")}. Escolha pela data do projeto.</p>
                  )}
                  {regime.sistemaOficial && <p>Envio pelo {regime.sistemaOficial}.</p>}
                  {regraFinal ? (
                    <p>Prazo de envio: {descreverRegra(regraFinal)} ({regraFinal.fonte.dispositivo}).</p>
                  ) : (
                    <p>Sem regras de lei: o prazo e os limites vêm do contrato ou do edital.</p>
                  )}
                  {captacao?.lei && regime.mecanismo !== captacao.lei && regime.codigo !== "generico" && (
                    <p className="text-[#B07A14]">A negociação é de outra lei ({captacao.lei}). Confira o regime.</p>
                  )}
                </div>
              )}
            </>
          )}

          {atual.id === "dados" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={ROTULO}>{regime?.identificadorOficial?.rotulo ?? "Identificador oficial"}</span>
                  <input value={identificador} onChange={e => setIdentificador(e.target.value)} className={CAMPO} />
                </label>
                <label className="block">
                  <span className={ROTULO}>Valor aprovado (R$)</span>
                  <InputValor value={dados.valorAprovado} onChange={valorAprovado => atualizar({ valorAprovado })} placeholder="0,00" className={`${CAMPO} tabular-nums`} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={ROTULO}>Proponente</span>
                  <ComboboxCriavel
                    opcoes={proponentes}
                    valor={proponenteId}
                    onChange={setProponenteId}
                    onCriar={criarProponente}
                    rotulo="Proponente"
                    placeholder={proponentes.length ? "Buscar ou criar proponente" : "Digite o nome do proponente"}
                  />
                </div>
                <label className="block">
                  <span className={ROTULO}>Fonte do recurso</span>
                  <input value={fonteRecurso} onChange={e => setFonteRecurso(e.target.value)} placeholder="Ex.: incentivo fiscal" className={CAMPO} />
                </label>
              </div>
              <label className="block">
                <span className={ROTULO}>Observações</span>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Contexto, exigências do patrocinador…" className={`${CAMPO} resize-none`} />
              </label>
            </>
          )}

          {atual.id === "importacao" && (
            <div className="space-y-3">
              <p className="text-[0.75rem] leading-5 text-black/60">
                O orçamento aprovado é a base das rubricas, dos limites e do executado. Você pode importar a planilha
                ou o PDF aprovado (CSV, XLSX ou PDF) na aba Orçamento, que lê o arquivo e propõe os itens para revisar.
              </p>
              <button
                type="button"
                role="checkbox"
                aria-checked={abrirOrcamento}
                onClick={() => setAbrirOrcamento(v => !v)}
                className={`flex w-full items-start gap-3 rounded border px-3.5 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${abrirOrcamento ? "border-[#7259B5] bg-white" : "border-black/10 bg-white"}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${abrirOrcamento ? "border-[#7259B5] bg-[#7259B5] text-white" : "border-black/25"}`}>
                  {abrirOrcamento && <Check size={11} />}
                </span>
                <span>
                  <span className="flex items-center gap-1.5 text-[0.75rem] text-black/75"><FileSpreadsheet size={13} /> Importar o orçamento ao terminar</span>
                  <span className="mt-0.5 block text-[0.6875rem] text-black/40">Abre a aba Orçamento desta prestação depois do último passo.</span>
                </span>
              </button>
              {regime?.identificadorOficial?.tipo === "pronac" && (
                <p className="text-[0.6875rem] text-black/40">A importação direta do Salic pelo Pronac entra numa próxima versão.</p>
              )}
            </div>
          )}

          {atual.id === "marcos" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {([["aprovacao", "Aprovação"], ["liberacao", "Liberação"], ["termo", "Termo ou contrato"]] as const).map(([campo, rotulo]) => (
                  <label key={campo} className="block">
                    <span className={ROTULO}>{rotulo}</span>
                    <input type="date" value={marcos[campo]} onChange={e => setMarcos(m => ({ ...m, [campo]: e.target.value }))} className={CAMPO} />
                  </label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={ROTULO}>Início da execução</span>
                  <input type="date" value={dados.inicioExecucao} onChange={e => atualizar({ inicioExecucao: e.target.value })} className={CAMPO} />
                </label>
                <label className="block">
                  <span className={ROTULO}>Fim da execução</span>
                  <input type="date" value={dados.fimExecucao} onChange={e => atualizar({ fimExecucao: e.target.value })} className={CAMPO} />
                </label>
              </div>
              <div className="rounded border border-black/[.08] bg-black/[.015] p-3 text-[0.6875rem] leading-5 text-black/55">
                {regraFinal ? (
                  prazoCalculado
                    ? <p>Prazo de envio calculado: <strong className="tabular-nums text-black/80">{dataBr(prazoCalculado)}</strong> ({descreverRegra(regraFinal)}).</p>
                    : regraFinal.marco === "conclusao_objeto"
                      ? <p>O prazo de envio conta da {ROTULO_DO_MARCO.conclusao_objeto} ({descreverRegra(regraFinal)}): informe a data na prestação, depois de criada.</p>
                      : <p>Informe o fim da execução para calcular o prazo de envio.</p>
                ) : (
                  <p>Este regime não define prazo de envio. Informe o do contrato ou do edital abaixo.</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={ROTULO}>{prazoCalculado ? "Outro prazo (opcional)" : "Prazo de envio"}</span>
                  <input type="date" value={dados.prazoInformado} onChange={e => atualizar({ prazoInformado: e.target.value })} className={CAMPO} />
                </label>
                {dados.prazoInformado && prazoCalculado && dados.prazoInformado !== prazoCalculado && (
                  <label className="block">
                    <span className={ROTULO}>Justificativa <span className="text-[#D94A4A]">*</span></span>
                    <input value={dados.justificativa} onChange={e => atualizar({ justificativa: e.target.value })} placeholder="Ex.: prorrogação deferida" className={CAMPO} />
                  </label>
                )}
              </div>
            </>
          )}

          {erro && <p role="alert" className="text-[0.75rem] text-[#B23A3A]">{erro}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button
            type="button"
            onClick={() => (passo === 0 ? fechar() : (setErro(null), setPasso(passo - 1)))}
            className="px-2 py-2 text-[0.8125rem] font-medium text-black/40 transition hover:text-black/65"
          >
            {passo === 0 ? "Cancelar" : "Voltar"}
          </button>
          <button
            type="button"
            onClick={() => void continuar()}
            disabled={salvando || (atual.id === "origem" && !dados.titulo.trim())}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {passo === 0 && !prestacaoId ? "Criar rascunho" : passo === PASSOS.length - 1 ? "Concluir" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
