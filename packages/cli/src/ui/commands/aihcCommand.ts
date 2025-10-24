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

// Helper function to parse completion arguments
function parseCompletionArgs(partialArg: string): { lastArg: string; secondLastArg: string } {
  const hasTrailingSpace = partialArg.endsWith(' ');
  const argsArray = partialArg.trim().split(/\s+/).filter(Boolean);
  const lastArg = hasTrailingSpace ? '' : (argsArray[argsArray.length - 1] || '');
  const secondLastArg = hasTrailingSpace 
    ? (argsArray[argsArray.length - 1] || '') 
    : (argsArray.length > 1 ? argsArray[argsArray.length - 2] : '');
  return { lastArg, secondLastArg };
}

const getDatasetList = async (
  context: CommandContext,
  pageNumber: number = 1,
  pageSize: number = 10,
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
  completion: async (_context: CommandContext, partialArg: string) => {
    // No enum parameters for model list, just return option names
    const options = ['--pageNumber', '-p', '--pageSize', '-s', '--keyword', '-k'];
    return options.filter(opt => opt.startsWith(partialArg));
  },
};

// Dev instance list function
const getDevList = async (
  context: CommandContext,
  pageNumber: number = 1,
  pageSize: number = 10,
  onlyMyDevs: boolean = false,
  resourcePoolId?: string,
  queueName?: string,
  status?: string,
  queryKey?: string,
  queryVal?: string,
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
        text: `🔍 Fetching AIHC dev instances... (Page ${pageNumber}, Size ${pageSize}${onlyMyDevs ? ', Only Mine' : ''})`,
      },
      Date.now(),
    );

    // Prepare request parameters
    const params: Record<string, string> = {
      action: 'DescribeDevInstances',
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      onlyMyDevs: onlyMyDevs ? 'true' : 'false',
    };

    // Add optional parameters
    if (resourcePoolId) params['resourcePoolId'] = resourcePoolId;
    if (queueName) params['queueName'] = queueName;
    if (status) params['status'] = status;
    if (queryKey) params['queryKey'] = queryKey;
    if (queryVal) params['queryVal'] = queryVal;

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
    const devs = responseData;

    // Format and display dev instances
    let message = `✅ Dev instances retrieved successfully!\n   Total count: ${devs.totalCount || 0}\n\n`;

    if (!devs.devInstances || devs.devInstances.length === 0) {
      message += '📭 No dev instances found.';
      return {
        type: 'message',
        messageType: 'info',
        content: message,
      };
    }

    // Format and display dev instances
    message += '📊 Dev Instance List:\n';
    message += '┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n';
    message += '│ ID                │ Name                                        │ Status │ Queue               │ Pool ID           │ Creator             │ CPU │ Mem(GB) │ GPU │ Created              │ Updated              │\n';
    message += '├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤\n';

    devs.devInstances.forEach((dev: any) => {
      const id = (dev.id || '').padEnd(18);
      
      // Truncate name if too long and add ellipsis
      const fullName = dev.name || '';
      const maxNameLength = 40;
      const name = fullName.length > maxNameLength 
        ? (fullName.substring(0, maxNameLength - 3) + '...').padEnd(maxNameLength)
        : fullName.padEnd(maxNameLength);
      
      // Status mapping
      const statusMap: Record<number, string> = {
        0: 'Creating',
        1: 'Starting',
        2: 'Running',
        3: 'Stopping',
        4: 'Stopped',
        5: 'Deleting',
        6: 'Deleted',
        7: 'Failed',
      };
      const statusNum = dev.status || 0;
      const status = (statusMap[statusNum] || statusNum.toString()).padEnd(6);
      
      const queueName = (dev.queueName || '').padEnd(19);
      const poolId = (dev.resourcePoolId || '').padEnd(17);
      const creator = (dev.creator || '').padEnd(19);
      const cpus = (dev.resources?.cpus?.toString() || '0').padEnd(3);
      const memory = (dev.resources?.memory?.toString() || '0').padEnd(7);
      const gpus = (dev.resources?.acceleratorCount?.toString() || '0').padEnd(3);
      const createdAt = dev.createdAt ? new Date(dev.createdAt * 1000).toLocaleString() : '';
      const updatedAt = dev.updatedAt ? new Date(dev.updatedAt * 1000).toLocaleString() : '';
      
      message += `│ ${id} │ ${name} │ ${status} │ ${queueName} │ ${poolId} │ ${creator} │ ${cpus} │ ${memory} │ ${gpus} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │\n`;
    });

    message += '└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n';

    // Show pagination info if applicable
    if (devs.totalCount > pageSize) {
      const totalPages = Math.ceil(devs.totalCount / pageSize);
      message += `\n📄 Page ${pageNumber} of ${totalPages} (${devs.totalCount} total dev instances)\n`;
      message += `   Use /aihc dev list --pageNumber <number> to navigate through pages\n`;
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
      content: `❌ Error fetching dev instances: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const devListCommand: SlashCommand = {
  name: 'list',
  description: 'List AIHC development instances',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const argsArray = args.trim().split(/\s+/).filter(Boolean);
    
    let pageNumber = 1;
    let pageSize = 10;
    let onlyMyDevs = false;
    let resourcePoolId: string | undefined;
    let queueName: string | undefined;
    let status: string | undefined;
    let queryKey: string | undefined;
    let queryVal: string | undefined;

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
        case '--onlyMyDevs':
        case '-m':
          onlyMyDevs = true;
          break;
        case '--resourcePoolId':
        case '-r':
          if (nextArg) {
            resourcePoolId = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--queueName':
        case '-q':
          if (nextArg) {
            queueName = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--status':
          if (nextArg) {
            status = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--queryKey':
          if (nextArg) {
            queryKey = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--queryVal':
          if (nextArg) {
            queryVal = nextArg;
            i++; // Skip next argument
          }
          break;
      }
    }

    return getDevList(context, pageNumber, pageSize, onlyMyDevs, resourcePoolId, queueName, status, queryKey, queryVal);
  },
  completion: async (_context: CommandContext, partialArg: string) => {
    const { lastArg, secondLastArg } = parseCompletionArgs(partialArg);
    const queryKeys = ['devInstanceName', 'devInstanceId', 'creator'];
    
    // Check if lastArg is an enum value, then suggest other parameters
    const isEnumValue = queryKeys.includes(lastArg);
    if (isEnumValue && !lastArg.startsWith('-')) {
      const options = [
        '--pageNumber', '-p',
        '--pageSize', '-s',
        '--onlyMyDevs', '-m',
        '--resourcePoolId', '-r',
        '--queueName', '-q',
        '--status',
        '--queryKey',
        '--queryVal',
      ];
      return options;
    }
    
    // If the previous argument was --queryKey, suggest enum values
    if (secondLastArg === '--queryKey') {
      return queryKeys.filter(key => key.startsWith(lastArg));
    }
    
    // If lastArg itself is --queryKey, show enum values
    if (lastArg === '--queryKey') {
      return queryKeys;
    }
    
    // Otherwise suggest option names
    const options = [
      '--pageNumber', '-p',
      '--pageSize', '-s',
      '--onlyMyDevs', '-m',
      '--resourcePoolId', '-r',
      '--queueName', '-q',
      '--status',
      '--queryKey',
      '--queryVal',
    ];
    return options.filter(opt => opt.startsWith(lastArg));
  },
};

// Queue list function
const getQueueList = async (
  context: CommandContext,
  resourcePoolId: string,
  pageNumber: number = 1,
  pageSize: number = 10,
  keywordType?: 'queueName' | 'queueId',
  keyword?: string,
): Promise<SlashCommandActionReturn> => {
  try {
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
        text: `🔍 Fetching AIHC queues... (Pool: ${resourcePoolId}, Page ${pageNumber}, Size ${pageSize})`,
      },
      Date.now(),
    );

    const queryParams: Record<string, string> = {
      action: 'DescribeQueues',
      resourcePoolId: resourcePoolId,
    };
    if (keywordType) queryParams['keywordType'] = keywordType;
    if (keyword) queryParams['keyword'] = keyword;
    if (pageNumber) queryParams['pageNumber'] = pageNumber.toString();
    if (pageSize) queryParams['pageSize'] = pageSize.toString();

    const data = await bceSdk(queryParams, { 
      method: 'GET',
    }, {
      getBaiduCloudConfig: () => ({ endpoint, accessKey: ak, secretKey: sk }),
    } as any) as any;

    if (data && typeof data === 'object' && (data.code || data.message)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ API request failed: ${data.code || 'Unknown Error'}\n   Message: ${data.message || 'No message provided'}\n   Request ID: ${data.request_id || 'N/A'}`,
      };
    }

    const responseData = data.body || data;
    if (!responseData || typeof responseData !== 'object' || !('totalCount' in responseData)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Unexpected response format: ${JSON.stringify(data, null, 2)}`,
      };
    }

    const queues = responseData;
    let message = `✅ Queues retrieved successfully!\n   Total count: ${queues.totalCount || 0}\n\n`;

    if (!queues.queues || queues.queues.length === 0) {
      message += '📭 No queues found.';
      return { type: 'message', messageType: 'info', content: message };
    }

    const getDisplayWidth = (str: string): number => {
      let width = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF) || 
            (code >= 0xAC00 && code <= 0xD7AF) || (code >= 0xFF00 && code <= 0xFFEF)) {
          width += 2;
        } else {
          width += 1;
        }
      }
      return width;
    };

    message += '📊 Queue List:\n';
    message += '┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n';
    message += '│ Queue ID                  │ Queue Name                                  │ Type      │ Opened │ Reclaimable │ CPU(cores) │ Mem(GB) │ GPUs │ Created              │ Updated              │\n';
    message += '├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤\n';

    queues.queues.forEach((queue: any) => {
      const queueId = (queue.queueId || '').padEnd(25);
      const fullName = queue.queueName || '';
      const maxDisplayWidth = 40;
      let name = fullName;
      let displayWidth = getDisplayWidth(fullName);
      
      if (displayWidth > maxDisplayWidth) {
        let truncated = '';
        let currentWidth = 0;
        for (let i = 0; i < fullName.length; i++) {
          const charWidth = getDisplayWidth(fullName[i]);
          if (currentWidth + charWidth + 3 > maxDisplayWidth) break;
          truncated += fullName[i];
          currentWidth += charWidth;
        }
        name = truncated + '...';
        displayWidth = getDisplayWidth(name);
      }
      
      name = name + ' '.repeat(Math.max(0, maxDisplayWidth - displayWidth));
      const queueType = (queue.queueType || '').padEnd(9);
      const opened = (queue.opened ? 'Yes' : 'No').padEnd(6);
      const reclaimable = (queue.reclaimable ? 'Yes' : 'No').padEnd(11);
      const cpuCores = (queue.allocated?.cpuCores?.toString() || queue.capability?.cpuCores?.toString() || '0').padEnd(10);
      const memoryGi = (queue.allocated?.memoryGi?.toString() || queue.capability?.memoryGi?.toString() || '0').padEnd(7);
      
      let totalGPUs = 0;
      if (queue.allocated?.acceleratorCardList) {
        queue.allocated.acceleratorCardList.forEach((acc: any) => totalGPUs += parseFloat(acc.acceleratorCount || 0));
      } else if (queue.capability?.acceleratorCardList) {
        queue.capability.acceleratorCardList.forEach((acc: any) => totalGPUs += parseFloat(acc.acceleratorCount || 0));
      }
      const gpus = totalGPUs.toString().padEnd(4);
      const createdAt = queue.createdAt ? new Date(queue.createdAt).toLocaleString() : '';
      const updatedAt = queue.updatedAt ? new Date(queue.updatedAt).toLocaleString() : '';
      
      message += `│ ${queueId} │ ${name} │ ${queueType} │ ${opened} │ ${reclaimable} │ ${cpuCores} │ ${memoryGi} │ ${gpus} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │\n`;
    });

    message += '└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n';

    if (queues.totalCount > pageSize) {
      const totalPages = Math.ceil(queues.totalCount / pageSize);
      message += `\n📄 Page ${pageNumber} of ${totalPages} (${queues.totalCount} total queues)\n`;
      message += `   Use /aihc queue list --pageNumber <number> to navigate through pages\n`;
    }

    return { type: 'message', messageType: 'info', content: message };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ Error fetching queues: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const queueListCommand: SlashCommand = {
  name: 'list',
  description: 'List AIHC queues',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const argsArray = args.trim().split(/\s+/).filter(Boolean);
    let resourcePoolId: string | undefined;
    let pageNumber = 1;
    let pageSize = 10;
    let keywordType: 'queueName' | 'queueId' | undefined;
    let keyword: string | undefined;

    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const nextArg = argsArray[i + 1];
      
      switch (arg) {
        case '--resourcePoolId': case '-r': if (nextArg) { resourcePoolId = nextArg; i++; } break;
        case '--pageNumber': case '-p': if (nextArg && !isNaN(Number(nextArg))) { pageNumber = Number(nextArg); i++; } break;
        case '--pageSize': case '-s': if (nextArg && !isNaN(Number(nextArg))) { pageSize = Number(nextArg); i++; } break;
        case '--keywordType': if (nextArg && (nextArg === 'queueName' || nextArg === 'queueId')) { keywordType = nextArg as 'queueName' | 'queueId'; i++; } break;
        case '--keyword': case '-k': if (nextArg) { keyword = nextArg; i++; } break;
      }
    }

    if (!resourcePoolId) {
      return { type: 'message', messageType: 'error', content: '❌ Error: --resourcePoolId is required\n   Use --resourcePoolId <pool-id>' };
    }

    return getQueueList(context, resourcePoolId, pageNumber, pageSize, keywordType, keyword);
  },
  completion: async (_context: CommandContext, partialArg: string) => {
    const { lastArg, secondLastArg } = parseCompletionArgs(partialArg);
    const keywordTypes = ['queueName', 'queueId'];
    
    // Check if lastArg is an enum value, then suggest other parameters
    const isEnumValue = keywordTypes.includes(lastArg);
    if (isEnumValue && !lastArg.startsWith('-')) {
      const options = ['--resourcePoolId', '-r', '--pageNumber', '-p', '--pageSize', '-s', '--keywordType', '--keyword', '-k'];
      return options;
    }
    
    // If the previous argument was --keywordType, suggest enum values
    if (secondLastArg === '--keywordType') {
      return keywordTypes.filter(type => type.startsWith(lastArg));
    }
    
    // If lastArg itself is --keywordType, show enum values
    if (lastArg === '--keywordType') {
      return keywordTypes;
    }
    
    // Otherwise suggest option names
    const options = ['--resourcePoolId', '-r', '--pageNumber', '-p', '--pageSize', '-s', '--keywordType', '--keyword', '-k'];
    return options.filter(opt => opt.startsWith(lastArg));
  },
};

const queueCommand: SlashCommand = {
  name: 'queue',
  description: 'Manage AIHC queues',
  kind: CommandKind.BUILT_IN,
  subCommands: [queueListCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Queue Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc queue list${RESET_COLOR} - List queues\n` +
      `    Required:\n` +
      `      --resourcePoolId, -r <string>  Resource pool ID\n` +
      `    Options:\n` +
      `      --keywordType <string>         Keyword search type (queueName, queueId)\n` +
      `      --keyword, -k <string>         Search keyword\n` +
      `      --pageNumber, -p <number>      Page number (default: 1)\n` +
      `      --pageSize, -s <number>        Page size (default: 10)\n\n` +
      `  Example: ${COLOR_CYAN}/aihc queue list --resourcePoolId cce-xxx --keyword default${RESET_COLOR}`,
  }),
};

