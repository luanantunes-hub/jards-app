"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BedDouble, Bus, Check, ChevronLeft, ChevronRight, Clock, Copy, Download, FileText, MapPin, Phone } from "lucide-react";
import { DetailBackLink, DetailPageContent, DetailTabs } from "@/components/ui/DetailPagePrimitives";
import { Select } from "@/components/ui/Select";
import { Caixa, FaixaDoPrototipo, TituloDeSecao } from "@/components/producao/prototipo/Prototipo";
import { ACORDOS, ARQUIVOS, BLOCOS, DATA, ESCALAS, FOLHA, HISTORICO, HOSPEDAGEM, NOTAS, TAREFAS, TURNE, VIAGEM } from "@/lib/producao/prototipo/dados";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

const TAREFAS_DA_DATA = TAREFAS.filter(tarefa => tarefa.data.startsWith("05 dez"));
const ACORDO = ACORDOS.find(acordo => acordo.id === "campinas")!;
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]";

const ABAS = [
  { id: "resumo", label: "Resumo" },
  { id: "dia", label: "O dia", count: BLOCOS.length },
  { id: "equipe", label: "Equipe", count: ESCALAS.length },
  { id: "viagem", label: "Viagem e hospedagem" },
  { id: "tarefas", label: "Tarefas", count: TAREFAS_DA_DATA.filter(tarefa => tarefa.situacao !== "feita").length },
  { id: "arquivos", label: "Arquivos", count: ARQUIVOS.length },
  { id: "notas", label: "Notas", count: NOTAS.length },
  { id: "historico", label: "Histórico" },
];

