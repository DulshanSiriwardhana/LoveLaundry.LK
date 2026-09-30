import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import jsQR from 'jsqr'
import { useLinenByCode, useScanLinen } from '../hooks/useLinen'
import { LINEN_STATUS_CONFIG, SCAN_ACTIONS, type LinenStatus } from '../../../types/linen'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Camera, CameraOff, Keyboard, Search, CheckCircle, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export default function LinenScanner() {
  const [mode, setMode] = useState<'camera' | 'manual'>('manual')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [code, setCode] = useState('')
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<{ label: string; color: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data: linen, refetch, isFetching } = useLinenByCode(lastScanned ?? undefined)
  const scanMutation = useScanLinen()

  const handleCodeScanned = useCallback((decodedText: string) => {
    const trimmed = decodedText.trim().toUpperCase()
    if (!trimmed || trimmed === lastScanned) return
    setLastAction(null)
    setLastScanned(trimmed)
    setCode(trimmed)
    refetch()
    toast.info(`Scanned: ${trimmed}`)
  }, [lastScanned, refetch])

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = 0
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async (e: React.MouseEvent) => {
    // Prevent default to ensure this is treated as user gesture
    e.preventDefault()
    setCameraError(null)
    setCameraStarting(true)

    try {
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      streamRef.current = stream

      // Create video element directly in the container
      const container = containerRef.current
      if (!container) throw new Error('Container not found')

      // Remove old video if any
      const oldVideo = container.querySelector('video')
      if (oldVideo) oldVideo.remove()

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
      setCameraActive(true)
      setCameraStarting(false)

      // Start scanning loop
      const scanCanvas = document.createElement('canvas')
      const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true })

      const scanLoop = () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanLoopRef.current = requestAnimationFrame(scanLoop)
          return
        }

        const v = videoRef.current
        scanCanvas.width = v.videoWidth
        scanCanvas.height = v.videoHeight
        scanCtx!.drawImage(v, 0, 0)

        const imageData = scanCtx!.getImageData(0, 0, scanCanvas.width, scanCanvas.height)
        const qr = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (qr?.data) {
          handleCodeScanned(qr.data)
          return
        }

        scanLoopRef.current = requestAnimationFrame(scanLoop)
      }

      scanLoopRef.current = requestAnimationFrame(scanLoop)
    } catch (err: any) {
      setCameraStarting(false)
      setCameraActive(false)
      const name = err?.name || ''
      if (name === 'NotAllowedError') {
        setCameraError('Camera blocked. Go to browser Settings → Site Settings → Camera → Allow this site, then reload.')
      } else if (name === 'NotFoundError') {
        setCameraError('No camera found.')
      } else if (name === 'NotReadableError') {
        setCameraError('Camera in use by another app.')
      } else {
        setCameraError(`${name}: ${err?.message}`)
      }
    }
  }, [stopCamera, handleCodeScanned, lastScanned])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const switchToManual = useCallback(() => {
    stopCamera()
    setMode('manual')
    setCameraError(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [stopCamera])

  const handleLookup = useCallback(() => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLastAction(null)
    setLastScanned(trimmed)
    refetch()
    setCode('')
  }, [code, refetch])

  const handleQuickAction = (action: string) => {
    if (!linen?.id) return
    const sa = SCAN_ACTIONS.find(a => a.value === action)
    const label = sa?.label ?? action
    scanMutation.mutate(
      { docId: linen.id, payload: { action } },
      {
        onSuccess: () => {
          setLastAction({ label, color: sa?.color ?? '#DC2626' })
          toast.success(`${label} — ${linen.linen_id}`)
          setTimeout(() => refetch(), 300)
        },
      }
    )
  }

  const stCfg = linen ? (LINEN_STATUS_CONFIG[linen.status as LinenStatus] ?? { label: linen.status, color: '#6B7280', bg: '#F3F4F6' }) : null

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Linen' }, { label: 'Scanner' }]} />

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
          Scan Linen
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Scan a QR code or enter a linen ID manually</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {!cameraActive ? (
          <Button variant="outline" size="sm" onClick={startCamera} disabled={cameraStarting} className="gap-2">
            {cameraStarting ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {cameraStarting ? 'Starting...' : 'Start Camera'}
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={switchToManual} className="gap-2">
            <CameraOff size={14} /> Stop Camera
          </Button>
        )}
        <Button
          variant={mode === 'manual' && !cameraActive ? 'default' : 'outline'}
          size="sm"
          onClick={switchToManual}
          className="gap-2"
        >
          <Keyboard size={14} /> Manual Entry
        </Button>
      </div>

      {/* Camera container — video element is created here via DOM */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden border border-[var(--border)]"
        style={{ display: cameraActive || cameraStarting ? 'block' : 'none', minHeight: 300 }}
      >
        {cameraStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <div className="text-center text-white">
              <Loader2 size={32} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Starting camera...</p>
              <p className="text-xs mt-1 opacity-70">Accept the permission prompt on your phone</p>
            </div>
          </div>
        )}
        {cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-56 h-56 border-2 border-white/60 rounded-2xl" />
          </div>
        )}
        {cameraActive && (
          <div className="absolute bottom-0 inset-x-0 p-2 text-center text-xs text-white/80 bg-black/40 z-10">
            Point camera at a QR code — scanning is automatic
          </div>
        )}
      </div>

      {/* Camera error */}
      {cameraError && (
        <Card className="border border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CameraOff size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{cameraError}</p>
                <Button size="sm" variant="outline" className="mt-2 text-red-700 border-red-300" onClick={startCamera}>
                  <RefreshCw size={12} className="mr-1" /> Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual input */}
      {mode === 'manual' && !cameraActive && (
        <Card className="border border-[var(--border)] shadow-sm">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  ref={inputRef}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  placeholder="Enter linen ID (e.g. LL-7K4P92)"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 text-lg font-mono border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors"
                />
              </div>
              <Button onClick={handleLookup} disabled={!code.trim() || isFetching} className="px-6">
                {isFetching ? <Loader2 size={16} className="animate-spin" /> : 'Lookup'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not found */}
      {!linen && lastScanned && !isFetching && (
        <Card className="border border-[var(--border)] shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No linen found with ID: <span className="font-mono font-semibold">{lastScanned}</span></p>
            <div className="mt-3 flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => { setLastScanned(null); inputRef.current?.focus() }}>
                Clear & Try Again
              </Button>
              <Link to="/linen/tags"><Button variant="outline" size="sm">Generate Tags</Button></Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan result */}
      {linen && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)]" style={{ backgroundColor: stCfg?.bg }}>
            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: stCfg?.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold" style={{ color: stCfg?.color }}>{stCfg?.label}</p>
                {lastAction && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/70 border" style={{ color: lastAction.color, borderColor: lastAction.color + '40' }}>
                    <CheckCircle size={10} /> {lastAction.label} applied
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate">{linen.linen_id} · {linen.item_type} · {linen.client_name}</p>
            </div>
            {scanMutation.isPending ? (
              <Loader2 size={18} className="animate-spin text-[var(--text-muted)] flex-shrink-0" />
            ) : lastAction ? (
              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
            ) : null}
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <Card className="flex-1 border border-[var(--border)] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Item Info</h2>
                  {isFetching && <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Category', linen.category],
                    ['Type', linen.item_type],
                    ['Client', linen.client_name],
                    ['Size', linen.size || '—'],
                    ['Color', linen.color || '—'],
                    ['Condition', linen.condition],
                    ['Washes', String(linen.wash_count)],
                    ['Location', linen.location || '—'],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase">{l}</p>
                      <p className="font-semibold text-[var(--text-primary)]">{v}</p>
                    </div>
                  ))}
                </div>
                <Link to={`/linen/${linen.id}`} className="inline-block mt-4 text-xs text-[#DC2626] hover:underline font-semibold">
                  View Full Profile →
                </Link>
              </CardContent>
            </Card>

            <Card className="lg:w-72 border border-[var(--border)] shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Quick Actions</h2>
                <div className="space-y-1.5">
                  {SCAN_ACTIONS.map(sa => (
                    <Button
                      key={sa.value}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs h-8 focus:ring-2 focus:ring-[#DC2626]/20"
                      style={{ borderColor: sa.color + '30', color: sa.color }}
                      onClick={() => handleQuickAction(sa.value)}
                      disabled={scanMutation.isPending}
                    >
                      {scanMutation.isPending ? <Loader2 size={12} className="animate-spin mr-2" /> : null}
                      {sa.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
