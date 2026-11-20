import type { MarcaPublica } from "@/lib/producao/marcas";

/** "Apresentada por" com o logo (se há) e o nome da marca, que vira link para o site dela (se há). Serve à programação pública e ao bloco de programação do site. */
export function MarcaDaSessao({ marca }: { marca: MarcaPublica }) {
  const conteudo = (
    <>
      {marca.logo && (
        // eslint-disable-next-line @next/next/no-img-element -- o logo é um endereço https que a produção cadastrou, de qualquer site: o otimizador do Next não serve
        <img src={marca.logo} alt="" height={16} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="inline-block max-h-4 w-auto max-w-[5rem] align-text-bottom" />
      )}
      <span className="font-medium">{marca.nome}</span>
    </>
  );
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.75rem] opacity-60">
      <span>Apresentada por</span>
      {marca.site ? <a href={marca.site} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">{conteudo}</a> : <span className="inline-flex items-center gap-1.5">{conteudo}</span>}
    </span>
  );
}
