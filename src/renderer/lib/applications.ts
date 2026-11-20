import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApplicationDetail,
  ApplicationPatch,
  CreateApplication,
  LegacyImportResult,
  ListFilter,
} from '@shared/schemas/application';
import { call } from './ipc';

const keys = {
  all: ['applications'] as const,
  list: (filter: ListFilter) => ['applications', 'list', filter] as const,
  one: (id: string) => ['applications', 'one', id] as const,
};

export function useApplicationList(filter: ListFilter) {
  return useQuery({
    queryKey: keys.list(filter),
    queryFn: () => call('applications:list', filter),
    placeholderData: keepPreviousData,
  });
}

export function useApplication(id: string) {
  return useQuery({ queryKey: keys.one(id), queryFn: () => call('applications:get', id) });
}

export function useCreateApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApplication) => call('applications:create', input),
    onSuccess: (detail: ApplicationDetail) => {
      client.setQueryData(keys.one(detail.application.id), detail);
      return client.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useUpdateApplication(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: ApplicationPatch) => call('applications:update', { id, patch }),
    onSuccess: (detail: ApplicationDetail) => {
      client.setQueryData(keys.one(id), detail);
      return client.invalidateQueries({ queryKey: ['applications', 'list'] });
    },
  });
}

export function useDeleteApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call('applications:delete', id),
    onSuccess: (_result, id) => {
      client.removeQueries({ queryKey: keys.one(id) });
      return client.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useLegacyDetect() {
  return useQuery({ queryKey: ['legacy', 'detect'], queryFn: () => call('legacy:detect') });
}

export function useLegacyImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (includeSamples: boolean): Promise<LegacyImportResult> =>
      call('legacy:import', { includeSamples }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.all }),
        client.invalidateQueries({ queryKey: ['legacy'] }),
      ]),
  });
}

/** Turns a rejected IPC call into a sentence for the user. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something unexpected happened.';
  // Electron prefixes remote errors with "Error invoking remote method '…': Error: ".
  const message = error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  // Validation failures arrive as a JSON list of issues; show their messages.
  try {
    const issues: unknown = JSON.parse(message);
    if (Array.isArray(issues)) {
      const texts = issues.flatMap((issue: unknown) =>
        typeof issue === 'object' && issue !== null && 'message' in issue
          ? [String(issue.message)]
          : [],
      );
      if (texts.length > 0) return texts.join(' ');
    }
  } catch {
    // Not JSON: use the message as is.
  }
  return message;
}

/** Today in the user's own time zone, formatted for a date input. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
