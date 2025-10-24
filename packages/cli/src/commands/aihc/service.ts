/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc service' command
import type { CommandModule, Argv } from 'yargs';
import { listCommand } from './service/list.js';

export const serviceCommand: CommandModule = {
  command: 'service',
  describe: 'Manage AIHC services',
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

