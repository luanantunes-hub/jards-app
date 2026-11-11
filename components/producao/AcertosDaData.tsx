"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerCampo, resumoDaRevisao, DESTINO_DO_ACERTO, type CampoDoModelo } from "@/lib/producao/acerto";
import type { DestinoDoAcerto, SituacaoDoAcerto, SituacaoDoItemDoAcerto, TipoDeCampoDoAcerto, VisibilidadeDoAcerto } from "@/lib/producao/estados";
import { diaEMes } from "@/lib/producao/agenda";

type Acerto = {
  id: string; modelo_nome: string; situacao: SituacaoDoAcerto; link_expira_em: string | null; link_revogado_em: string | null;
  respondente_nome: string | null; respondente_email: string | null; respondido_em: string | null;
};
type Item = {
  id: string; acerto_id: string; secao: string; rotulo: string; tipo: TipoDeCampoDoAcerto; destino: DestinoDoAcerto; visibilidade: VisibilidadeDoAcerto;
  resposta: string | null; situacao: SituacaoDoItemDoAcerto; motivo: string | null;
};
type ModeloResumo = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

const ROTULO_DA_SITUACAO: Record<SituacaoDoAcerto, string> = { aguardando: "Aguardando a casa", respondido: "Respondido, para revisar", concluido: "Concluído", cancelado: "Cancelado" };
const ERRO_DA_REVISAO: Record<string, string> = {
  data_sem_sala: "Esta data não tem sala. Ligue a sala à data para gravar na ficha dela.",
  data_sem_espaco: "Esta data não tem espaço. Ligue o espaço à data para gravar na ficha dele.",
  motivo_obrigatorio: "Escreva o motivo para a casa saber o que ajustar.",
  item_nao_esta_para_revisar: "Este item já foi revisado.",
};

const linkDe = (codigo: string) => `${window.location.origin}/acerto/${codigo}`;

/** O código do link só aparece uma vez: aqui ele é mostrado e copiado. */
function CaixaDoLink({ url, onFechar }: { url: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.12)" }} role="status">
      <p className="text-[0.8125rem] font-medium text-[#282525]">Link pronto para mandar à casa</p>
      <p className="mt-1 text-[0.75rem] text-black/55">Ele aparece só agora: copie e envie. Se perder, gere um novo (o anterior deixa de valer).</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input readOnly value={url} aria-label="Link do acerto" onFocus={event => event.currentTarget.select()} className={`${CAMPO} min-w-0 flex-1 basis-64`} />
        <button type="button" onClick={() => { void navigator.clipboard.writeText(url).then(() => setCopiado(true)); }} className={BOTAO}>{copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar"}</button>
        <button type="button" onClick={onFechar} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/50 hover:bg-black/[.05]">Fechar</button>
      </div>
    </div>
  );
}

