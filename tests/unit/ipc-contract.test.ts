import { describe, expect, it } from 'vitest';
import { ipcContract } from '@shared/ipc-contract';

describe('ipc contract', () => {
  it('accepts a valid settings patch and an empty one', () => {
    expect(ipcContract['settings:update'].input.parse({ theme: 'light' })).toEqual({
      theme: 'light',
    });
    expect(ipcContract['settings:update'].input.parse({})).toEqual({});
  });

  it('does not fill defaults into a patch, so an empty patch changes nothing', () => {
    expect(ipcContract['settings:update'].input.parse({})).toEqual({});
  });

  it('rejects unknown setting names', () => {
    expect(() => ipcContract['settings:update'].input.parse({ language: 'fr' })).toThrow();
  });

  it('fills defaults when reading stored settings', () => {
    expect(ipcContract['settings:get'].output.parse({})).toEqual({ theme: 'dark' });
  });

  it('rejects an unknown theme', () => {
    expect(() => ipcContract['settings:update'].input.parse({ theme: 'neon' })).toThrow();
  });

  it('rejects input on channels that take none', () => {
    expect(() => ipcContract['app:info'].input.parse({ path: 'C:\\secret' })).toThrow();
  });

  it('rejects app info with the wrong name', () => {
    const base = { version: '1', platform: 'win32', dataDir: 'x', schemaVersion: 1 };
    expect(() => ipcContract['app:info'].output.parse({ ...base, name: 'other' })).toThrow();
  });
});