// Job list function
const getJobList = async (
  context: CommandContext,
  resourcePoolId: string,
  pageNumber: number = 1,
  pageSize: number = 10,
  queueID?: string,
  queue?: string,
  status?: string,
  keywordType?: 'name' | 'queueName',
  keyword?: string,
  orderBy: 'createdAt' | 'finishedAt' = 'createdAt',
  order: 'asc' | 'desc' = 'desc',
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
        text: `🔍 Fetching AIHC training jobs... (Pool: ${resourcePoolId}, Page ${pageNumber}, Size ${pageSize})`,
      },
      Date.now(),
    );

    // Prepare query parameters (for URL)
    const queryParams: Record<string, string> = {
      action: 'DescribeJobs',
      resourcePoolId: resourcePoolId,
    };
    if (queueID) {
      queryParams['queueID'] = queueID;
    }

    // Prepare body parameters (for POST body)
    const bodyParams: Record<string, any> = {
      pageNumber: pageNumber,
      pageSize: pageSize,
      orderBy: orderBy,
      order: order,
    };
    if (queue) {
      bodyParams['queue'] = queue;
    }
    if (status) {
      bodyParams['status'] = status;
    }
    if (keywordType) {
      bodyParams['keywordType'] = keywordType;
    }
    if (keyword) {
      bodyParams['keyword'] = keyword;
    }

    // Make the request using BCE SDK (POST method with body)
    const data = await bceSdk(queryParams, { 
      method: 'POST',
      body: bodyParams,
    }, {
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
    const jobs = responseData;

    // Format and display training jobs
    let message = `✅ Training jobs retrieved successfully!\n   Total count: ${jobs.totalCount || 0}\n\n`;

    if (!jobs.jobs || jobs.jobs.length === 0) {
      message += '📭 No training jobs found.';
      return {
        type: 'message',
        messageType: 'info',
        content: message,
      };
    }

    // Format and display training jobs
    message += '📊 Training Job List:\n';
    message += '┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n';
    message += '│ Job ID                    │ Name                                        │ Status      │ Type      │ Priority │ Replicas │ Queue               │ Created              │ Finished             │\n';
    message += '├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤\n';

    jobs.jobs.forEach((job: any) => {
      const jobId = (job.jobId || '').padEnd(25);
      
      // Truncate name if too long and add ellipsis
      const fullName = job.name || '';
      const maxNameLength = 40;
      const name = fullName.length > maxNameLength 
        ? (fullName.substring(0, maxNameLength - 3) + '...').padEnd(maxNameLength)
        : fullName.padEnd(maxNameLength);
      
      const status = (job.status || '').padEnd(11);
      const jobType = (job.jobType || '').padEnd(9);
      const priority = (job.priority || '').padEnd(8);
      const replicas = (job.jobSpec?.replicas?.toString() || '0').padEnd(8);
      const queueId = (job.queueId || '').padEnd(19);
      const createdAt = job.createdAt ? new Date(job.createdAt).toLocaleString() : '';
      const finishedAt = job.finishedAt ? new Date(job.finishedAt).toLocaleString() : '';
      
      message += `│ ${jobId} │ ${name} │ ${status} │ ${jobType} │ ${priority} │ ${replicas} │ ${queueId} │ ${createdAt.padEnd(19)} │ ${finishedAt.padEnd(19)} │\n`;
    });

    message += '└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n';

    // Show pagination info if applicable
    if (jobs.totalCount > pageSize) {
      const totalPages = Math.ceil(jobs.totalCount / pageSize);
      message += `\n📄 Page ${pageNumber} of ${totalPages} (${jobs.totalCount} total jobs)\n`;
      message += `   Use /aihc job list --pageNumber <number> to navigate through pages\n`;
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
      content: `❌ Error fetching training jobs: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const jobListCommand: SlashCommand = {
  name: 'list',
  description: 'List AIHC training jobs',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const argsArray = args.trim().split(/\s+/).filter(Boolean);
    
    let resourcePoolId: string | undefined;
    let pageNumber = 1;
    let pageSize = 10;
    let queueID: string | undefined;
    let queue: string | undefined;
    let status: string | undefined;
    let keywordType: 'name' | 'queueName' | undefined;
    let keyword: string | undefined;
    let orderBy: 'createdAt' | 'finishedAt' = 'createdAt';
    let order: 'asc' | 'desc' = 'desc';

    // Parse arguments
    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const nextArg = argsArray[i + 1];
      
      switch (arg) {
        case '--resourcePoolId':
        case '-r':
          if (nextArg) {
            resourcePoolId = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--queueID':
          if (nextArg) {
            queueID = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--queue':
        case '-q':
          if (nextArg) {
            queue = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--status':
          if (nextArg) {
            status = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--keywordType':
          if (nextArg && (nextArg === 'name' || nextArg === 'queueName')) {
            keywordType = nextArg as 'name' | 'queueName';
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
        case '--orderBy':
          if (nextArg && (nextArg === 'createdAt' || nextArg === 'finishedAt')) {
            orderBy = nextArg as 'createdAt' | 'finishedAt';
            i++; // Skip next argument
          }
          break;
        case '--order':
          if (nextArg && (nextArg === 'asc' || nextArg === 'desc')) {
            order = nextArg as 'asc' | 'desc';
            i++; // Skip next argument
          }
          break;
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
      }
    }

    if (!resourcePoolId) {
      return {
        type: 'message',
        messageType: 'error',
        content: '❌ Error: --resourcePoolId is required\n   Use --resourcePoolId <pool-id>',
      };
    }

    return getJobList(context, resourcePoolId, pageNumber, pageSize, queueID, queue, status, keywordType, keyword, orderBy, order);
  },
  completion: async (_context: CommandContext, partialArg: string) => {
    const { lastArg, secondLastArg } = parseCompletionArgs(partialArg);
    const keywordTypes = ['name', 'queueName'];
    const orderByFields = ['createdAt', 'finishedAt'];
    const orderValues = ['asc', 'desc'];
    
    // Check if lastArg is an enum value, then suggest other parameters
    const isEnumValue = [...keywordTypes, ...orderByFields, ...orderValues].includes(lastArg);
    if (isEnumValue && !lastArg.startsWith('-')) {
      const options = [
        '--resourcePoolId', '-r',
        '--queueID',
        '--queue', '-q',
        '--status',
        '--keywordType',
        '--keyword', '-k',
        '--orderBy',
        '--order',
        '--pageNumber', '-p',
        '--pageSize', '-s',
      ];
      return options;
    }
    
    // If the previous argument was a parameter flag expecting enum values, suggest those values
    if (secondLastArg === '--keywordType') {
      return keywordTypes.filter(type => type.startsWith(lastArg));
    }
    if (secondLastArg === '--orderBy') {
      return orderByFields.filter(field => field.startsWith(lastArg));
    }
    if (secondLastArg === '--order') {
      return orderValues.filter(val => val.startsWith(lastArg));
    }
    
    // If lastArg itself is a parameter flag, show enum values
    if (lastArg === '--keywordType') return keywordTypes;
    if (lastArg === '--orderBy') return orderByFields;
    if (lastArg === '--order') return orderValues;
    
    // Otherwise suggest option names
    const options = [
      '--resourcePoolId', '-r',
      '--queueID',
      '--queue', '-q',
      '--status',
      '--keywordType',
      '--keyword', '-k',
      '--orderBy',
      '--order',
      '--pageNumber', '-p',
      '--pageSize', '-s',
    ];
    return options.filter(opt => opt.startsWith(lastArg));
  },
};

const jobCommand: SlashCommand = {
  name: 'job',
  description: 'Manage AIHC training jobs',
  kind: CommandKind.BUILT_IN,
  subCommands: [jobListCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Training Job Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc job list${RESET_COLOR} - List training jobs\n` +
      `    Required:\n` +
      `      --resourcePoolId, -r <string>  Resource pool ID\n` +
      `    Options:\n` +
      `      --queueID <string>             Queue ID (for dedicated pools)\n` +
      `      --queue, -q <string>           Queue name or ID\n` +
      `      --status <string>              Filter by job status\n` +
      `      --keywordType <string>         Keyword search type (name, queueName)\n` +
      `      --keyword, -k <string>         Search keyword\n` +
      `      --orderBy <string>             Order by field (createdAt, finishedAt)\n` +
      `      --order <string>               Order direction (asc, desc)\n` +
      `      --pageNumber, -p <number>      Page number (default: 1)\n` +
      `      --pageSize, -s <number>        Page size (default: 10)\n\n` +
      `  Example: ${COLOR_CYAN}/aihc job list --resourcePoolId cce-xxx --queue default${RESET_COLOR}`,
  }),
};

