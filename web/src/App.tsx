import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { LoginPage } from '@/auth/LoginPage';
import { RequireStaff } from '@/auth/RequireStaff';
import { RepositoriesProvider } from '@/data/RepositoriesProvider';
import type { Repositories } from '@/data/repositories';
import { LandingPage } from '@/features/landing/LandingPage';
import { FeedbackProvider, Spinner } from '@/ui';

// El panel se carga bajo demanda: quien solo visita la landing no descarga
// el código del backoffice.
const AdminLayout = lazy(() => import('@/features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const DashboardPage = lazy(() => import('@/features/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LevelsPage = lazy(() => import('@/features/admin/content/LevelsPage').then((m) => ({ default: m.LevelsPage })));
const LevelEditorPage = lazy(() => import('@/features/admin/content/LevelEditorPage').then((m) => ({ default: m.LevelEditorPage })));
const DictionaryPage = lazy(() => import('@/features/admin/content/DictionaryPages').then((m) => ({ default: m.DictionaryPage })));
const VocabularyPage = lazy(() => import('@/features/admin/content/DictionaryPages').then((m) => ({ default: m.VocabularyPage })));
const MediaPage = lazy(() => import('@/features/admin/media/MediaPage').then((m) => ({ default: m.MediaPage })));
const RemoteConfigPage = lazy(() => import('@/features/admin/config/RemoteConfigPage').then((m) => ({ default: m.RemoteConfigPage })));
const FeatureFlagsPage = lazy(() => import('@/features/admin/config/FeatureFlagsPage').then((m) => ({ default: m.FeatureFlagsPage })));
const AuditPage = lazy(() => import('@/features/admin/config/AuditPage').then((m) => ({ default: m.AuditPage })));
const UsersPage = lazy(() => import('@/features/admin/users/UsersPage').then((m) => ({ default: m.UsersPage })));

const fallback = (
  <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
    <Spinner label="Cargando…" />
  </div>
);

export function AppRoutes() {
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireStaff>
              <AdminLayout />
            </RequireStaff>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="levels" element={<LevelsPage />} />
          <Route path="levels/new" element={<LevelEditorPage />} />
          <Route path="levels/:id" element={<LevelEditorPage />} />
          <Route path="dictionary" element={<DictionaryPage />} />
          <Route path="vocabulary" element={<VocabularyPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="config" element={<RequireStaff admin><RemoteConfigPage /></RequireStaff>} />
          <Route path="flags" element={<RequireStaff admin><FeatureFlagsPage /></RequireStaff>} />
          <Route path="audit" element={<RequireStaff admin><AuditPage /></RequireStaff>} />
          <Route path="users" element={<RequireStaff admin><UsersPage /></RequireStaff>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function App({ repositories }: { repositories?: Repositories }) {
  return (
    <RepositoriesProvider repositories={repositories}>
      <FeedbackProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </FeedbackProvider>
    </RepositoriesProvider>
  );
}
