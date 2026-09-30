import { Link } from 'react-router-dom'
import { BedDouble, Shirt, ArrowUpRight } from 'lucide-react'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Card, CardContent } from '../../../components/ui/card'

const TEMPLATES = [
  {
    to: '/linen/gate-pass/linen',
    title: 'Camelot Linen Receipt',
    description: 'Linen laundry gatepass — bedsheets, towels, curtains, banquet cloth and more with color columns.',
    icon: BedDouble,
    accent: '#2563EB',
  },
  {
    to: '/linen/gate-pass/uniform',
    title: 'Camelot Uniform Receipt',
    description: 'Uniform laundry gatepass — department-wise uniforms, kitchen and apron sections with signature area.',
    icon: Shirt,
    accent: '#DC2626',
  },
]

export default function GatePassHub() {
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Linen', href: '/linen' }, { label: 'Gate Pass' }]} />

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
          Gate Pass — Camelot
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Kimberley Hotels & Resorts · printable receipt templates</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        {TEMPLATES.map(t => (
          <Link key={t.to} to={t.to} className="group block">
            <Card className="h-full border border-[var(--border)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl border"
                    style={{ color: t.accent, backgroundColor: t.accent + '0D', borderColor: t.accent + '30' }}
                  >
                    <t.icon size={22} />
                  </div>
                  <ArrowUpRight size={18} className="text-[var(--text-muted)] group-hover:text-[#DC2626] transition-colors" />
                </div>
                <h2 className="mt-4 text-base font-bold text-[var(--text-primary)]">{t.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)] leading-relaxed">{t.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}