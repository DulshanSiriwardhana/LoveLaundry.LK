import { useEffect, useState, type ComponentType } from 'react'
import './App.css'
import ActionBar from './components/actionbar/ActionBar'
import { actions } from './constants/actions'
import { useRoute } from './hooks/useRoute'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import WorkPage from './pages/WorkPage'
import JoinPage from './pages/JoinPage'
import { ThemeSwitcher } from './ll-theme'

const pages: Record<string, ComponentType> = {
  '/': HomePage,
  '/about': AboutPage,
  '/work': WorkPage,
  '/join': JoinPage,
}

function App() {
  const path = useRoute()
  const Page = pages[path] ?? HomePage
  const [selectedItem, setSelectedItem] = useState(actions[0])

  useEffect(() => {
    setSelectedItem(actions.find((action) => action.path === path) ?? actions[0])
  }, [path])

  return (
    <div className='min-h-screen w-full bg-[var(--bg)] text-[var(--text-primary)]'>
      <header className='flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4'>
        <div>
          <p className='text-lg font-bold text-[var(--brand-text)]'>Love Laundry</p>
          <p className='text-xs text-[var(--text-muted)]'>Fresh clothes, more free time</p>
        </div>
        <ThemeSwitcher compact />
      </header>
      <main className='mx-auto max-w-3xl px-5 pb-40 pt-8 text-sm leading-relaxed'>
        <Page />
      </main>
      <ActionBar items={actions} selectedItem={selectedItem} setSelectedItem={setSelectedItem} />
    </div>
  )
}

export default App
