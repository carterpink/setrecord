import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import type { SetTrack, ArchitectParams } from '@/types'
import { formatBpm } from '@/utils/format'
import { KeyChip } from '@/components/shared/KeyChip'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'

interface WarmupResultProps {
  setTracks: SetTrack[]
  params: ArchitectParams
  startBpm: number
  targetBpm: number
  name: string
}

const W = 600
const H = 64
const PAD = 6

/** Build the area + line path for the real per-track energy curve. */
function curvePaths(energies: number[]): { line: string; area: string } {
  if (energies.length === 0) return { line: '', area: '' }
  const n = energies.length
  const xs = (i: number): number => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const ys = (e: number): number => H - PAD - (Math.max(1, Math.min(10, e)) / 10) * (H - PAD * 2)
  const pts = energies.map((e, i) => [xs(i), ys(e)] as const)
  const line = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  return { line, area }
}

export function WarmupResult({
  setTracks,
  params,
  startBpm,
  targetBpm,
  name
}: WarmupResultProps): React.JSX.Element {
  const { t } = useTranslation('home')
  const populateFromArchitect = useSetStore((s) => s.populateFromArchitect)
  const setMode = useUiStore((s) => s.setMode)

  const runtimeMin = Math.round(
    setTracks.reduce((sum, st) => sum + (st.track.duration ?? 0), 0) / 60
  )
  const energies = setTracks.map((st) => st.track.energy ?? 5)
  const { line, area } = curvePaths(energies)
  const preview = setTracks.slice(0, 4)
  const more = Math.max(0, setTracks.length - preview.length)

  function openInBuild(): void {
    populateFromArchitect(setTracks, params, name)
    setMode('Build')
  }

  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">{t('warmup.title', { minutes: params.targetDuration })}</span>
        <span className="res-meta">
          {params.energyCurveType === 'rise' ? t('warmup.slowBurn') : t('warmup.steady')}
        </span>
      </div>
      <div className="build-card glass-1">
        <div className="build-stat-row">
          <div className="build-stat">
            <div className="v">
              {setTracks.length}
              <span className="u">{t('warmup.tracks')}</span>
            </div>
            <div className="k">{t('warmup.pulledFrom')}</div>
          </div>
          <div className="build-stat">
            <div className="v">
              {runtimeMin}
              <span className="u">{t('warmup.min')}</span>
            </div>
            <div className="k">{t('warmup.runtime')}</div>
          </div>
          <div className="build-stat">
            <div className="v" style={{ fontFamily: 'var(--font-mono)' }}>
              {startBpm}
              <span className="u">→ {targetBpm}</span>
            </div>
            <div className="k">{t('warmup.bpmRamp')}</div>
          </div>
        </div>

        <div className="curve glass-2">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="home-cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(200,255,61,0.30)" />
                <stop offset="1" stopColor="rgba(200,255,61,0)" />
              </linearGradient>
            </defs>
            {area && <path d={area} fill="url(#home-cg)" />}
            {line && (
              <path
                d={line}
                fill="none"
                stroke="#C8FF3D"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>

        <div className="build-preview">
          {preview.map((st, i) => (
            <div className="bp-row" key={st.id}>
              <span className="bp-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="bp-t">{st.track.title}</div>
                <div className="bp-a">{st.track.artist}</div>
              </div>
              <span className="track-bpm">{formatBpm(st.track.bpm)}</span>
              {st.track.key && <KeyChip>{st.track.key}</KeyChip>}
            </div>
          ))}
          {more > 0 && <div className="bp-more">{t('warmup.moreShaped', { count: more })}</div>}
        </div>

        <div className="build-head">
          <span className="res-meta">{t('warmup.notCommitted')}</span>
          <button type="button" className="btn btn-primary" onClick={openInBuild}>
            <Layers size={15} strokeWidth={1.7} />
            {t('warmup.openInBuild')}
          </button>
        </div>
      </div>
    </div>
  )
}
