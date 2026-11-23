"use client";

import { useEffect, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria, type ClienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { salaDaSessao, salasDoEspaco, type SalaDoEspaco } from "@/lib/ticketeria/salas";
import { CLASSIFICACOES_INDICATIVAS } from "@/lib/ticketeria/estados";
import {
  FUSOS_DO_BRASIL, UFS, ROTULO_DA_CLASSIFICACAO, lerEvento, lerLocal, lerSessao, mensagemDoErroDoEvento, partesNoFuso,
} from "@/lib/ticketeria/eventos";

// As folhas da Ticketeria (T2): evento, sessão, local e setor. Criar e editar pela mesma folha; tudo grava ao salvar.

export const CAMPO = "h-10 w-full rounded-xl border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
export const AREA = "w-full rounded-xl border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
export const ROTULO = "mb-1.5 block text-[0.6875rem] font-normal text-black/55";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded-xl acao-salvar px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const APAGAR = "mr-auto rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const ARQUIVAR = "mr-auto rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

export const Aviso = ({ texto }: { texto: string }) => <p role="alert" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;

export function Rodape({ fechar, salvando, rotulo, onSalvar, onApagar, rotuloApagar, arquivar = false }: { fechar: () => void; salvando: boolean; rotulo: string; onSalvar: () => void; onApagar?: () => void; rotuloApagar?: string; arquivar?: boolean }) {
  return (
    <>
      {onApagar && <button type="button" onClick={onApagar} disabled={salvando} className={arquivar ? ARQUIVAR : APAGAR}>{rotuloApagar ?? "Apagar"}</button>}
      <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
      <button type="button" onClick={onSalvar} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : rotulo}</button>
    </>
  );
}

/** A loja da organização; cria com o nome da organização se ainda não houver (a loja nasce do primeiro evento ou local). */
export async function garantirLoja(ticketeria: ClienteDaTicketeria, organizationId: string, nome: string): Promise<string | { erro: string }> {
  const { data } = await ticketeria.from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
  if (data) return data.id;
  const { data: nova, error } = await ticketeria.from("ticketeria_lojas").insert({ organization_id: organizationId, nome: nome.trim().slice(0, 120) || "Loja" }).select("id").single();
  if (error || !nova) return { erro: mensagemDoErroDoEvento(error ?? {}) };
  return nova.id;
}

// ─── Evento ─────────────────────────────────────────────────────────────────

export type EventoEditavel = { id: string; titulo: string; descricao: string | null; imagem_url: string | null; classificacao: string | null; artista?: string | null; loja_id?: string };

