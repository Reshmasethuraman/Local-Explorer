import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'

// Keep the existing frontend code working in production by routing its
// localhost API requests to the deployed Render backend.
const productionApi = 'https://local-explorer-api.onrender.com'
const originalFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  if (typeof input === 'string' && input.startsWith('http://localhost:5000')) {
    input = productionApi + input.slice('http://localhost:5000'.length)
  } else if (input instanceof Request && input.url.startsWith('http://localhost:5000')) {
    input = new Request(productionApi + input.url.slice('http://localhost:5000'.length), input)
  }
  return originalFetch(input, init)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
