import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { LoginPage } from './routes/login';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <div>
        SaaS — Phase 0 shell. Visit <a href="/login">/login</a>.
      </div>
    ),
  },
  { path: '/login', element: <LoginPage /> },
]);

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
