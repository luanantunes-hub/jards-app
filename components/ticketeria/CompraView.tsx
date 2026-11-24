import type { ReactNode } from "react";
import { create as criarQr } from "qrcode";
import { SeletorDeIdioma } from "@/components/i18n/SeletorDeIdioma";
import { Dropdown } from "@/components/ui/Dropdown";
import { TEXTO_DAS_NOVIDADES } from "@/lib/ticketeria/novidades";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { textoSobreCor } from "@/lib/ticketeria/site";
import { disponivelNasFaixas, totalNasFaixas, type IngressoDaVitrine } from "@/lib/ticketeria/vitrine";

// A compra de ingressos desenhada (passo C da T5): quatro telas de quem compra, sem login, no celular primeiro. Só desenho: os dados e as ações chegam por
// props (a página busca no servidor e liga os botões). Segue o site da pessoa (fundo branco, cabeçalho na cor dela, ação principal em tinta #282525).

export const BOTAO = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#6450D2] px-5 py-3 text-[0.9375rem] font-normal text-white transition hover:bg-[#5342BA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6450D2] disabled:cursor-not-allowed disabled:bg-black/20";
export const BOTAO_SECUNDARIO = "inline-flex min-h-11 items-center justify-center rounded-xl border border-black/15 bg-white px-4 py-2.5 text-[0.875rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-normal uppercase tracking-[.08em] text-black/50";
const CAMPO = "h-12 w-full rounded-xl border border-black/15 bg-white px-3.5 text-[1rem] text-[#282525] placeholder:text-black/30 focus:border-[#282525] focus:outline-none";
const ETIQUETA = "inline-flex rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal uppercase tracking-[.08em]";

/** O preço de um ingresso, com o ⓘ quando ele está ajustado pela demanda (preço dinâmico): toque no preço abre a explicação, sem clique obrigatório e sem etapa a mais. Sem JavaScript (details). */
export function PrecoDoIngresso({ centavos, ajustado }: { centavos: number; ajustado?: boolean }) {
  const texto = centavos === 0 ? "Gratuito" : formatarMoeda(centavos);
  if (!ajustado || centavos === 0) return <p className="mt-1 text-[0.9375rem] tabular-nums">{texto}</p>;
  return (
    <details className="mt-1">
      <summary className="flex w-fit cursor-pointer list-none items-baseline gap-1.5 text-[0.9375rem] tabular-nums [&::-webkit-details-marker]:hidden">
        {texto}
        <span role="img" aria-label="Por que o preço varia?" className="text-[0.8125rem] text-black/45">ⓘ</span>
      </summary>
      <p className="mt-1 max-w-[18rem] text-[0.75rem] leading-snug text-black/55">O preço deste ingresso varia conforme a procura. O valor que você vê agora fica garantido durante a sua compra.</p>
    </details>
  );
}

/** A moldura das telas: cabeçalho na cor do site da pessoa e o miolo estreito (34rem), que no celular ocupa a largura toda. */
export function Moldura({ titulo, cor = "#1C0E33", passo, children, rodape, seletorDeIdioma }: { titulo: string; cor?: string; passo?: { atual: number; total: number }; children: ReactNode; rodape?: ReactNode; seletorDeIdioma?: boolean }) {
  const texto = textoSobreCor(cor);
  return (
    <div className="min-h-screen bg-white text-[#282525]">
      <header style={{ backgroundColor: cor, color: texto }}>
        <div className="mx-auto flex w-full max-w-[34rem] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="text-[1.0625rem] font-medium tracking-[-.01em]">{titulo}</span>
          {passo && <span className="text-[0.6875rem] font-normal uppercase tracking-[.08em] opacity-70">Passo {passo.atual} de {passo.total}</span>}
          {/* Só nas telas já traduzidas, dentro do ProvedorDeIdioma; as demais seguem em português até a vez delas. */}
          {seletorDeIdioma && <SeletorDeIdioma />}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[34rem] px-4 pb-32 pt-6 sm:px-6">{children}</main>
      {rodape && <div className="fixed inset-x-0 bottom-0 border-t border-black/10 bg-white/95 backdrop-blur"><div className="mx-auto w-full max-w-[34rem] px-4 py-3 sm:px-6">{rodape}</div></div>}
    </div>
  );
}

export type EventoParaComprar = { titulo: string; quando: string; local: string; classificacao?: string | null; descricao?: string | null };

