

const loadingStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.05); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  subtext?: string
  fullScreen?: boolean
  className?: string
}

export function Loader({
  size = 'md',
  text = 'Loading...',
  subtext,
  fullScreen = false,
  className = '',
}: LoaderProps) {
  const sizes = {
    sm: { logo: 40, text: 12, gap: 8 },
    md: { logo: 60, text: 14, gap: 12 },
    lg: { logo: 100, text: 16, gap: 16 },
  }
  const s = sizes[size]

  return (
    <div
      className={`loader-wrapper ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: fullScreen ? 'center' : 'flex-start',
        gap: `${s.gap}px`,
        minHeight: fullScreen ? '100vh' : 'auto',
        padding: fullScreen ? '0' : '20px',
        background: fullScreen ? 'var(--bg)' : 'transparent',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: loadingStyles }} />
      <img
        src="/icon.png"
        alt="Love Laundry"
        style={{
          width: `${s.logo}px`,
          height: `${s.logo}px`,
          objectFit: 'contain',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />
      {text && (
        <p style={{
          margin: 0,
          fontSize: `${s.text}px`,
          color: 'var(--text-primary)',
          fontWeight: 600,
          animation: 'fadeInUp 0.5s ease-out',
        }}>{text}</p>
      )}
      {subtext && (
        <p style={{
          margin: 0,
          fontSize: `${s.text - 2}px`,
          color: 'var(--text-muted)',
          animation: 'fadeInUp 0.5s ease-out 0.1s both',
        }}>{subtext}</p>
      )}
    </div>
  )
}

export function SkeletonLoader({ count = 5, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <style dangerouslySetInnerHTML={{ __html: loadingStyles }} />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: '20px',
          background: 'linear-gradient(90deg, var(--skeleton-from) 25%, var(--skeleton-via) 50%, var(--skeleton-to) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: 'var(--radius-sm)',
        }} />
      ))}
    </div>
  )
}

export function PageLoader({ text = 'Loading page...', subtext }: { text?: string; subtext?: string }) {
  return <Loader size="lg" text={text} subtext={subtext} fullScreen />
}

export function DataLoader({ text = 'Loading data...' }: { text?: string }) {
  return <Loader size="md" text={text} fullScreen />
}

export function ButtonLoader({ text = 'Processing...' }: { text?: string }) {
  return <Loader size="sm" text={text} />
}