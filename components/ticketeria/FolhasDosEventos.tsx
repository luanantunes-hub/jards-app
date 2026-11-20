"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria, type ClienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { CLASSIFICACOES_INDICATIVAS } from "@/lib/ticketeria/estados";
import {
  FUSOS_DO_BRASIL, UFS, ROTULO_DA_CLASSIFICACAO, lerEvento, lerLocal, lerSessao, lerSetor, mensagemDoErroDoEvento, partesNoFuso,
} from "@/lib/ticketeria/eventos";

// As folhas da Ticketeria (T2): evento, sessão, local e setor. Criar e editar pela mesma folha; tudo grava ao salvar.

export const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
export const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
export const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const APAGAR = "mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const ARQUIVAR = "mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

export const Aviso = ({ texto }: { texto: string }) => <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;

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

export type EventoEditavel = { id: string; titulo: string; descricao: string | null; imagem_url: string | null; classificacao: string | null };

export function EventoSheet({ organizationId, nomeDaOrganizacao, evento, onClose, onSaved }: { organizationId: string; nomeDaOrganizacao: string; evento?: EventoEditavel; onClose: () => void; onSaved: (id: string) => void }) {
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [imagem, setImagem] = useState(evento?.imagem_url ?? "");
  const [classificacao, setClassificacao] = useState(evento?.classificacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerEvento({ titulo, descricao, imagem, classificacao });
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
        <div><span className={ROTULO}>Classificação indicativa</span><Dropdown ariaLabel="Classificação indicativa" value={classificacao} onChange={setClassificacao} disabled={salvando} placeholder="Sem classificação" options={[{ value: "", label: "Sem classificação" }, ...CLASSIFICACOES_INDICATIVAS.map(c => ({ value: c, label: ROTULO_DA_CLASSIFICACAO[c] }))]} /></div>
        <details className="rounded border border-black/[.08]" open={Boolean(evento?.descricao || evento?.imagem_url)}>
          <summary className="cursor-pointer px-3 py-2.5 text-[0.75rem] font-medium text-black/60">Mais detalhes</summary>
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
export type SessaoEditavel = { id: string; local_id: string; inicio: string; fim: string | null; abertura_portas: string | null };

export function SessaoSheet({ organizationId, eventoId, locais, sessao, podeApagar, onClose, onSaved, onNovoLocal }: {
  organizationId: string; eventoId: string; locais: LocalDaSessao[]; sessao?: SessaoEditavel; podeApagar: boolean;
  onClose: () => void; onSaved: () => void; onNovoLocal: () => void;
}) {
  const emUso = locais.filter(local => !local.arquivado || local.id === sessao?.local_id);
  const [localId, setLocalId] = useState(sessao?.local_id ?? emUso[0]?.id ?? "");
  const fusoInicial = locais.find(local => local.id === (sessao?.local_id ?? emUso[0]?.id))?.fuso ?? "America/Sao_Paulo";
  const inicio = sessao ? partesNoFuso(sessao.inicio, fusoInicial) : { dia: "", hora: "20:00" };
  const [dia, setDia] = useState(inicio.dia);
  const [hora, setHora] = useState(inicio.hora);
  const [fim, setFim] = useState(sessao?.fim ? partesNoFuso(sessao.fim, fusoInicial).hora : "");
  const [portas, setPortas] = useState(sessao?.abertura_portas ? partesNoFuso(sessao.abertura_portas, fusoInicial).hora : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O local recém-criado (pela própria folha) chega depois que a folha abriu: sem escolha, vale o primeiro em uso.
  const localEscolhido = localId || emUso[0]?.id || "";

  async function salvar(fechar: () => void) {
    const local = locais.find(item => item.id === localEscolhido);
    if (!local) { setErro("Escolha o local da sessão."); return; }
    const leitura = lerSessao({ dia, hora, fim, portas }, local.fuso);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    const { error } = sessao
      ? await ticketeria.from("ticketeria_sessoes").update({ local_id: localEscolhido, ...leitura.valor }).eq("id", sessao.id)
      : await ticketeria.from("ticketeria_sessoes").insert({ organization_id: organizationId, evento_id: eventoId, local_id: localEscolhido, ...leitura.valor });
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
          <div className="rounded border border-black/[.08] px-3 py-3 text-[0.75rem] text-black/55">
            Cadastre primeiro o local onde a sessão acontece. <button type="button" onClick={onNovoLocal} className="font-medium text-[#282525] underline underline-offset-2">Novo local</button>
          </div>
        ) : (
          <div><span className={ROTULO}>Local</span><Dropdown ariaLabel="Local da sessão" value={localEscolhido} onChange={setLocalId} disabled={salvando} options={emUso.map(local => ({ value: local.id, label: local.nome }))} /></div>
        )}
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
        <details className="rounded border border-black/[.08]" open={Boolean(local?.endereco || (local && local.fuso !== "America/Sao_Paulo"))}>
          <summary className="cursor-pointer px-3 py-2.5 text-[0.75rem] font-medium text-black/60">Mais detalhes</summary>
          <div className="space-y-4 border-t border-black/[.06] px-3 py-3">
            <div><label className={ROTULO} htmlFor="lo-endereco">Endereço</label><input id="lo-endereco" className={CAMPO} value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro" maxLength={300} disabled={salvando} /></div>
            <div><span className={ROTULO}>Fuso horário</span><Dropdown ariaLabel="Fuso horário" value={fuso} onChange={setFuso} disabled={salvando} options={FUSOS_DO_BRASIL.map(item => ({ value: item.id, label: item.rotulo }))} /></div>
          </div>
        </details>
      </div>
    </TopSheet>
  );
}

export type SetorEditavel = { id: string; nome: string; lugares: number; arquivado: boolean };

export function SetorSheet({ organizationId, localId, setor, onClose, onSaved }: { organizationId: string; localId: string; setor?: SetorEditavel; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [lugares, setLugares] = useState(setor ? String(setor.lugares) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar(fechar: () => void, mudanca?: { arquivado: boolean }) {
    const leitura = lerSetor({ nome, lugares });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    const { error } = setor
      ? await ticketeria.from("ticketeria_setores").update({ ...leitura.valor, ...mudanca }).eq("id", setor.id)
      : await ticketeria.from("ticketeria_setores").insert({ organization_id: organizationId, local_id: localId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoEvento(error)); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo={setor ? "Editar setor" : "Novo setor"}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={setor ? "Salvar" : "Criar setor"} onSalvar={() => void gravar(fechar)} onApagar={setor ? () => void gravar(fechar, { arquivado: !setor.arquivado }) : undefined} rotuloApagar={setor?.arquivado ? "Tirar do arquivo" : "Arquivar"} arquivar />}
    >
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div><label className={ROTULO} htmlFor="st-nome">Nome</label><input id="st-nome" autoFocus className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} placeholder="Plateia" maxLength={120} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="st-lugares">Lugares</label><input id="st-lugares" inputMode="numeric" className={CAMPO} value={lugares} onChange={e => setLugares(e.target.value)} placeholder="300" disabled={salvando} /></div>
        </div>
        <p className="text-[0.75rem] text-black/55">A capacidade do local é a soma dos setores. Assento marcado vem depois.</p>
      </div>
    </TopSheet>
  );
}
