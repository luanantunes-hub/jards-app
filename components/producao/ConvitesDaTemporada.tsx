"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Send } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import { DIAS_DO_LINK_DO_CONVITE, mensagemDoConvite, resumoDosConvites, ROTULO_DA_RESPOSTA_DO_CONVITE } from "@/lib/producao/convites";
import type { RespostaDoConvite } from "@/lib/producao/estados";
import { TransfersDaTemporada } from "@/components/producao/TransfersDaTemporada";

type Convite = {
  id: string; pessoa_id: string; resposta: RespostaDoConvite; chegada_dia: string | null; chegada_hora: string | null; saida_dia: string | null; saida_hora: string | null;
  observacao: string | null; respondido_em: string | null; link_expira_em: string | null;
};
type Pessoa = { id: string; nome: string };

const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

const hora = (valor: string | null) => (valor ? valor.slice(0, 5) : null);

function ConvidarSheet({ temporadaId, temporadaTitulo, pessoas, convites, onClose, onGerou }: {
  temporadaId: string; temporadaTitulo: string; pessoas: Pessoa[]; convites: Convite[]; onClose: () => void; onGerou: () => void;
}) {
  const organizacao = useOrganizationName();
  const jaConvidadas = useMemo(() => new Set(convites.map(convite => convite.pessoa_id)), [convites]);
  const [escolhidas, setEscolhidas] = useState<string[]>(() => pessoas.filter(pessoa => !jaConvidadas.has(pessoa.id)).map(pessoa => pessoa.id));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<{ nome: string; texto: string }[] | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function gerar() {
    if (escolhidas.length === 0) { setErro("Marque ao menos uma pessoa."); return; }
    setGerando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_convite_gerar", { p_temporada: temporadaId, p_pessoas: escolhidas, p_dias: DIAS_DO_LINK_DO_CONVITE });
    setGerando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode convidar pessoas aqui." : "Não foi possível gerar os links. Tente de novo."); return; }
    const lista = (Array.isArray(data) ? data : []) as { pessoa_id: string; codigo: string }[];
    const nomes = new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome]));
    setMensagens(lista.map(item => ({
      nome: nomes.get(item.pessoa_id) ?? "Pessoa",
      texto: mensagemDoConvite({ nome: nomes.get(item.pessoa_id) ?? "", titulo: temporadaTitulo, organizacao, url: `${window.location.origin}/presenca/${item.codigo}` }),
    })));
    onGerou();
  }

  async function copiar(chave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado(atual => (atual === chave ? null : atual)), 2000);
    } catch {
      setErro("Não foi possível copiar. Selecione o texto e copie à mão.");
    }
  }

  return (
    <TopSheet
      titulo="Convidar a equipe"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={gerando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{mensagens ? "Fechar" : "Cancelar"}</button>
          {!mensagens && <button type="button" onClick={() => void gerar()} disabled={gerando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{gerando ? "Gerando…" : `Gerar ${escolhidas.length} ${escolhidas.length === 1 ? "link" : "links"}`}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {!mensagens ? (
          <>
            {pessoas.length === 0 ? (
              <p className="text-[0.8125rem] text-black/55">Ainda não há ninguém na equipe. Cadastre as pessoas em Equipe e volte aqui.</p>
            ) : (
              <fieldset>
                <legend className="mb-1.5 flex w-full items-center justify-between text-[0.6875rem] font-medium text-black/55">
                  <span>Quem convidar</span>
                  <button type="button" onClick={() => setEscolhidas(atual => (atual.length === pessoas.length ? [] : pessoas.map(pessoa => pessoa.id)))} className="text-[0.6875rem] font-medium text-black/55 underline underline-offset-2 hover:text-[#282525]">{escolhidas.length === pessoas.length ? "Limpar" : "Marcar todos"}</button>
                </legend>
                <div className="max-h-72 space-y-0.5 overflow-y-auto rounded border p-1" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                  {pessoas.map(pessoa => (
                    <label key={pessoa.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded px-2.5 text-[0.8125rem] text-[#282525] hover:bg-black/[.04]">
                      <input type="checkbox" checked={escolhidas.includes(pessoa.id)} disabled={gerando} onChange={event => setEscolhidas(atual => (event.target.checked ? [...atual, pessoa.id] : atual.filter(id => id !== pessoa.id)))} className="h-4 w-4 accent-[#282525]" />
                      <span className="min-w-0 flex-1 truncate">{pessoa.nome}</span>
                      {jaConvidadas.has(pessoa.id) && <span className="text-[0.6875rem] text-black/40">já convidada</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        ) : (
          <>
            <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>Os links aparecem só agora. Copie e mande por WhatsApp ou e-mail antes de fechar; depois, para mandar de novo, gere um link novo.</p>
            {mensagens.length > 1 && <button type="button" onClick={() => void copiar("todas", mensagens.map(item => `${item.nome}\n${item.texto}`).join("\n\n"))} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado === "todas" ? "Copiadas" : "Copiar todas as mensagens"}</button>}
            <ul className="space-y-3">
              {mensagens.map(item => (
                <li key={item.nome + item.texto} className="rounded border p-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  <p className="text-[0.8125rem] font-medium text-[#282525]">{item.nome}</p>
                  <p className="mt-1 break-words text-[0.75rem] text-black/60">{item.texto}</p>
                  <button type="button" onClick={() => void copiar(item.texto, item.texto)} className={`${BOTAO} mt-2`}><Copy size={13} aria-hidden="true" /> {copiado === item.texto ? "Copiada" : "Copiar mensagem"}</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </TopSheet>
  );
}

/** Os convites da temporada (PD6.9): quem foi convidado, o que respondeu e quando chega e sai; e a folha para convidar mais gente. */
export function ConvitesDaTemporada({ organizationId, temporadaId, temporadaTitulo, podeEditar }: { organizationId: string; temporadaId: string; temporadaTitulo: string; podeEditar: boolean }) {
  const [convites, setConvites] = useState<Convite[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [con, pes] = await Promise.all([
        producao.from("producao_convites").select("id, pessoa_id, resposta, chegada_dia, chegada_hora, saida_dia, saida_hora, observacao, respondido_em, link_expira_em").eq("temporada_id", temporadaId),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      if (!ativo) return;
      setConvites(con.data ?? []);
      setPessoas(pes.data ?? []);
      setErro(con.error ? "Não foi possível carregar os convites. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [temporadaId, organizationId, versao]);

  const nomes = useMemo(() => new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome])), [pessoas]);
  const resumo = useMemo(() => resumoDosConvites(convites ?? []), [convites]);
  const ordenados = useMemo(() => [...(convites ?? [])].sort((a, b) => (nomes.get(a.pessoa_id) ?? "").localeCompare(nomes.get(b.pessoa_id) ?? "", "pt-BR")), [convites, nomes]);

  return (
    <section aria-labelledby="convites" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="convites" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Convites</h2>
        {podeEditar && <button type="button" onClick={() => setFolha(true)} className={BOTAO}><Send size={13} aria-hidden="true" /> Convidar a equipe</button>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {convites === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : convites.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Ninguém foi convidado ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Gere um link para cada pessoa da equipe. Elas respondem pelo celular, sem conta, e você vê aqui quem vai e quando chega.</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[0.75rem] tabular-nums text-black/55">{resumo.vao} {resumo.vao === 1 ? "vai" : "vão"} · {resumo.naoVao} {resumo.naoVao === 1 ? "não vai" : "não vão"} · {resumo.semResposta} sem resposta</p>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {ordenados.map(convite => {
              const chegada = [convite.chegada_dia ? diaEMes(convite.chegada_dia) : null, hora(convite.chegada_hora)].filter(Boolean).join(" às ");
              const saida = [convite.saida_dia ? diaEMes(convite.saida_dia) : null, hora(convite.saida_hora)].filter(Boolean).join(" às ");
              const vencido = convite.resposta === "pendente" && convite.link_expira_em !== null && new Date(convite.link_expira_em).getTime() < agora;
              return (
                <li key={convite.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
                  <span className="min-w-0 flex-1 basis-48 truncate text-[0.8125rem] font-medium text-[#282525]">{nomes.get(convite.pessoa_id) ?? "Pessoa"}</span>
                  <span className="w-24 text-[0.75rem] text-black/65">{vencido ? <span style={{ color: "#B07A14" }}>link vencido</span> : ROTULO_DA_RESPOSTA_DO_CONVITE[convite.resposta]}</span>
                  <span className="min-w-0 flex-1 basis-56 text-[0.6875rem] text-black/45">
                    {[chegada ? `chega ${chegada}` : null, saida ? `sai ${saida}` : null, convite.observacao].filter(Boolean).join(" · ")}
                  </span>
                </li>
              );
            })}
          </ul>
          <TransfersDaTemporada organizationId={organizationId} temporadaId={temporadaId} convites={convites} nomes={nomes} podeEditar={podeEditar} />
        </>
      )}
      {folha && <ConvidarSheet temporadaId={temporadaId} temporadaTitulo={temporadaTitulo} pessoas={pessoas} convites={convites ?? []} onClose={() => setFolha(false)} onGerou={() => setVersao(atual => atual + 1)} />}
    </section>
  );
}