// Pool list function
const getPoolList = async (
  context: CommandContext,
  resourcePoolType: 'common' | 'dedicatedV2',
  pageNumber: number = 1,
  pageSize: number = 10,
  keywordType: 'resourcePoolName' | 'resourcePoolId' = 'resourcePoolName',
  keyword?: string,
  orderBy: 'resourcePoolName' | 'resourcePoolId' | 'createdAt' = 'resourcePoolName',
  order: 'ASC' | 'DESC' = 'ASC',
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
        text: `🔍 Fetching AIHC resource pools... (Type: ${resourcePoolType}, Page ${pageNumber}, Size ${pageSize})`,
      },
      Date.now(),
    );

    // Prepare request parameters
    const params: Record<string, string> = {
      action: 'DescribeResourcePools',
      resourcePoolType: resourcePoolType,
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      keywordType: keywordType,
      orderBy: orderBy,
      order: order,
    };
    if (keyword) {
      params['keyword'] = keyword;
    }

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
    const pools = responseData;

    // Format and display resource pools
    let message = `✅ Resource pools retrieved successfully!\n   Total count: ${pools.totalCount || 0}\n\n`;

    if (!pools.resourcePools || pools.resourcePools.length === 0) {
      message += '📭 No resource pools found.';
      return {
        type: 'message',
        messageType: 'info',
        content: message,
      };
    }

    // Format and display resource pools
    message += '📊 Resource Pool List:\n';
    message += '┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n';
    message += '│ ID                        │ Name                                        │ Type      │ Phase    │ Nodes │ Created              │ Updated              │ Creator              │\n';
    message += '├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤\n';

    pools.resourcePools.forEach((pool: any) => {
      const id = (pool.resourcePoolId || '').padEnd(24);
      
      // Calculate display width (CJK characters count as 2, others as 1)
      const getDisplayWidth = (str: string): number => {
        let width = 0;
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          // CJK Unified Ideographs and other wide characters
          if ((code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
              (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
              (code >= 0xAC00 && code <= 0xD7AF) ||  // Hangul Syllables
              (code >= 0xFF00 && code <= 0xFFEF)) {  // Fullwidth Forms
            width += 2;
          } else {
            width += 1;
          }
        }
        return width;
      };
      
      // Truncate name and pad to fixed display width
      const fullName = pool.name || '';
      const maxDisplayWidth = 40;
      let name = fullName;
      let displayWidth = getDisplayWidth(fullName);
      
      if (displayWidth > maxDisplayWidth) {
        // Truncate to fit with ellipsis
        let truncated = '';
        let currentWidth = 0;
        for (let i = 0; i < fullName.length; i++) {
          const charWidth = getDisplayWidth(fullName[i]);
          if (currentWidth + charWidth + 3 > maxDisplayWidth) break; // Reserve 3 for '...'
          truncated += fullName[i];
          currentWidth += charWidth;
        }
        name = truncated + '...';
        displayWidth = getDisplayWidth(name);
      }
      
      // Pad with spaces to reach target width
      const spacesToAdd = maxDisplayWidth - displayWidth;
      name = name + ' '.repeat(Math.max(0, spacesToAdd));
      
      const type = (pool.type || '').padEnd(9);
      const phase = (pool.phase || '').padEnd(8);
      const nodeNum = (pool.nodeNum?.toString() || '0').padEnd(5);
      const createdAt = pool.createdAt ? new Date(pool.createdAt).toLocaleString() : '';
      const updatedAt = pool.updatedAt ? new Date(pool.updatedAt).toLocaleString() : '';
      const createdBy = (pool.createdBy || '').padEnd(19);
      
      message += `│ ${id} │ ${name} │ ${type} │ ${phase} │ ${nodeNum} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │ ${createdBy} │\n`;
    });

    message += '└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n';

    // Show pagination info if applicable
    if (pools.totalCount > pageSize) {
      const totalPages = Math.ceil(pools.totalCount / pageSize);
      message += `\n📄 Page ${pageNumber} of ${totalPages} (${pools.totalCount} total resource pools)\n`;
      message += `   Use /aihc pool list --pageNumber <number> to navigate through pages\n`;
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
      content: `❌ Error fetching resource pools: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const poolListCommand: SlashCommand = {
  name: 'list',
  description: 'List AIHC resource pools',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const argsArray = args.trim().split(/\s+/).filter(Boolean);
    
    let resourcePoolType: 'common' | 'dedicatedV2' = 'common';
    let pageNumber = 1;
    let pageSize = 10;
    let keywordType: 'resourcePoolName' | 'resourcePoolId' = 'resourcePoolName';
    let keyword: string | undefined;
    let orderBy: 'resourcePoolName' | 'resourcePoolId' | 'createdAt' = 'resourcePoolName';
    let order: 'ASC' | 'DESC' = 'ASC';

    // Parse arguments
    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const nextArg = argsArray[i + 1];
      
      switch (arg) {
        case '--resourcePoolType':
        case '-t':
          if (nextArg && (nextArg === 'common' || nextArg === 'dedicatedV2')) {
            resourcePoolType = nextArg as 'common' | 'dedicatedV2';
            i++; // Skip next argument
          }
          break;
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
        case '--keywordType':
          if (nextArg && (nextArg === 'resourcePoolName' || nextArg === 'resourcePoolId')) {
            keywordType = nextArg as 'resourcePoolName' | 'resourcePoolId';
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
        case '--orderBy':
          if (nextArg && (nextArg === 'resourcePoolName' || nextArg === 'resourcePoolId' || nextArg === 'createdAt')) {
            orderBy = nextArg as 'resourcePoolName' | 'resourcePoolId' | 'createdAt';
            i++; // Skip next argument
          }
          break;
        case '--order':
          if (nextArg && (nextArg === 'ASC' || nextArg === 'DESC')) {
            order = nextArg as 'ASC' | 'DESC';
            i++; // Skip next argument
          }
          break;
      }
    }

    return getPoolList(context, resourcePoolType, pageNumber, pageSize, keywordType, keyword, orderBy, order);
  },
  completion: async (_context: CommandContext, partialArg: string) => {
    const { lastArg, secondLastArg } = parseCompletionArgs(partialArg);
    
    // Define enum values for each parameter
    const poolTypes = ['common', 'dedicatedV2'];
    const keywordTypes = ['resourcePoolName', 'resourcePoolId'];
    const orderByFields = ['resourcePoolName', 'resourcePoolId', 'createdAt'];
    const orderValues = ['ASC', 'DESC'];
    
    // Check if lastArg is an enum value (already completed parameter value)
    const isEnumValue = [...poolTypes, ...keywordTypes, ...orderByFields, ...orderValues].includes(lastArg);
    
    // If lastArg is an enum value, suggest other available parameters
    if (isEnumValue && !lastArg.startsWith('-')) {
      const options = [
        '--resourcePoolType', '-t',
        '--pageNumber', '-p',
        '--pageSize', '-s',
        '--keywordType',
        '--keyword', '-k',
        '--orderBy',
        '--order',
      ];
      return options;
    }
    
    // If the previous argument was a parameter flag expecting enum values, suggest those values
    if (secondLastArg === '--resourcePoolType' || secondLastArg === '-t') {
      return poolTypes.filter(type => type.startsWith(lastArg));
    }
    if (secondLastArg === '--keywordType') {
      return keywordTypes.filter(type => type.startsWith(lastArg));
    }
    if (secondLastArg === '--orderBy') {
      return orderByFields.filter(field => field.startsWith(lastArg));
    }
    if (secondLastArg === '--order') {
      return orderValues.filter(val => val.startsWith(lastArg));
    }
    
    // If lastArg itself is a parameter flag that expects enum values, show those values
    // This handles the case when user types "/aihc pool list -t" (without space after -t)
    if (lastArg === '--resourcePoolType' || lastArg === '-t') {
      return poolTypes;
    }
    if (lastArg === '--keywordType') {
      return keywordTypes;
    }
    if (lastArg === '--orderBy') {
      return orderByFields;
    }
    if (lastArg === '--order') {
      return orderValues;
    }
    
    // Otherwise suggest option names (parameter flags)
    const options = [
      '--resourcePoolType', '-t',
      '--pageNumber', '-p',
      '--pageSize', '-s',
      '--keywordType',
      '--keyword', '-k',
      '--orderBy',
      '--order',
    ];
    return options.filter(opt => opt.startsWith(lastArg));
  },
};

const poolCommand: SlashCommand = {
  name: 'pool',
  description: 'Manage AIHC resource pools',
  kind: CommandKind.BUILT_IN,
  subCommands: [poolListCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Resource Pool Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc pool list${RESET_COLOR} - List resource pools\n` +
      `    Required:\n` +
      `      --resourcePoolType, -t <string>  Resource pool type (common, dedicatedV2)\n` +
      `    Options:\n` +
      `      --pageNumber, -p <number>         Page number (default: 1)\n` +
      `      --pageSize, -s <number>           Page size (default: 10)\n` +
      `      --keywordType <string>            Keyword search type (resourcePoolName, resourcePoolId)\n` +
      `      --keyword, -k <string>            Search keyword\n` +
      `      --orderBy <string>                Order by field (resourcePoolName, resourcePoolId, createdAt)\n` +
      `      --order <string>                  Order direction (ASC, DESC)\n\n` +
      `  Example: ${COLOR_CYAN}/aihc pool list --resourcePoolType common --keyword test${RESET_COLOR}`,
  }),
};

