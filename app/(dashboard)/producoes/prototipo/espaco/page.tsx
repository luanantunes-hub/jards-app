import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Caixa, Etiqueta, FaixaDoPrototipo } from "@/components/producao/prototipo/Prototipo";
import { ESPACO, PAUTAS, type Pauta, type SituacaoDaPauta } from "@/lib/producao/prototipo/dados";

const COR: Record<SituacaoDaPauta, string> = {
  Confirmada: "#2E8932",
  "Pré-reserva 1ª": "#B07A14",
  "Pré-reserva 2ª": "#B07A14",
  Consulta: "#2D72B0",
};
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]";

function CartaoDaPauta({ pauta }: { pauta: Pauta }) {
  return (
    <div className="rounded border bg-white p-2.5" style={{ borderColor: "rgba(13,13,13,.10)" }}>
      <p className="text-[0.75rem] font-semibold leading-snug text-[#282525]">{pauta.titulo}</p>
      <p className="mt-0.5 text-[0.6875rem] text-black/50">{pauta.quem} · {pauta.horario}</p>
      <div className="mt-2"><Etiqueta cor={COR[pauta.situacao]}>{pauta.situacao}</Etiqueta></div>
      {pauta.aviso && (
        <p className="mt-1.5 flex items-start gap-1 text-[0.6875rem] text-black/60">
          <AlertTriangle size={11} aria-hidden="true" className="mt-px shrink-0 text-[#B07A14]" /> {pauta.aviso}
        </p>
      )}
    </div>
  );
}

/** Protótipo das pautas do espaço (PD1.5 e PD3.3): as salas na semana, com a fila de pré-reservas e os conflitos. */
export default function PrototipoDoEspaco() {
  return (
    <div className="min-h-full">
      <FaixaDoPrototipo href="/producoes/prototipo/espaco" />
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Pautas · {ESPACO.nome}</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">Semana de {ESPACO.semana} · {ESPACO.salas.length} salas</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={BOTAO} aria-label="Semana anterior"><ChevronLeft size={14} aria-hidden="true" /></button>
              <button type="button" className={BOTAO}>Esta semana</button>
              <button type="button" className={BOTAO} aria-label="Próxima semana"><ChevronRight size={14} aria-hidden="true" /></button>
              <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded bg-[#282525] px-3.5 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"><Plus size={13} aria-hidden="true" /> Nova pauta</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[0.6875rem] text-black/45">
            <Etiqueta cor={COR.Consulta}>Consulta</Etiqueta>
            <Etiqueta cor={COR["Pré-reserva 1ª"]}>Pré-reserva, em fila</Etiqueta>
            <Etiqueta cor={COR.Confirmada}>Confirmada</Etiqueta>
            <span>· a 2ª pré-reserva assume quando a 1ª cai ou vence</span>
          </div>
        </div>
      </header>
      <DetailPageContent>
        <Caixa className="hidden md:block">
          <div className="overflow-x-auto">
            <div className="grid min-w-[60rem]" style={{ gridTemplateColumns: `9.5rem repeat(${ESPACO.dias.length}, minmax(7.5rem, 1fr))` }}>
              <div className="border-b px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.08)" }} />
              {ESPACO.dias.map(dia => (
                <div key={dia} className="border-b border-l px-3 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>{dia}</div>
              ))}
              {ESPACO.salas.map(sala => (
                <div key={sala.nome} className="contents">
                  <div className="border-b px-3 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    <p className="text-[0.8125rem] font-medium text-[#282525]">{sala.nome}</p>
                    <p className="text-[0.6875rem] tabular-nums text-black/45">{sala.lugares} lugares</p>
                  </div>
                  {ESPACO.dias.map((dia, indice) => (
                    <div key={dia} className="space-y-1.5 border-b border-l p-1.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                      {PAUTAS.filter(pauta => pauta.sala === sala.nome && pauta.dia === indice).map(pauta => <CartaoDaPauta key={pauta.titulo} pauta={pauta} />)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Caixa>

        <div className="space-y-6 md:hidden">
          {ESPACO.dias.map((dia, indice) => {
            const doDia = PAUTAS.filter(pauta => pauta.dia === indice);
            return (
              <section key={dia}>
                <h2 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{dia}</h2>
                {doDia.length === 0 ? (
                  <p className="text-[0.75rem] text-black/40">Salas livres</p>
                ) : (
                  <ul className="space-y-2">
                    {doDia.map(pauta => (
                      <li key={pauta.titulo}>
                        <p className="mb-1 text-[0.6875rem] text-black/45">{pauta.sala}</p>
                        <CartaoDaPauta pauta={pauta} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </DetailPageContent>
    </div>
  );
}
