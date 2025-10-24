/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc pool' command
import type { CommandModule, Argv } from 'yargs';
import { listCommand } from './pool/list.js';

export const poolCommand: CommandModule = {
  command: 'pool',
  describe: 'Manage AIHC resource pools',
  builder: (yargs: Argv) =>
    yargs
      .command(listCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
    // thanks to demandCommand(1) in the builder.
  },
};
