import './App.css'
import ActionBar from './components/actionbar/ActionBar'
import { actions } from './constants/actions'
import HomePage from './pages/HomePage'

function App() {

  return (
    <div className='w-full h-screen flex items-center justify-center text-black font-bold text-6xl'>
      <HomePage/>
      <ActionBar items={actions} selectedItem={actions[0]}/>
    </div>
  )
}

export default App