function NovoAcertoSheet({ dataId, modelos, onClose, onCreated }: { dataId: string; modelos: ModeloResumo[]; onClose: () => void; onCreated: (url: string) => void }) {
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [campos, setCampos] = useState<CampoDoModelo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!modeloId) return;
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaProducao(createClient()).from("producao_modelos_acerto").select("campos").eq("id", modeloId).maybeSingle();
      if (!ativo) return;
      const lista = Array.isArray(data?.campos) ? data.campos : [];
      setCampos(lista.flatMap(entrada => { const leitura = lerCampo((entrada ?? {}) as Partial<Record<keyof CampoDoModelo, unknown>>); return leitura.ok ? [leitura.campo] : []; }));
      setValores({});
    })();
    return () => { ativo = false; };
  }, [modeloId]);

  const deLeitura = campos.filter(campo => campo.visibilidade === "leitura");

  async function criar(fechar: () => void) {
    if (!modeloId) { setErro("Escolha o modelo."); return; }
    setCriando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { data: id, error } = await producao.rpc("fn_producao_acerto_criar", { p_data: dataId, p_modelo: modeloId, p_valores: valores });
    if (error || !id) { setCriando(false); setErro(error?.code === "42501" ? "Você não pode criar acertos nesta data." : "Não foi possível criar o acerto. Tente de novo."); return; }
    const { data: codigo, error: erroDoLink } = await producao.rpc("fn_producao_acerto_novo_link", { p_acerto: id, p_dias: 30 });
    setCriando(false);
    if (erroDoLink || !codigo) { setErro("O acerto foi criado, mas o link não. Gere o link na lista."); return; }
    onCreated(linkDe(codigo));
    fechar();
  }

  return (
    <TopSheet
      titulo="Novo acerto técnico"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={criando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void criar(fechar)} disabled={criando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{criando ? "Criando…" : "Criar e gerar o link"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div><span className={ROTULO}>Modelo</span><Dropdown ariaLabel="Modelo do acerto" value={modeloId} onChange={setModeloId} disabled={criando} options={modelos.map(modelo => ({ value: modelo.id, label: modelo.nome }))} /></div>
        {deLeitura.length > 0 && (
          <div className="space-y-3">
            <p className="text-[0.75rem] text-black/55">A casa vai ler estes campos. Preencha o que o espetáculo pede.</p>
            {deLeitura.map(campo => (
              <div key={campo.chave}>
                <label className={ROTULO} htmlFor={`novo-${campo.chave}`}>{campo.rotulo}</label>
                <input id={`novo-${campo.chave}`} className={CAMPO} value={valores[campo.chave] ?? ""} onChange={event => setValores(atual => ({ ...atual, [campo.chave]: event.target.value }))} disabled={criando} maxLength={2000} />
              </div>
            ))}
          </div>
        )}
        <p className="text-[0.6875rem] text-black/45">A casa abre o link no celular, sem entrar no Jards, e vê só os campos do modelo. Nada vai para a ficha sem a sua aprovação. O link vale 30 dias.</p>
      </div>
    </TopSheet>
  );
}

function RevisaoDoItem({ item, podeEditar, onRevisado, onErro }: { item: Item; podeEditar: boolean; onRevisado: () => void; onErro: (mensagem: string) => void }) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function revisar(aprovar: boolean) {
    setEnviando(true);
    const { error } = await clienteDaProducao(createClient()).rpc("fn_producao_acerto_revisar", { p_item: item.id, p_aprovar: aprovar, p_motivo: aprovar ? "" : motivo });
    setEnviando(false);
    if (error) {
      const chave = Object.keys(ERRO_DA_REVISAO).find(nome => error.message.includes(nome));
      onErro(chave ? ERRO_DA_REVISAO[chave] : error.code === "42501" ? "Você não pode revisar este item." : error.code === "23514" ? "A ficha não aceita esse valor. Recuse e peça para a casa ajustar." : "Não foi possível revisar. Tente de novo.");
      return;
    }
    onRevisado();
  }

  return (
    <li className="px-4 py-3">
      <p className="text-[0.6875rem] text-black/45">{item.secao}</p>
      <p className="text-[0.8125rem] font-medium text-[#282525]">{item.rotulo}</p>
      <p className="mt-0.5 text-[0.9375rem] text-[#282525]">{item.tipo === "sim_nao" ? (item.resposta === "sim" ? "Sim" : "Não") : item.tipo === "numero" ? item.resposta?.replace(".", ",") : item.resposta}</p>
      <p className="mt-0.5 text-[0.6875rem] text-black/45">{item.destino === "livre" ? "Fica só no acerto." : `Se aprovar, vai para: ${DESTINO_DO_ACERTO[item.destino].rotulo}.`}</p>
      {podeEditar && !recusando && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => void revisar(true)} disabled={enviando} className="h-9 rounded bg-[#2E8932] px-3.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">Aprovar</button>
          <button type="button" onClick={() => setRecusando(true)} disabled={enviando} className={BOTAO}>Recusar</button>
        </div>
      )}
      {podeEditar && recusando && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input aria-label="Motivo da recusa" autoFocus className={`${CAMPO} min-w-0 flex-1 basis-56`} placeholder="O que a casa precisa ajustar" value={motivo} onChange={event => setMotivo(event.target.value)} maxLength={500} disabled={enviando} />
          <button type="button" onClick={() => void revisar(false)} disabled={enviando} className={BOTAO}>Recusar</button>
          <button type="button" onClick={() => setRecusando(false)} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/50 hover:bg-black/[.05]">Cancelar</button>
        </div>
      )}
    </li>
  );
}

