"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Shield, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "_jards_imp";

export function ImpersonationBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const impFlag  = params.get("_imp");
    const impEmail = params.get("_imp_email");
    let claimedEmail: string | null = null;

    if (impFlag === "1" && impEmail) {
      try { sessionStorage.setItem(STORAGE_KEY, impEmail); } catch {}
      claimedEmail = impEmail;
      // Limpa os params da URL sem reload
      const url = new URL(window.location.href);
      url.searchParams.delete("_imp");
      url.searchParams.delete("_imp_email");
      window.history.replaceState({}, "", url.toString());
    } else {
      try {
        claimedEmail = sessionStorage.getItem(STORAGE_KEY);
      } catch {}
    }

    if (!claimedEmail) return;

    // Confirma que a sessão real bate com o e-mail anunciado antes de exibir o aviso —
    // a troca de sessão acontece em /admin/impersonate/complete e pode falhar silenciosamente.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === claimedEmail) {
        setEmail(claimedEmail);
      } else {
        setMismatch(true);
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      }
    });
  }, [params]);

  async function handleExit() {
    setExiting(true);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/usuarios");
  }

  if (mismatch) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-5 py-2 text-[12px] font-semibold text-white"
        style={{ background: "#D94E4E" }}
      >
        <Shield size={13} />
        Não foi possível confirmar a sessão do usuário — você continua com a sua própria sessão.
      </div>
    );
  }

  if (!email) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-5 py-2"
      style={{ background: "#B07A14" }}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-white/90">
        <Shield size={13} className="text-white" />
        Navegando como{" "}
        <span className="font-bold text-white">{email}</span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold text-white transition disabled:opacity-60"
        style={{ background: "rgba(0,0,0,.22)" }}
      >
        <X size={11} />
        {exiting ? "Saindo…" : "Encerrar sessão"}
      </button>
    </div>
  );
}
