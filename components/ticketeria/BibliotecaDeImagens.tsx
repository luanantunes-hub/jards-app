"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso } from "@/components/ticketeria/FolhasDosEventos";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ESPACO_DAS_IMAGENS, MAX_IMAGENS_POR_ORGANIZACAO, caminhoDaImagem, descricaoDaImagem, lerImagens, mensagemDoErroDeImagem, nomeDaImagem, type ImagemDaBiblioteca } from "@/lib/ticketeria/imagens";
import { ErroDaImagem, prepararImagem } from "@/lib/ticketeria/imagens-navegador";

// A folha "Biblioteca de imagens": as imagens da loja em grade, com Enviar, Usar esta imagem e Apagar. Desenho aprovado pelo dono em 20/11/2026.
// A folha é desenhada no <body> (portal): ela abre por cima de outra folha, e uma folha dentro de outra, que se move com transform, perderia a posição.

const LINK = "rounded-xl text-[0.75rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

export const urlDaImagem = (caminho: string) => createClient().storage.from(ESPACO_DAS_IMAGENS).getPublicUrl(caminho).data.publicUrl;

export function BibliotecaDeImagens({ organizationId, aoEscolher, onClose }: { organizationId: string; aoEscolher?: (url: string, nome: string) => void; onClose: () => void }) {
  const [imagens, setImagens] = useState<ImagemDaBiblioteca[] | "erro" | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_imagens").select("id, caminho, nome, tipo, bytes, largura, altura, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(MAX_IMAGENS_POR_ORGANIZACAO);
      if (ativo) setImagens(error ? "erro" : lerImagens(data));
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  async function enviar(arquivo: File) {
    setTrabalhando(true);
    setErro(null);
    try {
      const pronta = await prepararImagem(arquivo);
      const id = crypto.randomUUID();
      const caminho = caminhoDaImagem(organizationId, id, pronta.tipo);
      if (!caminho) throw new ErroDaImagem("Não foi possível enviar a imagem. Tente de novo.");
      const cliente = createClient();
      const envio = await cliente.storage.from(ESPACO_DAS_IMAGENS).upload(caminho, pronta.blob, { contentType: pronta.tipo, cacheControl: "31536000", upsert: false });
      if (envio.error) throw new ErroDaImagem(mensagemDoErroDeImagem(envio.error));
      const { data: { user } } = await cliente.auth.getUser();
      const { error } = await clienteDaTicketeria(cliente).from("ticketeria_site_imagens").insert({ id, organization_id: organizationId, caminho, nome: nomeDaImagem(arquivo.name), tipo: pronta.tipo, bytes: pronta.blob.size, largura: pronta.largura, altura: pronta.altura, criado_por: user?.id ?? null });
      if (error) {
        await cliente.storage.from(ESPACO_DAS_IMAGENS).remove([caminho]);
        throw new ErroDaImagem(mensagemDoErroDeImagem(error));
      }
      setEscolhida(id);
      setVersao(v => v + 1);
    } catch (e) {
      setErro(e instanceof ErroDaImagem ? e.message : "Não foi possível enviar a imagem. Tente de novo.");
    }
    setTrabalhando(false);
  }

  async function apagar(imagem: ImagemDaBiblioteca) {
    setTrabalhando(true);
    setErro(null);
    const cliente = createClient();
    const remocao = await cliente.storage.from(ESPACO_DAS_IMAGENS).remove([imagem.caminho]);
    if (remocao.error) { setErro(mensagemDoErroDeImagem(remocao.error)); setTrabalhando(false); return; }
    const { error } = await clienteDaTicketeria(cliente).from("ticketeria_site_imagens").delete().eq("id", imagem.id);
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeImagem(error)); return; }
    setApagando(null);
    if (escolhida === imagem.id) setEscolhida(null);
    setVersao(v => v + 1);
  }

  const lista = Array.isArray(imagens) ? imagens : [];
  const atual = lista.find(i => i.id === escolhida) ?? null;
  const alvo = typeof document === "undefined" ? null : document.body;
  if (!alvo) return null;

  return createPortal(
    <TopSheet
      titulo="Biblioteca de imagens"
      largura="34rem"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} className="mr-auto rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{aoEscolher ? "Cancelar" : "Fechar"}</button>
          {aoEscolher && atual && <button type="button" onClick={() => { aoEscolher(urlDaImagem(atual.caminho), atual.nome); fechar(); }} disabled={trabalhando} className="rounded-xl acao-salvar px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">Usar esta imagem</button>}
        </>
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.75rem] text-black/55">{Array.isArray(imagens) ? `${lista.length} de ${MAX_IMAGENS_POR_ORGANIZACAO} imagens` : ""}</p>
          <button type="button" onClick={() => entrada.current?.click()} disabled={trabalhando || lista.length >= MAX_IMAGENS_POR_ORGANIZACAO} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1C0E33] px-3.5 text-[0.75rem] font-normal text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><Upload size={13} aria-hidden="true" />{trabalhando ? "Enviando…" : "Enviar imagem"}</button>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Escolher o arquivo da imagem" tabIndex={-1} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
        </div>
        {erro && <Aviso texto={erro} />}
        {imagens === null && <p className="text-[0.8125rem] text-black/55">Carregando…</p>}
        {imagens === "erro" && <Aviso texto="Não foi possível carregar as imagens. Tente de novo." />}
        {Array.isArray(imagens) && lista.length === 0 && <p className="rounded-xl border border-black/[.1] px-4 py-5 text-[0.8125rem] text-black/55">Nenhuma imagem ainda. Envie a primeira: ela fica aqui para usar em qualquer bloco do site.</p>}
        {lista.length > 0 && (
          <ul className="grid grid-cols-3 gap-2" role="listbox" aria-label="Imagens da loja">
            {lista.map(i => (
              <li key={i.id}>
                <button type="button" role="option" aria-selected={escolhida === i.id} onClick={() => { setEscolhida(i.id); setApagando(null); }} className={`block w-full rounded-xl border p-1 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${escolhida === i.id ? "border-[#1C0E33]" : "border-black/[.1] hover:border-black/25"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagem da própria biblioteca (endereço público do armazenamento) */}
                  <img src={urlDaImagem(i.caminho)} alt={i.nome} loading="lazy" className="h-16 w-full rounded-[0.55rem] bg-black/[.04] object-cover" />
                  <span className="mt-1 block truncate text-[0.625rem] text-[#282525]">{i.nome}</span>
                  <span className="block text-[0.625rem] text-black/50">{descricaoDaImagem(i)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {atual && (
          apagando === atual.id ? (
            <div className="rounded-xl border border-black/[.1] px-3 py-2.5">
              <p className="text-[0.75rem] leading-relaxed text-black/70">Apagar <span className="text-[#282525]">{atual.nome}</span>? Se ela estiver em algum bloco do site, o bloco fica sem a imagem.</p>
              <div className="mt-2 flex items-center justify-end gap-4">
                <button type="button" onClick={() => setApagando(null)} disabled={trabalhando} className="text-[0.75rem] text-black/45 transition hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
                <button type="button" onClick={() => void apagar(atual)} disabled={trabalhando} className="text-[0.75rem] text-[#B23B3B] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">{trabalhando ? "Apagando…" : "Apagar de vez"}</button>
              </div>
            </div>
          ) : <div className="flex justify-end"><button type="button" onClick={() => setApagando(atual.id)} disabled={trabalhando} className={LINK}>Apagar esta imagem</button></div>
        )}
        <p className="text-[0.6875rem] leading-relaxed text-black/50">Aceita JPG, PNG e WebP, até 15 MB. O Jards reduz para no máximo 2000 pixels de largura, converte para WebP e tira os dados da foto (como o local onde foi tirada). As imagens são públicas: qualquer pessoa com o endereço as vê, como no site.</p>
      </div>
    </TopSheet>,
    alvo,
  );
}
