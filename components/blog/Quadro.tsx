// Moldura comum dos infográficos do blog: rótulo, título, conteúdo e legenda
// (nota e fonte). "largo" deixa o quadro avançar à direita da coluna de texto
// em telas grandes, para diagramas que precisam de mais espaço.

export const ROTULO = "font-(family-name:--font-mono) text-[0.6875rem] font-medium uppercase tracking-[.08em]";

type Props = {
  id: string;
  rotulo: string;
  titulo: string;
  nota?: string;
  fonte?: string;
  largo?: boolean;
  children: React.ReactNode;
};

export default function Quadro({ id, rotulo, titulo, nota, fonte, largo = false, children }: Props) {
  return (
    <figure className={`my-12 ${largo ? "lg:-mr-32 xl:-mr-48" : ""}`} aria-labelledby={id}>
      <div className="rounded bg-[#F7F7F5] px-5 py-7 sm:px-8">
        <p className={`${ROTULO} text-[#684DB0]`}>{rotulo}</p>
        <p id={id} className="mt-2 text-lg leading-snug font-bold tracking-[-0.01em] text-balance text-[#282525]">{titulo}</p>
        {children}
        {(nota || fonte) && (
          <figcaption className="mt-5 flex flex-col gap-1.5 text-xs leading-relaxed text-black/60">
            {nota && <span>{nota}</span>}
            {fonte && <span>Fonte: {fonte}</span>}
          </figcaption>
        )}
      </div>
    </figure>
  );
}
