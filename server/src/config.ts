import { resolve } from 'node:path';
import { homedir } from 'node:os';

export const PORT = 8765;
export const HOST = '0.0.0.0';
export const COMMAND_TIMEOUT_MS = 30_000;
export const FOUNDRY_DATA_DIR = resolve(homedir(), 'foundry-dev-data', 'Data');
