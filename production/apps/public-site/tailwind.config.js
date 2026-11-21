/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--color-brand)',
          50: 'var(--color-brand-soft)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          500: 'var(--color-brand)',
          600: 'var(--color-brand)',
          700: 'var(--color-brand-dark)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
          border: 'var(--color-line)',
        },
      },
      fontSize: {
        'nav': ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
        'section': ['1.375rem', { lineHeight: '1.25', fontWeight: '600', letterSpacing: '-0.015em' }],
        'dashboard': ['2rem', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.02em' }],
        'card-title': ['1.0625rem', { lineHeight: '1.35', fontWeight: '600', letterSpacing: '-0.01em' }],
        'body-lg': ['0.9375rem', { lineHeight: '1.5' }],
        'body': ['0.875rem', { lineHeight: '1.5' }],
        'label': ['0.8125rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      boxShadow: {
        card: '0 1px 3px rgba(var(--shadow-rgb), 0.06), 0 1px 2px rgba(var(--shadow-rgb), 0.04)',
        'card-hover': '0 4px 12px rgba(var(--shadow-rgb), 0.08), 0 2px 4px rgba(var(--shadow-rgb), 0.04)',
        nav: '0 1px 2px rgba(var(--shadow-rgb), 0.05)',
      },
      borderRadius: {
        DEFAULT: '12px',
        lg: '14px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}