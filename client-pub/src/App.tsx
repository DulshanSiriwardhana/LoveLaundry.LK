import { useState } from 'react'
import './App.css'
import ActionBar from './components/actionbar/ActionBar'
import { actions } from './constants/actions'
import HomePage from './pages/HomePage'

function App() {
  const [selectedItem, setSelectedItem] = useState(actions[0])

  return (
    <div className='w-full h-screen flex items-center justify-center text-black font-bold text-6xl'>
      <HomePage/>
      <ActionBar items={actions} selectedItem={selectedItem} setSelectedItem={setSelectedItem}/>
    </div>
  )
}

export default App
