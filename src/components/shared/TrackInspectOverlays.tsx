import { AnimatePresence } from '@/components/shared/Motion'
import { useTrackInspectStore } from '@/stores/trackInspectStore'
import { TrackResumePopover } from '@/components/library/TrackResumePopover'
import { CouragePopover } from '@/components/library/CouragePopover'

/**
 * App-root host for the per-track inspect overlays (Track Résumé + Courage).
 * Mounted once near the top of the tree so the overlays render full-screen
 * instead of being squished inside whatever panel triggered them. The popovers
 * themselves portal to <body>; this just wires them to the global store with
 * the house enter/exit animation.
 */
export function TrackInspectOverlays(): React.JSX.Element {
  const resume = useTrackInspectStore((s) => s.resume)
  const courage = useTrackInspectStore((s) => s.courage)
  const closeResume = useTrackInspectStore((s) => s.closeResume)
  const closeCourage = useTrackInspectStore((s) => s.closeCourage)

  return (
    <>
      <AnimatePresence>
        {resume && (
          <TrackResumePopover
            track={resume.track}
            resume={resume.resume}
            loading={resume.loading}
            onClose={closeResume}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {courage && (
          <CouragePopover
            reference={courage.track}
            courage={courage.courage}
            loading={courage.loading}
            onClose={closeCourage}
          />
        )}
      </AnimatePresence>
    </>
  )
}
