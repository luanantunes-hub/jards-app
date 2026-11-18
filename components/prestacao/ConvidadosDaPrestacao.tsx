"use client";

// Convidados da prestação (P5.3), na visão geral: quem de fora acompanha
// (contador, auditor, patrocinador), com seções e validade; convidar, alterar
// e revogar; e o histórico do que cada um comentou e marcou como verificado.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { CampoParaCopiar } from "@/components/prestacao/CampoParaCopiar";
import {
  erroDoConvite,
  historicoDosConvidados,
  listaDoTipo,
  nomeDoConvidado,
  PAPEIS_DO_CONVIDADO,
  ROTULO_DA_SITUACAO_DO_CONVITE,
  ROTULO_DO_ITEM,
  rotuloDoPapel,
  SECOES_DO_CONVITE,
  situacaoDoConvite,
  textoDaNota,
  textoDasSecoes,
  type ConvidadoDaPrestacao,
  type EventoDoConvidado,
  type NotaDoConvidado,
  type PapelDoConvidado,
  type SecaoDoConvite,
} from "@/lib/prestacao/convidados";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const SALVAR = "flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40";
const CANCELAR = "rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
const LINK = "rounded text-[0.6875rem] text-black/45 underline decoration-black/20 underline-offset-2 transition focus-visible:outline-2 focus-visible:outline-[#7259B5]";
const EVENTOS_VISIVEIS = 6;

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const diaBr = (instante: string) => new Date(instante).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

function Girando() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />;
}

