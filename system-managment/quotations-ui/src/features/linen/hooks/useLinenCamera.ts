import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import jsQR from 'jsqr'

/** A decoded tag is ignored for this long after a read, so one physical tag
 * held in front of the lens registers once instead of firing every frame —
 * while still being re-readable when the operator deliberately rescans it. */
const DEFAULT_RESCAN_COOLDOWN_MS = 1500

export interface LinenCameraOptions {
  /** Receives the raw QR payload, before it is parsed into a linen code. */
  onCode: (raw: string) => void
  cooldownMs?: number
}

export interface LinenCamera {
  active: boolean
  starting: boolean
  error: string | null
  /** Attach this to an element; the <video> is inserted as its first child. */
  containerRef: RefObject<HTMLDivElement | null>
  start: (event?: MouseEvent) => void
  stop: () => void
}

function explain(error: unknown): string {
  const name = (error as { name?: string } | undefined)?.name ?? ''
  if (name === 'NotAllowedError') {
    return 'Camera blocked. Allow camera access in your browser settings, then retry. You can keep scanning with the input below.'
  }
  if (name === 'NotFoundError') return 'No camera found. Use the manual input below.'
  if (name === 'NotReadableError') return 'Camera is in use by another app. Use the manual input below.'
  const message = (error as { message?: string } | undefined)?.message
  return message ? `${name || 'Camera error'}: ${message}` : name || 'Camera error'
}

/**
 * Continuous QR reading for a linen session.
 *
 * The frame loop deliberately keeps running after a successful read: stopping
 * after the first decode would freeze the preview and silently ignore every
 * later tag. `onCode` is held in a ref so a long-running loop always calls the
 * latest handler instead of a stale render's closure.
 */
export function useLinenCamera({ onCode, cooldownMs = DEFAULT_RESCAN_COOLDOWN_MS }: LinenCameraOptions): LinenCamera {
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<number>(0)
  const lastRawRef = useRef<string | null>(null)
  const cooldownUntilRef = useRef(0)

  const onCodeRef = useRef(onCode)
  useEffect(() => { onCodeRef.current = onCode })

  const stop = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current)
      loopRef.current = 0
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.remove()
      videoRef.current = null
    }
    lastRawRef.current = null
    cooldownUntilRef.current = 0
    setActive(false)
  }, [])

  const start = useCallback(async (event?: MouseEvent) => {
    // getUserMedia is refused unless this originates from a user gesture.
    event?.preventDefault()
    setError(null)
    setStarting(true)

    try {
      stop()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream

      const container = containerRef.current
      if (!container) throw new Error('Camera container is not ready')

      container.querySelector('video')?.remove()
      const video = document.createElement('video')
      video.setAttribute('autoplay', '')
      video.setAttribute('playsinline', '')
      video.setAttribute('muted', '')
      video.style.width = '100%'
      video.style.minHeight = '300px'
      video.style.objectFit = 'cover'
      video.srcObject = stream
      container.prepend(video)
      videoRef.current = video

      await video.play()
      setActive(true)
      setStarting(false)

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })

      const loop = () => {
        const currentVideo = videoRef.current
        if (!currentVideo || currentVideo.readyState < 2) {
          loopRef.current = requestAnimationFrame(loop)
          return
        }

        canvas.width = currentVideo.videoWidth
        canvas.height = currentVideo.videoHeight
        context!.drawImage(currentVideo, 0, 0)

        const image = context!.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'attemptBoth',
        })

        if (qr?.data) {
          const now = Date.now()
          if (now >= cooldownUntilRef.current || qr.data !== lastRawRef.current) {
            cooldownUntilRef.current = now + cooldownMs
            lastRawRef.current = qr.data
            onCodeRef.current(qr.data)
          }
        }

        loopRef.current = requestAnimationFrame(loop)
      }

      loopRef.current = requestAnimationFrame(loop)
    } catch (error) {
      setStarting(false)
      setActive(false)
      setError(explain(error))
    }
  }, [cooldownMs, stop])

  useEffect(() => stop, [stop])

  return { active, starting, error, containerRef, start, stop }
}