function Cabecalho({ evento }: { evento: EventoParaComprar }) {
  return (
    <section aria-label="Evento" className="mb-6">
      {evento.classificacao && <span className={ETIQUETA} style={{ borderColor: "#28252547", color: "#282525" }}>{evento.classificacao}</span>}
      <h1 className="mt-2 text-[1.75rem] font-medium leading-[1.1] tracking-[-.03em] sm:text-[2rem]">{evento.titulo}</h1>
      <p className="mt-2 text-[0.9375rem] text-black/70">{evento.quando}</p>
      <p className="text-[0.9375rem] text-black/70">{evento.local}</p>
      {evento.descricao && <p className="mt-3 text-[0.9375rem] leading-relaxed text-black/70">{evento.descricao}</p>}
    </section>
  );
}

// ─── 1. Escolher os ingressos ───────────────────────────────────────────────

export type IngressoParaComprar = IngressoDaVitrine;

function Contador({ valor, max, nome, onMudar }: { valor: number; max: number; nome: string; onMudar?: (novo: number) => void }) {
  const botao = "flex h-11 w-11 items-center justify-center rounded-xl border border-black/15 bg-white text-[1.25rem] leading-none text-[#282525] transition hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={`Quantidade de ${nome}`}>
      <button type="button" className={botao} disabled={valor <= 0} onClick={() => onMudar?.(valor - 1)} aria-label={`Menos um ${nome}`}>−</button>
      <span className="w-6 text-center text-[1.0625rem] font-normal tabular-nums" aria-live="polite">{valor}</span>
      <button type="button" className={botao} disabled={valor >= max} onClick={() => onMudar?.(valor + 1)} aria-label={`Mais um ${nome}`}>+</button>
    </div>
  );
}

