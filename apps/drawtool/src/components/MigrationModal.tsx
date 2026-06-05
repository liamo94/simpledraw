import type { LocalCanvas } from '../hooks/useMigration'

type Props = {
  localCanvases: LocalCanvas[]
  willMigrateCount: number
  skippedCount: number
  onMigrate: () => Promise<void>
  onSkip: () => void
  migrating: boolean
  error: string | null
  isDark: boolean
}

export default function MigrationModal({
  localCanvases,
  willMigrateCount,
  skippedCount,
  onMigrate,
  onSkip,
  migrating,
  error,
  isDark,
}: Props) {
  const panel = isDark ? 'bg-black/80 border-white/15' : 'bg-white/80 border-black/15'
  const textPrimary = isDark ? 'text-white/80' : 'text-black/80'
  const textSecondary = isDark ? 'text-white/40' : 'text-black/40'
  const divider = isDark ? 'border-white/10' : 'border-black/10'

  return (
    <>
      <div className="fixed inset-0 z-40 backdrop-blur-xl pointer-events-none" />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className={`w-full max-w-xs rounded-lg border backdrop-blur-sm p-5 ${panel}`}>
          <div className={`text-sm font-medium mb-1 ${textPrimary}`}>
            Move your canvases to the cloud?
          </div>
          <div className={`text-xs mb-4 leading-relaxed ${textSecondary}`}>
            {skippedCount > 0
              ? `Free accounts include 3 cloud canvases - the first ${willMigrateCount} will be moved. The rest require Unleashed.`
              : `You have ${localCanvases.length} canvas${localCanvases.length !== 1 ? 'es' : ''} saved locally. Move them to your cloud workspace to access from any device.`
            }
          </div>

          <div className={`rounded-lg border overflow-hidden mb-4 ${divider}`}>
            {localCanvases.slice(0, willMigrateCount).map((c, i) => (
              <div
                key={c.index}
                className={`flex items-center justify-between px-3 py-2 text-xs ${i > 0 ? `border-t ${divider}` : ''}`}
              >
                <span className={textPrimary}>{c.name}</span>
                <span className={textSecondary}>{c.strokeCount} stroke{c.strokeCount !== 1 ? 's' : ''}</span>
              </div>
            ))}
            {skippedCount > 0 && (
              <div className={`flex items-center justify-between px-3 py-2 text-xs border-t ${divider}`}>
                <span className={textSecondary}>+{skippedCount} more locked</span>
                <a
                  href="https://unleash.drawzil.la"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded text-xs font-medium text-white transition-opacity opacity-90 hover:opacity-100"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  Get Unleashed
                </a>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          )}

          <div className="flex gap-2 justify-center">
            <button
              onClick={onMigrate}
              disabled={migrating}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white' : 'bg-black/8 hover:bg-black/15 text-black/70 hover:text-black'}`}
            >
              {migrating ? 'Moving…' : 'Move to cloud'}
            </button>
            <button
              onClick={onSkip}
              disabled={migrating}
              className={`px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50 ${isDark ? 'text-white/40 hover:text-white/70' : 'text-black/40 hover:text-black/70'}`}
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