// Service list function
const getServiceList = async (
  context: CommandContext,
  pageNumber: number = 1,
  pageSize: number = 10,
  orderBy: string = 'createdAt',
  order: 'asc' | 'desc' = 'desc',
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
        text: `🔍 Fetching AIHC services... (Page ${pageNumber}, Size ${pageSize})`,
      },
      Date.now(),
    );

    // Prepare request parameters
    const params: Record<string, string> = {
      action: 'DescribeServices',
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      orderBy,
      order,
    };

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
    const services = responseData;

    // Format and display services
    let message = `✅ Services retrieved successfully!\n   Total count: ${services.totalCount || 0}\n\n`;

    if (!services.services || services.services.length === 0) {
      message += '📭 No services found.';
      return {
        type: 'message',
        messageType: 'info',
        content: message,
      };
    }

    // Format and display services
    message += '📊 Service List:\n';
    message += '┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐\n';
    message += '│ ID                        │ Name                                        │ Network      │ Public │ Queue               │ Pool ID           │ CPU │ Mem(GB) │ GPU │ GPU Type          │ Created              │ Updated              │\n';
    message += '├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤\n';

    services.services.forEach((service: any) => {
      const id = (service.id || '').padEnd(24);
      
      // Truncate name if too long and add ellipsis
      const fullName = service.name || '';
      const maxNameLength = 40;
      const name = fullName.length > maxNameLength 
        ? (fullName.substring(0, maxNameLength - 3) + '...').padEnd(maxNameLength)
        : fullName.padEnd(maxNameLength);
      
      const networkType = (service.networkType || '').padEnd(12);
      const publicAccess = (service.publicAccess ? 'Yes' : 'No').padEnd(6);
      const queueName = (service.queueName || '').padEnd(19);
      const poolId = (service.resourcePoolId || '').padEnd(17);
      const cpus = (service.resourceSpec?.cpus?.toString() || '0').padEnd(3);
      const memory = (service.resourceSpec?.memory?.toString() || '0').padEnd(7);
      const gpus = (service.resourceSpec?.acceleratorCount?.toString() || '0').padEnd(3);
      
      // Truncate GPU type if too long
      const fullGpuType = service.resourceSpec?.acceleratorType || '';
      const maxGpuTypeLength = 17;
      const gpuType = fullGpuType.length > maxGpuTypeLength
        ? (fullGpuType.substring(0, maxGpuTypeLength - 3) + '...').padEnd(maxGpuTypeLength)
        : fullGpuType.padEnd(maxGpuTypeLength);
      
      const createdAt = service.createdAt ? new Date(service.createdAt * 1000).toLocaleString() : '';
      const updatedAt = service.updatedAt ? new Date(service.updatedAt * 1000).toLocaleString() : '';
      
      message += `│ ${id} │ ${name} │ ${networkType} │ ${publicAccess} │ ${queueName} │ ${poolId} │ ${cpus} │ ${memory} │ ${gpus} │ ${gpuType} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │\n`;
    });

    message += '└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n';

    // Show pagination info if applicable
    if (services.totalCount > pageSize) {
      const totalPages = Math.ceil(services.totalCount / pageSize);
      message += `\n📄 Page ${pageNumber} of ${totalPages} (${services.totalCount} total services)\n`;
      message += `   Use /aihc service list --pageNumber <number> to navigate through pages\n`;
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
      content: `❌ Error fetching services: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const serviceListCommand: SlashCommand = {
  name: 'list',
  description: 'List AIHC services',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const argsArray = args.trim().split(/\s+/).filter(Boolean);
    
    let pageNumber = 1;
    let pageSize = 10;
    let orderBy = 'createdAt';
    let order: 'asc' | 'desc' = 'desc';

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
        case '--orderBy':
          if (nextArg) {
            orderBy = nextArg;
            i++; // Skip next argument
          }
          break;
        case '--order':
          if (nextArg && (nextArg === 'asc' || nextArg === 'desc')) {
            order = nextArg as 'asc' | 'desc';
            i++; // Skip next argument
          }
          break;
      }
    }

    return getServiceList(context, pageNumber, pageSize, orderBy, order);
  },
  completion: async (_context: CommandContext, partialArg: string) => {
    const { lastArg, secondLastArg } = parseCompletionArgs(partialArg);
    const orderValues = ['asc', 'desc'];
    
    // Check if lastArg is an enum value, then suggest other parameters
    const isEnumValue = orderValues.includes(lastArg);
    if (isEnumValue && !lastArg.startsWith('-')) {
      const options = [
        '--pageNumber', '-p',
        '--pageSize', '-s',
        '--orderBy',
        '--order',
      ];
      return options;
    }
    
    // If the previous argument was --order, suggest enum values
    if (secondLastArg === '--order') {
      return orderValues.filter(val => val.startsWith(lastArg));
    }
    
    // If lastArg itself is --order, show enum values
    if (lastArg === '--order') {
      return orderValues;
    }
    
    // Otherwise suggest option names
    const options = [
      '--pageNumber', '-p',
      '--pageSize', '-s',
      '--orderBy',
      '--order',
    ];
    return options.filter(opt => opt.startsWith(lastArg));
  },
};

const serviceCommand: SlashCommand = {
  name: 'service',
  description: 'Manage AIHC services',
  kind: CommandKind.BUILT_IN,
  subCommands: [serviceListCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Service Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc service list${RESET_COLOR} - List services\n` +
      `    Options:\n` +
      `      --pageNumber, -p <number>  Page number (default: 1)\n` +
      `      --pageSize, -s <number>    Page size (default: 10)\n` +
      `      --orderBy <string>         Order by field (default: createdAt)\n` +
      `      --order <string>           Order direction (asc, desc, default: desc)\n\n` +
      `  Example: ${COLOR_CYAN}/aihc service list --pageSize 20 --order asc${RESET_COLOR}`,
  }),
};

