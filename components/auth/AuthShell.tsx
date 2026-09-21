import Image from "next/image";
import { ArrowUpRight, CalendarDays, Target, UsersRound } from "lucide-react";

type AuthShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  variant?: "default" | "editorial" | "compact";
};

export function AuthShell({ children, eyebrow, title, description, variant = "default" }: AuthShellProps) {
  const editorial = variant === "editorial";
  const compact = variant === "compact";

  return (
    <main className={`grid min-h-[100dvh] ${compact ? "bg-[#F7F7F5]" : editorial ? "bg-[#F7F7F5] lg:grid-cols-[minmax(0,1.06fr)_minmax(31rem,.94fr)]" : "bg-white lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,.92fr)]"}`}>
      {!compact && (
      <aside className={`auth-stage relative hidden min-h-[100dvh] overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-14 ${editorial ? "auth-stage--editorial" : ""}`}>
        {!editorial && (
          <div className="auth-stage__mesh" aria-hidden="true">
            <span className="auth-stage__orb auth-stage__orb--one" />
            <span className="auth-stage__orb auth-stage__orb--two" />
            <span className="auth-stage__orb auth-stage__orb--three" />
          </div>
        )}

        <Image src="/jards-logo.svg" alt="Jards" width={94} height={30} priority className="relative z-10 h-7 w-auto" />

        <div className="relative z-10 max-w-[42rem] py-12">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[.14em] text-black/40">{eyebrow}</p>
          <h2 className="max-w-[13ch] text-[clamp(3.2rem,5vw,5.8rem)] font-bold leading-[.94] tracking-[-.055em] text-[#0D0D0D]">
            {title}
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-black/48">{description}</p>

          {editorial ? (
            <Image
              src="/tamandua-telefone-transparent.png"
              alt="Tamanduá ao telefone"
              width={520}
              height={268}
              className="auth-editorial-mascot"
            />
          ) : (
            <div className="auth-product mt-10 max-w-xl border border-white/65 bg-white/64 p-3 backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-black/8 px-3 pb-3 pt-1">
                <div>
                  <p className="text-[10px] font-medium text-black/35">Pipeline de captação</p>
                  <p className="mt-0.5 text-sm font-semibold text-black/75">Visão do trimestre</p>
                </div>
                <span className="flex items-center gap-1.5 rounded border border-[#2E8932]/25 bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#2E8932]">
                  <ArrowUpRight size={11} /> 18,4%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3">
                <Metric icon={Target} label="Em negociação" value="R$ 1,28 mi" color="#7259B5" />
                <Metric icon={CalendarDays} label="Follow-ups" value="24" color="#2D72B0" />
                <Metric icon={UsersRound} label="Patrocinadores" value="2.064" color="#1A8B7A" />
              </div>
              <div className="grid grid-cols-5 gap-1.5 px-3 pb-3" aria-hidden="true">
                {[38, 54, 46, 72, 91, 64, 83, 58, 76, 96].map((height, index) => (
                  <span key={index} className="auth-product__bar" style={{ height: `${height * .46}px`, opacity: .28 + index * .055 }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {editorial ? (
          <p className="relative z-10 max-w-xs text-[11px] leading-5 text-black/42">Da oportunidade à renovação, tudo no mesmo contexto.</p>
        ) : (
          <div className="relative z-10 flex gap-8 text-[11px] text-black/40">
            <span><strong className="mr-1 font-semibold text-black/70">+2.000</strong> patrocinadores</span>
            <span><strong className="mr-1 font-semibold text-black/70">118</strong> oportunidades</span>
            <span><strong className="mr-1 font-semibold text-black/70">27</strong> estados</span>
          </div>
        )}
      </aside>
      )}

      <section className={`relative flex min-h-[100dvh] items-center justify-center overflow-hidden lg:px-12 xl:px-16 ${compact ? "auth-form-side--compact px-4 py-8 sm:px-10" : editorial ? "auth-form-side--editorial px-4 py-6 sm:px-10 sm:py-10" : "px-5 py-8 sm:px-10"}`}>
        {!editorial && !compact && <div className="auth-mobile-aura absolute inset-0 lg:hidden" aria-hidden="true" />}
        <div className={`relative z-10 w-full max-w-md ${compact ? "auth-form-panel auth-login-panel" : editorial ? "auth-form-panel" : ""}`}>{children}</div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-black/8 bg-white/72 p-3">
      <Icon size={14} style={{ color }} strokeWidth={1.7} />
      <p className="mt-4 text-[9px] text-black/35">{label}</p>
      <p className="mt-1 text-[13px] font-semibold tracking-[-.02em] text-black/75">{value}</p>
    </div>
  );
}
