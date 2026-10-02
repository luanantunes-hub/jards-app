"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ImpersonateCompleteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const email = params.get("email");
    if (!tokenHash || !email) { setError("Link inválido."); return; }

    const supabase = createClient();
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" }).then(({ data, error: verifyError }) => {
      if (verifyError || !data.user || data.user.email !== email) {
        setError(verifyError?.message ?? "Não foi possível confirmar a sessão.");
        return;
      }
      router.replace(`/dashboard?_imp=1&_imp_email=${encodeURIComponent(email)}`);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-[0.875rem] font-semibold text-black">Não foi possível entrar como este usuário</p>
          <p className="mt-1.5 text-[0.8125rem] text-black/50">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#7259B5] border-t-transparent" />
    </div>
  );
}

export default function ImpersonateCompletePage() {
  return (
    <Suspense fallback={null}>
      <ImpersonateCompleteInner />
    </Suspense>
  );
}
