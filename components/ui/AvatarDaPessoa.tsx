import { corDoAvatar, iniciaisDe } from "@/lib/conversas/avatar";

const TAMANHOS = {
  pequeno: "h-7 w-7 text-[0.5625rem]",
  medio: "h-9 w-9 text-[0.6875rem]",
  grande: "h-10 w-10 text-[0.75rem]",
} as const;

/**
 * Quem é a pessoa, num círculo: as iniciais do nome sobre a cor da identidade dela (sempre a mesma, tirada do
 * e-mail). Decorativo — o nome aparece escrito ao lado, então não entra na leitura de tela.
 */
export function AvatarDaPessoa({ nome, endereco, tamanho = "medio", className = "" }: {
  nome?: string | null;
  endereco?: string | null;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}) {
  const cor = corDoAvatar(endereco || nome);
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-white ${TAMANHOS[tamanho]} ${className}`}
      style={{ backgroundColor: cor }}
    >
      {iniciaisDe(nome, endereco)}
    </span>
  );
}
