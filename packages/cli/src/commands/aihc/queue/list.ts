/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc queue list' command
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { bceSdk } from '@qwen-code/qwen-code-core';
import { truncateAndPad } from '../../../utils/textWidth.js';

interface QueueListArgs {
  resourcePoolId?: string;
  keywordType?: 'queueName' | 'queueId';
  keyword?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List AIHC queues',
  builder: (yargs: Argv) =>
    yargs
      .option('resourcePoolId', {
        alias: 'r',
        type: 'string',
        demandOption: true,
        description: 'Resource pool ID (required)',
      })
      .option('keywordType', {
        type: 'string',
        choices: ['queueName', 'queueId'],
        description: 'Keyword search type (queueName, queueId)',
      })
      .option('keyword', {
        alias: 'k',
        type: 'string',
        description: 'Search keyword',
      })
      .option('pageNumber', {
        alias: 'p',
        type: 'number',
        default: 1,
        description: 'Page number (default: 1)',
      })
      .option('pageSize', {
        alias: 's',
        type: 'number',
        default: 10,
        description: 'Page size (default: 10)',
      })
      .version(false),
  handler: async (args: ArgumentsCamelCase<QueueListArgs>) => {
    try {
      // Check required parameters
      if (!args.resourcePoolId) {
        console.error('❌ Error: --resourcePoolId is required');
        console.error('   Use --resourcePoolId <pool-id>');
        process.exit(1);
      }

      // Check environment variables
      const ak = process.env['AIHC_AK'];
      const sk = process.env['AIHC_SK'];
      const endpoint = process.env['AIHC_ENDPOINT'] || 'https://aihc.bj.baidubce.com';

      if (!ak || !sk) {
        console.error('❌ Error: AIHC_AK and AIHC_SK environment variables are required');
        console.error('   Please set them using: export AIHC_AK=your_ak && export AIHC_SK=your_sk');
        process.exit(1);
      }

      console.log('🔍 Fetching AIHC queues...');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Resource Pool: ${args.resourcePoolId}`);
      console.log(`   Page: ${args.pageNumber || 1}, Size: ${args.pageSize || 10}`);
      if (args.keyword) {
        console.log(`   Keyword: ${args.keyword} (${args.keywordType || 'queueName'})`);
      }
      console.log('');

      // Prepare query parameters (for URL)
      const queryParams: Record<string, string> = {
        action: 'DescribeQueues',
        resourcePoolId: args.resourcePoolId,
      };
      if (args.keywordType) {
        queryParams['keywordType'] = args.keywordType;
      }
      if (args.keyword) {
        queryParams['keyword'] = args.keyword;
      }
      if (args.pageNumber) {
        queryParams['pageNumber'] = args.pageNumber.toString();
      }
      if (args.pageSize) {
        queryParams['pageSize'] = args.pageSize.toString();
      }

      console.log('🔍 Making request to AIHC API...');

      // Make the request using BCE SDK (GET method)
      const data = await bceSdk(queryParams, { 
        method: 'GET',
      }, {
        getBaiduCloudConfig: () => ({
          endpoint,
          accessKey: ak,
          secretKey: sk,
        }),
      } as any) as any;

      // Check if the response is an error
      if (data && typeof data === 'object' && (data.code || data.message)) {
        console.error(`❌ API request failed: ${data.code || 'Unknown Error'}`);
        console.error(`   Message: ${data.message || 'No message provided'}`);
        console.error(`   Request ID: ${data.request_id || 'N/A'}`);
        process.exit(1);
      }

      // Extract body from response (BCE SDK returns { http_headers, body })
      const responseData = data.body || data;

      // Check if data has the expected structure
      if (!responseData || typeof responseData !== 'object' || !('totalCount' in responseData)) {
        console.error(`❌ Unexpected response format:`, data);
        process.exit(1);
      }

      // Use responseData for the rest
      const queues = responseData;

      // Display results
      console.log('✅ Queues retrieved successfully!');
      console.log(`   Total count: ${queues.totalCount || 0}`);
      console.log('');

      if (!queues.queues || queues.queues.length === 0) {
        console.log('📭 No queues found.');
        return;
      }

      // Format and display queues (dual-row format without borders)
      console.log('📊 Queue List:');
      console.log('');
      console.log(`${'Name/ID'.padEnd(50)} ${'Type'.padEnd(15)} ${'Status'.padEnd(20)} ${'Resources'.padEnd(35)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}`);
      console.log('─'.repeat(165));

      queues.queues.forEach((queue: any) => {
        const createdAt = queue.createdAt ? new Date(queue.createdAt).toLocaleString() : '';
        const updatedAt = queue.updatedAt ? new Date(queue.updatedAt).toLocaleString() : '';
        
        const cpuCores = queue.allocated?.cpuCores || queue.capability?.cpuCores || 0;
        const memoryGi = queue.allocated?.memoryGi || queue.capability?.memoryGi || 0;
        
        // Count total GPUs from acceleratorCardList
        let totalGPUs = 0;
        if (queue.allocated?.acceleratorCardList) {
          queue.allocated.acceleratorCardList.forEach((acc: any) => {
            totalGPUs += parseFloat(acc.acceleratorCount || 0);
          });
        } else if (queue.capability?.acceleratorCardList) {
          queue.capability.acceleratorCardList.forEach((acc: any) => {
            totalGPUs += parseFloat(acc.acceleratorCount || 0);
          });
        }
        
        const opened = queue.opened ? 'Opened' : 'Closed';
        const reclaimable = queue.reclaimable ? 'Reclaimable' : 'Non-reclaimable';
        const status = `${opened}, ${reclaimable}`;
        const resources = `CPU:${cpuCores} Mem:${memoryGi}GB GPU:${totalGPUs}`;
        
        // First row: Name, Type, Status, Resources, Created, Updated
        const name = truncateAndPad(queue.queueName || '', 50);
        const queueType = (queue.queueType || '').padEnd(15);
        console.log(`${name} ${queueType} ${status.padEnd(20)} ${resources.padEnd(35)} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}`);
        
        // Second row: Queue ID
        const queueId = (queue.queueId || '').padEnd(50);
        console.log(`${queueId} ${' '.repeat(15)} ${' '.repeat(20)} ${' '.repeat(35)} ${' '.repeat(19)} ${' '.repeat(19)}`);
        console.log('');
      });

      // Show pagination info if applicable
      const pageSize = args.pageSize || 10;
      if (queues.totalCount > pageSize) {
        const totalPages = Math.ceil(queues.totalCount / pageSize);
        console.log('');
        console.log(`📄 Page ${args.pageNumber || 1} of ${totalPages} (${queues.totalCount} total queues)`);
        console.log(`   Use --pageNumber to navigate through pages`);
      }

    } catch (error) {
      console.error('❌ Error fetching queues:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },
};
