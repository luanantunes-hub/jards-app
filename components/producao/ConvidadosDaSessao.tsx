"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, Plus, Settings2, Ticket, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { SituacaoDoConvidado } from "@/lib/producao/estados";
import {
  lerConvidado, lerCorte, lerTipo, mensagemDoErroDeConvidado, mensagemDoLinkDePedidos, resumoDosConvidados, ROTULO_DA_SITUACAO_DO_CONVIDADO, saldoDosTipos,
  type ConvidadoDaSessao, type SaldoDoTipo, type TipoDeCredencial,
} from "@/lib/producao/convidados";
import { formatarCodigo, mensagemDaCredencial, presencaDaSessao } from "@/lib/producao/credenciais";

type Credencial = { convidado_id: string; entradas: number; revogada_em: string | null };
type CodigoNovo = { nome: string; lugares: number; codigo: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

function Erro({ texto }: { texto: string }) {
  return <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;
}

/** Os tipos de credencial da casa: criar, mudar o nome e a cota, arquivar ou voltar a usar, apagar o que nunca foi usado. */
function TiposSheet({ organizationId, tipos, onClose, onMudou }: { organizationId: string; tipos: TipoDeCredencial[]; onClose: () => void; onMudou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState("");
  const [cota, setCota] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function limpar() { setNome(""); setCota(""); setEditando(null); }

  async function salvar() {
    const leitura = lerTipo({ nome, cota });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = editando
      ? await producao.from("producao_credencial_tipos").update(leitura.valor).eq("id", editando)
      : await producao.from("producao_credencial_tipos").insert({ organization_id: organizationId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeConvidado(error)); return; }
    limpar();
    onMudou();
  }

  async function arquivar(tipo: TipoDeCredencial) {
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_credencial_tipos").update({ arquivado: !tipo.arquivado }).eq("id", tipo.id);
    if (error) { setErro(mensagemDoErroDeConvidado(error)); return; }
    onMudou();
  }

  function apagar(tipo: TipoDeCredencial) {
    confirmDelete({
      title: "Apagar tipo de credencial?",
      description: `“${tipo.nome}” sai da lista. Se já houver convidados com esse tipo, o banco recusa: arquive em vez de apagar.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_credencial_tipos").delete().eq("id", tipo.id);
        if (error) throw new Error(mensagemDoErroDeConvidado(error));
        onMudou();
      },
    });
  }

  return (
    <TopSheet titulo="Tipos de credencial" onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>}>
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <p className="text-[0.75rem] text-black/55">Cada tipo tem uma cota de lugares por sessão (Imprensa, Convidado do elenco, Parceiros...). Deixe a cota vazia para não limitar.</p>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div><label className={ROTULO} htmlFor="tipo-nome">{editando ? "Nome do tipo" : "Novo tipo"}</label><input id="tipo-nome" className={CAMPO} value={nome} maxLength={60} onChange={event => setNome(event.target.value)} disabled={salvando} placeholder="Imprensa" /></div>
          <div><label className={ROTULO} htmlFor="tipo-cota">Cota por sessão</label><input id="tipo-cota" inputMode="numeric" className={CAMPO} value={cota} onChange={event => setCota(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="Sem limite" /></div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void salvar()} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : editando ? "Salvar tipo" : "Adicionar tipo"}</button>
          {editando && <button type="button" onClick={limpar} className={CANCELAR}>Cancelar edição</button>}
        </div>
        {tipos.length > 0 && (
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {tipos.map(tipo => (
              <li key={tipo.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                <span className={`min-w-0 flex-1 basis-40 truncate text-[0.8125rem] ${tipo.arquivado ? "text-black/40" : "font-medium text-[#282525]"}`}>{tipo.nome}{tipo.arquivado ? " (arquivado)" : ""}</span>
                <span className="w-24 text-[0.75rem] tabular-nums text-black/55">{tipo.cota_por_sessao === null ? "sem limite" : `${tipo.cota_por_sessao} por sessão`}</span>
                <span className="flex gap-1.5">
                  <button type="button" className={BOTAO_PEQUENO} onClick={() => { setEditando(tipo.id); setNome(tipo.nome); setCota(tipo.cota_por_sessao === null ? "" : String(tipo.cota_por_sessao)); setErro(null); }}>Editar</button>
                  <button type="button" className={BOTAO_PEQUENO} onClick={() => void arquivar(tipo)}>{tipo.arquivado ? "Usar de novo" : "Arquivar"}</button>
                  <button type="button" className={`${BOTAO_PEQUENO} text-[#B23B3B]`} onClick={() => apagar(tipo)}>Apagar</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TopSheet>
  );
}

/** Convidar alguém para a sessão (ou editar o convite): só nome e afiliação, o tipo e quantos lugares. */
function ConvidadoSheet({ organizationId, sessaoId, tipos, saldos, convidado, onClose, onSalvou }: {
  organizationId: string; sessaoId: string; tipos: TipoDeCredencial[]; saldos: SaldoDoTipo[]; convidado: ConvidadoDaSessao | null; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const usaveis = useMemo(() => tipos.filter(tipo => !tipo.arquivado || tipo.id === convidado?.tipo_id), [tipos, convidado]);
  const [nome, setNome] = useState(convidado?.nome ?? "");
  const [afiliacao, setAfiliacao] = useState(convidado?.afiliacao ?? "");
  const [quantidade, setQuantidade] = useState(String(convidado?.quantidade ?? 1));
  const [tipoId, setTipoId] = useState(convidado?.tipo_id ?? (usaveis.length === 1 ? usaveis[0].id : ""));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const saldoDoTipo = saldos.find(saldo => saldo.tipoId === tipoId);

  async function salvar(fechar: () => void) {
    const leitura = lerConvidado({ nome, afiliacao, quantidade, tipoId });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = convidado
      ? await producao.from("producao_convidados").update(leitura.valor).eq("id", convidado.id)
      : await producao.from("producao_convidados").insert({ organization_id: organizationId, sessao_id: sessaoId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeConvidado(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!convidado) return;
    confirmDelete({
      title: "Apagar convidado?",
      description: `${convidado.nome} sai da lista desta sessão e o lugar volta para a cota.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_convidados").delete().eq("id", convidado.id);
        if (error) throw new Error("Não foi possível apagar o convidado.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={convidado ? "Editar convidado" : "Convidar para a sessão"}
      onClose={onClose}
      footer={fechar => (
        <>
          {convidado && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : convidado ? "Salvar" : "Convidar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div><label className={ROTULO} htmlFor="conv-nome">Nome do convidado</label><input id="conv-nome" className={CAMPO} value={nome} maxLength={120} onChange={event => setNome(event.target.value)} disabled={salvando} /></div>
        <div><label className={ROTULO} htmlFor="conv-afiliacao">Afiliação (opcional)</label><input id="conv-afiliacao" className={CAMPO} value={afiliacao} maxLength={120} onChange={event => setAfiliacao(event.target.value)} disabled={salvando} placeholder="Veículo, empresa ou grupo" /></div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <span className={ROTULO}>Tipo de credencial</span>
            <Dropdown ariaLabel="Tipo de credencial" value={tipoId} onChange={setTipoId} disabled={salvando} options={[{ value: "", label: "Escolha o tipo" }, ...usaveis.map(tipo => ({ value: tipo.id, label: tipo.nome }))]} />
          </div>
          <div><label className={ROTULO} htmlFor="conv-quantidade">Lugares</label><input id="conv-quantidade" inputMode="numeric" className={CAMPO} value={quantidade} onChange={event => setQuantidade(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
        </div>
        {saldoDoTipo && saldoDoTipo.cota !== null && (
          <p className="text-[0.75rem] tabular-nums text-black/55">{saldoDoTipo.usados} de {saldoDoTipo.cota} lugares usados nesta sessão{saldoDoTipo.saldo !== null && saldoDoTipo.saldo >= 0 ? ` · ${saldoDoTipo.saldo} livres` : ""}.</p>
        )}
        <p className="text-[0.6875rem] text-black/45">Lugares incluem a pessoa e os acompanhantes. Não escreva documento, telefone ou dados de saúde aqui.</p>
      </div>
    </TopSheet>
  );
}

type LinkDePedidos = { id: string; titulo: string | null; corte_em: string; limite: number; revogado_em: string | null };

const doisDigitos = (n: number) => String(n).padStart(2, "0");
/** O valor de um campo de data e hora ("2026-12-03T18:00") para um instante, no horário de quem está na tela. */
const paraCampoDeDataEHora = (data: Date) => `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
const textoDoCorte = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Gera (ou renova) o link para a equipe, a companhia ou a assessoria pedirem convidados até um horário de corte. O link aparece só uma vez. */
function LinkDePedidosSheet({ sessaoId, sessaoRotulo, ativo, onClose, onGerou }: { sessaoId: string; sessaoRotulo: string; ativo: LinkDePedidos | null; onClose: () => void; onGerou: () => void }) {
  const [corte, setCorte] = useState(() => {
    if (ativo && new Date(ativo.corte_em).getTime() > Date.now()) return paraCampoDeDataEHora(new Date(ativo.corte_em));
    const padrao = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    padrao.setHours(18, 0, 0, 0);
    return paraCampoDeDataEHora(padrao);
  });
  const [titulo, setTitulo] = useState(ativo?.titulo ?? "");
  const [limite, setLimite] = useState(ativo ? String(ativo.limite) : "");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    const leitura = lerCorte(corte, Date.now());
    if (!leitura.ok) { setErro(leitura.erro); return; }
    const semLimite = limite.trim() === "";
    const quantos = semLimite ? 0 : Number(limite);
    if (!semLimite && (!Number.isInteger(quantos) || quantos < 1 || quantos > 500)) { setErro("O limite é um número de 1 a 500, ou deixe vazio para aceitar até 100 pedidos."); return; }
    setGerando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_convidados_gerar_link", { p_sessao: sessaoId, p_corte: leitura.iso, p_titulo: titulo.trim(), p_limite: quantos });
    setGerando(false);
    if (error || typeof data !== "string") { setErro(error?.code === "42501" ? "Você não pode criar links aqui." : "Não foi possível gerar o link. Tente de novo."); return; }
    setMensagem(mensagemDoLinkDePedidos({ sessao: sessaoRotulo, corte: textoDoCorte(leitura.iso), url: `${window.location.origin}/convidar/${data}` }));
    onGerou();
  }

  async function copiar() {
    if (!mensagem) return;
    try { await navigator.clipboard.writeText(mensagem); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  return (
    <TopSheet
      titulo={ativo ? "Novo link de pedidos" : "Link de pedidos"}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={gerando} className={CANCELAR}>{mensagem ? "Fechar" : "Cancelar"}</button>
          {!mensagem && <button type="button" onClick={() => void gerar()} disabled={gerando} className={SALVAR}>{gerando ? "Gerando…" : "Gerar link"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {!mensagem ? (
          <>
            <p className="text-[0.75rem] text-black/55">Um link para esta sessão: quem recebe escolhe o tipo de credencial e pede os convidados pelo nome, até o horário de corte. Cada pedido chega aqui como “pedido” para você confirmar ou recusar; a cota de cada tipo continua valendo.{ativo ? " Gerar um novo desativa o link anterior." : ""}</p>
            <div><label className={ROTULO} htmlFor="ped-corte">Pedidos até</label><input id="ped-corte" type="datetime-local" className={CAMPO} value={corte} onChange={event => setCorte(event.target.value)} disabled={gerando} /></div>
            <div><label className={ROTULO} htmlFor="ped-titulo">Título da chamada (opcional)</label><input id="ped-titulo" className={CAMPO} value={titulo} maxLength={120} onChange={event => setTitulo(event.target.value)} disabled={gerando} placeholder="Pedir convidados" /></div>
            <div><label className={ROTULO} htmlFor="ped-limite">Máximo de pedidos (opcional)</label><input id="ped-limite" inputMode="numeric" className={CAMPO} value={limite} onChange={event => setLimite(event.target.value.replace(/\D/g, ""))} disabled={gerando} placeholder="Até 100" /></div>
          </>
        ) : (
          <>
            <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>O link aparece só agora. Copie e mande antes de fechar; depois, para ter o endereço de novo, gere um link novo.</p>
            <p className="whitespace-pre-line break-words rounded border bg-black/[.03] px-3 py-2.5 text-[0.75rem] text-[#282525]" style={{ borderColor: "rgba(13,13,13,.1)" }}>{mensagem}</p>
            <button type="button" onClick={() => void copiar()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiada" : "Copiar mensagem"}</button>
          </>
        )}
      </div>
    </TopSheet>
  );
}

/** Os códigos das credenciais, que aparecem só uma vez: copiar a mensagem de cada convidado ou todas de uma vez. */
function CodigosSheet({ titulo, itens, sessaoRotulo, onClose }: { titulo: string; itens: CodigoNovo[]; sessaoRotulo: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mensagens = itens.map(item => ({ ...item, texto: mensagemDaCredencial({ nome: item.nome, sessao: sessaoRotulo, codigo: item.codigo, lugares: item.lugares, url: `${window.location.origin}/credencial/${item.codigo}` }) }));

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
    <TopSheet titulo={titulo} onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>}>
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {itens.length === 0 ? (
          <p className="text-[0.8125rem] text-black/55">Todos os convidados confirmados já têm credencial. Para mandar o código de novo a alguém, use “Trocar código” na linha dele.</p>
        ) : (
          <>
            <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>Os códigos aparecem só agora. Copie e mande por WhatsApp ou e-mail antes de fechar; depois, para ter o código de novo, use “Trocar código” (o anterior deixa de valer).</p>
            {mensagens.length > 1 && <button type="button" onClick={() => void copiar("todas", mensagens.map(item => item.texto).join("\n\n"))} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado === "todas" ? "Copiadas" : "Copiar todas as mensagens"}</button>}
            <ul className="space-y-3">
              {mensagens.map(item => (
                <li key={item.codigo} className="rounded border p-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  <p className="text-[0.8125rem] font-medium text-[#282525]">{item.nome}</p>
                  <p className="mt-1 text-[1.125rem] font-semibold tabular-nums tracking-[.06em] text-[#282525]">{formatarCodigo(item.codigo)}</p>
                  <p className="mt-1 break-words text-[0.75rem] text-black/60">{item.texto}</p>
                  <button type="button" onClick={() => void copiar(item.codigo, item.texto)} className={`${BOTAO} mt-2`}><Copy size={13} aria-hidden="true" /> {copiado === item.codigo ? "Copiada" : "Copiar mensagem"}</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </TopSheet>
  );
}

/** Os convidados de uma sessão (PD7.2): o saldo de cada tipo contra a cota, quem foi convidado e a decisão da produção (confirmar ou recusar). Com as credenciais da porta (PD7.3). */
export function ConvidadosDaSessao({ organizationId, sessaoId, sessaoRotulo, podeEditar }: { organizationId: string; sessaoId: string; sessaoRotulo: string; podeEditar: boolean }) {
  const [tipos, setTipos] = useState<TipoDeCredencial[] | null>(null);
  const [convidados, setConvidados] = useState<ConvidadoDaSessao[] | null>(null);
  const [credenciais, setCredenciais] = useState<Credencial[]>([]);
  const [codigos, setCodigos] = useState<{ titulo: string; itens: CodigoNovo[] } | null>(null);
  const [linkDePedidos, setLinkDePedidos] = useState<LinkDePedidos | null>(null);
  const [linkAberto, setLinkAberto] = useState(false);
  const [agora] = useState(() => Date.now());
  const [folha, setFolha] = useState<{ convidado: ConvidadoDaSessao | null } | null>(null);
  const [tiposAbertos, setTiposAbertos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [tip, con, cre, lnk] = await Promise.all([
        producao.from("producao_credencial_tipos").select("id, nome, cota_por_sessao, arquivado").eq("organization_id", organizationId).order("nome"),
        producao.from("producao_convidados").select("id, tipo_id, nome, afiliacao, quantidade, situacao, solicitante").eq("sessao_id", sessaoId).order("nome"),
        producao.from("producao_credenciais").select("convidado_id, entradas, revogada_em").eq("sessao_id", sessaoId),
        producao.from("producao_convidados_links").select("id, titulo, corte_em, limite, revogado_em").eq("sessao_id", sessaoId).maybeSingle(),
      ]);
      if (!ativo) return;
      setTipos(tip.data ?? []);
      setConvidados(con.data ?? []);
      setCredenciais(cre.data ?? []);
      setLinkDePedidos(lnk.data ?? null);
      setErro(tip.error || con.error || cre.error || lnk.error ? "Não foi possível carregar os convidados. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, sessaoId, versao]);

  const saldos = useMemo(() => saldoDosTipos(tipos ?? [], convidados ?? []), [tipos, convidados]);
  const resumo = useMemo(() => resumoDosConvidados(convidados ?? []), [convidados]);
  const nomesDosTipos = useMemo(() => new Map((tipos ?? []).map(tipo => [tipo.id, tipo.nome])), [tipos]);
  const recarregar = () => setVersao(atual => atual + 1);
  const credencialPorConvidado = useMemo(() => new Map(credenciais.map(credencial => [credencial.convidado_id, credencial])), [credenciais]);
  const presenca = useMemo(() => presencaDaSessao(convidados ?? [], credenciais), [convidados, credenciais]);

  async function emitir() {
    setTrabalhando("emitir");
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_credenciais_emitir", { p_sessao: sessaoId });
    setTrabalhando(null);
    if (error) { setErro(error.code === "42501" ? "Você não pode emitir credenciais aqui." : "Não foi possível emitir as credenciais. Tente de novo."); return; }
    const lista = (Array.isArray(data) ? data : []) as { nome: string; lugares: number; codigo: string }[];
    setCodigos({ titulo: "Credenciais emitidas", itens: lista.map(item => ({ nome: item.nome, lugares: item.lugares, codigo: item.codigo })) });
    recarregar();
  }

  async function encerrarPedidos() {
    if (!linkDePedidos) return;
    setTrabalhando("link");
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_convidados_links").update({ revogado_em: new Date().toISOString() }).eq("id", linkDePedidos.id);
    setTrabalhando(null);
    if (error) { setErro("Não foi possível encerrar os pedidos. Tente de novo."); return; }
    recarregar();
  }

  async function trocarCodigo(convidado: ConvidadoDaSessao) {
    setTrabalhando(convidado.id);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_credencial_reemitir", { p_convidado: convidado.id });
    setTrabalhando(null);
    if (error || typeof data !== "string") { setErro(error?.code === "42501" ? "Você não pode trocar o código aqui." : "Não foi possível trocar o código. Tente de novo."); return; }
    setCodigos({ titulo: `Novo código de ${convidado.nome}`, itens: [{ nome: convidado.nome, lugares: convidado.quantidade, codigo: data }] });
    recarregar();
  }

  async function mudarSituacao(convidado: ConvidadoDaSessao, situacao: SituacaoDoConvidado) {
    setTrabalhando(convidado.id);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_convidados").update({ situacao }).eq("id", convidado.id);
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeConvidado(error)); return; }
    recarregar();
  }

  if (tipos === null || convidados === null) return <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  return (
    <div className="space-y-5">
      {erro && <Erro texto={erro} />}

      <section aria-labelledby="cotas">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="cotas" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Cotas por tipo</h2>
          {podeEditar && <button type="button" onClick={() => setTiposAbertos(true)} className={BOTAO}><Settings2 size={13} aria-hidden="true" /> Tipos de credencial</button>}
        </div>
        {saldos.length === 0 ? (
          <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhum tipo de credencial ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Crie os tipos da casa (Imprensa, Convidado do elenco...) com a cota de lugares por sessão. Depois é só convidar.</p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {saldos.map(saldo => (
              <li key={saldo.tipoId} className="rounded border bg-white px-4 py-3" style={{ borderColor: saldo.estado === "estourada" ? "#B07A1447" : "rgba(13,13,13,.08)" }}>
                <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{saldo.nome}{saldo.arquivado ? " · arquivado" : ""}</p>
                <p className={`mt-1 text-[1.125rem] font-semibold tabular-nums ${saldo.usados === 0 ? "text-black/30" : "text-[#282525]"}`}>
                  {saldo.usados}{saldo.cota !== null && <span className="text-[0.8125rem] font-normal text-black/45"> de {saldo.cota}</span>}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-black/55">
                  {saldo.estado === "sem_cota" && "sem limite"}
                  {saldo.estado === "livre" && `${saldo.saldo} ${saldo.saldo === 1 ? "lugar livre" : "lugares livres"}`}
                  {saldo.estado === "cheia" && "cota cheia"}
                  {saldo.estado === "estourada" && <span className="flex items-center gap-1 text-[#B07A14]"><TriangleAlert size={11} aria-hidden="true" /> {Math.abs(saldo.saldo ?? 0)} {Math.abs(saldo.saldo ?? 0) === 1 ? "lugar" : "lugares"} acima da cota</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lista-convidados">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="lista-convidados" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Convidados</h2>
          {podeEditar && (
            <span className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLinkAberto(true)} className={BOTAO}><Link2 size={13} aria-hidden="true" /> {linkDePedidos ? "Novo link de pedidos" : "Link de pedidos"}</button>
              <button type="button" onClick={() => setFolha({ convidado: null })} disabled={(tipos ?? []).every(tipo => tipo.arquivado)} className={BOTAO}><Plus size={13} aria-hidden="true" /> Convidar</button>
            </span>
          )}
        </div>
        {linkDePedidos && (
          <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-black/55">
            {!linkDePedidos.revogado_em && new Date(linkDePedidos.corte_em).getTime() > agora
              ? <span>Pedidos abertos até {textoDoCorte(linkDePedidos.corte_em)} · até {linkDePedidos.limite} pedidos</span>
              : <span>Pedidos encerrados</span>}
            {podeEditar && !linkDePedidos.revogado_em && new Date(linkDePedidos.corte_em).getTime() > agora && (
              <button type="button" onClick={() => void encerrarPedidos()} disabled={trabalhando === "link"} className="text-[0.6875rem] font-medium text-black/55 underline underline-offset-2 hover:text-[#282525] disabled:opacity-50">Encerrar pedidos</button>
            )}
          </p>
        )}
        {convidados.length === 0 ? (
          <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Ninguém convidado para esta sessão</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Convide pelo nome e escolha o tipo de credencial. O banco confere a cota: não deixa passar do limite.</p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-[0.75rem] tabular-nums text-black/55">{resumo.confirmados} {resumo.confirmados === 1 ? "lugar confirmado" : "lugares confirmados"} · {resumo.pedidos} {resumo.pedidos === 1 ? "pedido" : "pedidos"} · {resumo.recusados} {resumo.recusados === 1 ? "recusado" : "recusados"}{credenciais.length > 0 ? ` · ${presenca.entraram} de ${presenca.confirmados} entraram` : ""}</p>
              {podeEditar && presenca.semCredencial > 0 && (
                <button type="button" onClick={() => void emitir()} disabled={trabalhando === "emitir"} className={BOTAO}><Ticket size={13} aria-hidden="true" /> {trabalhando === "emitir" ? "Emitindo…" : `Emitir credenciais (${presenca.semCredencial})`}</button>
              )}
            </div>
            <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              {convidados.map(convidado => (
                <li key={convidado.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className={`truncate text-[0.8125rem] font-medium ${convidado.situacao === "recusado" ? "text-black/40 line-through" : "text-[#282525]"}`}>{convidado.nome}</p>
                    <p className="truncate text-[0.6875rem] text-black/45">{[convidado.afiliacao, nomesDosTipos.get(convidado.tipo_id), convidado.solicitante ? `pedido por ${convidado.solicitante}` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="w-16 text-[0.75rem] tabular-nums text-black/55">{convidado.quantidade} {convidado.quantidade === 1 ? "lugar" : "lugares"}</span>
                  <span className="w-24 text-[0.75rem] text-black/65">{ROTULO_DA_SITUACAO_DO_CONVIDADO[convidado.situacao]}</span>
                  <span className="w-28 text-[0.6875rem] tabular-nums text-black/45">
                    {(() => {
                      const credencial = credencialPorConvidado.get(convidado.id);
                      if (!credencial) return convidado.situacao === "confirmado" ? "sem credencial" : "";
                      return credencial.revogada_em ? "credencial cancelada" : `${credencial.entradas} de ${convidado.quantidade} entraram`;
                    })()}
                  </span>
                  {podeEditar && (
                    <span className="flex gap-1.5">
                      {credencialPorConvidado.has(convidado.id) && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === convidado.id} onClick={() => void trocarCodigo(convidado)}>Trocar código</button>}
                      {convidado.situacao !== "confirmado" && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === convidado.id} onClick={() => void mudarSituacao(convidado, "confirmado")}>Confirmar</button>}
                      {convidado.situacao !== "recusado" && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === convidado.id} onClick={() => void mudarSituacao(convidado, "recusado")}>Recusar</button>}
                      <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha({ convidado })}>Editar</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {linkAberto && <LinkDePedidosSheet sessaoId={sessaoId} sessaoRotulo={sessaoRotulo} ativo={linkDePedidos} onClose={() => setLinkAberto(false)} onGerou={recarregar} />}
      {codigos && <CodigosSheet titulo={codigos.titulo} itens={codigos.itens} sessaoRotulo={sessaoRotulo} onClose={() => setCodigos(null)} />}
      {tiposAbertos && <TiposSheet organizationId={organizationId} tipos={tipos} onClose={() => setTiposAbertos(false)} onMudou={recarregar} />}
      {folha && <ConvidadoSheet organizationId={organizationId} sessaoId={sessaoId} tipos={tipos} saldos={saldos} convidado={folha.convidado} onClose={() => setFolha(null)} onSalvou={recarregar} />}
    </div>
  );
}
