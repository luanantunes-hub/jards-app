"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, PenLine, RefreshCw, Video } from "lucide-react";
import { LinhaDaConversa } from "@/components/conversas/LinhaDaConversa";
import { PainelDaConversa } from "@/components/conversas/PainelDaConversa";
import { EscreverEmail, type ResultadoDoEnvio } from "@/components/email/EscreverEmail";
import { NovaReuniaoModal } from "@/components/modals/NovaReuniaoModal";
import { ListEmptyState, ListPageHeader, ListSummary, ListToolbar, PrimaryListAction, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { FilterButton } from "@/components/ui/FilterControls";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { contagemDosFiltros, enderecoDoOutroLado, FILTROS_DAS_CONVERSAS, itemNoFiltro, montarLista, type EmailAgendado, type FiltroDasConversas, type ItemDaLista, type ReuniaoNaLista } from "@/lib/conversas/lista";
import { agruparConversas, COLUNAS_DO_EMAIL_DE_CONVERSA, type EmailDeConversa } from "@/lib/email/conversas";
import { emPartes } from "@/lib/email/lotes";
import { horasEmTexto, type SituacaoDoLimite } from "@/lib/reunioes/custo";
import { createClient } from "@/lib/supabase/client";
import type { RemetenteDaTriagem } from "@/app/api/email/triagem/route";

/** As últimas mensagens da própria caixa que a tela agrupa em conversas. */
const MENSAGENS_NA_CAIXA = 600;

async function buscarJson<T>(url: string, vazio: T): Promise<T> {
  try {
    const resposta = await fetch(url, { cache: "no-store" });
    if (!resposta.ok) return vazio;
    return (await resposta.json()) as T;
  } catch {
    return vazio;
  }
}

/**
 * Conversas: e-mails e reuniões num lugar só, com a leitura ao lado da lista. É o registro do que foi conversado
 * com o patrocinador — por isso as duas coisas moram juntas. Cada pessoa vê a própria caixa; a conversa de quem
 * ainda não é contato só aparece para ela, até registrá-la no histórico da empresa.
 */
export default function ConversasPage() {
  const supabase = useMemo(() => createClient(), []);
  const organizationId = useOrganizationId();

  const [emails, setEmails] = useState<EmailDeConversa[]>([]);
  const [reunioes, setReunioes] = useState<ReuniaoNaLista[]>([]);
  const [agendados, setAgendados] = useState<EmailAgendado[]>([]);
  const [triagem, setTriagem] = useState<RemetenteDaTriagem[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [meuId, setMeuId] = useState<string | null>(null);
  const [conectado, setConectado] = useState(true);

  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDasConversas>("tudo");
  const [chaveAberta, setChaveAberta] = useState<string | null>(null);
  const [escrevendo, setEscrevendo] = useState(false);
  const [novaReuniao, setNovaReuniao] = useState(false);
  const [usoDasReunioes, setUsoDasReunioes] = useState<SituacaoDoLimite | null>(null);

  const carregar = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const usuario = auth.user?.id ?? null;
      setMeuId(usuario);
      if (!usuario) throw new Error("Entre de novo para ver suas conversas.");

      const [{ data, error }, daTriagem, osAgendados, asReunioes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("emails").select(COLUNAS_DO_EMAIL_DE_CONVERSA).eq("user_id", usuario).order("sent_at", { ascending: false }).limit(MENSAGENS_NA_CAIXA),
        buscarJson<{ conectado?: boolean; remetentes?: RemetenteDaTriagem[] }>("/api/email/triagem", {}),
        buscarJson<{ agendados?: EmailAgendado[] }>("/api/email/agendados", {}),
        organizationId ? buscarJson<{ reunioes?: ReuniaoNaLista[]; uso?: SituacaoDoLimite }>(`/api/reunioes?organization_id=${organizationId}`, {}) : Promise.resolve({} as { reunioes?: ReuniaoNaLista[]; uso?: SituacaoDoLimite }),
      ]);
      if (error) throw new Error(error.message);

      const lidos = (data ?? []) as EmailDeConversa[];
      setEmails(lidos);
      setTriagem(daTriagem.remetentes ?? []);
      setConectado(daTriagem.conectado !== false);
      setAgendados(osAgendados.agendados ?? []);
      setReunioes(asReunioes.reunioes ?? []);
      setUsoDasReunioes(asReunioes.uso ?? null);

      const idsDeContatos = [...new Set(lidos.map((email) => email.contato_id).filter((id): id is string => Boolean(id)))];
      const porId: Record<string, string> = {};
      for (const parte of emPartes(idsDeContatos, 100)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: contatos } = await (supabase as any).from("contatos").select("id, nome").in("id", parte);
        for (const contato of (contatos ?? []) as Array<{ id: string; nome: string | null }>) if (contato.nome) porId[contato.id] = contato.nome;
      }
      setNomes(porId);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar suas conversas.");
    } finally {
      setCarregando(false);
    }
  }, [organizationId, supabase]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    if (!aviso) return;
    const fim = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(fim);
  }, [aviso]);

  async function atualizar() {
    setSincronizando(true);
    try {
      await fetch("/api/email/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
    } finally {
      setSincronizando(false);
      await carregar();
    }
  }

  const conversas = useMemo(() => agruparConversas(emails), [emails]);
  const itens = useMemo(() => montarLista(conversas, reunioes, agendados), [conversas, reunioes, agendados]);
  const contagem = useMemo(() => contagemDosFiltros(itens), [itens]);
  const visiveis = useMemo(() => itens.filter((item) => itemNoFiltro(item, filtro)), [itens, filtro]);
  // A conversa aberta sai de `visiveis`: trocar de filtro só a fecha quando ela não está mais na lista.
  const aberta = chaveAberta ? visiveis.find((item) => item.chave === chaveAberta) ?? null : null;

  const nomesDoItem = useCallback(
    (item: ItemDaLista) => (item.tipo === "email"
      ? item.conversa.contatoIds.map((id) => nomes[id]).filter((nome): nome is string => Boolean(nome))
      : []),
    [nomes],
  );

  // Conversa de quem ainda não é contato: a triagem diz o que já sabemos dessa pessoa (empresa sugerida, contato criado).
  const remetenteDaAberta = useMemo(() => {
    if (!aberta || aberta.tipo !== "email" || aberta.conversa.contatoIds.length > 0) return null;
    const endereco = enderecoDoOutroLado(aberta.conversa);
    return endereco ? triagem.find((remetente) => remetente.endereco === endereco) ?? null : null;
  }, [aberta, triagem]);

  function depoisDeEnviar({ agendado, enviarEm }: ResultadoDoEnvio) {
    setAviso(agendado && enviarEm
      ? `E-mail agendado para ${new Date(enviarEm).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}.`
      : "E-mail enviado. Ele aparece aqui na próxima atualização.");
    if (agendado) setFiltro("agendados");
    void carregar();
  }

  const vazio = !carregando && itens.length === 0;

  return (
    <>
      {escrevendo && <EscreverEmail onClose={() => setEscrevendo(false)} onEnviado={depoisDeEnviar} />}
      {novaReuniao && organizationId && (
        <NovaReuniaoModal
          organizationId={organizationId}
          onClose={() => setNovaReuniao(false)}
          onCreated={() => { setNovaReuniao(false); setFiltro("reunioes"); void carregar(); }}
        />
      )}

      <ListPageHeader
        secao="conversas"
        eyebrow="Relacionamento"
        title="Conversas"
        summary={!carregando && !vazio && <ListSummary strong={contagem.tudo}>{contagem.tudo === 1 ? "conversa" : "conversas"}</ListSummary>}
        actions={
          <>
            <SecondaryListAction onClick={() => void atualizar()} disabled={sincronizando}>
              <RefreshCw size={13} className={sincronizando ? "animate-spin" : undefined} aria-hidden="true" />
              {sincronizando ? "Atualizando…" : "Atualizar"}
            </SecondaryListAction>
            <SecondaryListAction onClick={() => setNovaReuniao(true)} disabled={!organizationId || usoDasReunioes?.atingido === true}>
              <Video size={13} aria-hidden="true" />Enviar assistente
            </SecondaryListAction>
            <PrimaryListAction onClick={() => setEscrevendo(true)}><PenLine size={13} aria-hidden="true" />Escrever e-mail</PrimaryListAction>
          </>
        }
      />

      {!vazio && (
        <ListToolbar>
          {FILTROS_DAS_CONVERSAS.filter(({ value }) => value === "tudo" || value === filtro || contagem[value] > 0).map(({ value, label }) => (
            <FilterButton key={value} active={filtro === value} onClick={() => setFiltro(value)}>
              {label}
              {value !== "tudo" && <span className="tabular-nums text-black/30">{contagem[value]}</span>}
            </FilterButton>
          ))}
        </ListToolbar>
      )}

      {usoDasReunioes && (usoDasReunioes.atingido || usoDasReunioes.perto) && (
        <p role="status" className="shrink-0 border-b bg-white px-4 py-2.5 text-[0.75rem] tabular-nums md:px-8" style={{ borderColor: "rgba(13,13,13,.06)", color: usoDasReunioes.atingido ? "#B23B3B" : "#946611" }}>
          {usoDasReunioes.atingido
            ? `O limite de reuniões deste mês foi atingido: ${horasEmTexto(usoDasReunioes.usadasH)} de ${horasEmTexto(usoDasReunioes.limiteH)}. Fale com a equipe do Jards para ampliar.`
            : `Reuniões deste mês: ${horasEmTexto(usoDasReunioes.usadasH)} de ${horasEmTexto(usoDasReunioes.limiteH)} — perto do limite.`}
        </p>
      )}
      {aviso && <p role="status" className="shrink-0 border-b bg-white px-4 py-2.5 text-[0.75rem] font-medium text-[#3C7A55] md:px-8" style={{ borderColor: "rgba(13,13,13,.06)" }}>{aviso}</p>}
      {erro && <p role="alert" className="shrink-0 border-b bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B] md:px-8" style={{ borderColor: "rgba(13,13,13,.06)" }}>{erro}</p>}

      {carregando ? (
        <p className="flex-1 py-16 text-center text-[0.75rem] text-black/35">Carregando…</p>
      ) : vazio ? (
        <div className="flex-1 overflow-y-auto">
          <ListEmptyState
            icon={Mail}
            title={conectado ? "Nenhuma conversa por aqui ainda" : "Conecte seu e-mail"}
            description={conectado
              ? "Clique em Atualizar para buscar seus e-mails. Aparecem as conversas com seus contatos e com quem ainda não é contato."
              : "Depois de conectar, suas conversas por e-mail aparecem aqui, junto com as reuniões gravadas."}
            action={conectado
              ? undefined
              : <Link href="/configuracoes?section=ferramentas" className="flex h-9 items-center rounded px-3 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04]">Abrir Minhas ferramentas</Link>}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className={`w-full shrink-0 overflow-y-auto border-r lg:block lg:w-[21rem] ${aberta ? "hidden" : "block"}`} style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {visiveis.length === 0 ? (
              <p className="px-4 py-16 text-center text-[0.75rem] text-black/35">Nada neste filtro.</p>
            ) : (
              <ul className="divide-y divide-black/[.05]">
                {visiveis.map((item) => (
                  <li key={item.chave}>
                    <LinhaDaConversa item={item} nomesDosContatos={nomesDoItem(item)} selecionada={item.chave === chaveAberta} onAbrir={() => setChaveAberta(item.chave)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-6 lg:block ${aberta ? "block" : "hidden"}`}>
            {/* A leitura não acompanha a largura da tela: linha longa demais cansa a vista. */}
            <div className="max-w-3xl">
            {aberta ? (
              <PainelDaConversa
                key={aberta.chave}
                item={aberta}
                meuId={meuId}
                nomesDosContatos={nomesDoItem(aberta)}
                remetenteDaTriagem={remetenteDaAberta}
                onMudou={() => void carregar()}
                onVoltar={() => setChaveAberta(null)}
              />
            ) : (
              <p className="pt-20 text-center text-[0.75rem] text-black/30">Escolha uma conversa para ler.</p>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
