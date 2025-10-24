/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc queue' command
import type { CommandModule, Argv } from 'yargs';
import { listCommand } from './queue/list.js';

export const queueCommand: CommandModule = {
  command: 'queue',
  describe: 'Manage AIHC queues',
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
