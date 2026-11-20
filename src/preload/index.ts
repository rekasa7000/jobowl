import { contextBridge, ipcRenderer } from 'electron';
import { ipcContract, type JobowlApi } from '@shared/ipc-contract';

const api: JobowlApi = {
  invoke: (channel, input) => {
    if (!(channel in ipcContract)) return Promise.reject(new Error(`Unknown channel: ${channel}`));
    return ipcRenderer.invoke(channel, input) as never;
  },
};

contextBridge.exposeInMainWorld('jobowl', api);
