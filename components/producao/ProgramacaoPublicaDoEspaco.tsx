"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";

type Link = { id: string; titulo: string | null; revogado_em: string | null; created_at: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

function Copiavel({ rotulo, valor, linhas = 1 }: { rotulo: string; valor: string; linhas?: number }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div>
      <p className="mb-1 text-[0.6875rem] font-medium text-black/55">{rotulo}</p>
      <div className="flex items-start gap-2">
        {linhas > 1
          ? <textarea readOnly rows={linhas} value={valor} aria-label={rotulo} onFocus={event => event.currentTarget.select()} className="w-full rounded border border-black/[.12] bg-white px-3 py-2 font-mono text-[0.75rem] text-[#282525]" />
          : <input readOnly value={valor} aria-label={rotulo} onFocus={event => event.currentTarget.select()} className={`${CAMPO} min-w-0 flex-1`} />}
        <button type="button" onClick={() => { void navigator.clipboard.writeText(valor).then(() => setCopiado(true)); }} className={BOTAO}>{copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar"}</button>
      </div>
    </div>
  );
}

/** Os endereços de um link novo: a página, o código para embutir no site e o JSON. O código só aparece agora. */
function EnderecosDoLink({ codigo, onFechar }: { codigo: string; onFechar: () => void }) {
  const origem = typeof window === "undefined" ? "" : window.location.origin;
  const pagina = `${origem}/programacao/${codigo}`;
  const embutir = `<iframe src="${origem}/embed/programacao/${codigo}" title="Programação" width="100%" height="640" style="border:0"></iframe>`;
  return (
    <div className="mb-4 space-y-3 rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.12)" }} role="status">
      <div>
        <p className="text-[0.8125rem] font-medium text-[#282525]">Programação pronta para publicar</p>
        <p className="mt-1 text-[0.75rem] text-black/55">Estes endereços aparecem só agora: copie o que for usar. Se perder, gere outro e desative este.</p>
      </div>
      <Copiavel rotulo="Página para divulgar (link)" valor={pagina} />
      <Copiavel rotulo="Para colar no site da casa (iframe)" valor={embutir} linhas={3} />
      <Copiavel rotulo="Para o site montar do jeito dele (JSON)" valor={`${origem}/api/programacao/${codigo}`} />
      <button type="button" onClick={onFechar} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/50 hover:bg-black/[.05]">Fechar</button>
    </div>
  );
}

function NovoLinkSheet({ espacoId, onClose, onCreated }: { espacoId: string; onClose: () => void; onCreated: (codigo: string) => void }) {
  const [titulo, setTitulo] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(fechar: () => void) {
    if (titulo.trim().length > 120) { setErro("O título pode ter até 120 letras."); return; }
    setGerando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_programacao_criar_link", { p_espaco: espacoId, p_titulo: titulo });
    setGerando(false);
    if (error || !data) { setErro(error?.code === "42501" ? "Você não pode publicar a programação deste espaço." : "Não foi possível gerar o link. Tente de novo."); return; }
    onCreated(data);
    fechar();
  }

  return (
    <TopSheet
      titulo="Publicar a programação"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={gerando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void gerar(fechar)} disabled={gerando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{gerando ? "Gerando…" : "Gerar os endereços"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className="mb-1.5 block text-[0.6875rem] font-medium text-black/55" htmlFor="prog-titulo">Título na página (opcional)</label>
          <input id="prog-titulo" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Em cartaz no Teatro Central" maxLength={120} disabled={gerando} />
        </div>
        <p className="text-[0.75rem] text-black/55">Qualquer pessoa com o endereço vê as sessões já marcadas, de hoje em diante: dia, hora, título e sala. <strong className="font-medium">Só entram sessões de pautas confirmadas.</strong> Pré-reserva, consulta, contratante e notas nunca aparecem.</p>
      </div>
    </TopSheet>
  );
}

/** A programação pública do espaço (PD8.3): gera o link, o código para o site da casa e o JSON, e desativa quando quiser. */
export function ProgramacaoPublicaDoEspaco({ espacoId, podeEditar }: { espacoId: string; podeEditar: boolean }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [folha, setFolha] = useState(false);
  const [novo, setNovo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_programacao_links").select("id, titulo, revogado_em, created_at").eq("espaco_id", espacoId).order("created_at", { ascending: false });
      if (!ativo) return;
      setLinks((data ?? []) as Link[]);
      setErro(error ? "Não foi possível carregar os links. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [espacoId, versao]);

  async function desativar(link: Link) {
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_programacao_links").update({ revogado_em: new Date().toISOString() }).eq("id", link.id);
    if (error) { setErro("Não foi possível desativar. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  return (
    <section aria-labelledby="programacao-publica" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="programacao-publica" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Programação pública</h2>
        {podeEditar && <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Publicar a programação</PrimaryListAction>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {novo && <EnderecosDoLink codigo={novo} onFechar={() => setNovo(null)} />}
      {links === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : links.length === 0 ? null : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {links.map(link => (
            <li key={link.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <span className="min-w-0 flex-1 basis-48">
                <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{link.titulo ?? "Sem título"}</span>
                <span className="block text-[0.6875rem] text-black/45">Criado em {diaEMes(link.created_at.slice(0, 10))} · {link.revogado_em ? "desativado" : "no ar"}</span>
              </span>
              {podeEditar && !link.revogado_em && <button type="button" onClick={() => void desativar(link)} className={BOTAO}>Desativar</button>}
            </li>
          ))}
        </ul>
      )}
      {folha && <NovoLinkSheet espacoId={espacoId} onClose={() => setFolha(false)} onCreated={codigo => { setNovo(codigo); setVersao(atual => atual + 1); }} />}
    </section>
  );
}
