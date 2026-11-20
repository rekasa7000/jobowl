import { MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { Rail } from '../components/Rail';
import { useSettings } from '../lib/ipc';
import { useApplyTheme } from '../lib/theme';
import { ApplicationDetail } from '../screens/applications/ApplicationDetail';
import { ApplicationsScreen } from '../screens/applications/ApplicationsScreen';
import { EmptyDetail } from '../screens/applications/EmptyDetail';
import { NewApplication } from '../screens/applications/NewApplication';
import { SettingsScreen } from '../screens/settings/SettingsScreen';

function Shell() {
  const settings = useSettings();
  useApplyTheme(settings.data?.theme);

  return (
    <div className="flex h-full">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}

export function App() {
  return (
    <MemoryRouter initialEntries={['/applications']}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="applications" element={<ApplicationsScreen />}>
            <Route index element={<EmptyDetail />} />
            <Route path="new" element={<NewApplication />} />
            <Route path=":id" element={<ApplicationDetail />} />
          </Route>
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/applications" replace />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
