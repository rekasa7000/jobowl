import { utilityProcess } from 'electron';
import { join } from 'node:path';
import { ResumeFileError } from './extract';

const TIMEOUT_MS = 30_000;

/** Extracts resume text in a throwaway utility process, so a hostile file can't reach main. */
export function extractInWorker(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(join(import.meta.dirname, 'workers', 'extract.js'), [], {
      serviceName: 'jobowl resume reader',
    });
    const done = (settle: () => void) => {
      clearTimeout(timer);
      child.kill();
      settle();
    };
    const timer = setTimeout(
      () =>
        done(() => reject(new ResumeFileError('Reading that file took too long and was stopped.'))),
      TIMEOUT_MS,
    );

    child.on(
      'message',
      (reply: { ok: boolean; text?: string; message?: string; expected?: boolean }) => {
        done(() => {
          if (reply.ok && reply.text !== undefined) resolve(reply.text);
          else if (reply.expected)
            reject(new ResumeFileError(reply.message ?? 'The file could not be read.'));
          else reject(new Error(reply.message ?? 'The file could not be read.'));
        });
      },
    );
    child.on('exit', (code) => {
      done(() =>
        reject(new Error(`The resume reader stopped unexpectedly (code ${String(code)}).`)),
      );
    });
    child.postMessage({ id: 1, bytes });
  });
}
