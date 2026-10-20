import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./lib/auth";
import { SettingsProvider } from "./lib/settings";
import { YouTubeProvider } from "./lib/youtube-context";
import { UploadsProvider } from "./lib/uploads";
import { Spinner, ToastProvider } from "./components/ui";
import { firebaseConfigured } from "./config";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/Upload";
import Queue from "./pages/Queue";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import Guide from "./pages/Guide";
import Privacy from "./pages/Privacy";

function FullScreenSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="size-7" />
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return (
    <SettingsProvider>
      <YouTubeProvider>
        <UploadsProvider>
          <Outlet />
        </UploadsProvider>
      </YouTubeProvider>
    </SettingsProvider>
  );
}

function NotConfigured() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-bold">Firebase is not configured</h1>
        <p className="mt-2 text-muted">
          Put your Firebase web config in <code>src/config.ts</code> and rebuild.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!firebaseConfigured) return <NotConfigured />;
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/upload/video" element={<UploadPage key="video" kind="video" />} />
                <Route path="/upload/short" element={<UploadPage key="short" kind="short" />} />
                <Route path="/queue" element={<Queue />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/guide" element={<Guide />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