export function TelaEscolherIngressos({ site, evento, ingressos, quantidades, onMudar, onContinuar, cupom = null, cupomErro = null, codigoDoCupom = "", onCodigoDoCupom, onAbrirCupom, onAplicarCupom, onRemoverCupom, aplicandoCupom = false, cupomAberto = false, onEntrarNaEspera, aviso = null, lugaresEscolhidos = {}, onEscolherLugares, onLimparLugares }: {
  site: { titulo: string; cor?: string }; evento: EventoParaComprar; ingressos: IngressoParaComprar[]; quantidades: Record<string, number>;
  onMudar?: (id: string, novo: number) => void; onContinuar?: () => void;
  /** O cupom já aplicado (o desconto do pedido, em centavos), a frase de erro do código digitado, e as ações. `cupomAberto`: mostra o campo (a pessoa tocou em "Tem um cupom?"). */
  cupom?: { codigo: string; descricao: string; desconto_centavos: number } | null; cupomErro?: string | null; codigoDoCupom?: string;
  onCodigoDoCupom?: (codigo: string) => void; onAbrirCupom?: () => void; onAplicarCupom?: () => void; onRemoverCupom?: () => void; aplicandoCupom?: boolean; cupomAberto?: boolean;
  /** Ingresso esgotado: "Avise-me se voltar" leva à lista de espera (sem a ação, o ingresso só mostra "Esgotado"). */
  onEntrarNaEspera?: (ingressoId: string) => void;
  /** Uma frase de aviso acima dos ingressos (por exemplo: alguém acabou de escolher os lugares). */
  aviso?: string | null;
  /** Ingresso de setor numerado: os lugares escolhidos ("C7") por ingresso, e as ações de escolher no mapa e de limpar. */
  lugaresEscolhidos?: Record<string, string[]>; onEscolherLugares?: (ingressoId: string) => void; onLimparLugares?: (ingressoId: string) => void;
}) {
  const total = ingressos.reduce((soma, i) => soma + (totalNasFaixas(i.faixas, quantidades[i.id] ?? 0) ?? 0), 0);
  const qtd = ingressos.reduce((soma, i) => soma + (quantidades[i.id] ?? 0), 0);
  const desconto = cupom ? Math.min(cupom.desconto_centavos, total) : 0;
  return (
    <Moldura titulo={site.titulo} cor={site.cor} passo={{ atual: 1, total: 3 }}
      rodape={
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.75rem] text-black/55">{qtd === 0 ? "Nenhum ingresso" : qtd === 1 ? "1 ingresso" : `${qtd} ingressos`}</p>
            {desconto > 0 && <p className="text-[0.75rem] tabular-nums text-black/55">{cupom?.codigo} · −{formatarMoeda(desconto)}</p>}
            <p className="text-[1.25rem] font-medium tabular-nums tracking-[-.02em]">{formatarMoeda(total - desconto)}</p>
          </div>
          <button type="button" className={`${BOTAO} !w-auto min-w-40`} disabled={qtd === 0} onClick={onContinuar}>Continuar</button>
        </div>
      }>
      <Cabecalho evento={evento} />
      {aviso && <p role="alert" className="mb-4 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{aviso}</p>}
      <h2 className="mb-2 text-[0.6875rem] font-normal uppercase tracking-[.08em] text-black/50">Ingressos</h2>
      <ul className="divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10">
        {ingressos.map(i => {
          const disponivel = disponivelNasFaixas(i.faixas);
          const esgotado = disponivel <= 0;
          const max = Math.min(i.limite, disponivel);
          const preco = i.faixas[0]?.preco_centavos ?? 0;
          if (i.numerado && !esgotado) {
            const escolhidos = lugaresEscolhidos[i.id] ?? [];
            return (
              <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-[1rem] font-normal">{i.nome}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-black/55">{i.numerado.setor} · lugares numerados</p>
                  {i.descricao && <p className="mt-0.5 text-[0.8125rem] text-black/55">{i.descricao}</p>}
                  <PrecoDoIngresso centavos={preco} ajustado={i.ajustado} />
                  {escolhidos.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ul className="flex flex-wrap gap-1.5" aria-label={`Lugares escolhidos: ${i.nome}`}>
                        {escolhidos.map(l => <li key={l} className="rounded-lg bg-[#282525] px-2 py-1 text-[0.75rem] tabular-nums text-white">{l}</li>)}
                      </ul>
                      <button type="button" onClick={() => onLimparLugares?.(i.id)} className="rounded-xl px-1 text-[0.8125rem] text-black/55 underline underline-offset-2 hover:text-black/75">Limpar</button>
                    </div>
                  )}
                </div>
                <button type="button" className={`${BOTAO_SECUNDARIO} shrink-0`} onClick={() => onEscolherLugares?.(i.id)}>{escolhidos.length === 0 ? "Escolher lugares" : "Trocar lugares"}</button>
              </li>
            );
          }
          return (
            <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <p className="text-[1rem] font-normal">{i.nome}</p>
                {i.descricao && <p className="mt-0.5 text-[0.8125rem] text-black/55">{i.descricao}</p>}
                {!esgotado && <PrecoDoIngresso centavos={preco} ajustado={i.ajustado} />}
              </div>
              {esgotado
                ? (
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={ETIQUETA} style={{ borderColor: "#6b676747", color: "#6b6767" }}>Esgotado</span>
                    {onEntrarNaEspera && <button type="button" onClick={() => onEntrarNaEspera(i.id)} className="rounded-xl text-[0.8125rem] text-black/60 underline underline-offset-2 hover:text-black/80">Avise-me se voltar</button>}
                  </div>
                )
                : <Contador valor={quantidades[i.id] ?? 0} max={max} nome={i.nome} onMudar={novo => onMudar?.(i.id, novo)} />}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[0.75rem] text-black/50">O preço é o que você paga: não há taxa somada.</p>
      <section aria-label="Cupom de desconto" className="mt-5">
        {cupom ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "#2E893247" }}>
            <div className="min-w-0"><p className="text-[0.875rem] font-normal tracking-[.04em]">{cupom.codigo}</p><p className="text-[0.75rem] text-black/60">{cupom.descricao}</p></div>
            <button type="button" onClick={onRemoverCupom} className="shrink-0 rounded-xl text-[0.8125rem] text-black/55 underline underline-offset-2 hover:text-black/75">Remover</button>
          </div>
        ) : cupomAberto ? (
          <form onSubmit={e => { e.preventDefault(); onAplicarCupom?.(); }}>
            <label htmlFor="cupom" className={ROTULO}>Código do cupom</label>
            <div className="flex gap-2">
              <input id="cupom" className={`${CAMPO} uppercase tracking-[.08em]`} value={codigoDoCupom} onChange={e => onCodigoDoCupom?.(e.target.value)} autoCapitalize="characters" autoComplete="off" maxLength={20} disabled={aplicandoCupom} aria-invalid={cupomErro ? true : undefined} />
              <button type="submit" disabled={aplicandoCupom || codigoDoCupom.trim() === ""} className={`${BOTAO_SECUNDARIO} shrink-0 disabled:opacity-40`}>{aplicandoCupom ? "Conferindo…" : "Aplicar"}</button>
            </div>
            {cupomErro && <p role="alert" className="mt-2 text-[0.8125rem] text-[#B23B3B]">{cupomErro}</p>}
          </form>
        ) : (
          <button type="button" onClick={onAbrirCupom} className="rounded-xl text-[0.875rem] text-black/60 underline underline-offset-2 hover:text-black/80">Tem um cupom?</button>
        )}
      </section>
    </Moldura>
  );
}

