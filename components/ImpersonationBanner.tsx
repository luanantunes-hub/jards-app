"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Shield, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "_jards_imp";

type StoredImp = { email: string; accessToken: string };

export function ImpersonationBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const impFlag  = params.get("_imp");
    const impEmail = params.get("_imp_email");
    const supabase = createClient();

    if (impFlag === "1" && impEmail) {
      // Limpa os params da URL sem reload
      const url = new URL(window.location.href);
      url.searchParams.delete("_imp");
      url.searchParams.delete("_imp_email");
      window.history.replaceState({}, "", url.toString());

      // Confirma com o servidor que a sessão trocou de verdade antes de exibir o aviso —
      // a troca acontece em /admin/impersonate/complete e pode falhar silenciosamente.
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email !== impEmail) { setMismatch(true); return; }
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.access_token) {
            try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email: impEmail, accessToken: session.access_token } satisfies StoredImp)); } catch {}
          }
          setEmail(impEmail);
        });
      });
      return;
    }

    let stored: StoredImp | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {}
    if (!stored) return;

    // A marca só é válida enquanto for a MESMA sessão em que a impersonação começou.
    // Sem isso, qualquer saída que não passe pelo botão "Encerrar sessão" (o botão
    // normal de sair, fechar a aba, sessão expirar) deixa o e-mail marcado no
    // sessionStorage, e o próximo login normal com esse mesmo e-mail nessa aba
    // reativa o banner por engano — foi o que aconteceu com adm@walkmar.com.br.
    // Comparar o access_token garante que um login/logout normal (novo token)
    // invalida a marca sozinho, mesmo sem clicar em nada.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && session.access_token === stored!.accessToken) {
        setEmail(stored!.email);
      } else {
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
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-5 py-2 text-[0.75rem] font-semibold text-white"
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
      <div className="flex items-center gap-2 text-[0.75rem] font-semibold text-white/90">
        <Shield size={13} className="text-white" />
        Navegando como{" "}
        <span className="font-bold text-white">{email}</span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 px-3 py-1 rounded text-[0.6875rem] font-semibold text-white transition disabled:opacity-60"
        style={{ background: "rgba(0,0,0,.22)" }}
      >
        <X size={11} />
        {exiting ? "Saindo…" : "Encerrar sessão"}
      </button>
    </div>
  );
}
