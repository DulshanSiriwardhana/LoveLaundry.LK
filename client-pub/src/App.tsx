import { useEffect, useState, type ComponentType } from 'react'
import './App.css'
import ActionBar from './components/actionbar/ActionBar'
import { actions } from './constants/actions'
import { useRoute } from './hooks/useRoute'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import WorkPage from './pages/WorkPage'
import JoinPage from './pages/JoinPage'

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
    <div className='min-h-screen w-full bg-zinc-50 text-zinc-900'>
      <header className='border-b border-green-600 bg-white px-5 py-4'>
        <p className='text-lg font-bold text-green-700'>Love Laundry</p>
        <p className='text-xs text-zinc-500'>Fresh clothes, more free time</p>
      </header>
      <main className='mx-auto max-w-3xl px-5 pb-40 pt-8 text-sm leading-relaxed'>
        <Page />
      </main>
      <ActionBar items={actions} selectedItem={selectedItem} setSelectedItem={setSelectedItem} />
    </div>
  )
}

export default App
