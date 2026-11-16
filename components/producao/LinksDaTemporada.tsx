"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { BOTAO, BOTAO_PEQUENO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { ROTULO_DA_TABELA, type TipoDeTabela } from "@/lib/producao/tabelas-publicas";

type Link = { id: string; tipo: string; filtro: string | null; expira_em: string; revogado_em: string | null; created_at: string };

const VALIDADES = [
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
];

const TEXTOS: Record<TipoDeTabela, { titulo: string; filtro: string; exemplo: string; quem: string }> = {
  transfers: { titulo: "Link para a transportadora", filtro: "Só os transfers da companhia (opcional)", exemplo: "Viação Central", quem: "a hora, o trecho, a companhia, o localizador e os nomes dos passageiros de cada transfer da temporada" },
  locacao: { titulo: "Link para a locadora", filtro: "Só os itens do fornecedor (opcional)", exemplo: "Locadora Som & Luz", quem: "os itens locados da obra que ainda não foram devolvidos: nome, categoria, quantidade, período, medidas e peso" },
};

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

function situacaoDoLink(link: Link, agora = Date.now()): "no ar" | "desativado" | "vencido" {
  if (link.revogado_em) return "desativado";
  return new Date(link.expira_em).getTime() <= agora ? "vencido" : "no ar";
}

function NovoLinkSheet({ temporadaId, tipo, onClose, onCreated }: { temporadaId: string; tipo: TipoDeTabela; onClose: () => void; onCreated: (endereco: string) => void }) {
  const [filtro, setFiltro] = useState("");
  const [validade, setValidade] = useState("30");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const texto = TEXTOS[tipo];

  async function gerar(fechar: () => void) {
    if (filtro.trim().length > 120) { setErro("O nome pode ter até 120 letras."); return; }
    setGerando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_temporada_criar_link", { p_temporada: temporadaId, p_tipo: tipo, p_filtro: filtro, p_dias: Number(validade) });
    setGerando(false);
    if (error || !data) {
      setErro(error?.code === "42501" ? "Você não pode mudar esta temporada."
        : error?.message?.includes("temporada_sem_obra") ? "Esta temporada não está ligada a uma obra, e os itens locados são da obra. Ligue a temporada a uma obra primeiro."
        : "Não foi possível gerar o link. Tente de novo.");
      return;
    }
    onCreated(`${window.location.origin}/tabela/${data}`);
    fechar();
  }

  return (
    <TopSheet
      titulo={texto.titulo}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={gerando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void gerar(fechar)} disabled={gerando} className={SALVAR}>{gerando ? "Gerando…" : "Gerar link"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <p className="text-[0.75rem] text-black/55">
          Quem tem o endereço vê {texto.quem}, sempre atualizados. <strong className="font-medium">Telefone, e-mail, documentos, notas e dinheiro não aparecem.</strong>
        </p>
        <div>
          <label className={ROTULO} htmlFor="tabela-filtro">{texto.filtro}</label>
          <input id="tabela-filtro" autoFocus className={CAMPO} value={filtro} onChange={event => setFiltro(event.target.value)} placeholder={texto.exemplo} maxLength={120} disabled={gerando} />
        </div>
        <div className="max-w-xs">
          <span className={ROTULO}>O link vale por</span>
          <Dropdown value={validade} onChange={setValidade} options={VALIDADES} />
        </div>
      </div>
    </TopSheet>
  );
}

/** Tabelas só de leitura para a transportadora e para a locadora (PD8.6): um link por vez, com validade, que se desativa quando quiser. */
export function LinksDaTemporada({ temporadaId, podeEditar }: { temporadaId: string; podeEditar: boolean }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [folha, setFolha] = useState<TipoDeTabela | null>(null);
  const [endereco, setEndereco] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_temporada_links").select("id, tipo, filtro, expira_em, revogado_em, created_at").eq("temporada_id", temporadaId).order("created_at", { ascending: false });
      if (!ativo) return;
      setLinks((data ?? []) as Link[]);
      setErro(error ? "Não foi possível carregar os links. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [temporadaId, versao]);

  async function desativar(link: Link) {
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_temporada_links").update({ revogado_em: new Date().toISOString() }).eq("id", link.id);
    if (error) { setErro("Não foi possível desativar. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Selecione o endereço e copie à mão.");
    }
  }

  return (
    <section aria-labelledby="tabelas-parceiros" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="tabelas-parceiros" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Tabelas para parceiros</h2>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setEndereco(null); setFolha("transfers"); }} className={BOTAO}><Link2 size={13} aria-hidden="true" /> Link para a transportadora</button>
            <button type="button" onClick={() => { setEndereco(null); setFolha("locacao"); }} className={BOTAO}><Link2 size={13} aria-hidden="true" /> Link para a locadora</button>
          </div>
        )}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {endereco && (
        <div className="mb-4 space-y-2 rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.12)" }} role="status">
          <p className="text-[0.8125rem] font-medium text-[#282525]">Link pronto. Ele aparece só agora: copie e envie ao parceiro.</p>
          <div className="flex items-start gap-2">
            <input readOnly value={endereco} aria-label="Endereço da tabela" onFocus={event => event.currentTarget.select()} className={`${CAMPO} min-w-0 flex-1`} />
            <button type="button" onClick={() => void copiar()} className={`${BOTAO_PEQUENO} inline-flex h-10 items-center gap-1.5`}>
              {copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button type="button" onClick={() => setEndereco(null)} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/50 hover:bg-black/[.05]">Fechar</button>
        </div>
      )}
      {links === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : links.length === 0 ? (
        <p className="text-[0.75rem] text-black/45">Nenhum link ainda. {podeEditar ? "Gere um para a transportadora ou para a locadora ver só a lista que importa a ela." : ""}</p>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {links.map(link => {
            const situacao = situacaoDoLink(link);
            return (
              <li key={link.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{ROTULO_DA_TABELA[link.tipo as TipoDeTabela] ?? link.tipo}{link.filtro ? ` · ${link.filtro}` : ""}</span>
                  <span className="block text-[0.6875rem] text-black/45">
                    Criado em {dataBr(link.created_at)} · {situacao === "no ar" ? `no ar até ${dataBr(link.expira_em)}` : situacao === "vencido" ? `venceu em ${dataBr(link.expira_em)}` : "desativado"}
                  </span>
                </span>
                {podeEditar && situacao === "no ar" && <button type="button" onClick={() => void desativar(link)} className={BOTAO_PEQUENO}>Desativar</button>}
              </li>
            );
          })}
        </ul>
      )}
      {folha && <NovoLinkSheet temporadaId={temporadaId} tipo={folha} onClose={() => setFolha(null)} onCreated={url => { setEndereco(url); setCopiado(false); setVersao(atual => atual + 1); }} />}
    </section>
  );
}
