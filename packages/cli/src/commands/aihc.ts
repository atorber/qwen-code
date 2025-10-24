/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc' command
import type { CommandModule, Argv } from 'yargs';
import { datasetCommand } from './aihc/dataset.js';
import { modelCommand } from './aihc/model.js';
import { devCommand } from './aihc/dev.js';
import { serviceCommand } from './aihc/service.js';
import { poolCommand } from './aihc/pool.js';
import { jobCommand } from './aihc/job.js';
import { queueCommand } from './aihc/queue.js';

export const aihcCommand: CommandModule = {
  command: 'aihc',
  describe: 'AIHC (AI High Computing) platform commands',
  builder: (yargs: Argv) =>
    yargs
      .command(datasetCommand)
      .command(modelCommand)
      .command(devCommand)
      .command(serviceCommand)
      .command(poolCommand)
      .command(jobCommand)
      .command(queueCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
    // thanks to demandCommand(1) in the builder.
  },
};

