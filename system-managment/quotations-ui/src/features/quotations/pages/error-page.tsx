import { useRouteError, isRouteErrorResponse, Link, useLocation } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home, Unplug } from 'lucide-react'

export default function ErrorPage() {
    const error = useRouteError()
    const location = useLocation()

    let status = 500
    let title = 'Unexpected Error'
    let description = 'An unexpected error occurred. Try reloading the page.'

    if (isRouteErrorResponse(error)) {
        status = error.status
        if (status === 404) {
            title = 'Page Not Found'
            description = "The page you're looking for doesn't exist or has been moved."
        } else if (status === 401) {
            title = 'Unauthorised'
            description = 'You need to sign in to access this page.'
        } else if (status === 403) {
            title = 'Forbidden'
            description = "You don't have permission to view this page."
        } else {
            description = error.statusText || description
        }
    } else if (error instanceof Error) {
        description = error.message
    }

    const icon = status === 404
        ? <Unplug className="h-7 w-7 text-[var(--brand-text)]" />
        : <AlertTriangle className="h-7 w-7 text-[var(--danger-deep)]" />

    const iconBg = status === 404
        ? 'bg-[var(--surface-2)] border-[var(--brand-border)]'
        : 'bg-[var(--surface-2)] border-[var(--danger-border)]'

    return (
        <div className="min-h-screen bg-[var(--surface-2)] flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl border border-[var(--border)] bg-white shadow-lg p-8 text-center">
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${iconBg}`}>
                    {icon}
                </div>

                <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-2">
                    Error {status}
                </p>
                <h1 className="text-[20px] font-bold text-[var(--text-primary)] mb-2">{title}</h1>
                <p className="text-[13px] text-[var(--text-secondary)] mb-6 leading-relaxed">{description}</p>

                {/* Which page blew up is the single most useful thing to know and
                    it was the one thing missing. Without it a report is just the
                    message, which is not enough to locate the failing render. */}
                <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Page</p>
                    <code className="block break-all text-[12px] text-[var(--brand-deep)]">{location.pathname}</code>
                </div>

                <div className="flex gap-3 justify-center">
                    <Link
                        to="/"
                        className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-2)] hover:border-[var(--border)] transition"
                    >
                        <Home className="h-4 w-4" />
                        Dashboard
                    </Link>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--text-primary)] transition cursor-pointer"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Reload
                    </button>
                </div>
            </div>
        </div>
    )
}
