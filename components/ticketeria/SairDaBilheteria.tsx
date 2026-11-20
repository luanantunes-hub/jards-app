"use client";

import { createClient } from "@/lib/supabase/client";
import { ENTRADA_DA_BILHETERIA } from "@/lib/ticketeria/bilheteria";

export function SairDaBilheteria() {
  async function sair() {
    await createClient().auth.signOut();
    window.location.href = ENTRADA_DA_BILHETERIA;
  }
  return <button type="button" onClick={() => void sair()} className="mt-2 rounded-xl text-[0.75rem] text-black/50 underline underline-offset-2 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Sair</button>;
}
