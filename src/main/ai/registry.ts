import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import OpenAI from 'openai';
import { PROVIDER_LABELS, type KeyProvider, type ProviderId } from '@shared/schemas/ai';
import type { AiSettings } from '@shared/schemas/ai';
import type { SecretStore } from '../secrets/secret-store';
import { createAnthropicProvider } from './adapters/anthropic';
import { createOllamaProvider } from './adapters/ollama';
import { createOpenAiProvider } from './adapters/openai';
import { NotConfiguredError, type LlmProvider } from './provider';

export const SECRET_NAMES: Record<KeyProvider, string> = {
  anthropic: 'anthropic_api_key',
  openai: 'openai_api_key',
  openai_compatible: 'openai_compatible_api_key',
};

/** Builds a provider from the saved settings and keys. Keys are read here and nowhere else. */
export function createProviderFactory(
  getSettings: () => AiSettings,
  secrets: SecretStore,
): (id: ProviderId) => LlmProvider {
  return (id) => {
    const settings = getSettings();
    switch (id) {
      case 'anthropic': {
        const apiKey = secrets.get(SECRET_NAMES.anthropic);
        if (!apiKey) throw new NotConfiguredError('Add your Anthropic API key in Settings.');
        return createAnthropicProvider(new Anthropic({ apiKey }));
      }
      case 'openai': {
        const apiKey = secrets.get(SECRET_NAMES.openai);
        if (!apiKey) throw new NotConfiguredError('Add your OpenAI API key in Settings.');
        return createOpenAiProvider(new OpenAI({ apiKey }), 'openai');
      }
      case 'openai_compatible': {
        if (!settings.compatibleUrl) {
          throw new NotConfiguredError(
            `Enter the address of your ${PROVIDER_LABELS.openai_compatible} in Settings.`,
          );
        }
        // Many local servers need no key, but the client insists on a non-empty one.
        const apiKey = secrets.get(SECRET_NAMES.openai_compatible) ?? 'not-needed';
        return createOpenAiProvider(
          new OpenAI({ apiKey, baseURL: settings.compatibleUrl }),
          'openai_compatible',
        );
      }
      case 'ollama':
        return createOllamaProvider(new Ollama({ host: settings.ollamaUrl }));
    }
  };
}
