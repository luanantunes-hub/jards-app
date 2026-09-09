export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-black/40">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/10 border-t-[#7259B5]" />
        Carregando…
      </div>
    </div>
  );
}

