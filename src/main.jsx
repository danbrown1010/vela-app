import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// One-time migration: old 'dark'/'light' values → new theme names
const _migrateTheme = localStorage.getItem('vela-theme')
if (_migrateTheme === 'dark')  localStorage.setItem('vela-theme', 'evergreen')
if (_migrateTheme === 'light') localStorage.setItem('vela-theme', 'parchment')

// Apply persisted theme before first render; write default so it's
// always set after first visit (prevents blank localStorage on reload)
const savedTheme = localStorage.getItem('vela-theme') || 'evergreen'
if (!localStorage.getItem('vela-theme')) localStorage.setItem('vela-theme', 'evergreen')
document.documentElement.classList.add(savedTheme)

// --color-accent is the Tailwind v4 @theme variable; overriding it on
// the root element cascades to any utility that reads var(--color-accent)
const savedAccent = localStorage.getItem('vela-accent') || '#f97316'
if (!localStorage.getItem('vela-accent')) localStorage.setItem('vela-accent', '#f97316')
document.documentElement.style.setProperty('--color-accent', savedAccent)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
