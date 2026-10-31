"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Caixa, FaixaDoPrototipo, TituloDeSecao } from "@/components/producao/prototipo/Prototipo";
import { TAREFAS, TURNE, type Tarefa } from "@/lib/producao/prototipo/dados";

const GRUPOS: Tarefa["grupo"][] = ["Atrasadas", "Esta semana", "Depois", "Feitas"];
const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "minhas", label: "Minhas" },
  { id: "atrasadas", label: "Atrasadas" },
] as const;

/** Protótipo das tarefas da produção (PD1.11): de todas as datas, com o prazo contado da data. */
export default function PrototipoDasTarefas() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todas");
  const [feitas, setFeitas] = useState(() => new Set(TAREFAS.filter(tarefa => tarefa.situacao === "feita").map(chave)));

  const visiveis = useMemo(() => TAREFAS.filter(tarefa =>
    filtro === "todas" ? true : filtro === "minhas" ? tarefa.responsavel.endsWith("Marina") : tarefa.situacao === "atrasada" && !feitas.has(chave(tarefa)),
  ), [filtro, feitas]);

  function alternar(tarefa: Tarefa) {
    setFeitas(atual => {
      const nova = new Set(atual);
      if (nova.has(chave(tarefa))) nova.delete(chave(tarefa)); else nova.add(chave(tarefa));
      return nova;
    });
  }

  return (
    <div className="min-h-full">
      <FaixaDoPrototipo href="/producoes/prototipo/tarefas" />
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Tarefas</h1>
          <p className="mt-1 text-[0.75rem] text-black/45">{TURNE.titulo} · as tarefas nascem do modelo do tipo de produção e andam junto quando a data muda</p>
          <div role="group" aria-label="Filtrar tarefas" className="mt-5 flex flex-wrap gap-1.5">
            {FILTROS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltro(item.id)}
                aria-pressed={filtro === item.id}
                className={`h-9 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${filtro === item.id ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <DetailPageContent>
        <div className="space-y-8">
          {GRUPOS.map(grupo => {
            const doGrupo = visiveis.filter(tarefa => tarefa.grupo === grupo);
            if (doGrupo.length === 0) return null;
            return (
              <section key={grupo}>
                <TituloDeSecao>{grupo} <span className="tabular-nums text-black/30">· {doGrupo.length}</span></TituloDeSecao>
                <Caixa>
                  <ul className="divide-y divide-black/[.06]">
                    {doGrupo.map(tarefa => {
                      const feita = feitas.has(chave(tarefa));
                      return (
                        <li key={chave(tarefa)} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                          <button type="button" onClick={() => alternar(tarefa)} aria-pressed={feita} aria-label={feita ? `Reabrir: ${tarefa.titulo}` : `Concluir: ${tarefa.titulo}`} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${feita ? "border-[#2E8932] bg-[#2E8932] text-white" : "border-black/20 bg-white text-transparent hover:border-black/40"}`}>
                            <Check size={12} aria-hidden="true" />
                          </button>
                          <div className="min-w-0 flex-1 basis-60">
                            <p className={`text-[0.8125rem] ${feita ? "text-black/40 line-through decoration-black/25" : "font-medium text-[#282525]"}`}>{tarefa.titulo}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-black/45">
                              {tarefa.situacao === "atrasada" && !feita && <AlertTriangle size={12} aria-hidden="true" className="text-[#B07A14]" />}
                              {tarefa.prazo}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right text-[0.6875rem]">
                            <Link href="/producoes/prototipo/data" className="font-medium text-[#282525] underline decoration-black/20 underline-offset-2 hover:decoration-black/50">{tarefa.data}</Link>
                            <span className="text-black/45">{tarefa.responsavel}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Caixa>
              </section>
            );
          })}
          {visiveis.length === 0 && <p className="text-center text-[0.8125rem] text-black/45">Nenhuma tarefa atrasada.</p>}
        </div>
      </DetailPageContent>
    </div>
  );
}

function chave(tarefa: Tarefa): string {
  return `${tarefa.titulo} · ${tarefa.data}`;
}
