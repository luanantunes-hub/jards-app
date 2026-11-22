"use client";

import { useEffect, useState } from "react";
import { formatarReais } from "@/lib/producao/dinheiro";
import { quandoDaSessao } from "@/lib/ticketeria/eventos";
import { ROTULO_DO_SELO } from "@/lib/ticketeria/modelo-painel";
import { ROTULO_DA_DIRECAO, type DirecaoDoPreco, type LinhaDoQuadro, type QuadroDoEvento } from "@/lib/ticketeria/precificacao";

// O quadro de precificação do evento (plano da Ticketeria, seção 11, P1, SÓ LEITURA): por sessão por vir, o preço que vale, a ocupação, a previsão de lotação por comparação com eventos parecidos e a sugestão
// de direção, com o motivo. Não muda preço: o preço de cada sessão se muda no lote, em "Preço por sessão". A conta está em lib/ticketeria/precificacao.ts e precificacao-servidor.ts.

const COR_DA_DIRECAO: Record<DirecaoDoPreco, string> = { subir: "#2E8932", manter: "#6B6B6B", baixar: "#B07A14", sem_comparacao: "#9A9A9A" };

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <span className="inline-flex shrink-0 rounded-xl border px-2 py-0.5 text-[0.6875rem]" style={{ borderColor: cor + "47", color: cor, background: cor + "0F" }}>{texto}</span>;
}

const porcento = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

function textoDaPrevisao(l: LinhaDoQuadro): string | null {
  if (l.previsaoPorcento === null) return null;
  const faixa = l.faixaBaixo !== null && l.faixaAlto !== null ? `${porcento(l.faixaBaixo, l.lugares)}% a ${porcento(l.faixaAlto, l.lugares)}%` : `${l.previsaoPorcento}%`;
  return `Previsão de lotação: ${faixa}`;
}

/** O quadro, sem busca de dados: só mostra o que recebeu (roda nos testes). */
export function QuadroView({ quadro }: { quadro: QuadroDoEvento }) {
  if (quadro.linhas.length === 0) return null;
  return (
    <section aria-labelledby="precificacao-do-evento" className="mt-10">
      <h2 id="precificacao-do-evento" className="mb-1 text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Precificação</h2>
      <p className="mb-3 text-[0.75rem] text-black/50">Só leitura. A direção sugerida vem de eventos parecidos do seu histórico; o preço de cada sessão se muda no lote, em &quot;Preço por sessão&quot;.</p>
      <ul className="divide-y divide-black/[.06] overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {quadro.linhas.map(l => {
          const previsao = textoDaPrevisao(l);
          return (
            <li key={l.sessaoId} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[0.8125rem] font-normal text-[#282525]">{quandoDaSessao(l.inicio, l.fuso)}</span>
                <span className="flex items-center gap-2 text-[0.8125rem] tabular-nums text-[#282525]">
                  {l.precoVigenteCentavos !== null ? formatarReais(l.precoVigenteCentavos) : "Sem ingresso pago"}
                  {l.precoProprio && l.precoBaseCentavos !== null && <span className="text-[0.6875rem] text-black/45">preço próprio (lote: {formatarReais(l.precoBaseCentavos)})</span>}
                </span>
              </div>
              <p className="mt-0.5 text-[0.6875rem] tabular-nums text-black/50">
                {l.vendidos.toLocaleString("pt-BR")} de {l.lugares.toLocaleString("pt-BR")} vendidos ({porcento(l.vendidos, l.lugares)}%) · {l.diasAteASessao === 0 ? "é hoje" : `faltam ${l.diasAteASessao} ${l.diasAteASessao === 1 ? "dia" : "dias"}`}
                {previsao && <> · {previsao}{l.selo ? ` (${ROTULO_DO_SELO[l.selo]}, ${l.parecidos} ${l.parecidos === 1 ? "parecido" : "parecidos"})` : ""}</>}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Etiqueta texto={ROTULO_DA_DIRECAO[l.sugestao.direcao]} cor={COR_DA_DIRECAO[l.sugestao.direcao]} />
                <span className="text-[0.75rem] text-black/55">{l.sugestao.motivo}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {quadro.referencia && (
        <p className="mt-2 text-[0.75rem] text-black/50">
          Parecidos que lotaram cobraram, em média, {formatarReais(quadro.referencia.mediaCentavos)} ({quadro.referencia.n} {quadro.referencia.n === 1 ? "evento" : "eventos"}). É uma referência, não uma recomendação:
          como seus eventos quase não mudam de preço, não dá para medir quanto a venda reage a ele.
        </p>
      )}
    </section>
  );
}

/** O quadro de um evento: lê da rota do servidor (só quem edita a Ticketeria) e mostra. `chave` muda quando o preço de uma sessão muda, para ler de novo. */
export function QuadroDePrecificacao({ lojaId, eventoId, chave = 0 }: { lojaId: string; eventoId: string; chave?: number }) {
  const [quadro, setQuadro] = useState<QuadroDoEvento | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${lojaId}/precificacao?evento=${eventoId}`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const dados = (await resposta.json()) as QuadroDoEvento;
        if (ativo) { setQuadro(dados); setErro(false); }
      } catch {
        if (ativo) setErro(true);
      }
    })();
    return () => { ativo = false; };
  }, [lojaId, eventoId, chave]);

  if (erro) return <p className="mt-10 text-[0.75rem] text-black/45">Não foi possível carregar a precificação. Recarregue a página.</p>;
  if (quadro === null) return null;
  return <QuadroView quadro={quadro} />;
}
