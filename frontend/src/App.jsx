import React from 'react';
import { AuthProvider } from './app/AuthContext.jsx';
import { AuthModal } from './app/AuthModal.jsx';
import { AppRouter } from './app/Router.jsx';

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <AuthModal />
    </AuthProvider>
  );
}

export default App;
