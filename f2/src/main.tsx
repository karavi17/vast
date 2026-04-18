import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { LanguageProvider } from './context/LanguageContext'
import { UIProvider } from './context/UIContext'
import { ToastProvider } from './context/ToastContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <UIProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </UIProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
