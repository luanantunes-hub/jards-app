import { Download, Megaphone } from "lucide-react";
import { carregarCadastrosComOrigem } from "@/lib/origem-cadastro-servidor";
import { CONVERSAO_ASSINATURA, CONVERSAO_CADASTRO, JANELA_CLIQUE_DIAS, montarConversoes } from "@/lib/origem-cadastro";

export const dynamic = "force-dynamic";

const PLANO: Record<string, string> = { basico: "Starter", profissional: "Pro" };

function fmtData(valor: string) {
  return new Date(valor).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function AdminCampanhasPage() {
  const { usuarios, pagamentos, planos } = await carregarCadastrosComOrigem();
  const pagantes = new Set(pagamentos.map((pagamento) => pagamento.user_id));
  const comClique = usuarios.filter((usuario) => usuario.origem.gclid).length;
  const assinaram = usuarios.filter((usuario) => pagantes.has(usuario.id)).length;
  const paraEnviar = montarConversoes(usuarios, pagamentos, planos).length;

  const cards = [
    { rotulo: "Vieram de campanha", valor: usuarios.length },
    { rotulo: "Com clique de anúncio", valor: comClique },
    { rotulo: "Assinaram", valor: assinaram },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#282525]">Cadastros por campanha</h1>
        <p className="text-sm text-black/40 mt-0.5">
          De qual campanha e palavra-chave veio cada cadastro, e a lista de conversões para o Google Ads.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.rotulo} className="rounded p-5" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{card.rotulo}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${card.valor ? "text-[#282525]" : "text-black/30"}`}>{card.valor}</p>
          </div>
        ))}
      </div>

      <section className="rounded p-6 mb-6" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[38rem]">
            <h2 className="text-sm font-bold text-[#282525]">Enviar ao Google Ads</h2>
            <ol className="mt-2 space-y-1.5 text-[0.8125rem] leading-5 text-black/55 list-decimal pl-4">
              <li>
                Na primeira vez, crie em Metas, Conversões, duas ações de importação de cliques com estes nomes:{" "}
                <strong className="font-semibold text-black/75">{CONVERSAO_CADASTRO}</strong> e{" "}
                <strong className="font-semibold text-black/75">{CONVERSAO_ASSINATURA}</strong>.
              </li>
              <li>Uma vez por semana, baixe a lista e envie em Metas, Conversões, Uploads.</li>
            </ol>
            <p className="mt-3 text-xs leading-5 text-black/35">
              Entram só cliques dos últimos {JANELA_CLIQUE_DIAS} dias, de quem aceitou o aviso de cookies. Enviar de novo
              não duplica: o Google descarta a conversão que já recebeu.
            </p>
          </div>
          <a
            href="/api/admin/conversoes-google-ads"
            download
            className="inline-flex shrink-0 items-center gap-2 rounded bg-[#282525] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3A3535] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
          >
            <Download size={15} /> Baixar lista ({paraEnviar})
          </a>
        </div>
      </section>

      <section className="rounded" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
          <Megaphone size={15} className="text-black/40" />
          <h2 className="text-sm font-bold text-[#282525]">Últimos cadastros com origem</h2>
        </div>

        {usuarios.length === 0 ? (
          <p className="px-6 pb-8 pt-4 text-center text-sm text-black/35">
            Ainda não há cadastros vindos de campanha. Eles aparecem aqui quando alguém se cadastra a partir de um
            anúncio ou de um link com utm.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-y border-black/[.06] text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">
                  <th className="px-6 py-2.5 font-medium">Data</th>
                  <th className="px-3 py-2.5 font-medium">Origem</th>
                  <th className="px-3 py-2.5 font-medium">Campanha</th>
                  <th className="px-3 py-2.5 font-medium">Palavra-chave</th>
                  <th className="px-3 py-2.5 font-medium">Clique</th>
                  <th className="px-6 py-2.5 font-medium">Assinatura</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.slice(0, 200).map((usuario) => {
                  const { origem } = usuario;
                  const fonte = [origem.utm_source, origem.utm_medium].filter(Boolean).join(" / ");
                  const plano = planos[usuario.id];
                  return (
                    <tr key={usuario.id} className="border-b border-black/[.04] last:border-0 text-black/65">
                      <td className="px-6 py-2.5 tabular-nums whitespace-nowrap">{fmtData(usuario.created_at)}</td>
                      <td className="px-3 py-2.5">{fonte || "—"}</td>
                      <td className="px-3 py-2.5">{origem.utm_campaign || "—"}</td>
                      <td className="px-3 py-2.5">{origem.utm_term || "—"}</td>
                      <td className="px-3 py-2.5">{origem.gclid ? "Sim" : "—"}</td>
                      <td className="px-6 py-2.5">
                        {pagantes.has(usuario.id) ? PLANO[plano ?? ""] ?? "Paga" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