const devCommand: SlashCommand = {
  name: 'dev',
  description: 'Manage AIHC development instances',
  kind: CommandKind.BUILT_IN,
  subCommands: [devListCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Dev Instance Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc dev list${RESET_COLOR} - List development instances\n` +
      `    Options:\n` +
      `      --pageNumber, -p <number>       Page number (default: 1)\n` +
      `      --pageSize, -s <number>         Page size (default: 10)\n` +
      `      --onlyMyDevs, -m               Show only my instances\n` +
      `      --resourcePoolId, -r <string>  Resource pool ID filter\n` +
      `      --queueName, -q <string>       Queue name filter\n` +
      `      --status <string>              Status filter\n` +
      `      --queryKey <string>            Query key (devInstanceName, devInstanceId, creator)\n` +
      `      --queryVal <string>            Query value\n\n` +
      `  Example: ${COLOR_CYAN}/aihc dev list --onlyMyDevs --pageSize 20${RESET_COLOR}`,
  }),
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

    return getDatasetList(context, pageNumber, pageSize, keyword, storageType, storageInstances, importFormat);
  },
  completion: async (_context: CommandContext, partialArg: string) => {
    const { lastArg, secondLastArg } = parseCompletionArgs(partialArg);
    const storageTypes = ['BOS', 'PFS'];
    const importFormats = ['FILE', 'FOLDER'];
    
    // Check if lastArg is an enum value, then suggest other parameters
    const isEnumValue = [...storageTypes, ...importFormats].includes(lastArg);
    if (isEnumValue && !lastArg.startsWith('-')) {
      const options = [
        '--pageNumber', '-p',
        '--pageSize', '-s',
        '--keyword', '-k',
        '--storageType',
        '--storageInstances',
        '--importFormat',
      ];
      return options;
    }
    
    // If the previous argument was a parameter flag expecting enum values, suggest those values
    if (secondLastArg === '--storageType') {
      return storageTypes.filter(type => type.startsWith(lastArg));
    }
    if (secondLastArg === '--importFormat') {
      return importFormats.filter(format => format.startsWith(lastArg));
    }
    
    // If lastArg itself is a parameter flag, show enum values
    if (lastArg === '--storageType') return storageTypes;
    if (lastArg === '--importFormat') return importFormats;
    
    // Otherwise suggest option names
    const options = [
      '--pageNumber', '-p',
      '--pageSize', '-s',
      '--keyword', '-k',
      '--storageType',
      '--storageInstances',
      '--importFormat',
    ];
    return options.filter(opt => opt.startsWith(lastArg));
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
  subCommands: [datasetCommand, modelCommand, devCommand, serviceCommand, poolCommand, jobCommand, queueCommand],
  action: async (context: CommandContext, args: string) => ({
    type: 'message',
    messageType: 'info',
    content: `AIHC Commands:\n\n` +
      `  ${COLOR_CYAN}/aihc dataset${RESET_COLOR} - Manage AIHC datasets\n` +
      `  ${COLOR_CYAN}/aihc model${RESET_COLOR} - Manage AIHC models\n` +
      `  ${COLOR_CYAN}/aihc dev${RESET_COLOR} - Manage AIHC development instances\n` +
      `  ${COLOR_CYAN}/aihc service${RESET_COLOR} - Manage AIHC services\n` +
      `  ${COLOR_CYAN}/aihc pool${RESET_COLOR} - Manage AIHC resource pools\n` +
      `  ${COLOR_CYAN}/aihc job${RESET_COLOR} - Manage AIHC training jobs\n` +
      `  ${COLOR_CYAN}/aihc queue${RESET_COLOR} - Manage AIHC queues\n\n` +
      `Use ${COLOR_CYAN}/aihc <command> --help${RESET_COLOR} for more information.`,
  }),
};
