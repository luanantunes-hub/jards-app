"use client";

import { useEffect, useMemo, useState } from "react";
import { EyeOff, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { CATEGORIAS_DO_INGRESSO, type CategoriaDoIngresso } from "@/lib/ticketeria/estados";
import { partesNoFuso, quandoDaSessao } from "@/lib/ticketeria/eventos";
import {
  NOME_PADRAO, ROTULO_DA_CATEGORIA, lerIngresso, lerLote, lerPrecosDaSessao, loteDaVez, mensagemDoErroDoCatalogo, nomeDaMeia, nomeDoProximoLote, podeTerMeia,
  precoDaMeia, precoParaMostrar, publicoPorPadrao, semPreco, situacaoDoLote,
} from "@/lib/ticketeria/catalogo";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";

// O catálogo do evento (T3): os ingressos por setor e os lotes de cada um. Sem venda ainda (T5): os números são da oferta.

type Local = { id: string; nome: string; fuso: string; arquivado: boolean };
type Setor = { id: string; local_id: string; nome: string; lugares: number; arquivado: boolean };
type Ingresso = { id: string; setor_id: string; nome: string; categoria: CategoriaDoIngresso; limite_por_pedido: number; publico: boolean; ordem: number; arquivado: boolean; meia_de: string | null };
type Lote = { id: string; ingresso_id: string; nome: string; ordem: number; preco_centavos: number; quantidade: number; vendas_inicio: string | null; vendas_fim: string | null };
type SessaoDoEvento = { id: string; local_id: string; inicio: string; cancelada_em: string | null };
type PrecoDaSessao = { sessao_id: string; lote_id: string; preco_centavos: number };
type Folha = { tipo: "ingresso"; ingresso?: Ingresso } | { tipo: "lote"; ingresso: Ingresso; lote?: Lote };

const numero = (n: number) => n.toLocaleString("pt-BR");
const PEQUENO = "h-8 rounded-xl px-2.5 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]";

// ─── Folhas ─────────────────────────────────────────────────────────────────

function IngressoSheet({ organizationId, eventoId, setores, locais, ingresso, meia, ordem, onClose, onSaved }: {
  organizationId: string; eventoId: string; setores: Setor[]; locais: Local[]; ingresso?: Ingresso; /** A meia-entrada ligada a este ingresso, se já existe (ativa ou arquivada). */ meia?: Ingresso; ordem: number; onClose: () => void; onSaved: () => void;
}) {
  const opcoes = setores.filter(setor => (!setor.arquivado && !locais.find(local => local.id === setor.local_id)?.arquivado) || setor.id === ingresso?.setor_id);
  const [setorId, setSetorId] = useState(ingresso?.setor_id ?? opcoes[0]?.id ?? "");
  const [categoria, setCategoria] = useState<CategoriaDoIngresso>(ingresso?.categoria ?? "inteira");
  const [nome, setNome] = useState(ingresso?.nome ?? NOME_PADRAO.inteira);
  const [limite, setLimite] = useState(String(ingresso?.limite_por_pedido ?? 10));
  const [publico, setPublico] = useState(ingresso?.publico ?? true);
  const [comMeia, setComMeia] = useState(Boolean(meia && !meia.arquivado));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function trocarCategoria(nova: string) {
    const anterior = categoria;
    const valor = nova as CategoriaDoIngresso;
    setCategoria(valor);
    // O nome acompanha a categoria enquanto a pessoa não o mudou à mão.
    if (nome.trim() === "" || nome === NOME_PADRAO[anterior]) setNome(NOME_PADRAO[valor]);
    if (!ingresso) setPublico(publicoPorPadrao(valor));
  }

  async function salvar(fechar: () => void) {
    if (!setorId) { setErro("Escolha o setor."); return; }
    const leitura = lerIngresso({ nome, categoria, limite, publico });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    const querMeia = comMeia && podeTerMeia(categoria);
    let error: { code?: string; message?: string } | null = null;
    let idDaInteira = ingresso?.id ?? "";
    if (ingresso) {
      error = (await ticketeria.from("ticketeria_ingressos").update({ setor_id: setorId, ...leitura.valor }).eq("id", ingresso.id)).error;
    } else {
      const criado = await ticketeria.from("ticketeria_ingressos").insert({ organization_id: organizationId, evento_id: eventoId, setor_id: setorId, ordem, ...leitura.valor }).select("id").single();
      error = criado.error;
      idDaInteira = criado.data?.id ?? "";
    }
    // A meia-entrada é o desconto de 50% da inteira: o banco espelha os lotes dela (metade do preço) e a faz seguir o setor, o limite e o "aparece ao público".
    if (!error && idDaInteira) {
      if (querMeia && !meia) {
        error = (await ticketeria.from("ticketeria_ingressos").insert({ organization_id: organizationId, evento_id: eventoId, setor_id: setorId, nome: nomeDaMeia(leitura.valor.nome), categoria: "meia", ordem: ordem + 1, limite_por_pedido: leitura.valor.limite_por_pedido, publico: leitura.valor.publico, meia_de: idDaInteira })).error;
      } else if (querMeia && meia?.arquivado) {
        error = (await ticketeria.from("ticketeria_ingressos").update({ arquivado: false }).eq("id", meia.id)).error;
      } else if (!querMeia && meia && !meia.arquivado) {
        error = (await ticketeria.from("ticketeria_ingressos").update({ arquivado: true }).eq("id", meia.id)).error;
      }
    }
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoCatalogo(error)); return; }
    onSaved();
    fechar();
  }

  async function apagar(fechar: () => void) {
    if (!ingresso) return;
    setSalvando(true);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_ingressos").delete().eq("id", ingresso.id);
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoCatalogo(error)); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo={ingresso ? "Editar ingresso" : "Novo ingresso"} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={ingresso ? "Salvar" : "Criar ingresso"} onSalvar={() => void salvar(fechar)} onApagar={ingresso ? () => void apagar(fechar) : undefined} rotuloApagar="Apagar o ingresso" />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {opcoes.length === 0 ? (
          <p className="rounded-xl border border-black/[.08] px-3 py-3 text-[0.75rem] text-black/55">O ingresso é de um setor de um local. Cadastre o local e os setores em Configurações, na aba Espaços.</p>
        ) : (
          <div><span className={ROTULO}>Setor</span><Dropdown ariaLabel="Setor do ingresso" value={setorId} onChange={setSetorId} disabled={salvando} options={opcoes.map(setor => ({ value: setor.id, label: `${locais.find(local => local.id === setor.local_id)?.nome ?? "Local"} · ${setor.nome}` }))} /></div>
        )}
        <div><span className={ROTULO}>Categoria</span><Dropdown ariaLabel="Categoria do ingresso" value={categoria} onChange={trocarCategoria} disabled={salvando} options={CATEGORIAS_DO_INGRESSO.map(c => ({ value: c, label: ROTULO_DA_CATEGORIA[c] }))} /></div>
        <div><label className={ROTULO} htmlFor="in-nome">Nome</label><input id="in-nome" autoFocus className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} placeholder="Inteira" maxLength={120} disabled={salvando} /></div>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:items-end">
          <div><label className={ROTULO} htmlFor="in-limite">Por pedido, até</label><input id="in-limite" inputMode="numeric" className={CAMPO} value={limite} onChange={e => setLimite(e.target.value)} disabled={salvando} /></div>
          <label className="flex h-10 items-center gap-2 text-[0.8125rem] text-[#282525]">
            <input type="checkbox" checked={publico} onChange={e => setPublico(e.target.checked)} disabled={salvando} className="h-4 w-4 accent-[#1C0E33]" />
            Aparece ao público
          </label>
        </div>
        {podeTerMeia(categoria) && (
          <div>
            <label className="flex items-center gap-2 text-[0.8125rem] text-[#282525]">
              <input type="checkbox" checked={comMeia} onChange={e => setComMeia(e.target.checked)} disabled={salvando} className="h-4 w-4 accent-[#1C0E33]" />
              Oferecer meia-entrada (50% de desconto)
            </label>
            <p className="mt-1 text-[0.75rem] text-black/55">A meia custa metade da inteira e vende os mesmos lugares. O preço dela acompanha o da inteira: você só cuida dos lotes da inteira.</p>
          </div>
        )}
        {categoria === "meia" && <p className="text-[0.75rem] text-black/55">A meia-entrada custa metade da inteira.</p>}
        {categoria === "cortesia" && <p className="text-[0.75rem] text-black/55">A cortesia não tem preço e, por padrão, não aparece ao público: a produção distribui.</p>}
      </div>
    </TopSheet>
  );
}

