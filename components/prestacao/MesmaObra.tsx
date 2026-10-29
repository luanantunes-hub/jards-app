"use client";

// Prestações da mesma obra (P7.4): a ANCINE pede uma prestação por SALIC e por
// fonte, mas, na mesma obra e no mesmo objeto, vale o prazo que vencer por
// último e a concentração por fornecedor soma todas. Aqui a pessoa liga as
// prestações e vê o prazo que vale para o grupo.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { prazoDaObra } from "@/lib/prestacao/mesma-obra";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

type Outra = {
  id: string;
  titulo: string;
  identificador_oficial: string | null;
  fonte_recurso: string | null;
  prazo: string | null;
  obra_grupo: string | null;
};

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const BOTAO = "inline-flex h-9 items-center rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-not-allowed disabled:text-black/30";

export function MesmaObra({ prestacao, podeEditar, onMudou }: {
  prestacao: { id: string; titulo: string; organization_id: string | null; obra_grupo?: string | null; prazo: string | null };
  podeEditar: boolean;
  onMudou: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [outras, setOutras] = useState<Outra[] | null>(null);
  const [escolhida, setEscolhida] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [leitura, setLeitura] = useState(0);

  useEffect(() => {
    if (!prestacao.organization_id) return;
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacoes_contas ainda não está no tipo Database
    (supabase as any).from("prestacoes_contas")
      .select("id, titulo, identificador_oficial, fonte_recurso, prazo, obra_grupo")
      .eq("organization_id", prestacao.organization_id).neq("id", prestacao.id).order("titulo")
      .then(({ data, error }: { data: Outra[] | null; error: { message: string } | null }) => {
        if (!ativo) return;
        if (error) setErro(mensagemErroPrestacao(error, "Não foi possível carregar as prestações"));
        setOutras(data ?? []);
      });
    return () => { ativo = false; };
  }, [prestacao.id, prestacao.organization_id, prestacao.obra_grupo, supabase, leitura]);

  const doGrupo = (outras ?? []).filter(o => prestacao.obra_grupo && o.obra_grupo === prestacao.obra_grupo);
  const disponiveis = (outras ?? []).filter(o => !prestacao.obra_grupo || o.obra_grupo !== prestacao.obra_grupo);
  const ultimo = doGrupo.length ? prazoDaObra([prestacao, ...doGrupo]) : null;

  async function chamar(funcao: string, args: Record<string, string>) {
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- funções da prestação ainda não estão no tipo Database
    const { error } = await (supabase as any).rpc(funcao, args);
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível atualizar a obra")); return; }
    setEscolhida("");
    onMudou();
    setLeitura(n => n + 1);
  }

  return (
    <section className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby="mesma-obra-titulo">
      <h3 id="mesma-obra-titulo" className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35">Mesma obra</h3>
      <p className="mt-1 text-[0.6875rem] text-black/50">
        Prestações de outros SALICs ou chamadas do FSA da mesma obra e do mesmo objeto: a concentração por fornecedor soma todas, e vale o prazo que vencer por último.
        Desenvolvimento, produção e distribuição são objetos diferentes e não se juntam.
      </p>

      {doGrupo.length > 0 && (
        <>
          <ul className="mt-3 divide-y divide-black/[.05] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {doGrupo.map(o => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[0.75rem]">
                <div className="min-w-0">
                  <Link href={`/prestacoes/${o.id}`} className="rounded text-black/80 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{o.titulo}</Link>
                  <p className="text-[0.625rem] text-black/45">
                    {[o.identificador_oficial ? `SALIC ${o.identificador_oficial}` : null, o.fonte_recurso, o.prazo ? `prazo ${dataBr(o.prazo)}` : "sem prazo"].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {podeEditar && (
                  <button type="button" disabled={salvando} onClick={() => chamar("fn_prestacao_obra_desvincular", { p_prestacao_id: o.id })} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.1)" }} aria-label={`Desvincular ${o.titulo}`}>
                    Desvincular
                  </button>
                )}
              </li>
            ))}
          </ul>
          {ultimo && (
            <p className="mt-2 text-[0.6875rem] text-black/65">
              {ultimo.prestacao.id === prestacao.id
                ? <>Esta prestação tem o prazo que vence por último: <span className="tabular-nums">{dataBr(ultimo.prazo)}</span>.</>
                : <>Vale o prazo que vence por último: <span className="font-medium tabular-nums text-black/80">{dataBr(ultimo.prazo)}</span>, de {ultimo.prestacao.titulo}.</>}
            </p>
          )}
        </>
      )}

      {podeEditar && outras && disponiveis.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-[14rem]">
            <span className="mb-1 block text-[0.625rem] font-medium text-black/45">Vincular prestação da mesma obra</span>
            <Dropdown
              value={escolhida}
              onChange={setEscolhida}
              ariaLabel="Prestação da mesma obra"
              options={[{ value: "", label: "Escolha a prestação" }, ...disponiveis.map(o => ({ value: o.id, label: [o.titulo, o.identificador_oficial].filter(Boolean).join(" · ") }))]}
            />
          </div>
          <button type="button" disabled={!escolhida || salvando} onClick={() => chamar("fn_prestacao_obra_vincular", { p_prestacao_id: prestacao.id, p_outra_id: escolhida })} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.1)" }}>
            Vincular
          </button>
        </div>
      )}
      {outras && !doGrupo.length && !disponiveis.length && (
        <p className="mt-2 text-[0.6875rem] text-black/40">Não há outra prestação para vincular.</p>
      )}
      {erro && <p role="alert" className="mt-2 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}
    </section>
  );
}
