import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { textoSobreCor } from "@/lib/ticketeria/site";
import type { ListaDeEventosNaApi, SessaoNaApi } from "@/lib/ticketeria/integracao";

// A lista de ingressos que aparece dentro do site de fora (o widget): eventos, e em cada um as sessões com data, local, preço e o botão Comprar, que abre a página de compra do Jards em
// outra aba (o pagamento nunca acontece dentro do site de fora). Usa a cor do site da loja. Desenho aprovado pelo dono em 20/11/2026.

const SEM_CAIXA = "text-[0.8125rem] text-[#282525]";

function Situacao({ sessao, cor }: { sessao: SessaoNaApi; cor: string }) {
  if (sessao.estado === "aberta") {
    return <a href={sessao.url} target="_blank" rel="noopener noreferrer" className="shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[0.75rem] font-normal transition hover:opacity-90" style={{ backgroundColor: cor, color: textoSobreCor(cor) }}>Comprar</a>;
  }
  if (sessao.estado === "esgotada") return <a href={sessao.url} target="_blank" rel="noopener noreferrer" className="shrink-0 whitespace-nowrap text-[0.75rem] text-black/55 underline underline-offset-2 hover:text-black/75">Esgotado · lista de espera</a>;
  return <span className="shrink-0 whitespace-nowrap text-[0.75rem] text-black/45">Indisponível</span>;
}

function legenda(sessao: SessaoNaApi): string {
  const extra = sessao.estado !== "aberta" ? null : sessao.poucos ? "poucos ingressos" : sessao.a_partir_de_centavos !== null ? `a partir de ${formatarMoeda(sessao.a_partir_de_centavos)}` : null;
  return [sessao.local, extra].filter(Boolean).join(" · ");
}

/** `eventoId`: só este evento (o widget com data-evento). Sem eventos à venda, uma frase. */
export function IngressosEmbutidos({ lista, eventoId }: { lista: ListaDeEventosNaApi; eventoId?: string | null }) {
  const cor = lista.tema.cor;
  const eventos = eventoId ? lista.eventos.filter(e => e.id === eventoId) : lista.eventos;
  return (
    <div className="px-1 py-2">
      {eventos.length === 0 ? (
        <p className={`${SEM_CAIXA} text-black/55`}>Nenhum evento à venda no momento.</p>
      ) : (
        <div className="space-y-5">
          {eventos.map(e => (
            <section key={e.id} aria-label={e.titulo}>
              <h2 className="text-[0.9375rem] font-normal text-[#282525]">{e.titulo}</h2>
              {e.classificacao && <p className="text-[0.75rem] text-black/55">{e.classificacao}</p>}
              <ul className="mt-2 space-y-1.5">
                {e.sessoes.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/[.1] bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <p className={SEM_CAIXA}>{s.quando}</p>
                      {legenda(s) && <p className="text-[0.75rem] text-black/55">{legenda(s)}</p>}
                    </div>
                    <Situacao sessao={s} cor={cor} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-3 text-[0.6875rem] text-black/40">Ingressos por Jards</p>
    </div>
  );
}
