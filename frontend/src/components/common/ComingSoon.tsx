// Placeholder for routes whose page hasn't been built yet.

export function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-[var(--color-surface)] flex items-center justify-center">
        <span className="text-3xl">🚧</span>
      </div>
      <div className="text-center">
        <h2 className="text-[18px] font-semibold text-[var(--color-text-heading)]">{name}</h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
          This module is under development.
        </p>
      </div>
    </div>
  )
}