// ─── 2. Os dados de quem compra ─────────────────────────────────────────────

/** `total_centavos` é o que a pessoa paga (já com o desconto); `desconto` é o cupom aplicado, que sai da soma das linhas. */
export type ResumoDoPedido = { linhas: { nome: string; quantidade: number; total_centavos: number }[]; total_centavos: number; desconto?: { codigo: string; centavos: number } };

export function TelaDados({ site, evento, resumo, valores, erro, trabalhando, aceito = false, onAceitar, novidades = false, onNovidades, whatsapp = "", onWhatsapp, meio = "pix", onMeio, parcelasMax = 1, parcelas = 1, onParcelas, onMudar, onVoltar, onGerarPix }: {
  site: { titulo: string; cor?: string }; evento: EventoParaComprar; resumo: ResumoDoPedido; valores: { nome: string; email: string; documento: string };
  erro?: string | null; trabalhando?: boolean; aceito?: boolean; onAceitar?: (aceito: boolean) => void;
  /** O aceite de novidades do produtor (desmarcado de início) e o WhatsApp opcional, que só aparece com a caixa marcada. */
  novidades?: boolean; onNovidades?: (aceito: boolean) => void; whatsapp?: string; onWhatsapp?: (valor: string) => void;
  /** Como pagar: Pix (o código aparece na hora) ou cartão (a pessoa paga na página segura do provedor). `parcelasMax` é até quantas vezes a loja oferece, sem juros para quem compra. */
  meio?: "pix" | "cartao"; onMeio?: (meio: "pix" | "cartao") => void; parcelasMax?: number; parcelas?: number; onParcelas?: (parcelas: number) => void; onMudar?: (campo: "nome" | "email" | "documento", valor: string) => void; onVoltar?: () => void; onGerarPix?: () => void;
}) {
  return (
    <Moldura titulo={site.titulo} cor={site.cor} passo={{ atual: 2, total: 3 }}
      rodape={<div className="flex items-center gap-3"><button type="button" className={`${BOTAO_SECUNDARIO} shrink-0`} onClick={onVoltar} disabled={trabalhando}>Voltar</button><button type="button" className={BOTAO} onClick={onGerarPix} disabled={trabalhando}>{trabalhando ? (meio === "cartao" ? "Abrindo o pagamento…" : "Gerando o Pix…") : meio === "cartao" ? "Pagar com cartão" : "Gerar Pix"}</button></div>}>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Seus dados</h1>
      <p className="mt-1 text-[0.875rem] text-black/60">{evento.titulo} · {evento.quando}</p>
      <section aria-label="Resumo do pedido" className="mt-5 rounded-xl border border-black/10 px-4 py-3">
        <ul className="space-y-1.5">
          {resumo.linhas.map(l => (
            <li key={l.nome} className="flex justify-between gap-4 text-[0.9375rem]"><span>{l.quantidade} × {l.nome}</span><span className="tabular-nums">{formatarMoeda(l.total_centavos)}</span></li>
          ))}
        </ul>
        {resumo.desconto && resumo.desconto.centavos > 0 && <p className="mt-1.5 flex justify-between gap-4 text-[0.9375rem] text-[#2E8932]"><span>Cupom {resumo.desconto.codigo}</span><span className="tabular-nums">−{formatarMoeda(resumo.desconto.centavos)}</span></p>}
        <p className="mt-2 flex justify-between border-t border-black/10 pt-2 text-[1rem] font-medium"><span>Total</span><span className="tabular-nums">{formatarMoeda(resumo.total_centavos)}</span></p>
      </section>
      {erro && <p role="alert" className="mt-4 rounded-xl border px-4 py-2.5 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); onGerarPix?.(); }}>
        <div><label className={ROTULO} htmlFor="c-nome">Nome completo</label><input id="c-nome" className={CAMPO} value={valores.nome} onChange={e => onMudar?.("nome", e.target.value)} autoComplete="name" maxLength={120} disabled={trabalhando} /></div>
        <div><label className={ROTULO} htmlFor="c-email">E-mail</label><input id="c-email" type="email" inputMode="email" className={CAMPO} value={valores.email} onChange={e => onMudar?.("email", e.target.value)} autoComplete="email" maxLength={200} placeholder="seus ingressos chegam aqui" disabled={trabalhando} /></div>
        <div><label className={ROTULO} htmlFor="c-doc">CPF ou CNPJ</label><input id="c-doc" inputMode="numeric" className={CAMPO} value={valores.documento} onChange={e => onMudar?.("documento", e.target.value)} placeholder="000.000.000-00" disabled={trabalhando} /><p className="mt-1.5 text-[0.75rem] text-black/50">Exigido pelo provedor de pagamento. Não fica guardado.</p></div>
      </form>
      <fieldset className="mt-6" disabled={trabalhando}>
        <legend className={ROTULO}>Como pagar</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["pix", "Pix", "O código aparece na hora e o ingresso chega assim que o pagamento cai."], ["cartao", "Cartão de crédito", parcelasMax > 1 ? `À vista ou em até ${parcelasMax}x, sem juros para você.` : "À vista."]] as const).map(([id, titulo, texto]) => (
            <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition ${meio === id ? "border-[#282525] bg-black/[.02]" : "border-black/15 hover:bg-black/[.02]"}`}>
              <input type="radio" name="meio" value={id} checked={meio === id} onChange={() => onMeio?.(id)} className="mt-1 h-4 w-4 shrink-0 accent-[#282525]" />
              <span><span className="block text-[0.9375rem] font-normal">{titulo}</span><span className="mt-0.5 block text-[0.75rem] leading-snug text-black/55">{texto}</span></span>
            </label>
          ))}
        </div>
        {meio === "cartao" && (
          <div className="mt-3">
            {parcelasMax > 1 && (
              <div className="mb-3">
                <span className={ROTULO}>Parcelas</span>
                <Dropdown ariaLabel="Parcelas" value={String(parcelas)} onChange={v => onParcelas?.(Number(v))} options={Array.from({ length: parcelasMax }, (_, i) => i + 1).map(n => ({ value: String(n), label: n === 1 ? `À vista, ${formatarMoeda(resumo.total_centavos)}` : `${n}x de ${formatarMoeda(Math.ceil(resumo.total_centavos / n))}, sem juros` }))} />
              </div>
            )}
            <p className="text-[0.75rem] leading-relaxed text-black/55">Você paga na página segura do provedor de pagamento. Os dados do seu cartão não passam pelo Jards.</p>
          </div>
        )}
      </fieldset>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 px-4 py-3.5 text-[0.875rem] leading-snug">
        <input type="checkbox" checked={aceito} onChange={e => onAceitar?.(e.target.checked)} disabled={trabalhando} className="mt-0.5 h-5 w-5 shrink-0 accent-[#282525]" />
        <span>Li e concordo com os <a href="/termos-de-compra" target="_blank" rel="noopener noreferrer" className="font-normal underline underline-offset-2">Termos de compra</a>.</span>
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 px-4 py-3.5 text-[0.875rem] leading-snug">
        <input type="checkbox" checked={novidades} onChange={e => onNovidades?.(e.target.checked)} disabled={trabalhando} className="mt-0.5 h-5 w-5 shrink-0 accent-[#282525]" />
        <span>{TEXTO_DAS_NOVIDADES}</span>
      </label>
      {novidades && (
        <div className="mt-3"><label className={ROTULO} htmlFor="c-whatsapp">WhatsApp (opcional)</label><input id="c-whatsapp" type="tel" inputMode="tel" className={CAMPO} value={whatsapp} onChange={e => onWhatsapp?.(e.target.value)} autoComplete="tel-national" placeholder="(00) 00000-0000" maxLength={16} disabled={trabalhando} /></div>
      )}
      <p className="mt-4 text-[0.75rem] leading-relaxed text-black/50">{meio === "cartao" ? "Os lugares ficam reservados por 15 minutos para você pagar." : "Os lugares ficam reservados por 15 minutos depois que você gera o código."}</p>
    </Moldura>
  );
}

// ─── 3. Pagar com Pix ───────────────────────────────────────────────────────

/** O QR Code desenhado em SVG, sem imagem nem rede (a biblioteca monta a matriz na hora). Quatro módulos de margem, como o leitor espera. */
export function QrCode({ valor, tamanho = 220, rotulo }: { valor: string; tamanho?: number; rotulo: string }) {
  const qr = criarQr(valor, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const margem = 4;
  const caminhos: string[] = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!qr.modules.get(y, x)) { x++; continue; }
      let fim = x;
      while (fim < n && qr.modules.get(y, fim)) fim++;
      caminhos.push(`M${x + margem} ${y + margem}h${fim - x}v1h-${fim - x}z`);
      x = fim;
    }
  }
  const lado = n + margem * 2;
  return (
    <svg role="img" aria-label={rotulo} width={tamanho} height={tamanho} viewBox={`0 0 ${lado} ${lado}`} shapeRendering="crispEdges" className="rounded-xl bg-white">
      <path d={caminhos.join("")} fill="#282525" />
    </svg>
  );
}

export function TelaPagarPix({ site, evento, pedido, onCopiar, copiado, onVoltar }: {
  site: { titulo: string; cor?: string }; evento: EventoParaComprar; pedido: { codigo: string; total_centavos: number; pix_copia_e_cola: string; reservado_ate: string; restante: string };
  onCopiar?: () => void; copiado?: boolean; onVoltar?: () => void;
}) {
  return (
    <Moldura titulo={site.titulo} cor={site.cor} passo={{ atual: 3, total: 3 }}>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Pague com Pix</h1>
      <p className="mt-1 text-[0.875rem] text-black/60">{evento.titulo} · {evento.quando}</p>
      <p className="mt-5 text-[0.6875rem] font-normal uppercase tracking-[.08em] text-black/50">Valor</p>
      <p className="text-[2rem] font-medium tabular-nums tracking-[-.03em]">{formatarMoeda(pedido.total_centavos)}</p>
      <div className="mt-4 flex flex-col items-center rounded-xl border border-black/10 px-4 py-5">
        <QrCode valor={pedido.pix_copia_e_cola} rotulo="QR Code do Pix" />
        <p className="mt-3 text-center text-[0.8125rem] text-black/60">Aponte a câmera do app do seu banco para o QR Code.</p>
      </div>
      <p className="mt-5 text-[0.6875rem] font-normal uppercase tracking-[.08em] text-black/50">Ou use o Pix copia e cola</p>
      <p className="mt-1.5 break-all rounded-xl border border-black/10 bg-black/[.03] px-3 py-2.5 font-mono text-[0.75rem] leading-relaxed text-black/70" aria-label="Código Pix copia e cola">{pedido.pix_copia_e_cola.slice(0, 96)}…</p>
      <button type="button" className={`${BOTAO} mt-3`} onClick={onCopiar}>{copiado ? "Código copiado" : "Copiar código Pix"}</button>
      <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "#B07A1447" }}>
        <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#B07A14] motion-reduce:animate-none" />
        <div>
          <p className="text-[0.9375rem] font-normal">Aguardando o pagamento</p>
          <p className="text-[0.8125rem] text-black/60">Seus lugares estão reservados até {pedido.reservado_ate} (faltam {pedido.restante}). Quando o Pix cair, os ingressos aparecem aqui e chegam por e-mail.</p>
        </div>
      </div>
      <p className="mt-4 text-[0.75rem] text-black/50">Pedido {pedido.codigo}.{onVoltar && <> <button type="button" onClick={onVoltar} className="underline underline-offset-2">Mudar o pedido</button></>}</p>
    </Moldura>
  );
}

// ─── 4. Os ingressos ────────────────────────────────────────────────────────

/** `assento` só vem quando o ingresso é de um setor com lugares numerados: "Fileira C · lugar 7". */
export type IngressoDaPagina = { codigo: string; nome: string; assento?: string | null; usado?: boolean; cancelado?: boolean };

/** O que a seção de reembolso mostra: "pode" (o botão de pedir pela página, em `acao`, com o e-mail como reserva), "prazo_passou" (os 7 dias da compra acabaram) ou "indisponivel" (só o e-mail: por exemplo, um ingresso já usado). */
export type ReembolsoDaPagina = { estado: "pode"; acao: ReactNode } | { estado: "prazo_passou" } | { estado: "indisponivel" };

export function TelaIngressos({ site, evento, comprador, pedido, ingressos, emailDeReembolso, reembolso = { estado: "indisponivel" } }: {
  site: { titulo: string; cor?: string }; evento: EventoParaComprar; comprador: string; pedido: string; ingressos: IngressoDaPagina[]; emailDeReembolso: string; reembolso?: ReembolsoDaPagina;
}) {
  return (
    <Moldura titulo={site.titulo} cor={site.cor}>
      <span className={ETIQUETA} style={{ borderColor: "#2E893247", color: "#2E8932" }}>Pagamento confirmado</span>
      <h1 className="mt-2 text-[1.5rem] font-medium tracking-[-.025em]">Seus ingressos</h1>
      <p className="mt-1 text-[0.9375rem] text-black/70">Olá, {comprador}. Mostre o QR Code ou o código na entrada.</p>
      <p className="mt-3 text-[1.0625rem] font-normal">{evento.titulo}</p>
      <p className="text-[0.9375rem] text-black/70">{evento.quando}</p>
      <p className="text-[0.9375rem] text-black/70">{evento.local}</p>
      <ul className="mt-5 space-y-4">
        {ingressos.map(i => (
          <li key={i.codigo} className={`rounded-xl border border-black/15 px-4 py-5 ${i.cancelado ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[1rem] font-normal">{i.nome}</p>{i.assento && <p className="mt-0.5 text-[0.9375rem] text-black/70">{i.assento}</p>}</div>
              {i.cancelado && <span className={ETIQUETA} style={{ borderColor: "#D94A4A47", color: "#D94A4A" }}>Cancelado</span>}
              {i.usado && !i.cancelado && <span className={ETIQUETA} style={{ borderColor: "#6b676747", color: "#6b6767" }}>Já usado</span>}
            </div>
            <div className="mt-3 flex flex-col items-center">
              <QrCode valor={i.codigo} tamanho={200} rotulo={`QR Code do ingresso ${i.codigo}`} />
              <p className="mt-2 text-[1.25rem] font-medium tabular-nums tracking-[.18em]">{i.codigo}</p>
            </div>
          </li>
        ))}
      </ul>
      <section aria-label="Reembolso" className="mt-6 rounded-xl border border-black/10 px-4 py-3">
        <p className="text-[0.8125rem] font-normal">Precisa de reembolso?</p>
        {reembolso.estado === "pode" ? (
          <>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-black/60">Você pode desistir da compra em até 7 dias. Peça aqui: enviamos um link de confirmação ao e-mail da compra, e o reembolso sai quando você confirmar. Pedido {pedido}.</p>
            <div className="mt-3">{reembolso.acao}</div>
            <p className="mt-3 text-[0.75rem] leading-relaxed text-black/50">Se preferir, escreva para {emailDeReembolso} com o assunto “reembolso - código do ingresso”, do mesmo e-mail que usou na compra.</p>
          </>
        ) : reembolso.estado === "prazo_passou" ? (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-black/60">O prazo de 7 dias da compra para pedir reembolso já passou. Se o evento for cancelado ou adiado, avisaremos por e-mail. Pedido {pedido}.</p>
        ) : (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-black/60">Em até 7 dias da compra, escreva para {emailDeReembolso} com o assunto “reembolso - código do ingresso”, do mesmo e-mail que usou aqui. Pedido {pedido}.</p>
        )}
      </section>
    </Moldura>
  );
}

