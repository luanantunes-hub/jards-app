import { redirect } from "next/navigation";

/** A caixa de e-mail virou parte de Conversas, junto com as reuniões. */
export default function EmailsPage() {
  redirect("/conversas");
}
