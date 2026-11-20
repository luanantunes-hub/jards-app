"use client";

import { Check } from "lucide-react";
import { SEMANAS_IDEAIS, type Confianca, type ProntidaoDoModelo, type Verificacao } from "@/lib/ticketeria/modelo";

// A aba Modelo da Divulgação (fatia M-A): se já há dado para o modelo de marketing rodar, e o que falta. Ainda não há o cálculo do modelo (é a fatia seguinte). Só desenho: os dados
// e as ações chegam por props. Segue o DESIGN.md da Ticketeria: rótulos pequenos, cantos de 12px, cor só de estado.

const BORDA = "rgba(13,13,13,.08)";
const VERDE = "#2E8932";
const AMBAR = "#B07A14";
const LINK = "rounded-xl text-[0.75rem] text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const ROTULO_CONFIANCA: Record<Confianca, string> = { baixa: "baixa", media: "média", boa: "boa" };

function Marca({ estado }: { estado: Verificacao["estado"] }) {
  if (estado === "ok") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: VERDE }} aria-label="Pronto"><Check size={12} aria-hidden="true" /></span>;
  if (estado === "atencao") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] text-white" style={{ background: AMBAR }} aria-label="Falta um pouco">!</span>;
  return <span className="mt-0.5 size-5 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: "rgba(13,13,13,.25)" }} aria-label={estado === "falta" ? "Falta" : "Opcional"} />;
}

/** A checklist de prontidão: o aviso (pronto ou não, com o progresso) e cada verificação, com o botão que leva ao que resolve. */
export function ModeloDaLoja({ prontidao, onImportar, onConexoes }: { prontidao: ProntidaoDoModelo; onImportar?: () => void; onConexoes?: () => void }) {
  const { pronto, prontos, total, confianca, semanas, verificacoes, ignoradas } = prontidao;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pronto ? (
            <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">Os dados estão prontos.</span> Com eles o modelo teria confiança {confianca ? ROTULO_CONFIANCA[confianca] : "baixa"} ({semanas} {semanas === 1 ? "semana" : "semanas"} com vendas e gasto; o ideal são {SEMANAS_IDEAIS}). O cálculo do modelo chega na próxima etapa.</p>
          ) : (
            <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">O modelo ainda não pode rodar.</span> Faltam dados em {total - prontos === 1 ? "uma coisa" : `${total - prontos === 2 ? "duas" : "três"} coisas`}. Quando estiver tudo certo, ele roda sozinho toda segunda-feira.</p>
          )}
          <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: pronto ? `${VERDE}47` : "rgba(176,122,20,.28)", color: pronto ? VERDE : AMBAR }}>{prontos} de {total} prontos</span>
        </div>
      </div>
      <div className="divide-y divide-black/[.08] rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        {verificacoes.map(v => (
          <div key={v.id} className="flex items-start gap-3.5 px-4 py-4">
            <Marca estado={v.estado} />
            <div className="min-w-0">
              <p className="text-[0.8125rem] text-[#282525]">{v.titulo}</p>
              <p className="mt-1 max-w-3xl text-[0.75rem] leading-relaxed text-black/45">{v.detalhe}</p>
              {v.acao === "importar" && <button type="button" onClick={onImportar} className={`mt-1.5 ${LINK}`}>{v.id === "gasto" ? "Importar gastos antigos" : "Importar planilha"}</button>}
              {v.acao === "conexoes" && <button type="button" onClick={onConexoes} className={`mt-1.5 ${LINK}`}>Ir para Conexões</button>}
            </div>
          </div>
        ))}
      </div>
      {ignoradas.length > 0 && <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Para não contar o mesmo gasto duas vezes, ficou de fora o gasto {ignoradas.length === 1 ? "da ação" : "das ações"} <span className="text-black/65">{ignoradas.join(", ")}</span>: o gasto de anúncios já vem das conexões.</p>}
    </div>
  );
}
