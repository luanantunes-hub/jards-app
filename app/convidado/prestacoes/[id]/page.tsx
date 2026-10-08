"use client";

// A prestação aberta pelo convidado (P5.3): só as seções do convite, só
// leitura (as regras do banco não deixam escrever), com a marca de
// verificado e comentários por item, que a equipe vê na visão geral.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  chaveDoItem,
  estadoDosItens,
  LISTAS_DO_CONVIDADO,
  rotuloDaSecao,
  rotuloDoPapel,
  SECOES_DO_CONVITE,
  verificadosDaLista,
  type ItemDoConvidado,
  type NotaDoConvidado,
  type SecaoDoConvite,
} from "@/lib/prestacao/convidados";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { LinhaDoConvidado } from "./LinhaDoConvidado";

type Acesso = {
  situacao: "ativo" | "expirado" | "revogado" | "suspenso";
  convidado_id?: string;
  papel?: string;
  secoes?: SecaoDoConvite[];
  expira_em?: string;
  organizacao?: { nome: string | null; avatar_url: string | null } | null;
  prestacao?: {
    titulo: string;
    identificador_oficial: string | null;
    status: string;
    regime: string | null;
    proponente: string | null;
    data_inicio_execucao: string | null;
    data_fim_execucao: string | null;
  };
};

type ListaCarregada = { tipo: string; titulo: string; vazia: string; itens: ItemDoConvidado[]; erro: string };

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const AVISO: Record<Exclude<Acesso["situacao"], "ativo">, { titulo: string; texto: string }> = {
  expirado: { titulo: "Seu convite venceu", texto: "Peça a quem convidou você para renovar o acesso." },
  revogado: { titulo: "Seu acesso foi revogado", texto: "Fale com quem convidou você se ainda precisar acompanhar esta prestação." },
  suspenso: { titulo: "Prestação indisponível no momento", texto: "A organização está sem o módulo de prestação de contas ativo." },
};

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto max-w-[32rem] px-4 py-12">
      <div className="rounded-lg border bg-white px-6 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <h1 className="text-[1.0625rem] font-semibold text-[#0D0D0D]">{titulo}</h1>
        <p className="mt-2 text-[0.8125rem] text-black/55">{texto}</p>
        <Link href="/convidado" className="mt-4 inline-block rounded text-[0.75rem] text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]">
          Ver minhas prestações
        </Link>
      </div>
    </main>
  );
}

