/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SlashCommand,
  SlashCommandActionReturn,
  CommandContext,
  CommandKind,
} from './types.js';
import { bceSdk } from '@qwen-code/qwen-code-core';

const COLOR_CYAN = '\u001b[36m';
const RESET_COLOR = '\u001b[0m';

const getDatasetList = async (
  context: CommandContext,
  pageNumber: number = 1,
  pageSize: number = 10,
  orderBy: string = 'createdAt',
  order: 'ASC' | 'DESC' = 'DESC',
  keyword?: string,
  storageType?: string,
  storageInstances?: string,
  importFormat?: string,
): Promise<SlashCommandActionReturn> => {
  try {
    // Check environment variables
    const ak = process.env['AIHC_AK'];
    const sk = process.env['AIHC_SK'];
    const endpoint = process.env['AIHC_ENDPOINT'] || 'https://aihc.bj.baidubce.com';

    if (!ak || !sk) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Error: AIHC_AK and AIHC_SK environment variables are required\n   Please set them using: export AIHC_AK=your_ak && export AIHC_SK=your_sk`,
      };
    }

    context.ui.addItem(
      {
        type: 'info',
        text: `🔍 Fetching AIHC datasets... (Page ${pageNumber}, Size ${pageSize})`,
      },
      Date.now(),
    );

    // Prepare request parameters
    const params: Record<string, string> = {
      action: 'DescribeDatasets',
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    };

    // Add optional parameters
    if (keyword) params['keyword'] = keyword;
    if (storageType) params['storageType'] = storageType;
    if (storageInstances) params['storageInstances'] = storageInstances;
    if (importFormat) params['importFormat'] = importFormat;

    // Make the request using BCE SDK
    const data = await bceSdk(params, { method: 'GET' }, {
      getBaiduCloudConfig: () => ({
        endpoint,
        accessKey: ak,
        secretKey: sk,
      }),
    } as any) as any;

    // Check if the response is an error
    if (data && typeof data === 'object' && (data.code || data.message)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ API request failed: ${data.code || 'Unknown Error'}\n   Message: ${data.message || 'No message provided'}\n   Request ID: ${data.request_id || 'N/A'}`,
      };
    }

    // Extract body from response (BCE SDK returns { http_headers, body })
    const responseData = data.body || data;

    // Check if data has the expected structure
    if (!responseData || typeof responseData !== 'object' || !('totalCount' in responseData)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Unexpected response format: ${JSON.stringify(data, null, 2)}`,
      };
    }

    // Use responseData for the rest
    const datasets = responseData;

    // Format and display datasets
    let message = `✅ Datasets retrieved successfully!\n   Total count: ${datasets.totalCount || 0}\n\n`;

    if (!datasets.datasets || datasets.datasets.length === 0) {
      message += '📭 No datasets found.';
      return {
        type: 'message',
        messageType: 'info',
        content: message,
      };
    }

    // Format and display datasets
    message += '📊 Dataset List:\n';
    message += '┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n';
    message += '│ ID                │ Name                                        │ Storage │ Instance              │ Format │ Owner               │ Permission │ Version │ Created              │ Updated              │\n';
    message += '├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤\n';

    datasets.datasets.forEach((dataset: any) => {
      const id = (dataset.id || '').padEnd(18);
      
      // Truncate name if too long and add ellipsis
      const fullName = dataset.name || '';
      const maxNameLength = 40;
      const name = fullName.length > maxNameLength 
        ? (fullName.substring(0, maxNameLength - 3) + '...').padEnd(maxNameLength)
        : fullName.padEnd(maxNameLength);
      
      const storage = (dataset.storageType || '').padEnd(7);
      const instance = (dataset.storageInstance || '').padEnd(20);
      const format = (dataset.importFormat || '').padEnd(6);
      const owner = (dataset.ownerName || '').padEnd(19);
      const permission = (dataset.permission || '').padEnd(9);
      const version = (dataset.latestVersion || '').padEnd(7);
      const createdAt = dataset.createdAt ? new Date(dataset.createdAt).toLocaleString() : '';
      const updatedAt = dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleString() : '';
      
      message += `│ ${id} │ ${name} │ ${storage} │ ${instance} │ ${format} │ ${owner} │ ${permission} │ ${version} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │\n`;
    });

    message += '└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n';

    // Show pagination info if applicable
    if (datasets.totalCount > pageSize) {
      const totalPages = Math.ceil(datasets.totalCount / pageSize);
      message += `\n📄 Page ${pageNumber} of ${totalPages} (${datasets.totalCount} total datasets)\n`;
      message += `   Use /aihc dataset list --pageNumber <number> to navigate through pages\n`;
    }

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };

  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ Error fetching datasets: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// Model list function
const getModelList = async (
  context: CommandContext,
  pageNumber: number = 1,
  pageSize: number = 10,
  keyword?: string,
): Promise<SlashCommandActionReturn> => {
  try {
    // Check environment variables
    const ak = process.env['AIHC_AK'];
    const sk = process.env['AIHC_SK'];
    const endpoint = process.env['AIHC_ENDPOINT'] || 'https://aihc.bj.baidubce.com';

    if (!ak || !sk) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Error: AIHC_AK and AIHC_SK environment variables are required\n   Please set them using: export AIHC_AK=your_ak && export AIHC_SK=your_sk`,
      };
    }

    context.ui.addItem(
      {
        type: 'info',
        text: `🔍 Fetching AIHC models... (Page ${pageNumber}, Size ${pageSize})`,
      },
      Date.now(),
    );

    // Prepare request parameters
    const params: Record<string, string> = {
      action: 'DescribeModels',
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    };

    // Add optional parameters
    if (keyword) params['keyword'] = keyword;

    // Make the request using BCE SDK
    const data = await bceSdk(params, { method: 'GET' }, {
      getBaiduCloudConfig: () => ({
        endpoint,
        accessKey: ak,
        secretKey: sk,
      }),
    } as any) as any;

    // Check if the response is an error
    if (data && typeof data === 'object' && (data.code || data.message)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ API request failed: ${data.code || 'Unknown Error'}\n   Message: ${data.message || 'No message provided'}\n   Request ID: ${data.request_id || 'N/A'}`,
      };
    }

    // Extract body from response (BCE SDK returns { http_headers, body })
    const responseData = data.body || data;

    // Check if data has the expected structure
    if (!responseData || typeof responseData !== 'object' || !('totalCount' in responseData)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Unexpected response format: ${JSON.stringify(data, null, 2)}`,
      };
    }

    // Use responseData for the rest
    const models = responseData;

    // Format and display models
    let message = `✅ Models retrieved successfully!\n   Total count: ${models.totalCount || 0}\n\n`;

    if (!models.models || models.models.length === 0) {
      message += '📭 No models found.';
      return {
        type: 'message',
        messageType: 'info',
        content: message,
      };
    }

    // Format and display models
    message += '📊 Model List:\n';
    message += '┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n';
    message += '│ ID                │ Name                                        │ Format          │ Source        │ Owner               │ Visibility     │ Version │ Created              │ Updated              │\n';
    message += '├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤\n';

    models.models.forEach((model: any) => {
      const id = (model.id || '').padEnd(18);
      
      // Truncate name if too long and add ellipsis
      const fullName = model.name || '';
      const maxNameLength = 40;
      const name = fullName.length > maxNameLength 
        ? (fullName.substring(0, maxNameLength - 3) + '...').padEnd(maxNameLength)
        : fullName.padEnd(maxNameLength);
      
      const format = (model.modelFormat || '').padEnd(14);
      const source = (model.initSource || '').padEnd(12);
      const owner = (model.ownerName || '').padEnd(19);
      const visibility = (model.visibilityScope || '').padEnd(14);
      const version = (model.latestVersion || '').padEnd(7);
      const createdAt = model.createdAt ? new Date(model.createdAt).toLocaleString() : '';
      const updatedAt = model.updatedAt ? new Date(model.updatedAt).toLocaleString() : '';
      
      message += `│ ${id} │ ${name} │ ${format} │ ${source} │ ${owner} │ ${visibility} │ ${version} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │\n`;
    });

    message += '└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n';

    // Show pagination info if applicable
    if (models.totalCount > pageSize) {
      const totalPages = Math.ceil(models.totalCount / pageSize);
      message += `\n📄 Page ${pageNumber} of ${totalPages} (${models.totalCount} total models)\n`;
      message += `   Use /aihc model list --pageNumber <number> to navigate through pages\n`;
    }

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };

  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ Error fetching models: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const modelListCommand: SlashCommand = {
  name: 'list',
  description: 'List AIHC models',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const argsArray = args.trim().split(/\s+/).filter(Boolean);
    
    let pageNumber = 1;
    let pageSize = 10;
    let keyword: string | undefined;

    // Parse arguments
    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const nextArg = argsArray[i + 1];
      
      switch (arg) {
        case '--pageNumber':
        case '-p':
          if (nextArg && !isNaN(Number(nextArg))) {
            pageNumber = Number(nextArg);
            i++; // Skip next argument
          }
          break;
        case '--pageSize':
        case '-s':
          if (nextArg && !isNaN(Number(nextArg))) {
            pageSize = Number(nextArg);
            i++; // Skip next argument
          }
          break;
        case '--keyword':
        case '-k':
          if (nextArg) {
            keyword = nextArg;
            i++; // Skip next argument
          }
          break;
      }
    }

    return getModelList(context, pageNumber, pageSize, keyword);
  },
};

