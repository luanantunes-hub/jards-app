"use client";

import { AppWindow, AtSign, Braces, Code, Globe, Handshake, LayoutGrid, Link2, MousePointerClick, Plug, QrCode, Repeat, Store, Ticket, Users, Webhook, type LucideIcon } from "lucide-react";
import { gruposDaLoja, type Caixa, type EstadoDaCaixa, type IconeDaCaixa } from "@/lib/ticketeria/vender";
import type { EscolhasDaLoja } from "@/lib/ticketeria/menu";

const ICONES: Record<IconeDaCaixa, LucideIcon> = {
  store: Store, qr: QrCode, globe: Globe, arroba: AtSign, vitrine: LayoutGrid, codigo: Code, botao: MousePointerClick, janela: AppWindow, link: Link2,
  parceria: Handshake, pessoas: Users, api: Braces, webhook: Webhook, plug: Plug, passe: Ticket, assinatura: Repeat,
};

/** Caixas que levam uma ilustração no lugar do ícone (a imagem tem o fundo transparente). */
const ILUSTRACAO_DA_CAIXA: Partial<Record<string, string>> = { bilheteria: "/ilustracoes/ticketeria/caixa-bilheteria.webp", "site-cms": "/ilustracoes/ticketeria/caixa-site.webp", collab: "/ilustracoes/ticketeria/caixa-collab.webp", "qr-cartaz": "/ilustracoes/ticketeria/caixa-qr.webp" };

const ROTULO_DO_GRUPO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

function Etiqueta({ estado }: { estado: EstadoDaCaixa }) {
  if (estado === "em_uso") return <span className="rounded-full bg-[#6450D2]/10 px-2 py-0.5 text-[0.6875rem] font-normal text-[#6450D2]">Em uso</span>;
  if (estado === "em_breve") return <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-[0.6875rem] font-normal text-black/45">Em breve</span>;
  return null;
}

/** Uma caixa: o ícone (ou a ilustração, com o texto ao lado), o nome, uma frase e, quando cabe, "Em uso" ou "Em breve". Sem destino ainda, não é um botão. */
function CaixaDeVenda({ caixa, onAbrir }: { caixa: Caixa & { estado: EstadoDaCaixa }; onAbrir: (caixa: Caixa) => void }) {
  const Icone = ICONES[caixa.icone];
  const ilustracao = ILUSTRACAO_DA_CAIXA[caixa.id];
  const titulo = <span className={`block text-[1rem] font-normal ${caixa.estado === "em_breve" ? "text-black/45" : "text-[#282525]"}`}>{caixa.titulo}</span>;
  const descricao = <span className={`mt-1 block text-[0.8125rem] ${caixa.estado === "em_breve" ? "text-black/35" : "text-black/55"}`}>{caixa.descricao}</span>;
  // Com ilustração: ela à esquerda e, à direita, a etiqueta, o nome e a frase.
  const conteudo = ilustracao ? (
    <span className="flex items-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- ilustração estática, já reduzida */}
      <img src={ilustracao} alt="" loading="lazy" className="h-28 max-w-[8rem] w-auto shrink-0 object-contain" />
      <span className="min-w-0 flex-1">
        <span className="mb-2 flex"><Etiqueta estado={caixa.estado} /></span>
        {titulo}
        {descricao}
      </span>
    </span>
  ) : (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${caixa.estado === "em_breve" ? "bg-black/[.04] text-black/35" : "bg-[#6450D2]/10 text-[#6450D2]"}`}><Icone size={17} aria-hidden="true" /></span>
        <Etiqueta estado={caixa.estado} />
      </span>
      <span className="mt-4 block">{titulo}</span>
      {descricao}
    </>
  );
  if (caixa.estado === "em_breve") return <div className="rounded-xl border border-dashed border-black/[.14] p-5" aria-label={`${caixa.titulo}, em breve`}>{conteudo}</div>;
  return (
    <button type="button" onClick={() => onAbrir(caixa)} className={`rounded-xl border bg-white p-5 text-left transition hover:border-[#6450D2]/50 hover:bg-[#6450D2]/[.03] ${FOCO} ${caixa.estado === "em_uso" ? "border-[#6450D2]/45" : "border-black/[.12]"}`}>
      {conteudo}
    </button>
  );
}

/** A página de Vendas: as formas de vender, em caixas, de cinco em cinco grupos. `onAbrir` leva à página da caixa (e adiciona o canal, se a loja ainda não o usava). */
export function VenderView({ loja, onAbrir }: { loja: EscolhasDaLoja; onAbrir: (caixa: Caixa) => void }) {
  return (
    <div className="space-y-8">
      {gruposDaLoja(loja).map(({ grupo, caixas }) => (
        <section key={grupo.id} aria-labelledby={`vender-${grupo.id}`}>
          <h2 id={`vender-${grupo.id}`} className={`mb-3 ${ROTULO_DO_GRUPO}`}>{grupo.titulo}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {caixas.map(caixa => <CaixaDeVenda key={caixa.id} caixa={caixa} onAbrir={onAbrir} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
