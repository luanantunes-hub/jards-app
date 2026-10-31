import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PROTOTIPOS } from "@/components/producao/prototipo/Prototipo";
import { TURNE } from "@/lib/producao/prototipo/dados";

/** A entrada dos protótipos: as telas da produção que ainda não existem, para ver como vão ficar. */
export default function PrototiposPage() {
  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <p className="text-[0.6875rem] font-medium text-[#2D72B0]">Só o suporte vê esta área</p>
          <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525] [text-wrap:balance]">Protótipos da produção</h1>
          <p className="mt-1.5 max-w-[42rem] text-[0.8125rem] text-black/55">
            As telas que ainda não existem, para ver como vão ficar. Os dados são de exemplo, a turnê de “{TURNE.obra}” pelo interior paulista, e nada é salvo.
            Quando a tela de verdade fica pronta, ela substitui o protótipo, na ordem do plano.
          </p>
        </div>
      </header>
      <DetailPageContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PROTOTIPOS.map(prototipo => (
            <li key={prototipo.href}>
              <Link
                href={prototipo.href}
                className="group flex h-full flex-col rounded border bg-white p-5 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                style={{ borderColor: "rgba(13,13,13,.08)" }}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[0.9375rem] font-semibold text-[#282525]">{prototipo.nome}</span>
                  <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black/50 motion-reduce:transition-none" />
                </span>
                <span className="mt-1.5 text-[0.75rem] leading-relaxed text-black/55">{prototipo.descricao}</span>
                <span className="mt-auto pt-4 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">{prototipo.fase} · {prototipo.entrega}</span>
              </Link>
            </li>
          ))}
        </ul>
      </DetailPageContent>
    </div>
  );
}