const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Manage AIHC models',
  kind: CommandKind.BUILT_IN,
  subCommands: [modelListCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Model Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc model list${RESET_COLOR} - List models\n` +
      `    Options:\n` +
      `      --pageNumber, -p <number>  Page number (default: 1)\n` +
      `      --pageSize, -s <number>    Page size (default: 10)\n` +
      `      --keyword, -k <string>     Search keyword\n\n` +
      `  Example: ${COLOR_CYAN}/aihc model list --keyword llama --pageSize 20${RESET_COLOR}`,
  }),
};

const datasetListCommand: SlashCommand = {
  name: 'list',
  description: 'List AIHC datasets',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const argsArray = args.trim().split(/\s+/).filter(Boolean);
    
    let pageNumber = 1;
    let pageSize = 10;
    let keyword: string | undefined;
    let storageType: string | undefined;
    let storageInstances: string | undefined;
    let importFormat: string | undefined;

    // Parse arguments
    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const nextArg = argsArray[i + 1];
      
      switch (arg) {
        case '--pageNumber':
        case '-p':
          if (nextArg && !isNaN(Number(nextArg))) {
            pageNumber = Number(nextArg);
            i++; // Skip next argument
          }
          break;
        case '--pageSize':
        case '-s':
          if (nextArg && !isNaN(Number(nextArg))) {
            pageSize = Number(nextArg);
            i++; // Skip next argument
          }
          break;
        case '--keyword':
        case '-k':
          if (nextArg) {
            keyword = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--storageType':
          if (nextArg) {
            storageType = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--storageInstances':
          if (nextArg) {
            storageInstances = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--importFormat':
          if (nextArg) {
            importFormat = nextArg;
            i++; // Skip next argument
          }
          break;
      }
    }

    return getDatasetList(context, pageNumber, pageSize, 'createdAt', 'DESC', keyword, storageType, storageInstances, importFormat);
  },
};

const datasetCommand: SlashCommand = {
  name: 'dataset',
  description: 'Manage AIHC datasets',
  kind: CommandKind.BUILT_IN,
  subCommands: [datasetListCommand],
  action: async (context: CommandContext, args: string) => 
    // If no subcommand, show help
     ({
      type: 'message',
      messageType: 'info',
      content: `AIHC Dataset Commands:\n\n` +
        `  ${COLOR_CYAN}/aihc dataset list${RESET_COLOR} - List datasets\n` +
        `    Options:\n` +
        `      --pageNumber, -p <number>      Page number (default: 1)\n` +
        `      --pageSize, -s <number>        Page size (default: 10)\n` +
        `      --keyword, -k <string>         Search keyword\n` +
        `      --storageType <string>         Storage type filter\n` +
        `      --storageInstances <string>    Storage instances filter\n` +
        `      --importFormat <string>        Import format filter\n\n` +
        `  Example: ${COLOR_CYAN}/aihc dataset list --keyword test --pageSize 20${RESET_COLOR}`,
    })
  ,
};

export const aihcCommand: SlashCommand = {
  name: 'aihc',
  description: 'AIHC (AI High Computing) platform commands',
  kind: CommandKind.BUILT_IN,
  subCommands: [datasetCommand, modelCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc dataset${RESET_COLOR} - Manage AIHC datasets\n` +
      `  ${COLOR_CYAN}/aihc model${RESET_COLOR} - Manage AIHC models\n\n` +
      `Use ${COLOR_CYAN}/aihc <command> --help${RESET_COLOR} for more information.`,
  }),
};