// ─── Quando não dá ──────────────────────────────────────────────────────────

export function TelaAviso({ site, titulo, texto, acao }: { site: { titulo: string; cor?: string }; titulo: string; texto: string; acao?: { rotulo: string; onClick?: () => void } }) {
  return (
    <Moldura titulo={site.titulo} cor={site.cor}>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">{titulo}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">{texto}</p>
      {acao && <button type="button" className={`${BOTAO} mt-6`} onClick={acao.onClick}>{acao.rotulo}</button>}
    </Moldura>
  );
}

// ─── Os Termos de compra (a página pública) ─────────────────────────────────

export function TelaTermosDeCompra({ secoes, atualizadoEm, email }: { secoes: { id: string; titulo: string; paragrafos: string[] }[]; atualizadoEm: string; email: string }) {
  return (
    <div className="min-h-screen bg-white text-[#282525]">
      <header className="border-b border-black/10">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="text-[0.9375rem] font-medium tracking-[-.01em]">Jards</span>
          <span className="text-[0.75rem] text-black/45">Atualizado em {atualizadoEm}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[.12em] text-black/45">Compra de ingressos</p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-[1.1] tracking-[-.03em] sm:text-[2.5rem]">Termos de compra</h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-black/60">O que vale quando você compra um ingresso pela plataforma Jards. Leia antes de gerar o Pix.</p>
        <nav aria-label="Seções" className="mt-8 rounded-xl border border-black/10 px-4 py-3.5">
          <ol className="space-y-1 text-[0.875rem]">
            {secoes.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="text-black/60 underline-offset-2 hover:text-[#282525] hover:underline">{i + 1}. {s.titulo}</a></li>)}
          </ol>
        </nav>
        <div className="mt-10 space-y-10">
          {secoes.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`}>
              <h2 id={`${s.id}-t`} className="text-[1.25rem] font-medium tracking-[-.015em]">{i + 1}. {s.titulo}</h2>
              <div className="mt-3 space-y-3 text-[0.9375rem] leading-7 text-black/70">{s.paragrafos.map((p, j) => <p key={j}>{p.replaceAll("{email}", email)}</p>)}</div>
            </section>
          ))}
        </div>
        <p className="mt-12 border-t border-black/10 pt-6 text-[0.8125rem] text-black/45">Veja também a <a href="/privacidade" className="underline underline-offset-2">Política de Privacidade</a>.</p>
      </main>
    </div>
  );
}

/** Entre o clique em "Pagar com cartão" e a página segura do provedor. */
export function TelaAbrindoPagamento({ site, evento, resumo, endereco, enderecoDoPedido }: { site: { titulo: string; cor?: string }; evento: EventoParaComprar; resumo: ResumoDoPedido; endereco: string; enderecoDoPedido?: string }) {
  return (
    <Moldura titulo={site.titulo} cor={site.cor} passo={{ atual: 3, total: 3 }}>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Abrindo o pagamento</h1>
      <p className="mt-1 text-[0.875rem] text-black/60">{evento.titulo} · {evento.quando}</p>
      <div role="status" className="mt-6 flex items-start gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: "#B07A1447" }}>
        <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#B07A14] motion-reduce:animate-none" />
        <div>
          <p className="text-[0.9375rem] font-normal">Levando você à página segura de pagamento</p>
          <p className="mt-0.5 text-[0.8125rem] text-black/60">Pague com o cartão por lá. Quando o pagamento for aprovado, os seus ingressos aparecem na página do pedido e chegam por e-mail.</p>
        </div>
      </div>
      <section aria-label="Resumo do pedido" className="mt-5 rounded-xl border border-black/10 px-4 py-3">
        <ul className="space-y-1.5">
          {resumo.linhas.map(l => <li key={l.nome} className="flex justify-between gap-4 text-[0.9375rem]"><span>{l.quantidade} × {l.nome}</span><span className="tabular-nums">{formatarMoeda(l.total_centavos)}</span></li>)}
        </ul>
        {resumo.desconto && resumo.desconto.centavos > 0 && <p className="mt-1.5 flex justify-between gap-4 text-[0.9375rem] text-[#2E8932]"><span>Cupom {resumo.desconto.codigo}</span><span className="tabular-nums">−{formatarMoeda(resumo.desconto.centavos)}</span></p>}
        <p className="mt-2 flex justify-between border-t border-black/10 pt-2 text-[1rem] font-medium"><span>Total</span><span className="tabular-nums">{formatarMoeda(resumo.total_centavos)}</span></p>
      </section>
      <a href={endereco} className={`${BOTAO} mt-5`}>Abrir a página de pagamento</a>
      <p className="mt-3 text-[0.75rem] text-black/50">Se a página não abrir sozinha, toque no botão. Depois de pagar, volte para esta página.</p>
      {enderecoDoPedido && <p className="mt-2 text-[0.75rem] text-black/50">Já pagou? <a href={enderecoDoPedido} className="font-normal underline underline-offset-2">Ver o meu pedido</a>.</p>}
    </Moldura>
  );
}