export default function PrestacaoDoConvidado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [acesso, setAcesso] = useState<Acesso | null | undefined>(undefined);
  const [erroAcesso, setErroAcesso] = useState("");
  const [secao, setSecao] = useState<SecaoDoConvite | null>(null);
  const [listas, setListas] = useState<ListaCarregada[] | null>(null);
  const [notas, setNotas] = useState<NotaDoConvidado[]>([]);
  const [erroArquivo, setErroArquivo] = useState("");
  const [geral, setGeral] = useState("");
  const [erroGeral, setErroGeral] = useState("");
  const [enviandoGeral, setEnviandoGeral] = useState(false);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    (supabase as any).rpc("fn_convidado_acesso", { p_prestacao_id: id }).then(({ data, error }: { data: Acesso | null; error: { message?: string } | null }) => {
      if (!ativo) return;
      if (error) { setErroAcesso(mensagemErroPrestacao(error, "Não foi possível abrir a prestação")); setAcesso(null); return; }
      setAcesso(data);
      const primeira = SECOES_DO_CONVITE.find(s => data?.secoes?.includes(s.id));
      setSecao(primeira?.id ?? null);
    });
    return () => { ativo = false; };
  }, [id, supabase]);

  const buscarNotas = useCallback(async (convidadoId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const { data } = await (supabase as any).from("prestacao_convidado_notas")
      .select("id, convidado_id, entidade_tipo, entidade_id, tipo, texto, created_at")
      .eq("prestacao_id", id).eq("convidado_id", convidadoId).order("created_at");
    return (data ?? []) as NotaDoConvidado[];
  }, [id, supabase]);

  useEffect(() => {
    if (!acesso?.convidado_id) return;
    let ativo = true;
    buscarNotas(acesso.convidado_id).then(n => { if (ativo) setNotas(n); });
    return () => { ativo = false; };
  }, [acesso?.convidado_id, buscarNotas]);

  // As listas da seção escolhida, pelas regras de leitura do convidado.
  useEffect(() => {
    if (!secao) return;
    let ativo = true;
    Promise.all(LISTAS_DO_CONVIDADO[secao].map(async l => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
      let consulta = (supabase as any).from(l.tabela).select(l.campos).eq("prestacao_id", id);
      if (l.filtro) consulta = consulta.eq(l.filtro.coluna, l.filtro.valor);
      const { data, error } = await consulta.order(l.ordem.coluna, { ascending: l.ordem.crescente }).limit(500);
      return {
        tipo: l.tipo, titulo: l.titulo, vazia: l.vazia,
        itens: ((data ?? []) as Record<string, unknown>[]).map(l.item),
        erro: error ? "Não foi possível carregar esta lista." : "",
      };
    })).then(r => { if (ativo) setListas(r); });
    return () => { ativo = false; };
  }, [secao, id, supabase]);

  const estado = useMemo(() => estadoDosItens(notas), [notas]);

  async function anotar(tipo: string, entidadeId: string, acao: "comentario" | "verificado" | "desmarcado", texto?: string): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_convidado_anotar", {
      p_prestacao_id: id, p_entidade_tipo: tipo, p_entidade_id: entidadeId, p_tipo: acao, p_texto: texto ?? null,
    });
    if (error) return mensagemErroPrestacao(error, "Não foi possível registrar");
    if (acesso?.convidado_id) setNotas(await buscarNotas(acesso.convidado_id));
    return null;
  }

  async function abrirArquivo(path: string) {
    setErroArquivo("");
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErroArquivo(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  async function comentarGeral() {
    if (!geral.trim()) { setErroGeral("Escreva o comentário."); return; }
    setEnviandoGeral(true);
    const problema = await anotar("prestacao", id, "comentario", geral.trim());
    setEnviandoGeral(false);
    setErroGeral(problema ?? "");
    if (!problema) setGeral("");
  }

  if (acesso === undefined) {
    return (
      <main className="mx-auto max-w-pagina px-4 py-8 md:px-6">
        <div className="h-24 animate-pulse rounded-lg bg-black/[.04] motion-reduce:animate-none" />
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-black/[.04] motion-reduce:animate-none" />
      </main>
    );
  }
  if (erroAcesso) return <Aviso titulo="Não foi possível abrir a prestação" texto={erroAcesso} />;
  if (!acesso) return <Aviso titulo="Você não tem convite para esta prestação" texto="Abra o link do convite que recebeu, entrando com o e-mail convidado." />;
  if (acesso.situacao !== "ativo") return <Aviso {...AVISO[acesso.situacao]} />;

  const p = acesso.prestacao!;
  const secoes = SECOES_DO_CONVITE.filter(s => acesso.secoes?.includes(s.id));
  const comentariosGerais = estado.get(chaveDoItem("prestacao", id))?.comentarios ?? [];

  return (
    <main className="mx-auto max-w-pagina px-4 py-6 md:px-6 md:py-8">
      <Link href="/convidado" className="inline-flex items-center gap-1 rounded text-[0.75rem] text-black/50 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={13} aria-hidden /> Minhas prestações
      </Link>

      <header className="mt-3">
        <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">{acesso.organizacao?.nome ?? "Organização"}</p>
        <h1 className="mt-1 text-balance text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-[#0D0D0D]">{p.titulo}</h1>
        <p className="mt-1 text-[0.75rem] text-black/50">
          {[p.regime, p.identificador_oficial, p.proponente, p.data_inicio_execucao ? `Execução ${dataBr(p.data_inicio_execucao)}${p.data_fim_execucao ? ` a ${dataBr(p.data_fim_execucao)}` : ""}` : ""].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 text-[0.6875rem] text-black/45">
          Seu acesso: {rotuloDoPapel(acesso.papel ?? "outro")}, até {dataBr(acesso.expira_em)}. Só leitura: comente e marque o que conferiu.
        </p>
      </header>

      <section className="mt-5 rounded-lg border bg-white px-4 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby="geral-titulo">
        <h2 id="geral-titulo" className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[#0D0D0D]">
          <MessageSquare size={14} className="text-black/40" aria-hidden /> Comentário para a equipe
        </h2>
        {comentariosGerais.length > 0 && (
          <ul className="mt-2 space-y-1.5 border-l-2 border-black/[.08] pl-3">
            {comentariosGerais.map(c => (
              <li key={c.id} className="text-[0.75rem] text-black/65">
                <span className="whitespace-pre-line">{c.texto}</span>
                <span className="ml-1.5 text-[0.625rem] text-black/35">{new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-2 block">
          <span className="sr-only">Comentário geral sobre a prestação</span>
          <textarea value={geral} onChange={e => setGeral(e.target.value)} rows={2} maxLength={2000}
            placeholder="Algo sobre a prestação como um todo"
            className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
        {erroGeral && <p role="alert" className="mt-1 text-[0.6875rem] text-[#B23B3B]">{erroGeral}</p>}
        <div className="mt-1.5 flex justify-end">
          <button type="button" onClick={comentarGeral} disabled={enviandoGeral}
            className="rounded bg-[#2E8932] px-4 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-50">
            Enviar comentário
          </button>
        </div>
      </section>

      <div role="tablist" aria-label="Seções do convite" className="mt-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {secoes.map(s => (
          <button key={s.id} type="button" role="tab" id={`aba-${s.id}`} aria-selected={secao === s.id} aria-controls="painel-secao"
            onClick={() => { if (secao !== s.id) { setListas(null); setSecao(s.id); } }}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
              secao === s.id ? "border-[#7259B5] text-[#0D0D0D]" : "border-transparent text-black/50 hover:text-black/80"}`}>
            {s.rotulo}
          </button>
        ))}
      </div>

      <div id="painel-secao" role="tabpanel" aria-labelledby={secao ? `aba-${secao}` : undefined} className="mt-4 space-y-4">
        {secao && <p className="text-[0.6875rem] text-black/45">{SECOES_DO_CONVITE.find(s => s.id === secao)?.descricao}.</p>}
        {erroArquivo && <p role="alert" className="text-[0.6875rem] text-[#B23B3B]">{erroArquivo}</p>}
        {listas === null ? (
          <div className="h-48 animate-pulse rounded-lg bg-black/[.04] motion-reduce:animate-none" />
        ) : listas.map(l => (
          <section key={l.tipo} className="rounded-lg border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby={`lista-${l.tipo}`}>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <h2 id={`lista-${l.tipo}`} className="text-[0.8125rem] font-semibold text-[#0D0D0D]">{l.titulo}</h2>
              {l.itens.length > 0 && (
                <p className="text-[0.6875rem] tabular-nums text-black/45">{verificadosDaLista(l.itens, estado)} de {l.itens.length} verificados</p>
              )}
            </div>
            {l.erro ? (
              <p role="alert" className="px-4 py-3 text-[0.6875rem] text-[#B23B3B]">{l.erro}</p>
            ) : l.itens.length === 0 ? (
              <p className="px-4 py-3 text-[0.75rem] text-black/45">{l.vazia}</p>
            ) : (
              <ul className="divide-y divide-black/[.05]">
                {l.itens.map(item => (
                  <LinhaDoConvidado key={item.id} item={item} estado={estado.get(chaveDoItem(item.tipo, item.id))}
                    onMarcar={(i, verificado) => anotar(i.tipo, i.id, verificado ? "verificado" : "desmarcado")}
                    onComentar={(i, texto) => anotar(i.tipo, i.id, "comentario", texto)}
                    onAbrirArquivo={abrirArquivo} />
                ))}
              </ul>
            )}
          </section>
        ))}
        {secao && <p className="text-[0.625rem] text-black/35">Seção {rotuloDaSecao(secao).toLowerCase()} do convite. Os valores e documentos são os que a equipe lançou na Jards.</p>}
      </div>
    </main>
  );
}
