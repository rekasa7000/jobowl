import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { KeyProvider, LayerChoice, ProviderId } from '@shared/schemas/ai';
import { call } from './ipc';

export function useAiStatus() {
  return useQuery({ queryKey: ['ai', 'status'], queryFn: () => call('ai:status') });
}

export function useSpend() {
  return useQuery({ queryKey: ['ai', 'spend'], queryFn: () => call('ai:spend') });
}

export function useSetKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { provider: KeyProvider; key: string }) => call('ai:set-key', input),
    onSuccess: (status) => client.setQueryData(['ai', 'status'], status),
  });
}

export function useClearKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (provider: KeyProvider) => call('ai:clear-key', { provider }),
    onSuccess: (status) => client.setQueryData(['ai', 'status'], status),
  });
}

export function useLoadModels() {
  return useMutation({ mutationFn: (provider: ProviderId) => call('ai:models', { provider }) });
}

export function useTestModel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (choice: LayerChoice) => call('ai:test', choice),
    onSuccess: () => client.invalidateQueries({ queryKey: ['ai', 'spend'] }),
  });
}