function EscolhaDeSecoes({ secoes, onChange }: { secoes: SecaoDoConvite[]; onChange: (s: SecaoDoConvite[]) => void }) {
  return (
    <fieldset>
      <legend className={ROTULO}>Seções que a pessoa lê</legend>
      <div className="space-y-1.5">
        {SECOES_DO_CONVITE.map(s => (
          <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-black/[.03]">
            <input type="checkbox" checked={secoes.includes(s.id)} className="mt-0.5 h-4 w-4 accent-[#7259B5]"
              onChange={e => onChange(e.target.checked ? [...secoes, s.id] : secoes.filter(x => x !== s.id))} />
            <span>
              <span className="block text-[0.75rem] text-black/80">{s.rotulo}</span>
              <span className="block text-[0.625rem] text-black/45">{s.descricao}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ConvidarModal({ prestacaoId, onClose, onCriado }: { prestacaoId: string; onClose: () => void; onCriado: () => void }) {
  const hoje = hojeIso();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<PapelDoConvidado>("contador");
  const [secoes, setSecoes] = useState<SecaoDoConvite[]>(["financeiro"]);
  const [expiraEm, setExpiraEm] = useState(somarDias(hoje, 90));
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState<{ link: string; emailEnviado: boolean } | null>(null);

  async function convidar() {
    const problema = erroDoConvite({ email, nome, secoes, expiraEm, mensagem }, hoje);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    const resposta = await fetch(`/api/prestacoes/${prestacaoId}/convidados`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), nome: nome.trim(), papel, secoes, expira_em: expiraEm, mensagem: mensagem.trim() }),
    }).catch(() => null);
    const corpo = await resposta?.json().catch(() => null) as { link?: string; emailEnviado?: boolean; error?: string } | null;
    setSalvando(false);
    if (!resposta?.ok || !corpo?.link) { setErro(mensagemErroPrestacao({ message: corpo?.error }, "Não foi possível criar o convite")); return; }
    setCriado({ link: corpo.link, emailEnviado: Boolean(corpo.emailEnviado) });
    onCriado();
  }

  const rodape = criado ? (
    <>
      <span />
      <button type="button" onClick={onClose} className="rounded bg-[#1C0E33] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]">Concluir</button>
    </>
  ) : (
    <>
      <span />
      <div className="flex items-center gap-4">
        <button type="button" onClick={onClose} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={convidar} disabled={salvando} className={SALVAR}>
          {salvando && <Girando />} Convidar
        </button>
      </div>
    </>
  );

  return (
    <ModalPrestacao titulo="Convidar para acompanhar" subtitulo="Contador, auditor ou patrocinador: só leitura, por seção e com validade" onClose={onClose} rodape={rodape} largura="max-w-[36rem]">
      {criado ? (
        <div className="space-y-3 py-4">
          <p className="px-6 text-[0.75rem] text-black/65">
            {criado.emailEnviado ? `Enviamos o convite para ${email.trim().toLowerCase()}.` : "O e-mail não pôde ser enviado daqui: copie o endereço e mande à pessoa."}
          </p>
          <CampoParaCopiar rotulo="Endereço do convite" valor={criado.link} />
          <p className="px-6 text-[0.6875rem] text-[#B07A14]">Copie o endereço agora: ele não aparece de novo. Vale só para o e-mail convidado. Se perder, revogue o convite e convide de novo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={ROTULO}>E-mail</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={320} autoComplete="off" className={CAMPO} autoFocus />
          </label>
          <label>
            <span className={ROTULO}>Nome (opcional)</span>
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={200} className={CAMPO} />
          </label>
          <div>
            <span className={ROTULO}>Papel</span>
            <Dropdown value={papel} ariaLabel="Papel do convidado" onChange={v => setPapel(v as PapelDoConvidado)}
              options={PAPEIS_DO_CONVIDADO.map(p => ({ value: p.id, label: p.rotulo }))} />
          </div>
          <div className="sm:col-span-2">
            <EscolhaDeSecoes secoes={secoes} onChange={setSecoes} />
          </div>
          <label>
            <span className={ROTULO}>Acesso até</span>
            <input type="date" value={expiraEm} min={somarDias(hoje, 1)} max={somarDias(hoje, 366)} onChange={e => setExpiraEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
          </label>
          <label className="sm:col-span-2">
            <span className={ROTULO}>Mensagem no convite (opcional)</span>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} maxLength={2000}
              className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
          </label>
          {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
        </div>
      )}
    </ModalPrestacao>
  );
}

function AlterarModal({ convidado, onClose, onSalvo }: { convidado: ConvidadoDaPrestacao; onClose: () => void; onSalvo: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const hoje = hojeIso();
  const [secoes, setSecoes] = useState<SecaoDoConvite[]>(convidado.secoes);
  const [expiraEm, setExpiraEm] = useState(convidado.expira_em < somarDias(hoje, 1) ? somarDias(hoje, 90) : convidado.expira_em);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    const problema = erroDoConvite({ email: convidado.email, nome: "", secoes, expiraEm, mensagem: "" }, hoje);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_prestacao_alterar_convidado", { p_convidado_id: convidado.id, p_secoes: secoes, p_expira_em: expiraEm });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível alterar o acesso")); return; }
    onSalvo();
    onClose();
  }

  return (
    <ModalPrestacao titulo={`Acesso de ${nomeDoConvidado(convidado)}`} subtitulo={convidado.email} onClose={onClose} largura="max-w-[30rem]"
      rodape={(
        <>
          <span />
          <div className="flex items-center gap-4">
            <button type="button" onClick={onClose} className={CANCELAR}>Cancelar</button>
            <button type="button" onClick={salvar} disabled={salvando} className={SALVAR}>{salvando && <Girando />} Salvar</button>
          </div>
        </>
      )}>
      <div className="space-y-4 px-6 py-5">
        <EscolhaDeSecoes secoes={secoes} onChange={setSecoes} />
        <label className="block">
          <span className={ROTULO}>Acesso até</span>
          <input type="date" value={expiraEm} min={somarDias(hoje, 1)} max={somarDias(hoje, 366)} onChange={e => setExpiraEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

export function ConvidadosDaPrestacao({ prestacaoId, podeEditar }: { prestacaoId: string; podeEditar: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [convidados, setConvidados] = useState<ConvidadoDaPrestacao[] | null>(null);
  const [notas, setNotas] = useState<NotaDoConvidado[]>([]);
  const [nomesDosItens, setNomesDosItens] = useState<Map<string, string>>(new Map());
  const [erro, setErro] = useState("");
  const [convidando, setConvidando] = useState(false);
  const [alterando, setAlterando] = useState<ConvidadoDaPrestacao | null>(null);
  const [tudo, setTudo] = useState(false);
  const hoje = hojeIso();

  const buscar = useCallback(async () => {
    const [c, n] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      (supabase as any).from("prestacao_convidados")
        .select("id, email, nome, papel, secoes, expira_em, aceito_em, ultimo_acesso_em, revogado_em, created_at")
        .eq("prestacao_id", prestacaoId).order("created_at", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      (supabase as any).from("prestacao_convidado_notas")
        .select("id, convidado_id, entidade_tipo, entidade_id, tipo, texto, created_at")
        .eq("prestacao_id", prestacaoId).order("created_at", { ascending: false }).limit(200),
    ]);
    const notasLidas = (n.data ?? []) as NotaDoConvidado[];

    // O nome de cada item anotado, lido na tabela dele.
    const porTipo = new Map<string, Set<string>>();
    for (const nota of notasLidas) if (nota.entidade_tipo !== "prestacao") porTipo.set(nota.entidade_tipo, (porTipo.get(nota.entidade_tipo) ?? new Set()).add(nota.entidade_id));
    const nomes = new Map<string, string>();
    await Promise.all([...porTipo].map(async ([tipo, ids]) => {
      const lista = listaDoTipo(tipo);
      if (!lista) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
      const { data } = await (supabase as any).from(lista.tabela).select(lista.campos.replace("!inner", "")).in("id", [...ids]);
      for (const linha of (data ?? []) as Record<string, unknown>[]) {
        const item = lista.item(linha);
        nomes.set(`${tipo}:${item.id}`, item.titulo);
      }
    }));

    return {
      convidados: (c.data ?? []) as ConvidadoDaPrestacao[],
      notas: notasLidas,
      nomes,
      erro: c.error || n.error ? mensagemErroPrestacao(c.error ?? n.error, "Não foi possível carregar os convidados") : "",
    };
  }, [prestacaoId, supabase]);

  const aplicar = useCallback((lido: Awaited<ReturnType<typeof buscar>>) => {
    setConvidados(lido.convidados);
    setNotas(lido.notas);
    setNomesDosItens(lido.nomes);
    setErro(lido.erro);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(lido => { if (ativo) aplicar(lido); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  const recarregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  function revogar(c: ConvidadoDaPrestacao) {
    confirmDelete({
      title: "Revogar o acesso?",
      description: `${nomeDoConvidado(c)} deixa de ver a prestação. Os comentários e marcas já feitos continuam no histórico.`,
      confirmLabel: "Revogar",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
        const { error } = await (supabase as any).rpc("fn_prestacao_revogar_convidado", { p_convidado_id: c.id });
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível revogar o acesso"));
        await recarregar();
      },
    });
  }

  const porId = useMemo(() => new Map((convidados ?? []).map(c => [c.id, c])), [convidados]);
  const eventos = useMemo(() => historicoDosConvidados(convidados ?? [], notas), [convidados, notas]);
  const visiveis = tudo ? eventos : eventos.slice(0, EVENTOS_VISIVEIS);

  function textoDoEvento(e: EventoDoConvidado) {
    if (e.tipo === "convidado") return "recebeu o convite";
    if (e.tipo === "aceitou") return "aceitou o convite";
    if (e.tipo === "revogado") return "teve o acesso revogado";
    const n = e.nota!;
    if (n.entidade_tipo === "prestacao") {
      return n.tipo === "comentario" ? `comentou na prestação: “${n.texto ?? ""}”` : `${textoDaNota(n)} · Prestação`;
    }
    const nome = nomesDosItens.get(`${n.entidade_tipo}:${n.entidade_id}`);
    const item = `${ROTULO_DO_ITEM[n.entidade_tipo]}${nome ? `: ${nome}` : ""}`;
    return n.tipo === "comentario" ? `comentou em ${item}: “${n.texto ?? ""}”` : `${textoDaNota(n)} · ${item}`;
  }

  return (
    <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="text-[0.6875rem] font-semibold text-black/50">Convidados</p>
        {podeEditar && (
          <button type="button" onClick={() => setConvidando(true)}
            className="inline-flex h-8 items-center gap-1 rounded border bg-white px-2.5 text-[0.6875rem] text-black/65 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.12)" }}>
            <Plus size={12} aria-hidden /> Convidar
          </button>
        )}
      </div>
      {erro && <p role="alert" className="px-4 pt-3 text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
      {convidados === null ? (
        <div className="m-4 h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
      ) : convidados.length === 0 ? (
        <p className="px-4 py-4 text-[0.6875rem] text-black/45">Convide o contador, o auditor ou o patrocinador para ler as seções que você escolher. Eles comentam e marcam o que conferiram, sem alterar nada.</p>
      ) : (
        <ul className="divide-y divide-black/[.05]" aria-label="Convidados da prestação">
          {convidados.map(c => {
            const situacao = situacaoDoConvite(c, hoje);
            const s = ROTULO_DA_SITUACAO_DO_CONVITE[situacao];
            return (
              <li key={c.id} className="space-y-0.5 px-4 py-3 text-[0.6875rem]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-medium text-black/80">{nomeDoConvidado(c)}</p>
                  <span className="shrink-0 rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: s.cor + "47", color: s.cor }}>{s.rotulo}</span>
                </div>
                {c.nome && <p className="break-words text-black/45">{c.email}</p>}
                <p className="text-black/45">{rotuloDoPapel(c.papel)} · {textoDasSecoes(c.secoes)}</p>
                <p className="text-black/45">
                  {c.revogado_em ? `Revogado em ${diaBr(c.revogado_em)}` : `Até ${dataBr(c.expira_em)}`}
                  {c.ultimo_acesso_em ? ` · último acesso em ${diaBr(c.ultimo_acesso_em)}` : ""}
                </p>
                {podeEditar && !c.revogado_em && (
                  <div className="flex gap-3 pt-0.5">
                    <button type="button" onClick={() => setAlterando(c)} className={`${LINK} hover:text-black/75`}>Alterar acesso</button>
                    <button type="button" onClick={() => revogar(c)} className={`${LINK} hover:text-[#B23B3B]`}>Revogar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {eventos.length > 0 && (
        <div className="border-t px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Histórico</p>
          <ol className="space-y-2" aria-label="Histórico dos convidados">
            {visiveis.map((e, i) => {
              const c = porId.get(e.convidadoId);
              return (
                <li key={`${e.tipo}-${e.nota?.id ?? e.convidadoId}-${i}`} className="text-[0.6875rem] leading-snug text-black/60">
                  <span className="font-medium text-black/75">{c ? nomeDoConvidado(c) : "Pessoa convidada"}</span> {textoDoEvento(e)}
                  <span className="ml-1 text-[0.625rem] text-black/35">{diaBr(e.em)}</span>
                </li>
              );
            })}
          </ol>
          {eventos.length > EVENTOS_VISIVEIS && (
            <button type="button" onClick={() => setTudo(v => !v)} className={`${LINK} mt-2 hover:text-black/75`}>
              {tudo ? "Ver menos" : `Ver tudo (${eventos.length})`}
            </button>
          )}
        </div>
      )}
      {convidando && <ConvidarModal prestacaoId={prestacaoId} onClose={() => setConvidando(false)} onCriado={() => void recarregar()} />}
      {alterando && <AlterarModal convidado={alterando} onClose={() => setAlterando(null)} onSalvo={() => void recarregar()} />}
    </div>
  );
}
