import { redirect } from "next/navigation";

/** As reuniões viraram parte de Conversas, junto com os e-mails. A transcrição segue em /reunioes/[id]. */
export default function ReunioesPage() {
  redirect("/conversas");
}
