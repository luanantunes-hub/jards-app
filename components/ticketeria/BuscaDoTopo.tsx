"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Receipt, Search, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";

// A barra de busca do topo da Ticketeria: acha páginas do módulo, eventos e compras (por nome, e-mail ou código) e leva até lá.
// Os eventos carregam ao focar a barra; as compras (as 200 mais recentes) só quando a pessoa começa a digitar.

type Evento = { id: string; titulo: string };
type Compra = { id: string; codigo: string; comprador: string; email: string; evento: string };
type Resultado = { chave: string; grupo: "Páginas" | "Eventos" | "Compras"; rotulo: string; apoio?: string; href: string; icone: typeof Search };

const PAGINAS: { rotulo: string; href: string }[] = [
  { rotulo: "Início", href: "/ingressos" }, { rotulo: "Programação", href: "/ingressos/eventos" }, { rotulo: "Vendas", href: "/ingressos/vender" }, { rotulo: "Pedidos", href: "/ingressos/vendas" },
  { rotulo: "Controle de entrada", href: "/ingressos/porta" }, { rotulo: "Bilheteria", href: "/ingressos/bilheteria" }, { rotulo: "Financeiro", href: "/ingressos/recebimentos" }, { rotulo: "Recebimentos", href: "/ingressos/recebimentos" },
  { rotulo: "Marketing", href: "/ingressos/divulgacao" }, { rotulo: "Cupons", href: "/ingressos/cupons" }, { rotulo: "Lista de espera", href: "/ingressos/espera" },
  { rotulo: "Público", href: "/ingressos/publico" }, { rotulo: "Loja online", href: "/ingressos/site" }, { rotulo: "Integrações", href: "/ingressos/integracoes" }, { rotulo: "Espaços", href: "/ingressos/locais" },
];

/** Sem acento e em minúscula, para a busca não depender de como a pessoa digita. */
export const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Os resultados da busca para o texto digitado (puro, para os testes). */
export function buscarNaTicketeria(texto: string, eventos: Evento[], compras: Compra[]): Resultado[] {
  const q = normalizar(texto);
  if (q.length === 0) return [];
  const paginas = PAGINAS.filter(p => normalizar(p.rotulo).includes(q)).slice(0, 4).map(p => ({ chave: `p:${p.href}`, grupo: "Páginas" as const, rotulo: p.rotulo, href: p.href, icone: Ticket }));
  const dosEventos = eventos.filter(e => normalizar(e.titulo).includes(q)).slice(0, 4).map(e => ({ chave: `e:${e.id}`, grupo: "Eventos" as const, rotulo: e.titulo, href: `/ingressos/eventos/${e.id}`, icone: CalendarDays }));
  const dasCompras = compras.filter(c => normalizar(`${c.comprador} ${c.email} ${c.codigo}`).includes(q)).slice(0, 5)
    .map(c => ({ chave: `c:${c.id}`, grupo: "Compras" as const, rotulo: c.comprador, apoio: `${c.evento} · ${c.codigo}`, href: `/ingressos/vendas?compra=${c.id}`, icone: Receipt }));
  return [...paginas, ...dosEventos, ...dasCompras];
}

export function BuscaDoTopo({ organizationId }: { organizationId: string | null }) {
  const router = useRouter();
  const idDaLista = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [compras, setCompras] = useState<Compra[] | null>(null);

  // Os eventos, ao focar a barra pela primeira vez.
  useEffect(() => {
    if (!aberta || eventos !== null || !organizationId) return;
    let vivo = true;
    void clienteDaTicketeria(createClient()).from("ticketeria_eventos").select("id, titulo").eq("organization_id", organizationId).order("created_at", { ascending: false }).then(({ data }) => { if (vivo) setEventos((data ?? []) as Evento[]); });
    return () => { vivo = false; };
  }, [aberta, eventos, organizationId]);

  // As compras, quando a pessoa começa a digitar.
  useEffect(() => {
    if (texto.trim().length < 2 || compras !== null || !organizationId) return;
    let vivo = true;
    void (async () => {
      try {
        const { data: loja } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
        if (!loja) { if (vivo) setCompras([]); return; }
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/vendas`, { cache: "no-store" });
        const dados = resposta.ok ? ((await resposta.json()) as { compras?: Compra[] }) : {};
        if (vivo) setCompras((dados.compras ?? []).map(c => ({ id: c.id, codigo: c.codigo, comprador: c.comprador, email: c.email, evento: c.evento })));
      } catch { if (vivo) setCompras([]); }
    })();
    return () => { vivo = false; };
  }, [texto, compras, organizationId]);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberta(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberta]);

  const resultados = useMemo(() => buscarNaTicketeria(texto, eventos ?? [], compras ?? []), [texto, eventos, compras]);

  function ir(r: Resultado) {
    setAberta(false); setTexto(""); setAtivo(0);
    campo.current?.blur();
    router.push(r.href);
  }
  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setAberta(false); campo.current?.blur(); return; }
    if (resultados.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAberta(true); setAtivo(a => (a + 1) % resultados.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo(a => (a - 1 + resultados.length) % resultados.length); }
    else if (e.key === "Enter") { e.preventDefault(); ir(resultados[Math.min(ativo, resultados.length - 1)]); }
  }

  const mostrar = aberta && texto.trim().length > 0;
  return (
    <div ref={caixa} className="relative min-w-0 flex-1 md:max-w-xl">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" />
      <input
        ref={campo} type="search" role="combobox" aria-expanded={mostrar} aria-controls={idDaLista} aria-autocomplete="list" aria-label="Pesquisar" placeholder="Pesquisar"
        value={texto} autoComplete="off" onFocus={() => setAberta(true)} onChange={e => { setTexto(e.target.value); setAtivo(0); setAberta(true); }} onKeyDown={teclas}
        className="h-10 w-full rounded-xl border border-transparent bg-black/[.04] pl-10 pr-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/40 focus:border-[#7259B5]/45 focus:bg-white focus:ring-2 focus:ring-[#7259B5]/10"
      />
      {mostrar && (
        <div id={idDaLista} role="listbox" aria-label="Resultados" className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-xl border bg-white p-1.5 elevacao-1" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {resultados.length === 0 ? <p className="m-0 px-3 py-3 text-[0.8125rem] text-black/40">Nada encontrado</p> : (["Páginas", "Eventos", "Compras"] as const).map(grupo => {
            const itens = resultados.filter(r => r.grupo === grupo);
            if (itens.length === 0) return null;
            return (
              <div key={grupo} className="py-1">
                <p className="m-0 px-3 pb-1 pt-1 text-[0.625rem] uppercase tracking-[.08em] text-black/35">{grupo}</p>
                {itens.map(r => {
                  const indice = resultados.indexOf(r);
                  const Icone = r.icone;
                  return (
                    <button key={r.chave} type="button" role="option" aria-selected={indice === ativo} onMouseEnter={() => setAtivo(indice)} onClick={() => ir(r)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${indice === ativo ? "bg-black/[.05]" : ""}`}>
                      <Icone size={15} className="shrink-0 text-black/40" aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[0.8125rem] text-[#282525]">{r.rotulo}</span>{r.apoio && <span className="block truncate text-[0.75rem] text-black/40">{r.apoio}</span>}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
