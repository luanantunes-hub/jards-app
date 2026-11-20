"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilos";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerMarca } from "@/lib/producao/marcas";
import { RetornoDaMarcaSheet } from "@/components/producao/RetornoDaMarcaSheet";
import { PortalDaMarcaSheet } from "@/components/producao/PortalDaMarcaSheet";

export type MarcaDaLista = { id: string; nome: string; site_url: string | null; logo_url: string | null; arquivada: boolean };

type Edicao = { id: string | null; nome: string; site: string; logo: string };

const BUCKET_DE_IMAGENS = "projetos-identidade";
const LIMITE_DO_LOGO = 2 * 1024 * 1024;
const EXTENSAO_DO_LOGO: Record<string, string> = { "image/png": "png", "image/webp": "webp" };

/** As marcas que apresentam as sessões da programação pública (PD12.3): cadastra-se uma vez e escolhe-se na sessão. Arquivar tira a marca da programação pública. */
export function MarcasSheet({ organizationId, podeEditar, onClose, onMudou }: { organizationId: string; podeEditar: boolean; onClose: () => void; onMudou: () => void }) {
  const [marcas, setMarcas] = useState<MarcaDaLista[] | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [retornoDe, setRetornoDe] = useState<MarcaDaLista | null>(null);
  const [portalDe, setPortalDe] = useState<MarcaDaLista | null>(null);
  const entradaDoLogo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_marcas").select("id, nome, site_url, logo_url, arquivada").eq("organization_id", organizationId).order("nome");
      if (!ativo) return;
      setMarcas((data ?? []) as MarcaDaLista[]);
      if (error) setErro("Não foi possível carregar as marcas. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  function atualizado() {
    setVersao(atual => atual + 1);
    onMudou();
  }

  async function salvar() {
    if (!edicao) return;
    const leitura = lerMarca({ nome: edicao.nome, site: edicao.site, logo: edicao.logo });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = edicao.id
      ? await producao.from("producao_marcas").update(leitura.marca).eq("id", edicao.id)
      : await producao.from("producao_marcas").insert({ organization_id: organizationId, ...leitura.marca });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "Já existe uma marca com esse nome." : error.code === "42501" ? "Você não pode mudar as marcas." : error.code === "23514" ? "Confira o nome e os endereços (começam com https://)." : "Não foi possível salvar. Tente de novo.");
      return;
    }
    setEdicao(null);
    atualizado();
  }

  async function arquivar(marca: MarcaDaLista) {
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_marcas").update({ arquivada: !marca.arquivada }).eq("id", marca.id);
    if (error) { setErro("Não foi possível mudar a marca. Tente de novo."); return; }
    atualizado();
  }

  /** Envia a imagem para o armazenamento público de imagens e põe o endereço dela no campo do logo (o endereço continua podendo ser digitado). */
  async function enviarLogo(arquivo: File) {
    setErro(null);
    const extensao = EXTENSAO_DO_LOGO[arquivo.type];
    if (!extensao) { setErro("O logo precisa ser uma imagem PNG ou WebP."); return; }
    if (arquivo.size > LIMITE_DO_LOGO) { setErro("O logo passa de 2 MB."); return; }
    setEnviando(true);
    const supabase = createClient();
    const caminho = `${organizationId}/producao-marcas/${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage.from(BUCKET_DE_IMAGENS).upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    setEnviando(false);
    if (error) { setErro("Não foi possível enviar o logo. Tente de novo."); return; }
    const { data } = supabase.storage.from(BUCKET_DE_IMAGENS).getPublicUrl(caminho);
    setEdicao(atual => (atual ? { ...atual, logo: data.publicUrl } : atual));
  }

  return (
    <>
    <TopSheet
      titulo="Marcas que apresentam"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Fechar</button>
          {podeEditar && edicao && <button type="button" onClick={() => void salvar()} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : edicao.id ? "Salvar marca" : "Criar marca"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <p className="text-[0.75rem] text-black/55">
          Cadastre uma vez as marcas que patrocinam, apoiam ou realizam. Na sessão você escolhe qual apresenta, e a programação pública mostra &ldquo;Apresentada por&rdquo; com o nome, o logo e o site dela.
        </p>
        {marcas === null ? (
          <div className="h-12 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : marcas.length === 0 ? (
          <p className="text-[0.75rem] text-black/45">Nenhuma marca ainda.{podeEditar ? " Use \"Nova marca\"." : ""}</p>
        ) : (
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {marcas.map(marca => (
              <li key={marca.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1 basis-40">
                  <span className={`block truncate text-[0.8125rem] font-medium ${marca.arquivada ? "text-black/40" : "text-[#282525]"}`}>{marca.nome}</span>
                  <span className="block truncate text-[0.6875rem] text-black/45">{[marca.arquivada ? "arquivada, não aparece ao público" : null, marca.site_url, marca.logo_url ? "com logo" : null].filter(Boolean).join(" · ") || "sem site nem logo"}</span>
                </span>
                <button type="button" onClick={() => setRetornoDe(marca)} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Retorno</button>
                <button type="button" onClick={() => setPortalDe(marca)} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Portal</button>
                {podeEditar && (
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => { setErro(null); setEdicao({ id: marca.id, nome: marca.nome, site: marca.site_url ?? "", logo: marca.logo_url ?? "" }); }} aria-label={`Editar ${marca.nome}`} title="Editar" className="flex h-10 w-10 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Pencil size={14} aria-hidden="true" /></button>
                    <button type="button" onClick={() => void arquivar(marca)} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{marca.arquivada ? "Restaurar" : "Arquivar"}</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {podeEditar && !edicao && (
          <button type="button" onClick={() => { setErro(null); setEdicao({ id: null, nome: "", site: "", logo: "" }); }} className="flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Nova marca</button>
        )}
        {podeEditar && edicao && (
          <div className="space-y-3 rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.12)" }}>
            <p className="text-[0.8125rem] font-medium text-[#282525]">{edicao.id ? "Editar marca" : "Nova marca"}</p>
            <div><label className={ROTULO} htmlFor="marca-nome">Nome</label><input id="marca-nome" autoFocus className={CAMPO} value={edicao.nome} onChange={event => setEdicao({ ...edicao, nome: event.target.value })} maxLength={120} placeholder="Banco Central" disabled={salvando} /></div>
            <div><label className={ROTULO} htmlFor="marca-site">Site (opcional)</label><input id="marca-site" className={CAMPO} value={edicao.site} onChange={event => setEdicao({ ...edicao, site: event.target.value })} placeholder="https://www.exemplo.com.br" disabled={salvando} /></div>
            <div>
              <label className={ROTULO} htmlFor="marca-logo">Logo (opcional)</label>
              <div className="flex items-start gap-2">
                <input id="marca-logo" className={`${CAMPO} min-w-0 flex-1`} value={edicao.logo} onChange={event => setEdicao({ ...edicao, logo: event.target.value })} placeholder="https://www.exemplo.com.br/logo.png" disabled={salvando || enviando} />
                <input ref={entradaDoLogo} type="file" accept="image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={event => { const escolhido = event.target.files?.[0]; event.target.value = ""; if (escolhido) void enviarLogo(escolhido); }} />
                <button type="button" onClick={() => entradaDoLogo.current?.click()} disabled={salvando || enviando} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded border border-black/12 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><ImagePlus size={13} aria-hidden="true" /> {enviando ? "Enviando…" : "Enviar imagem"}</button>
              </div>
            </div>
            <button type="button" onClick={() => setEdicao(null)} disabled={salvando} className="rounded px-3 py-2 text-[0.75rem] font-medium text-black/50 hover:bg-black/[.05]">Cancelar</button>
          </div>
        )}
      </div>
    </TopSheet>
      {retornoDe && <RetornoDaMarcaSheet marca={{ id: retornoDe.id, nome: retornoDe.nome }} onClose={() => setRetornoDe(null)} />}
      {portalDe && <PortalDaMarcaSheet marcaId={portalDe.id} marca={portalDe.nome} podeEditar={podeEditar} onClose={() => setPortalDe(null)} />}
    </>
  );
}