function LoteSheet({ organizationId, ingresso, fuso, lote, quantosLotes, sugestao, sessoes, precosDoLote, onClose, onSaved }: {
  organizationId: string; ingresso: Ingresso; fuso: string; lote?: Lote; quantosLotes: number; sugestao: number | null;
  /** As sessões que ainda vão acontecer (para o preço por sessão) e os preços próprios que este lote já tem nelas. */
  sessoes: SessaoDoEvento[]; precosDoLote: PrecoDaSessao[]; onClose: () => void; onSaved: () => void;
}) {
  const inicio = lote?.vendas_inicio ? partesNoFuso(lote.vendas_inicio, fuso) : { dia: "", hora: "" };
  const fim = lote?.vendas_fim ? partesNoFuso(lote.vendas_fim, fuso) : { dia: "", hora: "" };
  const gratis = semPreco(ingresso.categoria);
  const [nome, setNome] = useState(lote?.nome ?? nomeDoProximoLote(quantosLotes));
  const [preco, setPreco] = useState(lote && !gratis ? (lote.preco_centavos / 100).toFixed(2).replace(".", ",") : sugestao && !gratis ? (sugestao / 100).toFixed(2).replace(".", ",") : "");
  const [quantidade, setQuantidade] = useState(lote ? String(lote.quantidade) : "");
  const [inicioDia, setInicioDia] = useState(inicio.dia);
  const [inicioHora, setInicioHora] = useState(inicio.hora);
  const [fimDia, setFimDia] = useState(fim.dia);
  const [fimHora, setFimHora] = useState(fim.hora);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O preço por sessão (plano, seção 11, P0): só num lote que já existe, de ingresso pago que não é a meia (a meia vale metade da inteira da sessão).
  const podePrecoPorSessao = Boolean(lote) && !gratis && ingresso.meia_de === null && sessoes.length >= 2;
  const formatar = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
  const [porSessao, setPorSessao] = useState<Record<string, string>>(() => Object.fromEntries(sessoes.map(s => [s.id, precosDoLote.find(p => p.sessao_id === s.id) ? formatar(precosDoLote.find(p => p.sessao_id === s.id)!.preco_centavos) : ""])));

  async function salvar(fechar: () => void) {
    const leitura = lerLote({ nome, preco, quantidade, inicioDia, inicioHora, fimDia, fimHora }, ingresso.categoria, fuso);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    const precos = podePrecoPorSessao ? lerPrecosDaSessao(porSessao) : null;
    if (precos && !precos.ok) { setErro(precos.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    const { error } = lote
      ? await ticketeria.from("ticketeria_lotes").update(leitura.valor).eq("id", lote.id)
      : await ticketeria.from("ticketeria_lotes").insert({ organization_id: organizationId, ingresso_id: ingresso.id, ordem: quantosLotes, ...leitura.valor });
    if (error) { setSalvando(false); setErro(mensagemDoErroDoCatalogo(error)); return; }
    // Só o que mudou: preço novo ou alterado grava; em branco apaga (a sessão volta ao preço do lote).
    if (lote && precos?.ok) {
      for (const [sessaoId, novo] of precos.precos) {
        const antigo = precosDoLote.find(p => p.sessao_id === sessaoId)?.preco_centavos ?? null;
        if (novo === antigo) continue;
        const { error: erroDoPreco } = novo === null
          ? await ticketeria.from("ticketeria_precos_da_sessao").delete().eq("sessao_id", sessaoId).eq("lote_id", lote.id)
          : await ticketeria.from("ticketeria_precos_da_sessao").upsert({ organization_id: organizationId, sessao_id: sessaoId, lote_id: lote.id, preco_centavos: novo }, { onConflict: "sessao_id,lote_id" });
        if (erroDoPreco) { setSalvando(false); setErro(mensagemDoErroDoCatalogo(erroDoPreco)); onSaved(); return; }
      }
    }
    setSalvando(false);
    onSaved();
    fechar();
  }

  async function apagar(fechar: () => void) {
    if (!lote) return;
    setSalvando(true);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_lotes").delete().eq("id", lote.id);
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoCatalogo(error)); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo={`${lote ? "Editar lote" : "Novo lote"}: ${ingresso.nome}`} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={lote ? "Salvar" : "Criar lote"} onSalvar={() => void salvar(fechar)} onApagar={lote ? () => void apagar(fechar) : undefined} rotuloApagar="Apagar o lote" />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
          <div><label className={ROTULO} htmlFor="lo-nome-lote">Nome</label><input id="lo-nome-lote" autoFocus className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} maxLength={60} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="lo-preco">Preço (R$)</label><input id="lo-preco" inputMode="decimal" className={CAMPO} value={gratis ? "Grátis" : preco} onChange={e => setPreco(e.target.value)} placeholder="50,00" disabled={salvando || gratis} /></div>
          <div><label className={ROTULO} htmlFor="lo-qtd">Por sessão</label><input id="lo-qtd" inputMode="numeric" className={CAMPO} value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="100" disabled={salvando} /></div>
        </div>
        {ingresso.categoria === "meia" && sugestao !== null && <p className="text-[0.75rem] text-black/55">Metade da inteira deste setor: {precoParaMostrar(sugestao)}.</p>}
        <details className="rounded-xl border border-black/[.08]" open={Boolean(lote?.vendas_inicio || lote?.vendas_fim)}>
          <summary className="cursor-pointer px-3 py-2.5 text-[0.75rem] font-normal text-black/60">Período de venda</summary>
          <div className="space-y-3 border-t border-black/[.06] px-3 py-3">
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div><label className={ROTULO} htmlFor="lo-ini-dia">Começa em</label><input id="lo-ini-dia" type="date" className={CAMPO} value={inicioDia} onChange={e => setInicioDia(e.target.value)} disabled={salvando} /></div>
              <div><label className={ROTULO} htmlFor="lo-ini-hora">Hora</label><input id="lo-ini-hora" type="time" className={CAMPO} value={inicioHora} onChange={e => setInicioHora(e.target.value)} disabled={salvando} /></div>
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div><label className={ROTULO} htmlFor="lo-fim-dia">Termina em</label><input id="lo-fim-dia" type="date" className={CAMPO} value={fimDia} onChange={e => setFimDia(e.target.value)} disabled={salvando} /></div>
              <div><label className={ROTULO} htmlFor="lo-fim-hora">Hora</label><input id="lo-fim-hora" type="time" className={CAMPO} value={fimHora} onChange={e => setFimHora(e.target.value)} disabled={salvando} /></div>
            </div>
            <p className="text-[0.75rem] text-black/55">Sem começo, abre quando o evento é publicado; sem fim, vai até a sessão. O lote seguinte abre quando este esgota ou termina.</p>
          </div>
        </details>
        {podePrecoPorSessao && lote && (
          <details className="rounded-xl border border-black/[.08]" open={precosDoLote.length > 0}>
            <summary className="cursor-pointer px-3 py-2.5 text-[0.75rem] font-normal text-black/60">Preço por sessão</summary>
            <div className="space-y-2 border-t border-black/[.06] px-3 py-3">
              <p className="text-[0.75rem] text-black/55">Em branco, a sessão cobra o preço do lote ({precoParaMostrar(lote.preco_centavos)}). A meia acompanha: metade do preço da sessão.</p>
              {sessoes.map(s => (
                <div key={s.id} className="grid grid-cols-[1fr_8rem] items-center gap-3">
                  <label className="text-[0.8125rem] text-[#282525]" htmlFor={`lo-ps-${s.id}`}>{quandoDaSessao(s.inicio, fuso)}</label>
                  <input id={`lo-ps-${s.id}`} inputMode="decimal" className={CAMPO} value={porSessao[s.id] ?? ""} onChange={e => setPorSessao(atual => ({ ...atual, [s.id]: e.target.value }))} placeholder={formatar(lote.preco_centavos)} disabled={salvando} />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </TopSheet>
  );
}

// ─── A seção ────────────────────────────────────────────────────────────────

/** Os ingressos do evento, agrupados por setor, com os lotes e os lugares de cada setor. */
export function CatalogoDoEvento({ organizationId, eventoId, locaisDasSessoes, podeEditar }: { organizationId: string; eventoId: string; locaisDasSessoes: string[]; podeEditar: boolean }) {
  const [dados, setDados] = useState<{ locais: Local[]; setores: Setor[]; ingressos: Ingresso[]; lotes: Lote[]; sessoes: SessaoDoEvento[]; precos: PrecoDaSessao[] } | null>(null);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const [lo, se, ing, ses] = await Promise.all([
        ticketeria.from("ticketeria_locais").select("id, nome, fuso, arquivado").eq("organization_id", organizationId).order("nome"),
        ticketeria.from("ticketeria_setores").select("id, local_id, nome, lugares, arquivado").eq("organization_id", organizationId).order("ordem").order("nome"),
        ticketeria.from("ticketeria_ingressos").select("id, setor_id, nome, categoria, limite_por_pedido, publico, ordem, arquivado, meia_de").eq("evento_id", eventoId).order("ordem"),
        ticketeria.from("ticketeria_sessoes").select("id, local_id, inicio, cancelada_em").eq("evento_id", eventoId).order("inicio"),
      ]);
      const ids = (ing.data ?? []).map(ingresso => ingresso.id);
      const lt = ids.length > 0 ? await ticketeria.from("ticketeria_lotes").select("id, ingresso_id, nome, ordem, preco_centavos, quantidade, vendas_inicio, vendas_fim").in("ingresso_id", ids).order("ordem") : { data: [], error: null };
      // Os preços próprios das sessões: se faltar o que ler, o catálogo segue sem eles (cada sessão cobra o preço do lote).
      const loteIds = (lt.data ?? []).map(lote => lote.id);
      const pr = loteIds.length > 0 ? await ticketeria.from("ticketeria_precos_da_sessao").select("sessao_id, lote_id, preco_centavos").in("lote_id", loteIds) : { data: [], error: null };
      if (!ativo) return;
      setDados({ locais: (lo.data ?? []) as Local[], setores: (se.data ?? []) as Setor[], ingressos: (ing.data ?? []) as Ingresso[], lotes: (lt.data ?? []) as Lote[], sessoes: (ses.data ?? []) as SessaoDoEvento[], precos: (pr.data ?? []) as PrecoDaSessao[] });
      setErro(lo.error || se.error || ing.error || lt.error ? "Não foi possível carregar os ingressos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, eventoId, versao]);

  // Os setores dos locais onde o evento tem sessão vêm primeiro na escolha do ingresso.
  const setoresParaEscolher = useMemo(() => [...(dados?.setores ?? [])].sort((a, b) => Number(locaisDasSessoes.includes(b.local_id)) - Number(locaisDasSessoes.includes(a.local_id))), [dados, locaisDasSessoes]);

  const grupos = useMemo(() => {
    if (!dados) return [];
    const setoresComIngresso = [...new Set(dados.ingressos.map(ingresso => ingresso.setor_id))];
    return setoresComIngresso.map(setorId => {
      const setor = dados.setores.find(item => item.id === setorId);
      const local = dados.locais.find(item => item.id === setor?.local_id);
      return {
        setor, local,
        lugares: setor ? setor.lugares : null,
        // A meia ligada à inteira não é um item à parte: aparece sob a inteira, como o desconto dela.
        ingressos: dados.ingressos.filter(ingresso => ingresso.setor_id === setorId && !ingresso.meia_de).map(ingresso => {
          const meia = dados.ingressos.find(outro => outro.meia_de === ingresso.id && !outro.arquivado);
          const loteDaMeia = meia ? loteDaVez(dados.lotes.filter(lote => lote.ingresso_id === meia.id)) : null;
          return { ingresso, lotes: dados.lotes.filter(lote => lote.ingresso_id === ingresso.id), meia: meia ?? null, precoDaMeia: loteDaMeia?.preco_centavos ?? null };
        }),
      };
    });
  }, [dados]);

  function sugestaoDaMeia(ingresso: Ingresso): number | null {
    if (!dados || ingresso.categoria !== "meia") return null;
    const inteiras = dados.ingressos.filter(item => item.setor_id === ingresso.setor_id && item.categoria === "inteira" && !item.arquivado);
    const lote = loteDaVez(dados.lotes.filter(item => inteiras.some(inteira => inteira.id === item.ingresso_id)));
    return lote ? precoDaMeia(lote.preco_centavos) : null;
  }

  const fusoDo = (ingresso: Ingresso) => dados?.locais.find(local => local.id === dados.setores.find(setor => setor.id === ingresso.setor_id)?.local_id)?.fuso ?? "America/Sao_Paulo";

  function janela(lote: Lote, fuso: string): string {
    const situacao = situacaoDoLote(lote);
    if (situacao === "antes" && lote.vendas_inicio) return `abre ${quandoDaSessao(lote.vendas_inicio, fuso)}`;
    if (situacao === "encerrado") return "vendas encerradas";
    return lote.vendas_fim ? `até ${quandoDaSessao(lote.vendas_fim, fuso)}` : "até a sessão";
  }

  return (
    <section aria-labelledby="ingressos-do-evento" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="ingressos-do-evento" className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Ingressos</h2>
        {podeEditar && dados && <SecondaryListAction onClick={() => setFolha({ tipo: "ingresso" })}><Plus size={13} aria-hidden="true" /> Novo ingresso</SecondaryListAction>}
      </div>
      {erro && <div className="mb-3"><Aviso texto={erro} /></div>}
      {dados === null ? (
        <div className="h-24 rounded-xl border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border bg-white px-5 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-normal text-black/55">Nenhum ingresso ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Cada ingresso é de um setor (Inteira na Plateia, Meia no Balcão) e tem lotes com preço, quantidade por sessão e período de venda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map(({ setor, local, lugares, ingressos }) => (
            <div key={setor?.id ?? "sem-setor"} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b bg-black/[.015] px-4 py-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <p className="text-[0.75rem] font-normal text-[#282525]">{local?.nome ?? "Local"} · {setor?.nome ?? "Setor"}</p>
                {lugares !== null && <p className="text-[0.6875rem] tabular-nums text-black/50">{numero(lugares)} lugares para todos os ingressos</p>}
              </div>
              <ul className="divide-y divide-black/[.06]">
                {ingressos.map(({ ingresso, lotes, meia, precoDaMeia: precoDaMeiaNaVez }) => {
                  const fuso = fusoDo(ingresso);
                  return (
                    <li key={ingresso.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="min-w-0 flex-1 basis-48">
                          <span className={`block text-[0.8125rem] font-normal ${ingresso.arquivado ? "text-black/40 line-through" : "text-[#282525]"}`}>{ingresso.nome}</span>
                          <span className="flex items-center gap-1.5 text-[0.6875rem] text-black/45">
                            {[ingresso.nome === ROTULO_DA_CATEGORIA[ingresso.categoria] ? null : ROTULO_DA_CATEGORIA[ingresso.categoria], `até ${ingresso.limite_por_pedido} por pedido`].filter(Boolean).join(" · ")}
                            {!ingresso.publico && <><EyeOff size={12} aria-hidden="true" className="text-black/40" /> não aparece ao público</>}
                          </span>
                        </span>
                        {podeEditar && (
                          <span className="flex items-center gap-1">
                            <button type="button" onClick={() => setFolha({ tipo: "ingresso", ingresso })} className={PEQUENO}>Editar</button>
                            <button type="button" onClick={() => setFolha({ tipo: "lote", ingresso })} className={PEQUENO}>+ Lote</button>
                          </span>
                        )}
                      </div>
                      {meia && <p className="mt-1 text-[0.6875rem] text-black/45">{meia.nome} · 50% de desconto{precoDaMeiaNaVez !== null ? `, ${precoParaMostrar(precoDaMeiaNaVez)}` : ""} · mesmos lugares e lotes da inteira</p>}
                      {lotes.length === 0 ? (
                        <p className="mt-2 text-[0.6875rem] text-black/45">Sem lote: ponha o primeiro, com o preço e a quantidade por sessão.</p>
                      ) : (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {lotes.map(lote => (
                            <li key={lote.id}>
                              <button type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "lote", ingresso, lote })} className={`rounded-xl border border-black/[.12] bg-white px-2.5 py-1.5 text-left text-[0.6875rem] transition enabled:hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${situacaoDoLote(lote) === "encerrado" ? "text-black/40" : "text-black/65"}`}>
                                <span className="block font-normal text-[#282525]">{lote.nome} · {precoParaMostrar(lote.preco_centavos)}</span>
                                <span className="block tabular-nums">{numero(lote.quantidade)} por sessão · {janela(lote, fuso)}{(() => { const n = dados.precos.filter(p => p.lote_id === lote.id).length; return n > 0 ? ` · preço próprio em ${n} ${n === 1 ? "sessão" : "sessões"}` : ""; })()}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {folha?.tipo === "ingresso" && dados && <IngressoSheet organizationId={organizationId} eventoId={eventoId} setores={setoresParaEscolher} locais={dados.locais} ingresso={folha.ingresso} meia={folha.ingresso ? dados.ingressos.find(outro => outro.meia_de === folha.ingresso?.id) : undefined} ordem={dados.ingressos.length} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "lote" && dados && <LoteSheet organizationId={organizationId} ingresso={folha.ingresso} fuso={fusoDo(folha.ingresso)} lote={folha.lote} quantosLotes={dados.lotes.filter(lote => lote.ingresso_id === folha.ingresso.id).length} sugestao={sugestaoDaMeia(folha.ingresso)} sessoes={dados.sessoes.filter(s => !s.cancelada_em && Date.parse(s.inicio) > Date.now())} precosDoLote={folha.lote ? dados.precos.filter(p => p.lote_id === folha.lote?.id) : []} onClose={() => setFolha(null)} onSaved={recarregar} />}
    </section>
  );
}
