import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ipcContract, type IpcChannel, type IpcInput, type IpcOutput } from '@shared/ipc-contract';

type Handler<C extends IpcChannel> = (input: IpcInput<C>) => IpcOutput<C> | Promise<IpcOutput<C>>;

/**
 * Registers a typed handler. Rejects calls that don't come from the app's own top-level frame,
 * validates the input, and validates the output before it leaves main.
 */
export function handle<C extends IpcChannel>(
  channel: C,
  isTrusted: (event: IpcMainInvokeEvent) => boolean,
  handler: Handler<C>,
): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    if (!isTrusted(event)) throw new Error(`Rejected ${channel}: untrusted sender`);
    const contract = ipcContract[channel];
    const input = contract.input.parse(raw) as IpcInput<C>;
    const result = await handler(input);
    return contract.output.parse(result);
  });
}
