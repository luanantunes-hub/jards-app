import Link from "next/link";

/** O fecho das páginas públicas da produção (voluntário, visita e presença): o que acontece com o que a pessoa escreveu e onde ler a política. */
export function AvisoDePrivacidade() {
  return (
    <p className="mt-6 text-center text-[0.6875rem] leading-5 text-black/45">
      O que você escreve aqui vai para a produção que enviou o link, só para organizar este evento, e é apagado ou tornado anônimo até 12 meses depois dele.{" "}
      <Link href="/privacidade#s2" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Ler a política de privacidade</Link>.
    </p>
  );
}
