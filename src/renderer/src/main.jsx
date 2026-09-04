import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { applyUiTheme, readStoredUiTheme } from './Brand.jsx'
import './styles.css'

if (window.pdc?.platform) document.documentElement.dataset.platform = window.pdc.platform
applyUiTheme(readStoredUiTheme())

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
