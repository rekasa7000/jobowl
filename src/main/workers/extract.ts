import { extractResumeText, ResumeFileError } from '../resume/extract';

/**
 * Runs inside an Electron utility process. Reading untrusted PDF and DOCX files happens here,
 * away from the main process, which holds the database and the API keys.
 */
interface Request {
  id: number;
  bytes: Uint8Array;
}

type Reply =
  | { id: number; ok: true; text: string }
  | { id: number; ok: false; message: string; expected: boolean };

const port = process.parentPort;

port.on('message', (event) => {
  const { id, bytes } = event.data as Request;
  extractResumeText(bytes).then(
    (text) => port.postMessage({ id, ok: true, text } satisfies Reply),
    (error: unknown) =>
      port.postMessage({
        id,
        ok: false,
        expected: error instanceof ResumeFileError,
        message: error instanceof Error ? error.message : 'The file could not be read.',
      } satisfies Reply),
  );
});
