"use client";

import { useId, useState } from "react";
import { CalendarClock, Clock, Columns2, HelpCircle, Image as IconeImagem, ImagePlus, LayoutGrid, MapPin, MousePointerClick, Phone, Play, Store, Ticket, Type, AlignLeft, CalendarDays, Plus, Trash2, type LucideIcon } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, AREA, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { CampoDeImagem } from "@/components/ticketeria/CampoDeImagem";
import { instanteNoFuso, partesNoFuso } from "@/lib/ticketeria/eventos";
import { GRUPOS_DE_BLOCOS, ROTULO_DO_TIPO_DE_BLOCO, lerBloco, type Bloco, type TipoDeBloco } from "@/lib/ticketeria/site";

// O seletor "Acrescentar bloco" (blocos em três grupos) e as folhas dos blocos novos do construtor (capa, duas colunas, galeria, vídeo, mapa, contagem regressiva, perguntas e patrocinadores).
// Desenho aprovado pelo dono em 20/11/2026. Os blocos antigos seguem na folha de EditorDoSite.tsx.

const FUSO = "America/Sao_Paulo";
const LINK = "rounded-xl text-[0.75rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

/** Os tipos que esta folha edita (os outros têm folha própria em EditorDoSite.tsx). */
export const TIPOS_DAS_FOLHAS_NOVAS: readonly TipoDeBloco[] = ["capa", "colunas", "galeria", "video", "mapa", "contagem", "faq", "patrocinadores", "agenda"];

const ICONE_DO_TIPO: Record<TipoDeBloco, LucideIcon> = {
  capa: IconeImagem, titulo: Type, texto: AlignLeft, colunas: Columns2, imagem: ImagePlus, galeria: LayoutGrid, video: Play, mapa: MapPin, contato: Phone,
  ingressos: Ticket, agenda: CalendarClock, botao: MousePointerClick, contagem: Clock, faq: HelpCircle, patrocinadores: Store, programacao: CalendarDays,
};

const NOME_CURTO: Partial<Record<TipoDeBloco, string>> = { agenda: "Agenda", programacao: "Programação", botao: "Botão", contagem: "Contagem", faq: "Perguntas" };