export function EventoSheet({ organizationId, nomeDaOrganizacao, evento, onClose, onSaved }: { organizationId: string; nomeDaOrganizacao: string; evento?: EventoEditavel; onClose: () => void; onSaved: (id: string) => void }) {
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [imagem, setImagem] = useState(evento?.imagem_url ?? "");
  const [classificacao, setClassificacao] = useState(evento?.classificacao ?? "");
  const [artista, setArtista] = useState(evento?.artista ?? "");
  const historico = useHistoricoDoArtista(organizationId, evento?.loja_id ?? null, artista, evento?.id ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerEvento({ titulo, descricao, imagem, classificacao, artista });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    if (evento) {
      const { error } = await ticketeria.from("ticketeria_eventos").update(leitura.valor).eq("id", evento.id);
      setSalvando(false);
      if (error) { setErro(mensagemDoErroDoEvento(error)); return; }
      onSaved(evento.id);
      fechar();
      return;
    }
    const loja = await garantirLoja(ticketeria, organizationId, nomeDaOrganizacao);
    if (typeof loja !== "string") { setSalvando(false); setErro(loja.erro); return; }
    const { data, error } = await ticketeria.from("ticketeria_eventos").insert({ organization_id: organizationId, loja_id: loja, ...leitura.valor }).select("id").single();
    setSalvando(false);
    if (error || !data) { setErro(mensagemDoErroDoEvento(error ?? {})); return; }
    onSaved(data.id);
  }

  return (
    <TopSheet titulo={evento ? "Editar evento" : "Novo evento"} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={evento ? "Salvar" : "Criar evento"} onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor="ev-titulo">Título</label><input id="ev-titulo" autoFocus className={CAMPO} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Hamlet" maxLength={200} disabled={salvando} /></div>
        <div>
          <label className={ROTULO} htmlFor="ev-artista">Artista ou companhia (opcional)</label>
          <input id="ev-artista" className={CAMPO} value={artista} onChange={e => setArtista(e.target.value)} placeholder="Cia. Atores de Mar" maxLength={120} disabled={salvando} />
          <p className="mt-1.5 text-[0.6875rem] text-black/45">Serve para o Jards mostrar como esse artista já vendeu na sua casa. Não é um rótulo: é só o nome.</p>
          {historico && historico.length > 0 && (
            <div className="mt-2.5 rounded-xl border px-3.5 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="flex items-center justify-between gap-3"><p className="text-[0.8125rem] text-[#282525]">{artista.trim()} na sua casa</p><span className="inline-flex shrink-0 items-center rounded-xl border px-2 py-0.5 text-[0.625rem]" style={{ color: "#2E8932", borderColor: "rgba(46,137,50,.35)" }}>medido</span></div>
              <p className="mt-1 text-[0.75rem] leading-relaxed text-black/50">Já se apresentou aqui {historico.length === 1 ? "1 vez" : `${historico.length} vezes`}: {historico.map((h, i) => <span key={h.eventoId}>{i > 0 ? (i === historico.length - 1 ? " e " : ", ") : ""}<span className="text-[#282525]">{h.titulo}</span>{h.lotacao !== null ? ` (${Math.round(h.lotacao * 100)}% da lotação)` : ""}</span>)}.</p>
            </div>
          )}
        </div>
        <div><span className={ROTULO}>Classificação indicativa</span><Dropdown ariaLabel="Classificação indicativa" value={classificacao} onChange={setClassificacao} disabled={salvando} placeholder="Sem classificação" options={[{ value: "", label: "Sem classificação" }, ...CLASSIFICACOES_INDICATIVAS.map(c => ({ value: c, label: ROTULO_DA_CLASSIFICACAO[c] }))]} /></div>
        <details className="rounded-xl border border-black/[.08]" open={Boolean(evento?.descricao || evento?.imagem_url)}>
          <summary className="cursor-pointer px-3 py-2.5 text-[0.75rem] font-normal text-black/60">Mais detalhes</summary>
          <div className="space-y-4 border-t border-black/[.06] px-3 py-3">
            <div><label className={ROTULO} htmlFor="ev-descricao">Descrição</label><textarea id="ev-descricao" rows={5} className={AREA} value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={5000} disabled={salvando} /></div>
            <div><label className={ROTULO} htmlFor="ev-imagem">Imagem (https://…)</label><input id="ev-imagem" className={CAMPO} value={imagem} onChange={e => setImagem(e.target.value)} placeholder="https://…/cartaz.jpg" maxLength={500} disabled={salvando} /></div>
          </div>
        </details>
      </div>
    </TopSheet>
  );
}

// ─── Sessão ─────────────────────────────────────────────────────────────────

export type LocalDaSessao = { id: string; nome: string; fuso: string; arquivado: boolean };
export type SessaoEditavel = { id: string; local_id: string; sala_id: string; inicio: string; fim: string | null; abertura_portas: string | null };

export function SessaoSheet({ organizationId, eventoId, locais, salas = [], sessao, sugestao, podeApagar, onClose, onSaved, onNovoLocal }: {
  organizationId: string; eventoId: string; locais: LocalDaSessao[]; /** As salas dos espaços: com mais de uma no espaço, a sessão escolhe a sala. */ salas?: SalaDoEspaco[]; sessao?: SessaoEditavel; podeApagar: boolean;
  /** Sessão nova já preenchida (o "e se eu acrescentar uma sessão?"): dia e hora no fuso do local, e o espaço e a sala. */ sugestao?: { dia: string; hora: string; localId?: string; salaId?: string };
  onClose: () => void; onSaved: () => void; onNovoLocal: () => void;
}) {
  const emUso = locais.filter(local => !local.arquivado || local.id === sessao?.local_id);
  const localSugerido = sugestao?.localId && emUso.some(local => local.id === sugestao.localId) ? sugestao.localId : undefined;
  const [localId, setLocalId] = useState(sessao?.local_id ?? localSugerido ?? emUso[0]?.id ?? "");
  const fusoInicial = locais.find(local => local.id === (sessao?.local_id ?? localSugerido ?? emUso[0]?.id))?.fuso ?? "America/Sao_Paulo";
  const inicio = sessao ? partesNoFuso(sessao.inicio, fusoInicial) : sugestao ? { dia: sugestao.dia, hora: sugestao.hora } : { dia: "", hora: "20:00" };
  const [dia, setDia] = useState(inicio.dia);
  const [hora, setHora] = useState(inicio.hora);
  const [fim, setFim] = useState(sessao?.fim ? partesNoFuso(sessao.fim, fusoInicial).hora : "");
  const [portas, setPortas] = useState(sessao?.abertura_portas ? partesNoFuso(sessao.abertura_portas, fusoInicial).hora : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O local recém-criado (pela própria folha) chega depois que a folha abriu: sem escolha, vale o primeiro em uso.
  const localEscolhido = localId || emUso[0]?.id || "";
  const [salaId, setSalaId] = useState(sessao?.sala_id ?? sugestao?.salaId ?? "");
  const salasDoLocal = salasDoEspaco(salas, localEscolhido, sessao?.sala_id);
  // A sala escolhida vale se for do espaço; senão (espaço trocado, ou ainda sem escolha) a primeira em uso.
  const salaEscolhida = salaDaSessao(salas, localEscolhido, salaId);

  async function salvar(fechar: () => void) {
    const local = locais.find(item => item.id === localEscolhido);
    if (!local) { setErro("Escolha o local da sessão."); return; }
    const leitura = lerSessao({ dia, hora, fim, portas }, local.fuso);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    const { error } = sessao
      ? await ticketeria.from("ticketeria_sessoes").update({ local_id: localEscolhido, ...(salaEscolhida ? { sala_id: salaEscolhida } : {}), ...leitura.valor }).eq("id", sessao.id)
      : await ticketeria.from("ticketeria_sessoes").insert({ organization_id: organizationId, evento_id: eventoId, local_id: localEscolhido, ...(salaEscolhida ? { sala_id: salaEscolhida } : {}), ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoEvento(error)); return; }
    onSaved();
    fechar();
  }

  async function apagar(fechar: () => void) {
    if (!sessao) return;
    setSalvando(true);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_sessoes").delete().eq("id", sessao.id);
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoEvento(error)); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo={sessao ? "Editar sessão" : "Nova sessão"} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={sessao ? "Salvar" : "Criar sessão"} onSalvar={() => void salvar(fechar)} onApagar={sessao && podeApagar ? () => void apagar(fechar) : undefined} rotuloApagar="Apagar a sessão" />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {emUso.length === 0 ? (
          <div className="rounded-xl border border-black/[.08] px-3 py-3 text-[0.75rem] text-black/55">
            Cadastre primeiro o local onde a sessão acontece. <button type="button" onClick={onNovoLocal} className="font-normal text-[#282525] underline underline-offset-2">Novo local</button>
          </div>
        ) : (
          <div><span className={ROTULO}>Local</span><Dropdown ariaLabel="Local da sessão" value={localEscolhido} onChange={setLocalId} disabled={salvando} options={emUso.map(local => ({ value: local.id, label: local.nome }))} /></div>
        )}
        {salasDoLocal.length > 1 && <div><span className={ROTULO}>Sala</span><Dropdown ariaLabel="Sala da sessão" value={salaEscolhida} onChange={setSalaId} disabled={salvando} options={salasDoLocal.map(sala => ({ value: sala.id, label: sala.arquivado ? `${sala.nome} (arquivada)` : sala.nome }))} /></div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor="se-dia">Dia</label><input id="se-dia" type="date" autoFocus className={CAMPO} value={dia} onChange={e => setDia(e.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="se-hora">Início</label><input id="se-hora" type="time" className={CAMPO} value={hora} onChange={e => setHora(e.target.value)} disabled={salvando} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor="se-portas">Portas abrem (opcional)</label><input id="se-portas" type="time" className={CAMPO} value={portas} onChange={e => setPortas(e.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="se-fim">Fim (opcional)</label><input id="se-fim" type="time" className={CAMPO} value={fim} onChange={e => setFim(e.target.value)} disabled={salvando} /></div>
        </div>
        <p className="text-[0.75rem] text-black/55">Horas no fuso do local. Um fim antes do início termina no dia seguinte.</p>
      </div>
    </TopSheet>
  );
}

// ─── Local e setor ──────────────────────────────────────────────────────────

export type LocalEditavel = { id: string; nome: string; endereco: string | null; cidade: string | null; uf: string | null; fuso: string; arquivado: boolean };

export function LocalSheet({ organizationId, nomeDaOrganizacao, local, onClose, onSaved }: { organizationId: string; nomeDaOrganizacao: string; local?: LocalEditavel; onClose: () => void; onSaved: (id: string) => void }) {
  const [nome, setNome] = useState(local?.nome ?? "");
  const [endereco, setEndereco] = useState(local?.endereco ?? "");
  const [cidade, setCidade] = useState(local?.cidade ?? "");
  const [uf, setUf] = useState(local?.uf ?? "");
  const [fuso, setFuso] = useState(local?.fuso ?? "America/Sao_Paulo");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar(fechar: () => void, mudanca?: { arquivado: boolean }) {
    const leitura = lerLocal({ nome, endereco, cidade, uf, fuso });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    if (local) {
      const { error } = await ticketeria.from("ticketeria_locais").update({ ...leitura.valor, ...mudanca }).eq("id", local.id);
      setSalvando(false);
      if (error) { setErro(mensagemDoErroDoEvento(error)); return; }
      onSaved(local.id);
      fechar();
      return;
    }
    const loja = await garantirLoja(ticketeria, organizationId, nomeDaOrganizacao);
    if (typeof loja !== "string") { setSalvando(false); setErro(loja.erro); return; }
    const { data, error } = await ticketeria.from("ticketeria_locais").insert({ organization_id: organizationId, loja_id: loja, ...leitura.valor }).select("id").single();
    setSalvando(false);
    if (error || !data) { setErro(mensagemDoErroDoEvento(error ?? {})); return; }
    onSaved(data.id);
    fechar();
  }

  return (
    <TopSheet
      titulo={local ? "Editar local" : "Novo local"}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={local ? "Salvar" : "Criar local"} onSalvar={() => void gravar(fechar)} onApagar={local ? () => void gravar(fechar, { arquivado: !local.arquivado }) : undefined} rotuloApagar={local?.arquivado ? "Tirar do arquivo" : "Arquivar"} arquivar />}
    >
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor="lo-nome">Nome</label><input id="lo-nome" autoFocus className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} placeholder="Teatro Central" maxLength={200} disabled={salvando} /></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <div><label className={ROTULO} htmlFor="lo-cidade">Cidade</label><input id="lo-cidade" className={CAMPO} value={cidade} onChange={e => setCidade(e.target.value)} maxLength={120} disabled={salvando} /></div>
          <div><span className={ROTULO}>UF</span><Dropdown ariaLabel="Estado" value={uf} onChange={setUf} disabled={salvando} placeholder="—" options={[{ value: "", label: "—" }, ...UFS.map(item => ({ value: item, label: item }))]} /></div>
        </div>
        <details className="rounded-xl border border-black/[.08]" open={Boolean(local?.endereco || (local && local.fuso !== "America/Sao_Paulo"))}>
          <summary className="cursor-pointer px-3 py-2.5 text-[0.75rem] font-normal text-black/60">Mais detalhes</summary>
          <div className="space-y-4 border-t border-black/[.06] px-3 py-3">
            <div><label className={ROTULO} htmlFor="lo-endereco">Endereço</label><input id="lo-endereco" className={CAMPO} value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro" maxLength={300} disabled={salvando} /></div>
            <div><span className={ROTULO}>Fuso horário</span><Dropdown ariaLabel="Fuso horário" value={fuso} onChange={setFuso} disabled={salvando} options={FUSOS_DO_BRASIL.map(item => ({ value: item.id, label: item.rotulo }))} /></div>
          </div>
        </details>
      </div>
    </TopSheet>
  );
}


/** As apresentações anteriores do artista na casa (rota /artista da loja), conferidas meio segundo depois de parar de digitar. null enquanto não há nome ou loja. */
function useHistoricoDoArtista(organizationId: string, lojaInicial: string | null, artista: string, excluir: string | null): { eventoId: string; titulo: string; lotacao: number | null }[] | null {
  const [loja, setLoja] = useState<string | null>(lojaInicial);
  const [historico, setHistorico] = useState<{ eventoId: string; titulo: string; lotacao: number | null }[] | null>(null);
  useEffect(() => {
    if (loja) return;
    let ativo = true;
    void clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle().then(({ data }) => { if (ativo && data) setLoja(data.id); });
    return () => { ativo = false; };
  }, [loja, organizationId]);
  useEffect(() => {
    const nome = artista.trim();
    if (!loja || nome.length < 2) return;
    let ativo = true;
    const espera = setTimeout(() => {
      void fetch(`/api/ticketeria/lojas/${loja}/artista?nome=${encodeURIComponent(nome)}${excluir ? `&excluir=${excluir}` : ""}`, { cache: "no-store" })
        .then(r => (r.ok ? r.json() : { apresentacoes: [] }))
        .then((d: { apresentacoes?: { eventoId: string; titulo: string; lotacao: number | null }[] }) => { if (ativo) setHistorico(d.apresentacoes ?? []); })
        .catch(() => { if (ativo) setHistorico(null); });
    }, 500);
    return () => { ativo = false; clearTimeout(espera); };
  }, [loja, artista, excluir]);
  return artista.trim().length < 2 ? null : historico;
}
