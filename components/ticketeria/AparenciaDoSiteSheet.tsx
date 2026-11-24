"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import {
  LAYOUTS_DO_MENU, LAYOUTS_DO_RODAPE, MAX_COLUNAS, MAX_LINKS_DA_FAIXA, MAX_LINKS_POR_COLUNA, MAX_POLITICAS, MAX_REDES, ROTULO_DO_LAYOUT_DO_MENU, ROTULO_DO_LAYOUT_DO_RODAPE,
  lerAparencia, lerCabecalhoParaSalvar, lerRodapeParaSalvar, type ColunaDoRodape, type LayoutDoMenu, type LayoutDoRodape, type LinkDoSite,
} from "@/lib/ticketeria/aparencia";

// As folhas "Menu do site" e "Rodapé do site" (a biblioteca de seções, passo 4; desenhos aprovados pelo dono em 20/11/2026): a pessoa escolhe o layout olhando miniaturas e preenche só o
// que ele usa. Valem para o site inteiro. Cada folha guarda a sua metade em `ticketeria_sites.aparencia` e deixa a outra como está.

const LINK = "rounded-xl text-[0.75rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40";

function Miniatura({ forma }: { forma: LayoutDoMenu | LayoutDoRodape }) {
  const barra = "bg-[#7259B5]/55", suave = "bg-[#7259B5]/25", ponto = "h-1 rounded-full bg-white/80";
  return (
    <span aria-hidden="true" className="flex h-12 w-full flex-col overflow-hidden rounded-lg bg-black/[.04]">
      {forma === "classico" && <span className={`flex h-5 items-center gap-1.5 px-1.5 ${barra}`}><span className="h-1.5 w-4 rounded-full bg-white/90" /><span className={`${ponto} w-3`} /><span className={`${ponto} w-3`} /><span className="ml-auto h-2.5 w-5 rounded-[2px] bg-white" /></span>}
      {forma === "duas_camadas" && <><span className={`flex h-2 justify-end px-1.5 ${suave}`}><span className="h-1 w-8 self-center rounded-full bg-[#7259B5]/60" /></span><span className={`flex h-4 items-center gap-1.5 px-1.5 ${barra}`}><span className="h-1.5 w-4 rounded-full bg-white/90" /><span className={`${ponto} w-3`} /><span className="ml-auto h-2.5 w-5 rounded-[2px] bg-white" /></span></>}
      {forma === "minimo" && <span className={`flex h-5 items-center gap-1.5 px-1.5 ${barra}`}><span className="h-1.5 w-4 rounded-full bg-white/90" /><span className="ml-auto h-2.5 w-4 rounded-[2px] bg-white" /><span className="h-2.5 w-4 rounded-[2px] border border-white/90" /></span>}
      {forma === "centralizado" && <span className={`flex h-9 flex-col items-center justify-center gap-1 ${barra}`}><span className="h-1.5 w-6 rounded-full bg-white/90" /><span className="flex gap-1.5"><span className={`${ponto} w-3`} /><span className={`${ponto} w-3`} /><span className={`${ponto} w-3`} /></span></span>}
      {forma === "simples" && <span className={`mt-auto flex h-5 items-center gap-2 px-1.5 ${suave}`}><span className="h-1.5 w-5 rounded-full bg-[#7259B5]/70" /><span className="h-1 w-8 rounded-full bg-[#7259B5]/40" /><span className="ml-auto h-1 w-6 rounded-full bg-[#7259B5]/40" /></span>}
      {forma === "colunas" && <span className={`mt-auto flex h-8 gap-2 px-1.5 py-1.5 ${suave}`}><span className="h-1.5 w-5 rounded-full bg-[#7259B5]/70" /><span className="flex flex-1 flex-col gap-1"><span className="h-1 w-full rounded-full bg-[#7259B5]/40" /><span className="h-1 w-2/3 rounded-full bg-[#7259B5]/40" /></span><span className="flex flex-1 flex-col gap-1"><span className="h-1 w-full rounded-full bg-[#7259B5]/40" /><span className="h-1 w-2/3 rounded-full bg-[#7259B5]/40" /></span></span>}
      {forma === "newsletter" && <span className={`mt-auto flex h-8 gap-2 px-1.5 py-1.5 ${suave}`}><span className="flex flex-1 flex-col gap-1"><span className="h-1.5 w-2/3 rounded-full bg-[#7259B5]/70" /><span className="h-2 w-6 rounded-[2px] bg-[#7259B5]/70" /></span><span className="flex flex-1 flex-col gap-1"><span className="h-1 w-full rounded-full bg-[#7259B5]/40" /><span className="h-1 w-2/3 rounded-full bg-[#7259B5]/40" /></span></span>}
    </span>
  );
}

