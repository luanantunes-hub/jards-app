"use client";

import { useEffect, useMemo, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { CANCELAR, Erro, ROTULO } from "@/components/producao/estilos";
import { createClient } from "@/lib/supabase/client";
import { formatarReais } from "@/lib/producao/dinheiro";
import { compararComAPrestacao, type Comparacao, type NoDaPrestacao } from "@/lib/producao/comparar-prestacao";
import type { ContasDoOrcamento } from "@/lib/producao/orcamento";

type Prestacao = { id: string; titulo: string | null; identificador_oficial: string | null };

/**
 * O orçamento da produção ao lado do da prestação de contas (PD10.4): **só leitura**. Aparece para quem tem os dois
 * módulos — quem não lê a prestação não vê prestação nenhuma na lista. O Jards não iguala as categorias de um lado
 * às do outro: cada lado traz os nomes que usa, e o que se compara é o total.
 */
export function CompararComAPrestacaoSheet({ organizationId, contas, onClose }: {
  organizationId: string; contas: ContasDoOrcamento; onClose: () => void;
}) {
  const [prestacoes, setPrestacoes] = useState<Prestacao[] | null>(null);
  const [escolhida, setEscolhida] = useState("");
  const [nos, setNos] = useState<NoDaPrestacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      // A prestação tem as regras de acesso dela: quem não tem o módulo simplesmente não recebe nada aqui.
      const { data, error } = await (createClient() as unknown as {
        from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: Prestacao[] | null; error: { message: string } | null }> } } };
      }).from("prestacoes_contas").select("id, titulo, identificador_oficial").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (!ativo) return;
      setPrestacoes(data ?? []);
      setEscolhida(atual => atual || data?.[0]?.id || "");
      if (error) setErro("Não foi possível carregar as prestações.");
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!escolhida) return;
    let ativo = true;
    void (async () => {
      const cliente = createClient() as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: boolean) => { maybeSingle: () => PromiseLike<{ data: { id: string } | null }> };
              order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: NoDaPrestacao[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
      // A versão ativa do orçamento da prestação, e os nós dela.
      const versao = await cliente.from("prestacao_orcamento_versoes").select("id").eq("prestacao_id", escolhida).eq("ativa", true).maybeSingle();
      if (!ativo) return;
      if (!versao.data) { setNos([]); return; }
      const { data, error } = await cliente.from("prestacao_orcamento_nos").select("id, tipo, nome, grupo_custo, valor_total, parent_id").eq("versao_id", versao.data.id).order("ordem", { ascending: true });
      if (!ativo) return;
      setNos(data ?? []);
      if (error) setErro("Não foi possível carregar o orçamento da prestação.");
    })();
    return () => { ativo = false; };
  }, [escolhida]);

  const comparacao: Comparacao | null = useMemo(() => (nos === null ? null : compararComAPrestacao(contas, nos)), [contas, nos]);

  return (
    <TopSheet titulo="Comparar com a prestação de contas" onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>}>
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <p className="text-[0.75rem] text-black/55">
          Os dois orçamentos lado a lado, só para olhar. <strong className="font-medium">O Jards não iguala as categorias de um lado às do outro</strong>: cada lado traz os nomes que usa, e o que se compara é o total. A produção nunca grava no orçamento da prestação.
        </p>

        {prestacoes === null ? (
          <div className="h-12 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : prestacoes.length === 0 ? (
          <p className="rounded border bg-white px-4 py-3 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            Nenhuma prestação de contas para comparar. Isto aparece para quem usa os dois módulos.
          </p>
        ) : (
          <>
            <div className="max-w-md">
              <span className={ROTULO}>Prestação de contas</span>
              <Dropdown
                ariaLabel="Prestação de contas"
                value={escolhida}
                onChange={valor => { setNos(null); setEscolhida(valor); }}
                options={prestacoes.map(prestacao => ({ value: prestacao.id, label: [prestacao.titulo, prestacao.identificador_oficial].filter(Boolean).join(" · ") || "Prestação" }))}
              />
            </div>

            {comparacao === null ? (
              <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  { titulo: "Produção (previsto)", dados: comparacao.producao, vazio: "Nenhuma linha com valor." },
                  { titulo: "Prestação (orçamento ativo)", dados: comparacao.prestacao, vazio: "A prestação não tem orçamento ativo com valor." },
                ] as const).map(coluna => (
                  <section key={coluna.titulo} aria-label={coluna.titulo}>
                    <h3 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{coluna.titulo}</h3>
                    {coluna.dados.linhas.length === 0 ? (
                      <p className="rounded border bg-white px-4 py-3 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>{coluna.vazio}</p>
                    ) : (
                      <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                        {coluna.dados.linhas.map(linha => (
                          <li key={linha.nome} className="flex items-baseline justify-between gap-3 px-3 py-2">
                            <span className="min-w-0 flex-1 truncate text-[0.75rem] text-black/65">{linha.nome}</span>
                            <span className="shrink-0 text-[0.75rem] tabular-nums text-[#282525]">{formatarReais(linha.centavos)}</span>
                          </li>
                        ))}
                        <li className="flex items-baseline justify-between gap-3 bg-black/[.02] px-3 py-2">
                          <span className="text-[0.75rem] font-medium text-[#282525]">Total</span>
                          <span className="text-[0.75rem] font-medium tabular-nums text-[#282525]">{formatarReais(coluna.dados.totalCentavos)}</span>
                        </li>
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            )}

            {comparacao && (comparacao.producao.totalCentavos !== 0 || comparacao.prestacao.totalCentavos !== 0) && (
              <p className="text-[0.75rem] text-black/55">
                {comparacao.diferencaCentavos === 0
                  ? "Os dois totais são iguais."
                  : comparacao.diferencaCentavos > 0
                    ? `A produção prevê ${formatarReais(comparacao.diferencaCentavos)} mais que o orçamento da prestação.`
                    : `A produção prevê ${formatarReais(-comparacao.diferencaCentavos)} menos que o orçamento da prestação.`}
              </p>
            )}
          </>
        )}
      </div>
    </TopSheet>
  );
}
