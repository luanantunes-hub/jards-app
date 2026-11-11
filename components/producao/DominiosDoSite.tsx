"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { SituacaoDoDominio } from "@/lib/producao/estados";
import { lerDominio, registrosDeDns, type RegistroDeDns } from "@/lib/producao/site";

type Dominio = { id: string; dominio: string; situacao: SituacaoDoDominio; token_verificacao: string; erro: string | null; conferido_em: string | null };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const ROTULO_DA_SITUACAO: Record<SituacaoDoDominio, string> = { aguardando: "Aguardando o DNS", verificando: "Conferindo", ativo: "No ar", erro: "Com problema" };

function Copiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button type="button" aria-label={`Copiar ${valor}`} onClick={() => { void navigator.clipboard.writeText(valor).then(() => setCopiado(true)); }} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/45 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
      {copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  );
}

/** Os dois registros que a pessoa cria no DNS do domínio dela (quem registrou o domínio: Registro.br, GoDaddy, Hostinger, Cloudflare...). */
function RegistrosDeDns({ registros }: { registros: RegistroDeDns[] }) {
  return (
    <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.1)" }}>
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">Registros para criar no DNS do domínio</caption>
        <thead><tr className="border-b border-black/[.06]">{["Para que serve", "Tipo", "Nome (host)", "Valor"].map(titulo => <th key={titulo} scope="col" className="px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{titulo}</th>)}</tr></thead>
        <tbody>
          {registros.map(registro => (
            <tr key={`${registro.tipo}-${registro.nome}`} className="border-b border-black/[.06] last:border-b-0">
              <td className="px-3 py-2 text-[0.75rem] text-black/60">{registro.para === "apontar" ? "Apontar o domínio para o Jards" : "Provar que o domínio é seu"}</td>
              <td className="px-3 py-2 text-[0.8125rem] font-medium text-[#282525]">{registro.tipo}</td>
              <td className="px-3 py-2 font-mono text-[0.75rem] text-[#282525]"><span className="inline-flex items-center gap-1">{registro.nome}{registro.nome.startsWith("@") ? null : <Copiar valor={registro.nome} />}</span></td>
              <td className="px-3 py-2 font-mono text-[0.75rem] text-[#282525]"><span className="inline-flex items-center gap-1 break-all">{registro.valor}<Copiar valor={registro.valor} /></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** O domínio da pessoa ligado ao site (PD12.1b): o site abre só nele. Cadastrar, criar os registros no DNS, conferir e remover. */
export function DominiosDoSite({ siteId, podeEditar }: { siteId: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const [dominios, setDominios] = useState<Dominio[] | null>(null);
  const [novo, setNovo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [conferindo, setConferindo] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [apontar, setApontar] = useState<Record<string, RegistroDeDns[]>>({});
  const [pendencias, setPendencias] = useState<Record<string, string[]>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_site_dominios").select("id, dominio, situacao, token_verificacao, erro, conferido_em").eq("site_id", siteId).order("created_at");
      if (!ativo) return;
      setDominios((data ?? []) as Dominio[]);
      if (error) setErro("Não foi possível carregar os domínios. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [siteId, versao]);

  async function chamar(metodo: "POST" | "PUT" | "DELETE", corpo: object): Promise<{ ok: boolean; status: number; dados: Record<string, unknown> }> {
    const resposta = await fetch(`/api/producao/sites/${siteId}/dominio`, { method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
    return { ok: resposta.ok, status: resposta.status, dados: (await resposta.json().catch(() => ({}))) as Record<string, unknown> };
  }

  const mensagemDeErro = (dados: Record<string, unknown>, padrao: string) => (typeof dados.mensagem === "string" ? dados.mensagem : typeof dados.error === "string" && dados.error.includes(" ") ? dados.error : padrao);

  async function adicionar() {
    const leitura = lerDominio(novo);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setAdicionando(true);
    setErro(null);
    const { ok, dados } = await chamar("POST", { dominio: leitura.dominio });
    setAdicionando(false);
    if (!ok) { setErro(mensagemDeErro(dados, "Não foi possível cadastrar o domínio. Tente de novo.")); return; }
    setNovo("");
    setApontar(atual => ({ ...atual, [String(dados.id)]: (dados.registros as RegistroDeDns[]) ?? [] }));
    setAberto(String(dados.id));
    recarregar();
  }

  async function conferir(dominio: Dominio) {
    setConferindo(dominio.id);
    setErro(null);
    const { ok, dados } = await chamar("PUT", { id: dominio.id });
    setConferindo(null);
    if (!ok) { setErro(mensagemDeErro(dados, "Não foi possível conferir agora. Tente de novo.")); return; }
    setApontar(atual => ({ ...atual, [dominio.id]: (dados.registros as RegistroDeDns[]) ?? [] }));
    setPendencias(atual => ({ ...atual, [dominio.id]: (dados.pendencias as string[]) ?? [] }));
    recarregar();
  }

  function remover(dominio: Dominio) {
    confirmDelete({
      title: "Tirar o domínio do site?",
      description: `O site deixa de abrir em ${dominio.dominio}. Quem acessar vai ver "não encontrado" até o domínio ser ligado a outro site.`,
      confirmLabel: "Tirar", pendingLabel: "Tirando…", illustration: false,
      onConfirm: async () => {
        const { ok, dados } = await chamar("DELETE", { id: dominio.id });
        if (!ok) throw new Error(mensagemDeErro(dados, "Não foi possível tirar o domínio."));
        recarregar();
      },
    });
  }

  return (
    <section aria-labelledby="dominios-do-site" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="dominios-do-site" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Domínio do site</h2>
      </div>
      <p className="mb-3 max-w-2xl text-[0.75rem] text-black/55">O site abre só no domínio que é seu, como www.casa.com.br, nunca num endereço do Jards. Cadastre o domínio, crie os dois registros no DNS dele (onde você registrou o domínio) e confira. O endereço seguro (https) é emitido sozinho.</p>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {podeEditar && (
        <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void adicionar(); }}>
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="novo-dominio" className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Seu domínio</label>
            <input id="novo-dominio" className={CAMPO} value={novo} onChange={event => setNovo(event.target.value)} placeholder="www.casa.com.br" disabled={adicionando} autoComplete="off" />
          </div>
          <PrimaryListAction onClick={() => void adicionar()} disabled={adicionando}><Plus size={13} aria-hidden="true" /> {adicionando ? "Cadastrando…" : "Conectar domínio"}</PrimaryListAction>
        </form>
      )}
      {dominios === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : dominios.length === 0 ? (
        <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhum domínio ligado. Sem ele, só você vê o site, pela prévia.</p>
      ) : (
        <ul className="space-y-3">
          {dominios.map(dominio => (
            <li key={dominio.id} className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{dominio.dominio}</p>
                  <p className="text-[0.6875rem] text-black/45">{ROTULO_DA_SITUACAO[dominio.situacao]}{dominio.conferido_em ? ` · conferido em ${dominio.conferido_em.slice(8, 10)}/${dominio.conferido_em.slice(5, 7)}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dominio.situacao === "ativo" && <a href={`https://${dominio.dominio}`} target="_blank" rel="noopener noreferrer" className={BOTAO}>Abrir o site</a>}
                  {dominio.situacao !== "ativo" && <button type="button" onClick={() => setAberto(atual => (atual === dominio.id ? null : dominio.id))} aria-expanded={aberto === dominio.id} className={BOTAO}>{aberto === dominio.id ? "Esconder os registros" : "Ver os registros"}</button>}
                  {podeEditar && dominio.situacao !== "ativo" && <button type="button" onClick={() => void conferir(dominio)} disabled={conferindo === dominio.id} className={BOTAO}>{conferindo === dominio.id ? "Conferindo…" : "Conferir agora"}</button>}
                  {podeEditar && <button type="button" onClick={() => remover(dominio)} className={BOTAO}>Tirar</button>}
                </div>
              </div>
              {(pendencias[dominio.id]?.length ?? 0) > 0 && (
                <ul className="space-y-1 border-t px-4 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }} aria-label="O que falta">
                  {pendencias[dominio.id].map(item => <li key={item} className="text-[0.75rem] text-[#B07A14]">{item}</li>)}
                </ul>
              )}
              {aberto === dominio.id && dominio.situacao !== "ativo" && (
                <div className="space-y-2 border-t px-4 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  <p className="text-[0.75rem] text-black/55">Crie estes dois registros no DNS de {dominio.dominio}. Depois clique em Conferir. O DNS pode levar de alguns minutos a algumas horas para atualizar.</p>
                  <RegistrosDeDns registros={apontar[dominio.id] ?? registrosDeDns(dominio.dominio, dominio.token_verificacao)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
