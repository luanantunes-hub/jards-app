"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BriefcaseBusiness, CalendarClock, MessagesSquare, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { fetchOrganizationMembers, type OrganizationMemberSummary } from "@/lib/organization/members";
import { nomeDoMembro } from "@/lib/equipe/responsavel";
import { estaAtrasada, inicioDoPeriodo, PERIODOS, resumoDasNegociacoes, STATUS_ENCERRADOS, type Periodo } from "@/lib/equipe/perfil";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton, DetailSidebarCard } from "@/components/ui/DetailPagePrimitives";
import { Indicador } from "@/components/ui/IndicadoresFinanceiros";
import { SegmentedControl } from "@/components/ui/FilterControls";

type Negociacao = {
  id: string; titulo: string | null; status: string; valor_solicitado: number | null; updated_at: string;
  empresa_pub: { nome: string } | null; empresa_crm: { nome: string } | null;
};
type Atividade = { id: string; nome: string; tipo: string | null; data_prevista: string | null; feita: boolean };
type Contato = { id: string; assunto: string; canal: string | null; tipo: string; ocorreu_em: string; empresa: { nome: string } | null };

const PAPEL: Record<string, string> = { admin: "Administrador", colaborador: "Colaborador", leitor: "Leitor" };

/** Contagem no Indicador (feito para dinheiro): o número vira texto, e zero fica apagado. */
const quantidade = (n: number) => ({ valor: null, texto: String(n), corTexto: n === 0 ? "rgba(40,37,37,.3)" : undefined });

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** O trabalho de uma pessoa da equipe: negociações, atividades e contatos registrados. Só para administrador. */
export default function MembroDaEquipePage() {
  const { userId } = useParams<{ userId: string }>();
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const { etiquetas } = useEtiquetas();
  const [membro, setMembro] = useState<OrganizationMemberSummary | null | undefined>(undefined);
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void fetchOrganizationMembers(organizationId)
      .then(lista => { if (ativo) setMembro(lista.find(item => item.user_id === userId && item.papel !== "captador" && item.papel !== "proponente") ?? null); })
      .catch(() => { if (ativo) setMembro(null); });
    return () => { ativo = false; };
  }, [organizationId, userId]);

  useEffect(() => {
    if (!membro) return;
    let ativo = true;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas fora do tipo Database
    const db = supabase as any;
    void (async () => {
      const [neg, atv, cont] = await Promise.all([
        db.from("captacoes")
          .select("id, titulo, status, valor_solicitado, updated_at, empresa_pub:empresas!empresa_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome)")
          .or(`captador_id.eq.${userId},supervisor_id.eq.${userId}`)
          .order("updated_at", { ascending: false }),
        db.from("atividades")
          .select("id, nome, tipo, data_prevista, feita")
          .eq("responsavel_id", userId)
          .eq("feita", false)
          .order("data_prevista", { ascending: true, nullsFirst: false })
          .limit(50),
        db.from("crm_interacoes")
          .select("id, assunto, canal, tipo, ocorreu_em, empresa:empresas_crm!empresa_crm_id(nome)")
          .or(`created_by.eq.${userId},account_id.eq.${userId}`)
          .gte("ocorreu_em", inicioDoPeriodo(periodo, new Date()))
          .order("ocorreu_em", { ascending: false })
          .limit(100),
      ]);
      if (!ativo) return;
      setNegociacoes((neg.data ?? []) as Negociacao[]);
      setAtividades((atv.data ?? []) as Atividade[]);
      setContatos((cont.data ?? []) as Contato[]);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [membro, userId, periodo]);

  const resumo = useMemo(() => resumoDasNegociacoes(negociacoes), [negociacoes]);
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = atividades.filter(item => estaAtrasada(item, hoje)).length;
  const rotuloStatus = (status: string) => etiquetas.find(item => item.key === status)?.label ?? status;

  if (papel !== null && papel !== "admin") {
    return <DetailNotFound title="Só administradores veem esta página" backHref="/configuracoes" backLabel="Voltar para Configurações" />;
  }
  if (membro === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (membro === null) {
    return <DetailNotFound title="Pessoa não encontrada na equipe" backHref="/configuracoes" backLabel="Voltar para Configurações" />;
  }

  const nome = nomeDoMembro(membro);
  const abertas = negociacoes.filter(item => !STATUS_ENCERRADOS.has(item.status));

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href="/configuracoes" label="Equipe" />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[#282525] text-[1.125rem] font-semibold text-white">
                {nome.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{nome}</h1>
                <p className="mt-0.5 truncate text-[0.75rem] text-black/45">{[PAPEL[membro.papel] ?? membro.papel, membro.email].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <SegmentedControl
              value={String(periodo)}
              onChange={valor => setPeriodo(Number(valor) as Periodo)}
              ariaLabel="Período dos contatos registrados"
              options={PERIODOS.map(dias => ({ value: String(dias), label: `${dias} dias` }))}
            />
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Indicador icone={BriefcaseBusiness} rotulo="Negociações abertas" {...quantidade(resumo.abertas)} />
            <Indicador icone={Wallet} rotulo="Valor em aberto" valor={resumo.valorAberto} />
            <Indicador icone={CalendarClock} rotulo="Atividades atrasadas" {...quantidade(atrasadas)} />
            <Indicador icone={MessagesSquare} rotulo={`Contatos em ${periodo} dias`} {...quantidade(contatos.length)} />
          </dl>
        </div>
      </header>

      <DetailPageContent>
        {carregando ? (
          <p className="py-12 text-center text-[0.75rem] text-black/40">Carregando…</p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3 [&>section]:min-w-0">
            <DetailSidebarCard
              title="Negociações abertas"
              icon={BriefcaseBusiness}
              count={abertas.length}
              action={<Link href={`/captacoes?responsavel=${userId}`} className="text-[0.625rem] font-medium text-black/45 underline-offset-2 hover:text-black/70 hover:underline">Ver na lista</Link>}
            >
              {abertas.length === 0 ? <p className="text-[0.75rem] text-black/40">Nenhuma negociação aberta.</p> : (
                <ul className="divide-y divide-black/[.06]">
                  {abertas.slice(0, 15).map(item => (
                    <li key={item.id}>
                      <Link href={`/captacoes/${item.id}`} className="block py-2.5 hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                        <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{item.empresa_crm?.nome ?? item.empresa_pub?.nome ?? item.titulo ?? "Negociação"}</p>
                        <p className="mt-0.5 truncate text-[0.6875rem] text-black/45">
                          {rotuloStatus(item.status)}
                          {item.valor_solicitado ? <> · <span title={formatarValorCompleto(item.valor_solicitado)}>{formatarValorCurto(item.valor_solicitado)}</span></> : null}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSidebarCard>

            <DetailSidebarCard
              title="Atividades pendentes"
              icon={CalendarClock}
              count={atividades.length}
              action={<Link href={`/atividades?responsavel=${userId}`} className="text-[0.625rem] font-medium text-black/45 underline-offset-2 hover:text-black/70 hover:underline">Ver na lista</Link>}
            >
              {atividades.length === 0 ? <p className="text-[0.75rem] text-black/40">Nenhuma atividade pendente.</p> : (
                <ul className="divide-y divide-black/[.06]">
                  {atividades.slice(0, 15).map(item => (
                    <li key={item.id} className="py-2.5">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{item.nome}</p>
                      <p className={`mt-0.5 text-[0.6875rem] ${estaAtrasada(item, hoje) ? "text-[#B23B3B]" : "text-black/45"}`}>
                        {item.data_prevista ? `${estaAtrasada(item, hoje) ? "Atrasada desde " : "Para "}${dataCurta(item.data_prevista)}` : "Sem data"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSidebarCard>

            <DetailSidebarCard title={`Contatos registrados em ${periodo} dias`} icon={MessagesSquare} count={contatos.length}>
              {contatos.length === 0 ? <p className="text-[0.75rem] text-black/40">Nenhum contato registrado no período.</p> : (
                <ul className="divide-y divide-black/[.06]">
                  {contatos.slice(0, 15).map(item => (
                    <li key={item.id} className="py-2.5">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{item.assunto}</p>
                      <p className="mt-0.5 truncate text-[0.6875rem] text-black/45">{[item.empresa?.nome, dataCurta(item.ocorreu_em)].filter(Boolean).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSidebarCard>
          </div>
        )}
      </DetailPageContent>
    </div>
  );
}
