/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc' command
import type { CommandModule, Argv } from 'yargs';
import { datasetCommand } from './aihc/dataset.js';
import { modelCommand } from './aihc/model.js';

export const aihcCommand: CommandModule = {
  command: 'aihc',
  describe: 'AIHC (AI High Computing) platform commands',
  builder: (yargs: Argv) =>
    yargs
      .command(datasetCommand)
      .command(modelCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
    // thanks to demandCommand(1) in the builder.
  },
};

