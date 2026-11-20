import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JobFilter, SearchFields, SourceType } from '@shared/schemas/discovery';
import type { Profile } from '@shared/schemas/profile';
import type { SourceConfig } from '@shared/schemas/discovery';
import { call } from './ipc';

export function useSearches() {
  return useQuery({ queryKey: ['searches'], queryFn: () => call('searches:list') });
}

export function useSaveSearch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string | null; fields: SearchFields }) =>
      input.id === null
        ? call('searches:create', input.fields)
        : call('searches:update', { id: input.id, patch: input.fields }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['searches'] }),
  });
}

export function useDeleteSearch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call('searches:delete', id),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['searches'] }),
        client.invalidateQueries({ queryKey: ['jobs'] }),
      ]),
  });
}

export function useSources() {
  return useQuery({ queryKey: ['sources'], queryFn: () => call('sources:list') });
}

export function useDetectSource() {
  return useMutation({ mutationFn: (url: string) => call('sources:detect', { url }) });
}

export function useAddSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: SourceType; config: SourceConfig; label?: string }) =>
      call('sources:add', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['sources'] }),
  });
}

export function useUpdateSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: { enabled?: boolean; label?: string } }) =>
      call('sources:update', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['sources'] }),
  });
}

export function useDeleteSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call('sources:delete', id),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['sources'] }),
        client.invalidateQueries({ queryKey: ['jobs'] }),
      ]),
  });
}

export function useRunStatus() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ['runs', 'status'],
    queryFn: () => call('runs:status'),
    // Fast while a run is going so progress is visible, otherwise only now and then.
    refetchInterval: (query) => (query.state.data?.running ? 1000 : 15_000),
  });

  // A finished run (including one that started on its own) changes the jobs and each source's status.
  const finished = status.data?.last?.finishedAt ?? null;
  useEffect(() => {
    void client.invalidateQueries({ queryKey: ['jobs'] });
    void client.invalidateQueries({ queryKey: ['sources'] });
  }, [finished, client]);

  return status;
}

export function useStartRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => call('runs:start'),
    onSuccess: (status) => client.setQueryData(['runs', 'status'], status),
  });
}

export function useJobs(filter: JobFilter, running: boolean) {
  return useQuery({
    queryKey: ['jobs', 'list', filter],
    queryFn: () => call('jobs:list', filter),
    placeholderData: keepPreviousData,
    refetchInterval: running ? 2000 : false,
  });
}

export function useJob(id: string) {
  return useQuery({ queryKey: ['jobs', 'one', id], queryFn: () => call('jobs:get', id) });
}

export function useSetJobState() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      state: 'new' | 'shortlisted' | 'dismissed';
      reason?: string;
    }) => call('jobs:set-state', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useAdzunaKey() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ['integrations'],
    queryFn: () => call('integrations:status'),
  });
  const set = useMutation({
    mutationFn: (key: string) => call('integrations:set-adzuna-key', { key }),
    onSuccess: (next) => client.setQueryData(['integrations'], next),
  });
  const clear = useMutation({
    mutationFn: () => call('integrations:clear-adzuna-key'),
    onSuccess: (next) => client.setQueryData(['integrations'], next),
  });
  return { status, set, clear };
}

/** A lookup from profile item id to the words a person would recognise it by. */
export function evidenceLabels(profile: Profile | null | undefined): Map<string, string> {
  const labels = new Map<string, string>();
  if (!profile) return labels;
  if (profile.summary) labels.set(profile.summary.id, profile.summary.text);
  for (const job of profile.experiences) {
    labels.set(job.id, `${job.title} at ${job.employer}`);
    for (const bullet of job.bullets) labels.set(bullet.id, bullet.text);
  }
  for (const project of profile.projects) {
    labels.set(project.id, project.name);
    for (const bullet of project.bullets) labels.set(bullet.id, bullet.text);
  }
  for (const item of profile.education)
    labels.set(item.id, [item.degree, item.school].filter(Boolean).join(', '));
  for (const item of profile.certifications) labels.set(item.id, item.name);
  for (const skill of profile.skills) labels.set(skill.id, skill.name);
  return labels;
}
