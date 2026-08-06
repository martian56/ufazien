import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = document.getElementById('root')
if (!root) throw new Error('No #root element to mount into')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
