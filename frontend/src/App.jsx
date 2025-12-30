import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DateProvider } from './context/DateContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Imports from './pages/Imports';
import SousTraitants from './pages/SousTraitants';
import Chauffeurs from './pages/Chauffeurs';
import Tournees from './pages/Tournees';

function App() {
  return (
    <AuthProvider>
      <DateProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route
                path="imports"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Imports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sous-traitants"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <SousTraitants />
                  </ProtectedRoute>
                }
              />
              <Route
                path="chauffeurs"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Chauffeurs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tournees"
                element={
                  <ProtectedRoute roles={['admin', 'sous_traitant']}>
                    <Tournees />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DateProvider>
    </AuthProvider>
  );
}

export default App;