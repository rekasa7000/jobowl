import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IpcChannel, IpcInput, IpcOutput } from '@shared/ipc-contract';
import { ipcContract } from '@shared/ipc-contract';
import type { Settings, SettingsPatch } from '@shared/schemas/settings';

/** Calls main and re-validates the answer, so a contract mismatch fails loudly here. */
export async function call<C extends IpcChannel>(
  channel: C,
  input?: IpcInput<C>,
): Promise<IpcOutput<C>> {
  const raw = await window.jobowl.invoke(channel, input);
  return ipcContract[channel].output.parse(raw) as IpcOutput<C>;
}

export function useAppInfo() {
  return useQuery({ queryKey: ['app:info'], queryFn: () => call('app:info') });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => call('settings:get') });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => call('settings:update', patch),
    onSuccess: (settings: Settings) => {
      client.setQueryData(['settings'], settings);
      // Which providers are ready depends on settings such as the server address.
      return client.invalidateQueries({ queryKey: ['ai', 'status'] });
    },
  });
}
