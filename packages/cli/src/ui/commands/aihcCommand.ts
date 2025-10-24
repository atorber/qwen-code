/* eslint-disable @typescript-eslint/no-explicit-any */
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
import type {
  DescribeDatasetsResponse,
  DescribeModelsResponse,
  DescribeDevInstancesResponse,
  DescribeServicesResponse,
  DescribeResourcePoolsResponse,
  Dataset,
  Model,
  DevInstance,
  ServiceBriefInfo,
  ResourcePoolSpec,
  QueueItem,
  JobItem,
  AcceleratorCard,
} from '../../types/aihc-api.js';
import { truncateAndPad } from '../../utils/textWidth.js';

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
    const params: Record<string, any> = {
      action: 'DescribeDatasets',
      pageNumber: Number(pageNumber),
      pageSize: Number(pageSize),
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
    const datasets = responseData as DescribeDatasetsResponse;

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

    // Format and display datasets (Dev-style: dual-row, borderless)
    message += '📊 Dataset List:\n\n';
    const header = `${'Name/ID'.padEnd(61)} ${'Storage/Instance'.padEnd(35)} ${'Format'.padEnd(10)} ${'Owner'.padEnd(16)} ${'Permission'.padEnd(11)} ${'Version'.padEnd(8)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}`;
    message += header + '\n';
    message += '─'.repeat(header.length) + '\n';

    datasets.datasets.forEach((dataset: Dataset) => {
      // Row 1: Name, StorageType, Format, Owner, Permission, Version, Created, Updated
      const name = truncateAndPad(dataset.name || '', 61);

      const storageType = (dataset.storageType || '').padEnd(35);
      const format = (dataset.importFormat || '').padEnd(10);
      const owner = (dataset.ownerName || '').padEnd(16);
      const permission = (dataset.permission || '').padEnd(11);
      const version = (dataset.latestVersion || '').padEnd(8);
      const createdAt = dataset.createdAt ? new Date(dataset.createdAt).toLocaleString().padEnd(19) : ''.padEnd(19);
      const updatedAt = dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleString().padEnd(19) : ''.padEnd(19);

      message += `${name} ${storageType} ${format} ${owner} ${permission} ${version} ${createdAt} ${updatedAt}\n`;

      // Row 2: ID, StorageInstance, blanks for remaining columns
      const id = (dataset.id || '').padEnd(61);
      const instance = (dataset.storageInstance || '').padEnd(35);

      message += `${id} ${instance} ${' '.repeat(10)} ${' '.repeat(16)} ${' '.repeat(11)} ${' '.repeat(8)} ${' '.repeat(19)} ${' '.repeat(19)}\n\n`;
    });

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
    const params: Record<string, any> = {
      action: 'DescribeModels',
      pageNumber: Number(pageNumber),
      // pageSize: Number(pageSize),
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
    const models = responseData as DescribeModelsResponse;

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

    // Format and display models (Dev-style: dual-row, borderless)
    message += '📊 Model List:\n\n';
    const header = `${'Name/ID'.padEnd(61)} ${'Format/Source'.padEnd(35)} ${'Owner'.padEnd(16)} ${'Visibility'.padEnd(12)} ${'Version'.padEnd(8)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}`;
    message += header + '\n';
    message += '─'.repeat(header.length) + '\n';

    models.models.forEach((model: Model) => {
      // Row 1: Name, Format, Owner, Visibility, Version, Created, Updated
      const name = truncateAndPad(model.name || '', 61);

      const format = (model.modelFormat || '').padEnd(35);
      const owner = (model.ownerName || '').padEnd(16);
      const visibility = (model.visibilityScope || '').padEnd(12);
      const version = (model.latestVersion || '').padEnd(8);
      const createdAt = model.createdAt ? new Date(model.createdAt).toLocaleString().padEnd(19) : ''.padEnd(19);
      const updatedAt = model.updatedAt ? new Date(model.updatedAt).toLocaleString().padEnd(19) : ''.padEnd(19);

      message += `${name} ${format} ${owner} ${visibility} ${version} ${createdAt} ${updatedAt}\n`;

      // Row 2: ID, Source, blanks for remaining columns
      const id = (model.id || '').padEnd(61);
      const source = (model.initSource || '').padEnd(35);

      message += `${id} ${source} ${' '.repeat(16)} ${' '.repeat(12)} ${' '.repeat(8)} ${' '.repeat(19)} ${' '.repeat(19)}\n\n`;
    });

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
        default:
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
    const devs = responseData as DescribeDevInstancesResponse;

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

    // Format and display dev instances (dual-row format without borders)
    message += '📊 Dev Instance List:\n\n';
    message += `${'Name/ID'.padEnd(61)} ${'Pool/Queue'.padEnd(35)} ${'Status'.padEnd(11)} ${'Creator'.padEnd(16)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}\n`;
    message += '─'.repeat(165) + '\n';

    devs.devInstances.forEach((dev: DevInstance) => {
      // Complete status mapping according to API documentation
      const statusMap: Record<number, string> = {
        0: 'Creating',    // 创建中
        1: 'Queuing',     // 排队中
        2: 'Deploying',   // 部署中
        3: 'Running',     // 运行中
        4: 'Stopping',    // 实例停止中
        5: 'Stopped',     // 实例停止
        6: 'Starting',    // 实例开启中
        7: 'Started',     // 实例开启
        10: 'Imaging',    // 镜像制作中
        11: 'Deleting',   // 删除中
        18: 'Failed',     // 失败
        19: 'Exception',  // 异常
        20: 'Deleted',    // 已删除
      };
      const statusNum = dev.status || 0;
      const status = (statusMap[statusNum] || `Status${statusNum}`).padEnd(11);
      
      const creator = (dev.creator || '').padEnd(16);
      const createdAt = dev.createdAt ? new Date(dev.createdAt * 1000).toLocaleString() : '';
      const updatedAt = dev.updatedAt ? new Date(dev.updatedAt * 1000).toLocaleString() : '';
      
      // First row: Name, Pool, Status, Creator, Created, Updated
      const name = truncateAndPad(dev.name || '', 61);
      
      const pool = (dev.resourcePoolId || 'serverless').padEnd(35);
      message += `${name} ${pool} ${status} ${creator} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}\n`;
      
      // Second row: ID, Queue, empty other columns
      const id = (dev.id || '').padEnd(61);
      const queue = (dev.queueName || '-').padEnd(35);
      message += `${id} ${queue} ${' '.repeat(11)} ${' '.repeat(16)} ${' '.repeat(19)} ${' '.repeat(19)}\n\n`;
    });

    // Show pagination info if applicable
    if (devs.totalCount && devs.totalCount > pageSize) {
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
        default:
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
      resourcePoolId,
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

    // Format and display queues (dual-row format without borders)
    message += '📊 Queue List:\n\n';
    message += `${'Name/ID'.padEnd(50)} ${'Type'.padEnd(15)} ${'Status'.padEnd(20)} ${'Resources'.padEnd(35)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}\n`;
    message += '─'.repeat(165) + '\n';

    queues.queues.forEach((queue: QueueItem) => {
      const createdAt = queue.createdAt ? new Date(queue.createdAt).toLocaleString() : '';
      const updatedAt = queue.updatedAt ? new Date(queue.updatedAt).toLocaleString() : '';
      
      const cpuCores = queue.allocated?.cpuCores || queue.capability?.cpuCores || 0;
      const memoryGi = queue.allocated?.memoryGi || queue.capability?.memoryGi || 0;
      
      // Count total GPUs from acceleratorCardList
      let totalGPUs = 0;
      if (queue.allocated?.acceleratorCardList) {
        queue.allocated.acceleratorCardList.forEach((acc: AcceleratorCard) => {
          totalGPUs += parseFloat(String(acc.acceleratorCount || 0));
        });
      } else if (queue.capability?.acceleratorCardList) {
        queue.capability.acceleratorCardList.forEach((acc: AcceleratorCard) => {
          totalGPUs += parseFloat(String(acc.acceleratorCount || 0));
        });
      }
      
      const opened = queue.opened ? 'Opened' : 'Closed';
      const reclaimable = queue.reclaimable ? 'Reclaimable' : 'Non-reclaimable';
      const status = `${opened}, ${reclaimable}`;
      const resources = `CPU:${cpuCores} Mem:${memoryGi}GB GPU:${totalGPUs}`;
      
      // First row: Name, Type, Status, Resources, Created, Updated
      const name = truncateAndPad(queue.queueName || '', 50);
      const queueType = (queue.queueType || '').padEnd(15);
      message += `${name} ${queueType} ${status.padEnd(20)} ${resources.padEnd(35)} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}\n`;
      
      // Second row: Queue ID
      const queueId = (queue.queueId || '').padEnd(50);
      message += `${queueId} ${' '.repeat(15)} ${' '.repeat(20)} ${' '.repeat(35)} ${' '.repeat(19)} ${' '.repeat(19)}\n\n`;
    });

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
        default:
          break;
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
  action: async (_context: CommandContext, _args: string) => ({
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
      resourcePoolId,
    };
    if (queueID) {
      queryParams['queueID'] = queueID;
    }

    // Prepare body parameters (for POST body)
    const bodyParams: Record<string, any> = {
      pageNumber,
      pageSize,
      orderBy,
      order,
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

    // Format and display training jobs (Dev-style: dual-row, borderless)
    message += '📊 Training Job List:\n\n';
    const header = `${'Name/ID'.padEnd(61)} ${'Queue'.padEnd(35)} ${'Type/Status'.padEnd(20)} ${'Priority'.padEnd(8)} ${'Replicas'.padEnd(8)} ${'Created'.padEnd(19)} ${'Finished'.padEnd(19)}`;
    message += header + '\n';
    message += '─'.repeat(header.length) + '\n';

    jobs.jobs.forEach((job: JobItem) => {
      // Row 1: Name, Queue, Status (on odd row), Priority, Replicas, Created, Finished
      const name = truncateAndPad(job.name || '', 61);

      const queueVal = (job.queueId || job.queue || '').padEnd(35);
      const statusVal = (job.status || '').padEnd(20);
      const priority = (job.priority || '').padEnd(8);
      const replicas = (job.jobSpec?.replicas?.toString() || '0').padEnd(8);
      const createdAt = job.createdAt ? new Date(job.createdAt).toLocaleString().padEnd(19) : ''.padEnd(19);
      const finishedAt = job.finishedAt ? new Date(job.finishedAt).toLocaleString().padEnd(19) : ''.padEnd(19);

      message += `${name} ${queueVal} ${statusVal} ${priority} ${replicas} ${createdAt} ${finishedAt}\n`;

      // Row 2: Job ID, Type (on even row), blanks for remaining columns
      const jobId = ((job.jobId || job.jobid || '')).padEnd(61);
      const jobType = (job.jobType || '').padEnd(20);
      message += `${jobId} ${' '.repeat(35)} ${jobType} ${' '.repeat(8)} ${' '.repeat(8)} ${' '.repeat(19)} ${' '.repeat(19)}\n\n`;
    });

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
        default:
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
  action: async (_context: CommandContext, _args: string) => ({
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
      resourcePoolType,
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      keywordType,
      orderBy,
      order,
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
    const pools = responseData as DescribeResourcePoolsResponse;

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

    // Format and display resource pools (dual-row format without borders)
    message += '📊 Resource Pool List:\n\n';
    message += `${'Name/ID'.padEnd(50)} ${'Type'.padEnd(15)} ${'Phase'.padEnd(12)} ${'Nodes'.padEnd(8)} ${'Creator'.padEnd(20)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}\n`;
    message += '─'.repeat(165) + '\n';

    pools.resourcePools.forEach((pool: ResourcePoolSpec) => {
      const createdAt = pool.createdAt ? new Date(pool.createdAt).toLocaleString() : '';
      const updatedAt = pool.updatedAt ? new Date(pool.updatedAt).toLocaleString() : '';
      
      // First row: Name, Type, Phase, Nodes, Creator, Created, Updated
      const name = truncateAndPad(pool.name || '', 50);
      const type = (pool.type || '').padEnd(15);
      const phase = (pool.phase || '').padEnd(12);
      const nodeNum = (pool.nodeNum?.toString() || '0').padEnd(8);
      const createdBy = (pool.createdBy || '').padEnd(20);
      message += `${name} ${type} ${phase} ${nodeNum} ${createdBy} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}\n`;
      
      // Second row: Pool ID
      const id = (pool.resourcePoolId || '').padEnd(50);
      message += `${id} ${' '.repeat(15)} ${' '.repeat(12)} ${' '.repeat(8)} ${' '.repeat(20)} ${' '.repeat(19)} ${' '.repeat(19)}\n\n`;
    });

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
        default:
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
  action: async (_context: CommandContext, _args: string) => ({
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
    const services = responseData as DescribeServicesResponse;

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

    // Format and display services (dual-row format without borders)
    message += '📊 Service List:\n\n';
    message += `${'Name/ID'.padEnd(61)} ${'Pool/Queue'.padEnd(35)} ${'Type/Status'.padEnd(11)} ${'Creator'.padEnd(16)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}\n`;
    message += '─'.repeat(165) + '\n';

    services.services.forEach((service: ServiceBriefInfo) => {
      const status = (service.networkType || (service.publicAccess ? 'Public' : 'Private') || 'Active').padEnd(11);
      const typeStr = (service.workloadType || '-').padEnd(11);
      const creator = (service.creator || '-').padEnd(16);
      const createdAt = service.createdAt ? new Date(service.createdAt * 1000).toLocaleString() : '';
      const updatedAt = service.updatedAt ? new Date(service.updatedAt * 1000).toLocaleString() : '';

      const name = truncateAndPad(service.name || '', 61);
      
      const pool = (service.resourcePoolId || '-').padEnd(35);
      message += `${name} ${pool} ${status} ${creator} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}\n`;

      const id = (service.id || '').padEnd(61);
      const queue = (service.queueName || '-').padEnd(35);
      message += `${id} ${queue} ${typeStr} ${' '.repeat(16)} ${' '.repeat(19)} ${' '.repeat(19)}\n\n`;
    });

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
        default:
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
  action: async (_context: CommandContext, _args: string) => ({
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
  action: async (_context: CommandContext, _args: string) => ({
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
  action: async (_context: CommandContext, _args: string) => ({
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
        default:
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
  action: async (_context: CommandContext, _args: string) => 
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
  action: async (_context: CommandContext, _args: string) => ({
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
