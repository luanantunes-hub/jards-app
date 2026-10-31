import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

// A moldura dos protótipos da produção (/producoes/prototipo): a lista das telas, a faixa que diz que
// é protótipo e a etiqueta de situação. Nada aqui lê nem grava no banco: os dados vêm de
// lib/producao/prototipo/dados.ts. Quando a tela de verdade chega, o protótipo dela sai desta lista.

export type Prototipo = { href: string; nome: string; descricao: string; entrega: string; fase: string };

export const PROTOTIPOS: Prototipo[] = [
  {
    href: "/producoes/prototipo/data", nome: "Página da data",
    descricao: "A data inteira numa página: resumo, o dia, a equipe, viagem e hospedagem, tarefas, arquivos, notas e histórico.",
    entrega: "PD1.6, PD1.8 e PD1.11", fase: "Fase 1",
  },
  {
    href: "/producoes/prototipo/folha", nome: "Folha do dia",
    descricao: "O que cada pessoa da equipe recebe por link no celular: o agora e o próximo, a própria chamada, a van, o hotel e o botão de confirmar.",
    entrega: "PD1.12 e PD1.13", fase: "Fase 1",
  },
  {
    href: "/producoes/prototipo/tarefas", nome: "Tarefas com prazo",
    descricao: "As tarefas de todas as datas, com o prazo contado da data (30 dias antes, 2 dias antes), que andam junto quando a data muda.",
    entrega: "PD1.11", fase: "Fase 1",
  },
  {
    href: "/producoes/prototipo/espaco", nome: "Pautas do espaço",
    descricao: "As salas do espaço na semana: consultas, pré-reservas em fila e confirmações, com aviso de conflito e de pré-reserva vencendo.",
    entrega: "PD1.5 e PD3.3", fase: "Fases 1 e 3",
  },
  {
    href: "/producoes/prototipo/acordos", nome: "Acordos",
    descricao: "Os contratos com quem compra ou recebe a data: garantia, percentual da bilheteria, quem paga cada despesa e as assinaturas.",
    entrega: "PD4.5 e PD4.6", fase: "Fase 4",
  },
  {
    href: "/producoes/prototipo/orcamento", nome: "Orçamento",
    descricao: "O orçamento vivo da temporada: o orçado, o que os acordos já comprometeram e o realizado, por categoria e por cenário.",
    entrega: "PD5.1 e PD5.2", fase: "Fase 5",
  },
];

/** A faixa do topo de cada protótipo: diz que é exemplo, de que entrega é e volta para a lista. */
export function FaixaDoPrototipo({ href }: { href: string }) {
  const prototipo = PROTOTIPOS.find(item => item.href === href);
  return (
    <div className="border-b bg-white" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <div className="mx-auto flex max-w-pagina flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 sm:px-6 lg:px-10">
        <p className="text-[0.6875rem] text-[#2D72B0]">
          <span className="font-semibold">Protótipo</span> · dados de exemplo, nada é salvo{prototipo ? ` · ${prototipo.entrega}, ${prototipo.fase}` : ""}
        </p>
        <Link href="/producoes/prototipo" className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
          <ArrowLeft size={12} aria-hidden="true" /> Todos os protótipos
        </Link>
      </div>
    </div>
  );
}

/** Etiqueta informativa (DESIGN.md): fundo branco, borda leve e texto na cor. */
export function Etiqueta({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: `${cor}47`, color: cor }}>
      {children}
    </span>
  );
}

/** Título de seção, no padrão das páginas de detalhe. */
export function TituloDeSecao({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{children}</h2>
      {acao}
    </div>
  );
}

/** Caixa branca com borda leve, a mesma das listas das telas de verdade. */
export function Caixa({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded border bg-white ${className}`} style={{ borderColor: "rgba(13,13,13,.08)" }}>{children}</div>;
}
