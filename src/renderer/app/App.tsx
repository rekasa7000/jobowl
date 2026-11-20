import { MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { Rail } from '../components/Rail';
import { useSettings } from '../lib/ipc';
import { useApplyTheme } from '../lib/theme';
import { WorkspaceProvider } from '../lib/workspace';
import { ApplicationDetail } from '../screens/applications/ApplicationDetail';
import { ApplicationsScreen } from '../screens/applications/ApplicationsScreen';
import { EmptyDetail } from '../screens/applications/EmptyDetail';
import { NewApplication } from '../screens/applications/NewApplication';
import { FeedScreen } from '../screens/feed/FeedScreen';
import { EmptyFeedDetail, FeedDetail } from '../screens/feed/FeedDetail';
import { SearchesScreen } from '../screens/searches/SearchesScreen';
import { SourcesScreen } from '../screens/sources/SourcesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
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
    <WorkspaceProvider>
      <MemoryRouter initialEntries={['/feed']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="feed" element={<FeedScreen />}>
              <Route index element={<EmptyFeedDetail />} />
              <Route path=":id" element={<FeedDetail />} />
            </Route>
            <Route path="searches" element={<SearchesScreen />} />
            <Route path="sources" element={<SourcesScreen />} />
            <Route path="applications" element={<ApplicationsScreen />}>
              <Route index element={<EmptyDetail />} />
              <Route path="new" element={<NewApplication />} />
              <Route path=":id" element={<ApplicationDetail />} />
            </Route>
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/feed" replace />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </WorkspaceProvider>
  );
}
