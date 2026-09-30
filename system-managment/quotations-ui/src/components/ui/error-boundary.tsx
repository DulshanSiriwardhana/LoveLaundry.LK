import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './button'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: { componentStack: string }) {
        console.error('[ErrorBoundary]', error, info.componentStack)
    }

    handleReload = () => {
        window.location.reload()
    }

    handleHome = () => {
        window.location.href = '/'
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
                <div className="w-full max-w-md rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] sm:p-7">
                    <div className="flex items-start gap-3.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--danger-border)] bg-[var(--danger-soft)]">
                            <AlertTriangle className="size-[18px] text-[var(--danger-text)]" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">
                                Something went wrong
                            </h1>
                            <p className="mt-1 text-[13px] leading-[1.55] text-[var(--text-muted)]">
                                This screen failed to load. Reloading usually clears it. If it keeps
                                happening, send the details below to your administrator.
                            </p>
                        </div>
                    </div>

                    {this.state.error?.message && (
                        <details className="mt-5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]">
                            <summary className="cursor-pointer select-none px-3 py-2 text-[12.5px] font-medium text-[var(--text-secondary)]">
                                Error details
                            </summary>
                            <pre className="max-h-40 overflow-auto border-t border-[var(--border)] px-3 py-2.5 text-[11.5px] leading-[1.5] whitespace-pre-wrap break-words text-[var(--text-muted)]">
                                {this.state.error.message}
                            </pre>
                        </details>
                    )}

                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={this.handleHome}>
                            <Home aria-hidden />
                            Dashboard
                        </Button>
                        <Button variant="primary" onClick={this.handleReload}>
                            <RefreshCw aria-hidden />
                            Reload page
                        </Button>
                    </div>
                </div>
            </div>
        )
    }
}
