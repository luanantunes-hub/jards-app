"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SairDoConvidado() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  async function sair() {
    setSaindo(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={sair} disabled={saindo}
      className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[0.75rem] text-black/55 transition hover:bg-black/[.04] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
      <LogOut size={14} aria-hidden /> Sair
    </button>
  );
}
