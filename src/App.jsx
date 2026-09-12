import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateRoom from './pages/CreateRoom'
import JoinRoom from './pages/JoinRoom'
import DrawingRoom from './pages/DrawingRoom'
import { ToastProvider } from './components/UI/Toast'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/join/:code" element={<JoinRoom />} />
        <Route path="/room/:code" element={<DrawingRoom />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </ToastProvider>
  )
}
