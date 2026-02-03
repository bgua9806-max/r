
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css'; // Import CSS để Vite tự động xử lý và cache

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
