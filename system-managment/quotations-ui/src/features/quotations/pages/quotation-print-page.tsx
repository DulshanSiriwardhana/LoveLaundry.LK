import { useParams } from 'react-router-dom'
import { useQuotation } from '../hooks/useQuotations'
import { QuotationPrintTemplate } from '../components/quotation-print-template'
import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { PageLoader } from '../../../components/ui/loader'

export default function QuotationPrintPage() {
  const { id } = useParams()
  const { data: q, isLoading, isError } = useQuotation(id)

  useEffect(() => {
    if (!isLoading && !isError && q) {
      const timer = setTimeout(() => {
        window.print()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isLoading, isError, q])

  if (isLoading) {
    return (
      <div className="quotation-print-page">
        <PageLoader text="Loading quotation..." subtext="Preparing print layout" />
      </div>
    )
  }

  if (isError || !q) {
    return (
      <div className="quotation-print-page" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        fontFamily: '"Spectral", Georgia, serif',
        padding: '20px',
      }}>
        <img
          src="/icon.png"
          alt="Love Laundry Logo"
          style={{
            width: '80px',
            height: '80px',
            objectFit: 'contain',
            marginBottom: '20px',
            opacity: 0.5,
          }}
        />
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--danger-deep)',
          margin: '0 0 10px 0',
          textAlign: 'center',
        }}>Quotation Not Found</h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: '400px',
        }}>This quotation may have been deleted or the link is invalid.</p>
        <button
          onClick={() => window.close()}
          style={{
            marginTop: '24px',
            padding: '10px 20px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '0',
            cursor: 'pointer',
            fontFamily: '"Spectral", Georgia, serif',
            fontSize: '14px',
          }}
        >
          Close Window
        </button>
      </div>
    )
  }

  return (
    <div className="quotation-print-page" style={{
      minHeight: '100vh',
      background: 'var(--surface-2)',
      padding: '40px 20px',
      fontFamily: '"Spectral", Georgia, serif',
    }}>
      {/* Print button - TOP CENTER, above A4 pages */}
      <div className="no-print" style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
      }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#000',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '"Spectral", Georgia, serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--danger-deep)'}
          onMouseOut={(e) => e.currentTarget.style.background = '#000'}
        >
          <Printer size={18} /> Print / Save as PDF
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', minHeight: 'calc(100vh - 40px)', paddingTop: '60px' }}>
        <QuotationPrintTemplate quotation={q} />
      </div>
    </div>
  )
}