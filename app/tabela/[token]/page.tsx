// As tabelas para a transportadora e para a locadora, pelo link (PD8.6). Sem login: o servidor confere o código do link no banco (só o hash
// fica guardado), a revogação e a validade, e mostra só o que cada parceiro precisa: transfers (hora, trecho e passageiros) ou itens locados.

import type { Metadata } from "next";
import { carregarTabelaPublica, type ResultadoDaTabela } from "@/lib/producao/tabela-publica";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Tabela da produção",
  robots: { index: false, follow: false },
};

// A produção ajusta as listas a todo momento: nunca vêm prontas do cache.
export const dynamic = "force-dynamic";

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const diaBr = (dia: string) => dia.split("-").reverse().join("/");
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const medidas = (c: number | null, l: number | null, a: number | null) => (c === null && l === null && a === null ? "" : [c, l, a].map(valor => (valor === null ? "–" : numero.format(valor))).join(" × ") + " cm");

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9] px-4">
      <div className="max-w-[28rem] rounded border bg-white px-6 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <h1 className="text-[1.0625rem] font-semibold text-[#282525]">{titulo}</h1>
        <p className="mt-2 text-[0.8125rem] text-black/55">{texto}</p>
      </div>
    </main>
  );
}

const CAIXA = { borderColor: "rgba(13,13,13,.1)" };
const VAZIO = "mt-6 rounded border bg-white px-4 py-6 text-center text-[0.875rem] text-black/55";

export default async function TabelaPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let resultado: ResultadoDaTabela | null = null;
  try {
    resultado = await carregarTabelaPublica(createAdminClient(), token);
  } catch {
    resultado = null;
  }
  if (resultado === null) return <Aviso titulo="Não foi possível abrir a lista" texto="Tente de novo em instantes." />;
  if (resultado.situacao === "revogado") return <Aviso titulo="Esta lista foi desativada" texto="Peça o endereço novo a quem enviou." />;
  if (resultado.situacao === "expirado") return <Aviso titulo="Este endereço venceu" texto="Peça um endereço novo a quem enviou." />;
  if (resultado.situacao !== "valido") return <Aviso titulo="Lista não encontrada" texto="Confira o endereço que você recebeu." />;

  const { tabela } = resultado;
  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[44rem]">
        {tabela.organizacao && <p className="text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{tabela.organizacao}</p>}
        <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{tabela.titulo}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-black/55">
          {tabela.tipo === "transfers" ? "Transfers" : "Itens locados"}{tabela.filtro ? ` · ${tabela.filtro}` : ""}
        </p>

        {tabela.tipo === "transfers" ? (
          tabela.transfers.length === 0 ? (
            <p className={VAZIO} style={CAIXA}>Nenhum transfer marcado por enquanto. Volte em breve.</p>
          ) : (
            <ul className="mt-6 divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={CAIXA}>
              {tabela.transfers.map((transfer, indice) => (
                <li key={`${transfer.dia}-${transfer.saida}-${indice}`} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                    <span className="w-24 shrink-0 text-[0.9375rem] font-medium tabular-nums text-[#282525]">{diaBr(transfer.dia)}</span>
                    <span className="w-28 shrink-0 text-[0.9375rem] tabular-nums text-[#282525]">{transfer.saida ?? "hora a definir"}{transfer.chegada ? ` → ${transfer.chegada}` : ""}</span>
                    <span className="min-w-0 flex-1 basis-48 text-[0.9375rem] text-[#282525]">{[transfer.origem, transfer.destino].filter(Boolean).join(" → ") || "Trecho a definir"}</span>
                    <span className="text-[0.8125rem] text-black/50">{[transfer.tipo, transfer.companhia, transfer.localizador ? `localizador ${transfer.localizador}` : null].filter(Boolean).join(" · ")}</span>
                  </div>
                  <p className="mt-1 text-[0.8125rem] text-black/55">
                    {transfer.passageiros.length > 0 ? `${transfer.passageiros.length} ${transfer.passageiros.length === 1 ? "passageiro" : "passageiros"}: ${transfer.passageiros.join(", ")}` : "Passageiros a definir"}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : tabela.itens.length === 0 ? (
          <p className={VAZIO} style={CAIXA}>Nenhum item locado por enquanto. Volte em breve.</p>
        ) : (
          <ul className="mt-6 divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={CAIXA}>
            {tabela.itens.map((item, indice) => (
              <li key={`${item.nome}-${indice}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-3">
                <span className="w-12 shrink-0 text-[0.9375rem] font-medium tabular-nums text-[#282525]">{item.quantidade}×</span>
                <span className="min-w-0 flex-1 basis-48 text-[0.9375rem] text-[#282525]">{item.nome}<span className="ml-2 text-[0.75rem] text-black/45">{item.categoria}</span></span>
                <span className="text-[0.8125rem] tabular-nums text-black/55">
                  {[
                    item.locacao_inicio ? `${diaBr(item.locacao_inicio)}${item.locacao_fim ? ` a ${diaBr(item.locacao_fim)}` : ""}` : null,
                    medidas(item.comprimento_cm, item.largura_cm, item.altura_cm) || null,
                    item.peso_kg !== null ? `${numero.format(item.peso_kg)} kg` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-[0.6875rem] text-black/40">Este endereço vale até {dataBr(tabela.validoAte)}. A lista é atualizada pela produção.</p>
      </div>
    </main>
  );
}