/** O acerto técnico da data (PD4.1 e PD4.2): cria a partir de um modelo, manda o link para a casa e revê item a item. */
export function AcertosDaData({ organizationId, dataId, podeEditar }: { organizationId: string; dataId: string; podeEditar: boolean }) {
  const [agora] = useState(() => new Date().toISOString().slice(0, 19));
  const [acertos, setAcertos] = useState<Acerto[] | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [modelos, setModelos] = useState<ModeloResumo[]>([]);
  const [novo, setNovo] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [ace, mod] = await Promise.all([
        producao.from("producao_acertos").select("id, modelo_nome, situacao, link_expira_em, link_revogado_em, respondente_nome, respondente_email, respondido_em").eq("data_id", dataId).order("created_at", { ascending: false }),
        producao.from("producao_modelos_acerto").select("id, nome").eq("organization_id", organizationId).order("nome"),
      ]);
      const ids = (ace.data ?? []).map(item => item.id);
      const ite = ids.length > 0
        ? await producao.from("producao_acerto_itens").select("id, acerto_id, secao, rotulo, tipo, destino, visibilidade, resposta, situacao, motivo").in("acerto_id", ids).order("ordem")
        : { data: [] };
      if (!ativo) return;
      setAcertos((ace.data ?? []) as Acerto[]);
      setItens((ite.data ?? []) as Item[]);
      setModelos((mod.data ?? []) as ModeloResumo[]);
      setErro(ace.error ? "Não foi possível carregar os acertos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [dataId, organizationId, versao]);

  const itensDe = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    for (const item of itens) mapa.set(item.acerto_id, [...(mapa.get(item.acerto_id) ?? []), item]);
    return mapa;
  }, [itens]);

  async function gerarLink(acerto: Acerto) {
    setErro(null);
    const { data: codigo, error } = await clienteDaProducao(createClient()).rpc("fn_producao_acerto_novo_link", { p_acerto: acerto.id, p_dias: 30 });
    if (error || !codigo) { setErro("Não foi possível gerar o link. Tente de novo."); return; }
    setLink(linkDe(codigo));
    recarregar();
  }

  async function mudar(acerto: Acerto, mudanca: { situacao?: SituacaoDoAcerto; link_revogado_em?: string }) {
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_acertos").update(mudanca).eq("id", acerto.id);
    if (error) { setErro("Não foi possível mudar o acerto. Tente de novo."); return; }
    recarregar();
  }

  const linkValido = (acerto: Acerto) => acerto.link_expira_em !== null && acerto.link_revogado_em === null && acerto.link_expira_em.slice(0, 19) > agora;

  return (
    <section aria-labelledby="acerto-tecnico" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="acerto-tecnico" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Acerto técnico</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/producoes/acertos" className={BOTAO}>Modelos de acerto</Link>
          {podeEditar && modelos.length > 0 && <PrimaryListAction onClick={() => setNovo(true)}><Plus size={13} aria-hidden="true" /> Novo acerto</PrimaryListAction>}
        </div>
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {link && <div className="mb-3"><CaixaDoLink url={link} onFechar={() => setLink(null)} /></div>}

      {acertos === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : acertos.length === 0 ? (
        <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {modelos.length === 0 ? "Crie primeiro um modelo de acerto (Modelos de acerto). Depois você manda um link para a casa confirmar medidas, canais, energia e horários, e revê cada resposta antes de ela ir para a ficha." : "Mande um link para a casa confirmar medidas, canais, energia e horários. Você revê cada resposta antes de ela ir para a ficha."}
        </p>
      ) : (
        <ul className="space-y-3">
          {acertos.map(acerto => {
            const doAcerto = itensDe.get(acerto.id) ?? [];
            const paraRevisar = doAcerto.filter(item => item.situacao === "respondido");
            return (
              <li key={acerto.id} className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{acerto.modelo_nome}</p>
                    <p className="text-[0.6875rem] text-black/45">
                      {ROTULO_DA_SITUACAO[acerto.situacao]}
                      {acerto.respondente_nome ? ` · ${acerto.respondente_nome}${acerto.respondente_email ? ` (${acerto.respondente_email})` : ""}` : ""}
                      {acerto.respondido_em ? ` · ${diaEMes(acerto.respondido_em.slice(0, 10))}` : ""}
                      {acerto.situacao !== "concluido" && acerto.situacao !== "cancelado" ? ` · ${linkValido(acerto) ? `link vale até ${diaEMes((acerto.link_expira_em ?? "").slice(0, 10))}` : "sem link ativo"}` : ""}
                    </p>
                    {doAcerto.length > 0 && <p className="text-[0.6875rem] text-black/45">{resumoDaRevisao(doAcerto.filter(item => item.visibilidade === "opcional" || item.visibilidade === "obrigatorio"))}</p>}
                  </div>
                  {podeEditar && acerto.situacao !== "concluido" && acerto.situacao !== "cancelado" && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void gerarLink(acerto)} className={BOTAO}><Link2 size={13} aria-hidden="true" /> {linkValido(acerto) ? "Novo link" : "Gerar link"}</button>
                      {linkValido(acerto) && <button type="button" onClick={() => void mudar(acerto, { link_revogado_em: new Date().toISOString() })} className={BOTAO}>Desativar link</button>}
                      <button type="button" onClick={() => void mudar(acerto, { situacao: "cancelado" })} className={BOTAO}>Cancelar acerto</button>
                    </div>
                  )}
                  {paraRevisar.length > 0 && <button type="button" onClick={() => setAberto(atual => (atual === acerto.id ? null : acerto.id))} aria-expanded={aberto === acerto.id} className={BOTAO}>{aberto === acerto.id ? "Fechar revisão" : `Revisar (${paraRevisar.length})`}</button>}
                </div>
                {aberto === acerto.id && paraRevisar.length > 0 && (
                  <ul className="divide-y divide-black/[.06] border-t" style={{ borderColor: "rgba(13,13,13,.06)" }} aria-label="Itens para revisar">
                    {paraRevisar.map(item => <RevisaoDoItem key={item.id} item={item} podeEditar={podeEditar} onRevisado={recarregar} onErro={setErro} />)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {novo && <NovoAcertoSheet dataId={dataId} modelos={modelos} onClose={() => setNovo(false)} onCreated={url => { setLink(url); recarregar(); }} />}
    </section>
  );
}
