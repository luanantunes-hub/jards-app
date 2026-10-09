import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-black/35">Página não encontrada</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-.03em] text-[#282525]">Este endereço não existe ou foi removido.</h1>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded border border-[#2E8932] bg-white px-4 py-2.5 text-[0.8125rem] font-semibold text-[#2E8932] transition hover:bg-black/[.04]"
        >
          Voltar ao painel
        </Link>
      </div>
    </main>
  );
}

