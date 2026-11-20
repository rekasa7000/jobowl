import type { JobowlApi } from '@shared/ipc-contract';

declare global {
  interface Window {
    jobowl: JobowlApi;
  }
}
