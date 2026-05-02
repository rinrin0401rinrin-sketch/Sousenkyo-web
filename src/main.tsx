import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import './styles/index.css';

const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