/** A folha "Acrescentar bloco": os blocos em grupos, cada um com seu ícone. Programação só aparece com espaço da Produção, e ingressos só com evento na loja. */
export function AcrescentarBlocoSheet({ temEspacos, temEventos, onEscolher, onClose }: { temEspacos: boolean; temEventos: boolean; onEscolher: (tipo: TipoDeBloco) => void; onClose: () => void }) {
  return (
    <TopSheet titulo="Acrescentar bloco" onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className="rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>}>
      <div className="space-y-4">
        {GRUPOS_DE_BLOCOS.map(grupo => {
          const tipos = grupo.tipos.filter(t => (t !== "programacao" || temEspacos) && ((t !== "ingressos" && t !== "agenda") || temEventos));
          if (tipos.length === 0) return null;
          return (
            <section key={grupo.titulo} aria-label={grupo.titulo}>
              <h3 className="mb-1.5 text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">{grupo.titulo}</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {tipos.map(tipo => {
                  const Icone = ICONE_DO_TIPO[tipo];
                  return (
                    <button key={tipo} type="button" onClick={() => onEscolher(tipo)} className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border border-black/[.1] bg-white px-1.5 py-2 text-center text-[0.75rem] text-[#282525] transition hover:border-black/25 hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
                      <Icone size={17} aria-hidden="true" className="text-black/60" />
                      <span>{NOME_CURTO[tipo] ?? ROTULO_DO_TIPO_DE_BLOCO[tipo]}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </TopSheet>
  );
}

type ColunaEmEdicao = { tipo: "texto" | "imagem"; texto: string; url: string; alt: string };
type ImagemEmEdicao = { url: string; alt: string; link: string };
type PerguntaEmEdicao = { pergunta: string; resposta: string };

const colunaInicial = (c: Extract<Bloco, { tipo: "colunas" }>["esquerda"] | undefined, tipo: "texto" | "imagem"): ColunaEmEdicao => (c ? { tipo: c.tipo, texto: c.tipo === "texto" ? c.texto : "", url: c.tipo === "imagem" ? c.url : "https://", alt: c.tipo === "imagem" ? c.alt : "" } : { tipo, texto: "", url: "https://", alt: "" });
const entradaDaColuna = (c: ColunaEmEdicao) => (c.tipo === "texto" ? { tipo: "texto", texto: c.texto } : { tipo: "imagem", url: c.url, alt: c.alt });

function CamposDaColuna({ id, nome, coluna, onChange, desabilitado, organizationId }: { id: string; nome: string; coluna: ColunaEmEdicao; onChange: (c: ColunaEmEdicao) => void; desabilitado: boolean; organizationId: string }) {
  return (
    <fieldset className="space-y-2 rounded-xl border border-black/[.08] p-3">
      <legend className="px-1 text-[0.6875rem] text-black/55">{nome}</legend>
      <div className="flex gap-4 text-[0.8125rem]">
        {(["texto", "imagem"] as const).map(t => (
          <label key={t} className="flex items-center gap-1.5"><input type="radio" name={`${id}-tipo`} checked={coluna.tipo === t} onChange={() => onChange({ ...coluna, tipo: t })} disabled={desabilitado} className="accent-[#1C0E33]" />{t === "texto" ? "Texto" : "Imagem"}</label>
        ))}
      </div>
      {coluna.tipo === "texto"
        ? <textarea aria-label={`Texto da coluna ${nome.toLowerCase()}`} rows={4} className={AREA} value={coluna.texto} onChange={e => onChange({ ...coluna, texto: e.target.value })} maxLength={2000} disabled={desabilitado} />
        : (
          <>
            <CampoDeImagem id={`${id}-url`} ariaLabel={`Endereço da imagem da coluna ${nome.toLowerCase()}`} valor={coluna.url} onChange={url => onChange({ ...coluna, url })} organizationId={organizationId} desabilitado={desabilitado} />
            <input aria-label={`Texto alternativo da imagem da coluna ${nome.toLowerCase()}`} className={CAMPO} value={coluna.alt} onChange={e => onChange({ ...coluna, alt: e.target.value })} maxLength={200} placeholder="Descreva a imagem" disabled={desabilitado} />
          </>
        )}
    </fieldset>
  );
}

/** A folha de um bloco novo (ou de um existente, ao editar). `tipo` é um de TIPOS_DAS_FOLHAS_NOVAS. */
export function BlocoNovoSheet({ bloco, tipo, organizationId, onClose, onSalvar }: { bloco?: Bloco; tipo: TipoDeBloco; organizationId: string; onClose: () => void; onSalvar: (bloco: Bloco) => Promise<string | null> }) {
  const id = useId();
  const b = bloco?.tipo === tipo ? bloco : undefined;
  const [titulo, setTitulo] = useState(b && "titulo" in b ? b.titulo : "");
  const [subtitulo, setSubtitulo] = useState(b?.tipo === "capa" ? b.subtitulo : "");
  const [imagem, setImagem] = useState(b?.tipo === "capa" ? b.imagem : "");
  const [botaoRotulo, setBotaoRotulo] = useState(b?.tipo === "capa" ? b.botao_rotulo : "");
  const [botaoUrl, setBotaoUrl] = useState(b?.tipo === "capa" ? b.botao_url : "");
  const [esquerda, setEsquerda] = useState<ColunaEmEdicao>(colunaInicial(b?.tipo === "colunas" ? b.esquerda : undefined, "texto"));
  const [direita, setDireita] = useState<ColunaEmEdicao>(colunaInicial(b?.tipo === "colunas" ? b.direita : undefined, "imagem"));
  const [imagens, setImagens] = useState<ImagemEmEdicao[]>(b?.tipo === "galeria" ? b.imagens.map(i => ({ ...i, link: "" })) : [{ url: "https://", alt: "", link: "" }, { url: "https://", alt: "", link: "" }]);
  const [patrocinadores, setPatrocinadores] = useState<ImagemEmEdicao[]>(b?.tipo === "patrocinadores" ? b.itens : [{ url: "https://", alt: "", link: "" }]);
  const [video, setVideo] = useState(b?.tipo === "video" ? (b.provedor === "youtube" ? `https://www.youtube.com/watch?v=${b.id}` : `https://vimeo.com/${b.id}`) : "");
  const [endereco, setEndereco] = useState(b?.tipo === "mapa" ? b.endereco : "");
  const inicial = b?.tipo === "contagem" ? partesNoFuso(b.ate, FUSO) : { dia: "", hora: "20:00" };
  const [dia, setDia] = useState(inicial.dia);
  const [hora, setHora] = useState(inicial.hora);
  const [depois, setDepois] = useState(b?.tipo === "contagem" ? b.depois : "Já começou!");
  const [perguntas, setPerguntas] = useState<PerguntaEmEdicao[]>(b?.tipo === "faq" ? b.itens : [{ pergunta: "", resposta: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function entrada(): unknown {
    switch (tipo) {
      case "capa": return { tipo, titulo, subtitulo, imagem, botao_rotulo: botaoRotulo, botao_url: botaoUrl };
      case "colunas": return { tipo, esquerda: entradaDaColuna(esquerda), direita: entradaDaColuna(direita) };
      case "galeria": return { tipo, titulo, imagens: imagens.map(i => ({ url: i.url, alt: i.alt })) };
      case "video": return { tipo, titulo, url: video };
      case "mapa": return { tipo, titulo, endereco };
      case "contagem": return { tipo, titulo, depois, ate: instanteNoFuso(dia, hora, FUSO) ?? "" };
      case "faq": return { tipo, titulo, itens: perguntas };
      case "patrocinadores": return { tipo, titulo, itens: patrocinadores };
      case "agenda": return { tipo, titulo };
      default: return { tipo };
    }
  }

  async function salvar(fechar: () => void) {
    const leitura = lerBloco(entrada());
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    const problema = await onSalvar(leitura.bloco);
    setSalvando(false);
    if (problema) { setErro(problema); return; }
    fechar();
  }

  const campoTitulo = (rotulo = "Título (opcional)") => <div><label className={ROTULO} htmlFor={`${id}-titulo`}>{rotulo}</label><input id={`${id}-titulo`} className={CAMPO} value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120} disabled={salvando} /></div>;
  const mudar = <T,>(lista: T[], indice: number, valor: Partial<T>): T[] => lista.map((x, i) => (i === indice ? { ...x, ...valor } : x));

  return (
    <TopSheet
      titulo={`${bloco ? "Editar" : "Novo"} bloco: ${ROTULO_DO_TIPO_DE_BLOCO[tipo]}`}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={bloco ? "Salvar" : "Acrescentar"} onSalvar={() => void salvar(fechar)} />}
    >
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {tipo === "capa" && (
          <>
            <div><label className={ROTULO} htmlFor={`${id}-titulo`}>Título</label><input id={`${id}-titulo`} autoFocus className={CAMPO} value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120} disabled={salvando} /></div>
            <div><label className={ROTULO} htmlFor={`${id}-sub`}>Subtítulo (opcional)</label><input id={`${id}-sub`} className={CAMPO} value={subtitulo} onChange={e => setSubtitulo(e.target.value)} maxLength={200} disabled={salvando} /></div>
            <CampoDeImagem id={`${id}-img`} rotulo="Imagem de fundo (https://…, opcional)" valor={imagem} onChange={setImagem} organizationId={organizationId} desabilitado={salvando} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={ROTULO} htmlFor={`${id}-br`}>Botão: texto (opcional)</label><input id={`${id}-br`} className={CAMPO} value={botaoRotulo} onChange={e => setBotaoRotulo(e.target.value)} maxLength={60} placeholder="Comprar ingressos" disabled={salvando} /></div>
              <div><label className={ROTULO} htmlFor={`${id}-bu`}>Botão: para onde leva</label><input id={`${id}-bu`} className={CAMPO} value={botaoUrl} onChange={e => setBotaoUrl(e.target.value)} maxLength={500} placeholder="https://" disabled={salvando} /></div>
            </div>
            <p className="text-[0.75rem] text-black/55">Com imagem de fundo, o texto sai em branco sobre a imagem escurecida; sem ela, a capa usa a cor do site.</p>
          </>
        )}
        {tipo === "colunas" && (
          <>
            <CamposDaColuna id={`${id}-e`} nome="Esquerda" coluna={esquerda} onChange={setEsquerda} desabilitado={salvando} organizationId={organizationId} />
            <CamposDaColuna id={`${id}-d`} nome="Direita" coluna={direita} onChange={setDireita} desabilitado={salvando} organizationId={organizationId} />
            <p className="text-[0.75rem] text-black/55">No celular, as colunas ficam uma em cima da outra.</p>
          </>
        )}
        {tipo === "galeria" && (
          <>
            {campoTitulo()}
            <ul className="space-y-2">
              {imagens.map((im, i) => (
                <li key={i} className="space-y-1.5 rounded-xl border border-black/[.08] p-3">
                  <div className="flex items-center justify-between"><span className="text-[0.6875rem] text-black/55">Imagem {i + 1}</span>{imagens.length > 2 && <button type="button" onClick={() => setImagens(imagens.filter((_, j) => j !== i))} disabled={salvando} aria-label={`Tirar a imagem ${i + 1}`} className="flex h-7 w-7 items-center justify-center rounded-xl text-black/45 hover:bg-black/[.05]"><Trash2 size={13} aria-hidden="true" /></button>}</div>
                  <CampoDeImagem id={`${id}-gal-${i}`} ariaLabel={`Endereço da imagem ${i + 1}`} valor={im.url} onChange={url => setImagens(mudar(imagens, i, { url }))} organizationId={organizationId} desabilitado={salvando} />
                  <input aria-label={`Texto alternativo da imagem ${i + 1}`} className={CAMPO} value={im.alt} onChange={e => setImagens(mudar(imagens, i, { alt: e.target.value }))} maxLength={200} placeholder="Descreva a imagem" disabled={salvando} />
                </li>
              ))}
            </ul>
            {imagens.length < 12 && <button type="button" onClick={() => setImagens([...imagens, { url: "https://", alt: "", link: "" }])} disabled={salvando} className={`inline-flex items-center gap-1 ${LINK}`}><Plus size={12} aria-hidden="true" /> Outra imagem</button>}
            <p className="text-[0.75rem] text-black/55">De 2 a 12 imagens, em quadrados.</p>
          </>
        )}
        {tipo === "video" && (
          <>
            {campoTitulo()}
            <div><label className={ROTULO} htmlFor={`${id}-video`}>Endereço do vídeo (YouTube ou Vimeo)</label><input id={`${id}-video`} autoFocus className={CAMPO} value={video} onChange={e => setVideo(e.target.value)} maxLength={300} placeholder="https://www.youtube.com/watch?v=…" disabled={salvando} /></div>
            <p className="text-[0.75rem] text-black/55">Cole o endereço da página do vídeo. Só YouTube e Vimeo.</p>
          </>
        )}
        {tipo === "mapa" && (
          <>
            {campoTitulo()}
            <div><label className={ROTULO} htmlFor={`${id}-end`}>Endereço</label><input id={`${id}-end`} autoFocus className={CAMPO} value={endereco} onChange={e => setEndereco(e.target.value)} maxLength={200} placeholder="Rua Exemplo, 100, São Paulo" disabled={salvando} /></div>
            <p className="text-[0.75rem] text-black/55">O mapa do Google aparece no site, com o endereço escrito embaixo.</p>
          </>
        )}
        {tipo === "contagem" && (
          <>
            {campoTitulo("Título (opcional, como “Faltam”)")}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={ROTULO} htmlFor={`${id}-dia`}>Dia do fim</label><input id={`${id}-dia`} type="date" className={CAMPO} value={dia} onChange={e => setDia(e.target.value)} disabled={salvando} /></div>
              <div><label className={ROTULO} htmlFor={`${id}-hora`}>Hora</label><input id={`${id}-hora`} type="time" className={CAMPO} value={hora} onChange={e => setHora(e.target.value)} disabled={salvando} /></div>
            </div>
            <div><label className={ROTULO} htmlFor={`${id}-depois`}>Frase depois que acabar</label><input id={`${id}-depois`} className={CAMPO} value={depois} onChange={e => setDepois(e.target.value)} maxLength={120} disabled={salvando} /></div>
            <p className="text-[0.75rem] text-black/55">A hora é a de Brasília.</p>
          </>
        )}
        {tipo === "faq" && (
          <>
            {campoTitulo()}
            <ul className="space-y-2">
              {perguntas.map((p, i) => (
                <li key={i} className="space-y-1.5 rounded-xl border border-black/[.08] p-3">
                  <div className="flex items-center justify-between"><span className="text-[0.6875rem] text-black/55">Pergunta {i + 1}</span>{perguntas.length > 1 && <button type="button" onClick={() => setPerguntas(perguntas.filter((_, j) => j !== i))} disabled={salvando} aria-label={`Tirar a pergunta ${i + 1}`} className="flex h-7 w-7 items-center justify-center rounded-xl text-black/45 hover:bg-black/[.05]"><Trash2 size={13} aria-hidden="true" /></button>}</div>
                  <input aria-label={`Pergunta ${i + 1}`} className={CAMPO} value={p.pergunta} onChange={e => setPerguntas(mudar(perguntas, i, { pergunta: e.target.value }))} maxLength={200} disabled={salvando} />
                  <textarea aria-label={`Resposta ${i + 1}`} rows={3} className={AREA} value={p.resposta} onChange={e => setPerguntas(mudar(perguntas, i, { resposta: e.target.value }))} maxLength={2000} placeholder="Resposta" disabled={salvando} />
                </li>
              ))}
            </ul>
            {perguntas.length < 20 && <button type="button" onClick={() => setPerguntas([...perguntas, { pergunta: "", resposta: "" }])} disabled={salvando} className={`inline-flex items-center gap-1 ${LINK}`}><Plus size={12} aria-hidden="true" /> Outra pergunta</button>}
          </>
        )}
        {tipo === "agenda" && (
          <>
            <div><label className={ROTULO} htmlFor={`${id}-titulo`}>Título (opcional, como “Em cartaz”)</label><input id={`${id}-titulo`} autoFocus className={CAMPO} value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120} disabled={salvando} /></div>
            <p className="text-[0.75rem] text-black/55">Mostra os eventos publicados da loja que ainda têm sessão por vir, cada um com a próxima sessão, o preço e o link para a página do evento. A lista se atualiza sozinha.</p>
          </>
        )}
        {tipo === "patrocinadores" && (
          <>
            {campoTitulo("Título (opcional, como “Patrocínio”)")}
            <ul className="space-y-2">
              {patrocinadores.map((p, i) => (
                <li key={i} className="space-y-1.5 rounded-xl border border-black/[.08] p-3">
                  <div className="flex items-center justify-between"><span className="text-[0.6875rem] text-black/55">Patrocinador {i + 1}</span>{patrocinadores.length > 1 && <button type="button" onClick={() => setPatrocinadores(patrocinadores.filter((_, j) => j !== i))} disabled={salvando} aria-label={`Tirar o patrocinador ${i + 1}`} className="flex h-7 w-7 items-center justify-center rounded-xl text-black/45 hover:bg-black/[.05]"><Trash2 size={13} aria-hidden="true" /></button>}</div>
                  <CampoDeImagem id={`${id}-pat-${i}`} ariaLabel={`Endereço do logo ${i + 1}`} valor={p.url} onChange={url => setPatrocinadores(mudar(patrocinadores, i, { url }))} organizationId={organizationId} desabilitado={salvando} />
                  <input aria-label={`Nome do patrocinador ${i + 1}`} className={CAMPO} value={p.alt} onChange={e => setPatrocinadores(mudar(patrocinadores, i, { alt: e.target.value }))} maxLength={200} placeholder="Nome (texto alternativo do logo)" disabled={salvando} />
                  <input aria-label={`Site do patrocinador ${i + 1}`} className={CAMPO} value={p.link} onChange={e => setPatrocinadores(mudar(patrocinadores, i, { link: e.target.value }))} maxLength={500} placeholder="Site (https://…, opcional)" disabled={salvando} />
                </li>
              ))}
            </ul>
            {patrocinadores.length < 12 && <button type="button" onClick={() => setPatrocinadores([...patrocinadores, { url: "https://", alt: "", link: "" }])} disabled={salvando} className={`inline-flex items-center gap-1 ${LINK}`}><Plus size={12} aria-hidden="true" /> Outro patrocinador</button>}
          </>
        )}
      </div>
    </TopSheet>
  );
}
