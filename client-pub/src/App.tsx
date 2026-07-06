import './App.css'
import ActionBar from './components/actionbar/ActionBar'
import HomePage from './pages/HomePage'

function App() {

  return (
    <div className='w-full h-screen flex items-center justify-center text-black font-bold text-6xl'>
      <HomePage/>
      <ActionBar/>
    </div>
  )
}

export default App