function Escolha<T extends string>({ id, titulo, opcoes, rotulos, valor, onChange, desabilitado }: { id: string; titulo: string; opcoes: readonly T[]; rotulos: Record<T, { nome: string; frase: string }>; valor: T; onChange: (v: T) => void; desabilitado: boolean }) {
  return (
    <fieldset>
      <legend className={ROTULO}>{titulo}</legend>
      <div className="grid grid-cols-2 gap-2.5">
        {opcoes.map(o => (
          <label key={o} className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-2.5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#7259B5] ${valor === o ? "border-[#7259B5] bg-[#7259B5]/[.06] ring-1 ring-[#7259B5]" : "border-black/[.12] hover:bg-black/[.02]"}`}>
            <input type="radio" name={id} value={o} checked={valor === o} onChange={() => onChange(o)} disabled={desabilitado} className="sr-only" />
            <Miniatura forma={o as unknown as LayoutDoMenu} />
            <span className="text-[0.8125rem] font-normal text-[#282525]">{rotulos[o].nome}</span>
            <span className="text-[0.6875rem] leading-snug text-black/55">{rotulos[o].frase}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ListaDeLinks({ id, titulo, links, max, onChange, desabilitado, rotuloDoLink = "Link" }: { id: string; titulo: string; links: LinkDoSite[]; max: number; onChange: (l: LinkDoSite[]) => void; desabilitado: boolean; rotuloDoLink?: string }) {
  const mudar = (i: number, parte: Partial<LinkDoSite>) => onChange(links.map((l, j) => (j === i ? { ...l, ...parte } : l)));
  return (
    <div className="space-y-2">
      <span className={ROTULO}>{titulo}</span>
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <input aria-label={`${rotuloDoLink} ${i + 1}: texto`} className={CAMPO} value={l.rotulo} onChange={e => mudar(i, { rotulo: e.target.value })} maxLength={40} placeholder="Texto" disabled={desabilitado} />
          <input aria-label={`${rotuloDoLink} ${i + 1}: endereço`} className={CAMPO} value={l.url} onChange={e => mudar(i, { url: e.target.value })} maxLength={500} placeholder="https://" disabled={desabilitado} />
          <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} disabled={desabilitado} aria-label={`Tirar ${rotuloDoLink.toLowerCase()} ${i + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-black/35 hover:bg-black/[.05] hover:text-[#B23B3B]"><Trash2 size={13} aria-hidden="true" /></button>
        </div>
      ))}
      {links.length < max && <button type="button" onClick={() => onChange([...links, { rotulo: "", url: "https://" }])} disabled={desabilitado} id={`${id}-mais`} className={`inline-flex items-center gap-1 ${LINK}`}><Plus size={12} aria-hidden="true" /> Outro link</button>}
    </div>
  );
}

async function guardar(siteId: string, parte: "cabecalho" | "rodape", valor: unknown, atual: unknown): Promise<string | null> {
  const completa = { ...lerAparencia(atual), [parte]: valor };
  const { data, error } = await clienteDaTicketeria(createClient()).from("ticketeria_sites").update({ aparencia: completa as never }).eq("id", siteId).select("id");
  if (error) return error.code === "42501" ? "Você não pode mudar este site." : "Não foi possível salvar. Tente de novo.";
  if (!data || data.length === 0) return "Você não pode mudar este site.";
  return null;
}

export function MenuDoSiteSheet({ siteId, aparenciaAtual, onClose, onSaved }: { siteId: string; aparenciaAtual: unknown; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const a = lerAparencia(aparenciaAtual).cabecalho;
  const [layout, setLayout] = useState<LayoutDoMenu>(a.layout);
  const [botaoRotulo, setBotaoRotulo] = useState(a.botao_rotulo);
  const [botaoUrl, setBotaoUrl] = useState(a.botao_url);
  const [faixa, setFaixa] = useState<LinkDoSite[]>(a.faixa);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerCabecalhoParaSalvar({ layout, botao_rotulo: botaoRotulo, botao_url: botaoUrl, faixa });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    const problema = await guardar(siteId, "cabecalho", leitura.valor, aparenciaAtual);
    setSalvando(false);
    if (problema) { setErro(problema); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo="Menu do site" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Salvar" onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <Escolha id={`${id}-layout`} titulo="Como mostrar o menu" opcoes={LAYOUTS_DO_MENU} rotulos={ROTULO_DO_LAYOUT_DO_MENU} valor={layout} onChange={setLayout} desabilitado={salvando} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor={`${id}-br`}>Botão de ingressos: texto (vazio esconde o botão)</label><input id={`${id}-br`} className={CAMPO} value={botaoRotulo} onChange={e => setBotaoRotulo(e.target.value)} maxLength={30} placeholder="Ingressos" disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor={`${id}-bu`}>Para onde leva (opcional)</label><input id={`${id}-bu`} className={CAMPO} value={botaoUrl} onChange={e => setBotaoUrl(e.target.value)} maxLength={500} placeholder="https://" disabled={salvando} /></div>
        </div>
        <p className="text-[0.75rem] text-black/55">Sem endereço, o botão leva à página do primeiro evento publicado. Os links do menu são as páginas do site, na ordem delas.</p>
        {layout === "duas_camadas" && <ListaDeLinks id={`${id}-faixa`} titulo="Faixa fina (imprensa, contato, educativo…)" links={faixa} max={MAX_LINKS_DA_FAIXA} onChange={setFaixa} desabilitado={salvando} rotuloDoLink="Link da faixa" />}
        <p className="text-[0.75rem] text-black/55">No celular, os links vão para um painel que abre pelo botão de menu; o botão de ingressos continua à vista.</p>
      </div>
    </TopSheet>
  );
}

export function RodapeDoSiteSheet({ siteId, aparenciaAtual, nomeDoSite, onClose, onSaved }: { siteId: string; aparenciaAtual: unknown; nomeDoSite: string; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const r = lerAparencia(aparenciaAtual).rodape;
  const [layout, setLayout] = useState<LayoutDoRodape>(r.layout);
  const [nome, setNome] = useState(r.nome);
  const [contato, setContato] = useState(r.contato);
  const [endereco, setEndereco] = useState(r.endereco);
  const [horario, setHorario] = useState(r.horario);
  const [redes, setRedes] = useState<LinkDoSite[]>(r.redes);
  const [politicas, setPoliticas] = useState<LinkDoSite[]>(r.politicas);
  const [colunas, setColunas] = useState<ColunaDoRodape[]>(r.colunas);
  const [chamada, setChamada] = useState(r.chamada);
  const [texto, setTexto] = useState(r.texto);
  const [botaoRotulo, setBotaoRotulo] = useState(r.botao_rotulo);
  const [botaoUrl, setBotaoUrl] = useState(r.botao_url);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerRodapeParaSalvar({ layout, nome, contato, endereco, horario, redes, politicas, colunas, chamada, texto, botao_rotulo: botaoRotulo, botao_url: botaoUrl });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    const problema = await guardar(siteId, "rodape", leitura.valor, aparenciaAtual);
    setSalvando(false);
    if (problema) { setErro(problema); return; }
    onSaved();
    fechar();
  }
  const campo = (rotulo: string, valor: string, mudar: (v: string) => void, max: number, placeholder = "") => { const campoId = `${id}-${rotulo}`; return <div><label className={ROTULO} htmlFor={campoId}>{rotulo}</label><input id={campoId} className={CAMPO} value={valor} onChange={e => mudar(e.target.value)} maxLength={max} placeholder={placeholder} disabled={salvando} /></div>; };

  return (
    <TopSheet titulo="Rodapé do site" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Salvar" onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <Escolha id={`${id}-layout`} titulo="Como mostrar o rodapé" opcoes={LAYOUTS_DO_RODAPE} rotulos={ROTULO_DO_LAYOUT_DO_RODAPE} valor={layout} onChange={setLayout} desabilitado={salvando} />
        {campo("Nome (vazio usa o título do site)", nome, setNome, 80, nomeDoSite)}
        {campo("Contato", contato, setContato, 160, "contato@suacompanhia.com.br · (15) 99999-0000")}
        {layout !== "simples" && campo("Endereço", endereco, setEndereco, 200, "Rua das Flores, 100, Sorocaba/SP")}
        {layout !== "simples" && campo("Horário da bilheteria", horario, setHorario, 120, "Ter a dom, 14h às 20h")}
        <ListaDeLinks id={`${id}-redes`} titulo="Redes (Instagram, YouTube…)" links={redes} max={MAX_REDES} onChange={setRedes} desabilitado={salvando} rotuloDoLink="Rede" />
        <ListaDeLinks id={`${id}-pol`} titulo="Políticas (privacidade, termos…)" links={politicas} max={MAX_POLITICAS} onChange={setPoliticas} desabilitado={salvando} rotuloDoLink="Política" />
        {layout !== "simples" && (
          <div className="space-y-3">
            <span className={ROTULO}>Colunas de links</span>
            {colunas.map((c, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-black/[.08] p-3">
                <div className="flex items-center gap-2">
                  <input aria-label={`Coluna ${i + 1}: título`} className={CAMPO} value={c.titulo} onChange={e => setColunas(colunas.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} maxLength={40} placeholder="Título da coluna (Visite, Apoie…)" disabled={salvando} />
                  <button type="button" onClick={() => setColunas(colunas.filter((_, j) => j !== i))} disabled={salvando} aria-label={`Tirar a coluna ${i + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-black/35 hover:bg-black/[.05] hover:text-[#B23B3B]"><Trash2 size={13} aria-hidden="true" /></button>
                </div>
                <ListaDeLinks id={`${id}-col${i}`} titulo="Links" links={c.links} max={MAX_LINKS_POR_COLUNA} onChange={links => setColunas(colunas.map((x, j) => (j === i ? { ...x, links } : x)))} desabilitado={salvando} rotuloDoLink={`Coluna ${i + 1}, link`} />
              </div>
            ))}
            {colunas.length < MAX_COLUNAS && <button type="button" onClick={() => setColunas([...colunas, { titulo: "", links: [{ rotulo: "", url: "https://" }] }])} disabled={salvando} className={`inline-flex items-center gap-1 ${LINK}`}><Plus size={12} aria-hidden="true" /> Outra coluna</button>}
          </div>
        )}
        {layout === "newsletter" && (
          <div className="space-y-3">
            {campo("Chamada", chamada, setChamada, 80, "Receba a programação do mês")}
            {campo("Texto", texto, setTexto, 200, "Um e-mail por mês, com as estreias e as datas que abrem vendas.")}
            <div className="grid gap-3 sm:grid-cols-2">{campo("Botão: texto", botaoRotulo, setBotaoRotulo, 30, "Quero receber")}{campo("Botão: para onde leva", botaoUrl, setBotaoUrl, 500, "https://")}</div>
            <p className="text-[0.75rem] text-black/55">O botão leva ao endereço do formulário que você já usa para a sua lista (por exemplo, o do seu serviço de e-mail). A inscrição direto no site vem depois.</p>
          </div>
        )}
      </div>
    </TopSheet>
  );
}