/** Protótipo da página da data (PD1.6, PD1.8 e PD1.11): tudo da data numa página só, em abas. */
export default function PrototipoDaData() {
  const [aba, setAba] = useState("resumo");
  const [feitas, setFeitas] = useState(() => new Set(TAREFAS_DA_DATA.filter(tarefa => tarefa.situacao === "feita").map(tarefa => tarefa.titulo)));
  const [copiado, setCopiado] = useState(false);

  function alternar(titulo: string) {
    setFeitas(atual => {
      const nova = new Set(atual);
      if (nova.has(titulo)) nova.delete(titulo); else nova.add(titulo);
      return nova;
    });
  }

  return (
    <div className="min-h-full">
      <FaixaDoPrototipo href="/producoes/prototipo/data" />
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-7 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DetailBackLink href="/producoes/prototipo" label={TURNE.titulo} />
            <div className="flex items-center gap-1">
              <button type="button" className={BOTAO} title="A data anterior, sem sair da página"><ChevronLeft size={14} aria-hidden="true" /> {DATA.anterior}</button>
              <button type="button" className={BOTAO} title="A próxima data, sem sair da página">{DATA.proxima} <ChevronRight size={14} aria-hidden="true" /></button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{DATA.titulo}</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">{DATA.dia} · {DATA.lugar}, {TURNE.praca} · {TURNE.obra}</p>
            </div>
            <Select block={false} aria-label="Situação da data" defaultValue="confirmada" className="h-10 pl-3 pr-8 text-black/60">
              <option value="opcao">Opção</option>
              <option value="confirmada">Confirmada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
            </Select>
          </div>
        </div>
      </header>
      <DetailTabs ariaLabel="Partes da data" tabs={ABAS} activeTab={aba} onChange={setAba} />

      <DetailPageContent>
        {aba === "resumo" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section>
              <TituloDeSecao>O essencial</TituloDeSecao>
              <Caixa>
                <dl className="divide-y divide-black/[.06]">
                  {[
                    ["Sessão", "21:00 · abertura da casa às 20:30"],
                    ["Lugar", `${DATA.lugar} · ${DATA.endereco}`],
                    ["Contratante", DATA.contratante],
                    ["Lotação", `${DATA.lugares} lugares`],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                      <dt className="text-[0.6875rem] font-medium text-black/45">{rotulo}</dt>
                      <dd className="text-[0.8125rem] text-[#282525]">{valor}</dd>
                    </div>
                  ))}
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-[0.6875rem] font-medium text-black/45">Acordo</dt>
                    <dd className="text-[0.8125rem] text-[#282525]">
                      <Link href="/producoes/prototipo/acordos" className="underline decoration-black/20 underline-offset-2 hover:decoration-black/50">
                        Garantia de <span title={formatarValorCompleto(ACORDO.garantia)} className="tabular-nums">{formatarValorCurto(ACORDO.garantia)}</span> ou 70% da bilheteria
                      </Link>
                      <span className="text-black/45"> · {ACORDO.situacao.toLowerCase()}</span>
                    </dd>
                  </div>
                </dl>
              </Caixa>
            </section>
            <div className="space-y-6">
              <section>
                <TituloDeSecao>Pendências</TituloDeSecao>
                <Caixa>
                  <ul className="divide-y divide-black/[.06]">
                    {[
                      { alerta: true, texto: "Confirmar o hotel: atrasada desde 20 nov", aba: "tarefas" },
                      { alerta: true, texto: "Rafael Nunes está em outra data no mesmo horário", aba: "equipe" },
                      { alerta: false, texto: "Tiago Lemos recusou: falta contrarregra", aba: "equipe" },
                      { alerta: false, texto: "Joana Prado ainda não respondeu", aba: "equipe" },
                    ].map(item => (
                      <li key={item.texto}>
                        <button type="button" onClick={() => setAba(item.aba)} className="flex w-full items-start gap-2 px-4 py-3 text-left text-[0.75rem] text-black/65 transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                          {item.alerta
                            ? <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-[#B07A14]" />
                            : <Clock size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-black/40" />}
                          {item.texto}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Caixa>
              </section>
              <section>
                <TituloDeSecao>Folha do dia</TituloDeSecao>
                <Caixa className="p-4">
                  <p className="text-[0.75rem] text-black/60">
                    Enviada a <span className="font-semibold tabular-nums text-[#282525]">{FOLHA.enviadaPara}</span> pessoas ·{" "}
                    <span className="font-semibold tabular-nums text-[#282525]">{FOLHA.abriram}</span> abriram ·{" "}
                    <span className="font-semibold tabular-nums text-[#282525]">{FOLHA.confirmaram}</span> confirmaram
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setCopiado(true)} className={BOTAO}>{copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copiado ? "Link copiado" : "Copiar link da equipe"}</button>
                    <Link href="/producoes/prototipo/folha" className={BOTAO}>Ver como a equipe vê</Link>
                  </div>
                </Caixa>
              </section>
            </div>
          </div>
        )}

        {aba === "dia" && (
          <section>
            <TituloDeSecao>O dia</TituloDeSecao>
            <Caixa>
              <ul className="divide-y divide-black/[.06]">
                {BLOCOS.map(bloco => (
                  <li key={bloco.titulo} className="flex items-center gap-4 px-4 py-3">
                    <p className="w-32 shrink-0 text-[0.75rem] tabular-nums text-black/60">{bloco.hora}</p>
                    <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[#282525]">{bloco.titulo}</p>
                    <span className={`text-[0.6875rem] ${bloco.confirmado ? "text-black/40" : "text-black/55"}`}>{bloco.confirmado ? "confirmado" : "a confirmar"}</span>
                  </li>
                ))}
              </ul>
            </Caixa>
          </section>
        )}

        {aba === "equipe" && (
          <section>
            <TituloDeSecao>Equipe</TituloDeSecao>
            <Caixa>
              <ul className="divide-y divide-black/[.06]">
                {ESCALAS.map(escala => (
                  <li key={escala.nome} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{escala.nome}</p>
                      <p className="text-[0.6875rem] text-black/45">{escala.funcao} · {escala.horario}</p>
                      {escala.conflito && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[0.6875rem] text-black/60">
                          <AlertTriangle size={12} aria-hidden="true" className="mt-px shrink-0 text-[#B07A14]" />
                          {escala.conflito}
                        </p>
                      )}
                    </div>
                    <Select block={false} aria-label={`Resposta de ${escala.nome}`} defaultValue={escala.resposta} className="h-9 pl-3 text-black/60">
                      <option>Sem resposta</option>
                      <option>Confirmou</option>
                      <option>Recusou</option>
                    </Select>
                  </li>
                ))}
              </ul>
            </Caixa>
          </section>
        )}

        {aba === "viagem" && (
          <div className="grid gap-4 md:grid-cols-2">
            <section>
              <TituloDeSecao>Viagem do dia</TituloDeSecao>
              <Caixa className="p-4">
                <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[#282525]"><Bus size={15} aria-hidden="true" className="text-black/40" /> {VIAGEM.titulo}</p>
                <dl className="mt-3 space-y-2 text-[0.75rem]">
                  {[["Saída", VIAGEM.saida], ["Chegada", VIAGEM.chegada], ["Motorista", VIAGEM.motorista], ["Detalhe", VIAGEM.detalhe]].map(([rotulo, valor]) => (
                    <div key={rotulo} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                      <dt className="text-black/45">{rotulo}</dt>
                      <dd className="text-[#282525]">{valor}</dd>
                    </div>
                  ))}
                </dl>
              </Caixa>
            </section>
            <section>
              <TituloDeSecao>Hospedagem</TituloDeSecao>
              <Caixa className="p-4">
                <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[#282525]"><BedDouble size={15} aria-hidden="true" className="text-black/40" /> {HOSPEDAGEM.titulo}</p>
                <dl className="mt-3 space-y-2 text-[0.75rem]">
                  {[["Endereço", HOSPEDAGEM.endereco], ["Período", HOSPEDAGEM.periodo], ["Quartos", HOSPEDAGEM.quartos], ["Localizador", HOSPEDAGEM.localizador]].map(([rotulo, valor]) => (
                    <div key={rotulo} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                      <dt className="text-black/45">{rotulo}</dt>
                      <dd className="text-[#282525]">{valor}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-black/55"><FileText size={13} aria-hidden="true" className="text-black/40" /> {HOSPEDAGEM.arquivo}</p>
              </Caixa>
            </section>
            <p className="text-[0.6875rem] text-black/45 md:col-span-2">Os dois cartões vão para a folha do dia: a geral e a de cada pessoa. Na fase 6 viram deslocamentos e hospedagens completos, com o que já foi digitado aqui.</p>
          </div>
        )}

        {aba === "tarefas" && (
          <section>
            <TituloDeSecao>Tarefas da data</TituloDeSecao>
            <Caixa>
              <ul className="divide-y divide-black/[.06]">
                {TAREFAS_DA_DATA.map(tarefa => {
                  const feita = feitas.has(tarefa.titulo);
                  return (
                    <li key={tarefa.titulo} className="flex items-start gap-3 px-4 py-3">
                      <button type="button" onClick={() => alternar(tarefa.titulo)} aria-pressed={feita} aria-label={feita ? `Reabrir: ${tarefa.titulo}` : `Concluir: ${tarefa.titulo}`} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${feita ? "border-[#2E8932] bg-[#2E8932] text-white" : "border-black/20 bg-white text-transparent hover:border-black/40"}`}>
                        <Check size={12} aria-hidden="true" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[0.8125rem] ${feita ? "text-black/40 line-through decoration-black/25" : "font-medium text-[#282525]"}`}>{tarefa.titulo}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-black/45">
                          {tarefa.situacao === "atrasada" && !feita && <AlertTriangle size={12} aria-hidden="true" className="text-[#B07A14]" />}
                          {tarefa.prazo} · {tarefa.responsavel}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Caixa>
            <p className="mt-3 text-[0.6875rem] text-black/45">As tarefas vêm do modelo do tipo de produção, com o prazo contado da data: adiar a data adia as tarefas abertas.</p>
          </section>
        )}

        {aba === "arquivos" && (
          <section>
            <TituloDeSecao>Arquivos</TituloDeSecao>
            <Caixa>
              <ul className="divide-y divide-black/[.06]">
                {ARQUIVOS.map(arquivo => (
                  <li key={arquivo.nome} className="flex items-center gap-3 px-4 py-3">
                    <FileText size={15} aria-hidden="true" className="shrink-0 text-black/35" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{arquivo.nome}</p>
                      <p className="text-[0.6875rem] text-black/45">{arquivo.pasta} · {arquivo.tamanho} · {arquivo.quando}</p>
                    </div>
                    <button type="button" aria-label={`Baixar ${arquivo.nome}`} title="Baixar" className="flex h-9 w-9 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Download size={14} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            </Caixa>
          </section>
        )}

        {aba === "notas" && (
          <section className="max-w-[44rem]">
            <TituloDeSecao>Notas</TituloDeSecao>
            <ul className="space-y-3">
              {NOTAS.map(nota => (
                <li key={nota.quando}>
                  <Caixa className="px-4 py-3">
                    <p className="text-[0.6875rem] text-black/45"><span className="font-semibold text-[#282525]">{nota.autor}</span> · {nota.quando}</p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#282525]">
                      {nota.texto.split(/(@\w+)/).map((parte, i) => (parte.startsWith("@") ? <span key={i} className="font-semibold text-[#684DB0]">{parte}</span> : parte))}
                    </p>
                  </Caixa>
                </li>
              ))}
            </ul>
            <label className="mt-4 block">
              <span className="sr-only">Nova nota</span>
              <textarea disabled rows={3} placeholder="Escreva uma nota. Use @ para chamar alguém da equipe." className="w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] placeholder:text-black/35 disabled:bg-black/[.02]" />
            </label>
            <p className="mt-1.5 text-[0.6875rem] text-black/40">No protótipo, nada é salvo.</p>
          </section>
        )}

        {aba === "historico" && (
          <section className="max-w-[44rem]">
            <TituloDeSecao>Histórico</TituloDeSecao>
            <ol className="relative space-y-4 border-l pl-5" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              {HISTORICO.map(item => (
                <li key={item.quando} className="relative">
                  <span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full border bg-white" style={{ borderColor: "rgba(13,13,13,.25)" }} />
                  <p className="text-[0.8125rem] text-[#282525]"><span className="font-semibold">{item.quem}</span> {item.o_que}</p>
                  <p className="text-[0.6875rem] text-black/45">{item.quando}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-black/40">
          <span className="inline-flex items-center gap-1.5"><MapPin size={12} aria-hidden="true" /> {DATA.endereco}</span>
          <span className="inline-flex items-center gap-1.5"><Phone size={12} aria-hidden="true" /> Técnico da casa: {FOLHA.contatos[1].nome}</span>
        </p>
      </DetailPageContent>
    </div>
  );
}
