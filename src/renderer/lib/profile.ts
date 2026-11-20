import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImportDraft } from '@shared/schemas/profile';
import { z } from 'zod';
import { saveProfileSchema } from '@shared/schemas/profile';
import { call } from './ipc';

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: () => call('profile:get') });
}

export function useProfileVersions() {
  return useQuery({ queryKey: ['profile', 'versions'], queryFn: () => call('profile:versions') });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: z.input<typeof saveProfileSchema>) => call('profile:save', input),
    onSuccess: (saved) => {
      client.setQueryData(['profile'], saved);
      return client.invalidateQueries({ queryKey: ['profile', 'versions'] });
    },
  });
}

/** Opens the native file dialog in main. Resolves to null if the user cancels. */
export function useImportFile() {
  return useMutation<ImportDraft | null>({ mutationFn: () => call('resume:import-file') });
}

export function useImportText() {
  return useMutation({ mutationFn: (text: string) => call('resume:import-text', { text }) });
}
