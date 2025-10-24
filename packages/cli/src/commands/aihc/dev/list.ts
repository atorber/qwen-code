/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc dev list' command
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { bceSdk } from '@qwen-code/qwen-code-core';

interface DevListArgs {
  pageNumber?: number;
  pageSize?: number;
  onlyMyDevs?: boolean;
  resourcePoolId?: string;
  queueName?: string;
  status?: string;
  queryKey?: string;
  queryVal?: string;
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List AIHC development instances',
  builder: (yargs: Argv) =>
    yargs
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
      .option('onlyMyDevs', {
        alias: 'm',
        type: 'boolean',
        default: false,
        description: 'Show only my dev instances',
      })
      .option('resourcePoolId', {
        alias: 'r',
        type: 'string',
        description: 'Resource pool ID filter',
      })
      .option('queueName', {
        alias: 'q',
        type: 'string',
        description: 'Queue name filter',
      })
      .option('status', {
        type: 'string',
        description: 'Status filter',
      })
      .option('queryKey', {
        type: 'string',
        choices: ['devInstanceName', 'devInstanceId', 'creator'],
        description: 'Query key (devInstanceName, devInstanceId, creator)',
      })
      .option('queryVal', {
        type: 'string',
        description: 'Query value (used with queryKey)',
      })
      .version(false),
  handler: async (args: ArgumentsCamelCase<DevListArgs>) => {
    try {
      // Check environment variables
      const ak = process.env['AIHC_AK'];
      const sk = process.env['AIHC_SK'];
      const endpoint = process.env['AIHC_ENDPOINT'] || 'https://aihc.bj.baidubce.com';

      if (!ak || !sk) {
        console.error('❌ Error: AIHC_AK and AIHC_SK environment variables are required');
        console.error('   Please set them using: export AIHC_AK=your_ak && export AIHC_SK=your_sk');
        process.exit(1);
      }

      console.log('🔍 Fetching AIHC dev instances...');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Page: ${args.pageNumber || 1}, Size: ${args.pageSize || 10}`);
      if (args.onlyMyDevs) console.log(`   Only My Devs: true`);
      if (args.resourcePoolId) console.log(`   Resource Pool ID: ${args.resourcePoolId}`);
      if (args.queueName) console.log(`   Queue Name: ${args.queueName}`);
      if (args.status) console.log(`   Status: ${args.status}`);
      if (args.queryKey && args.queryVal) console.log(`   Query: ${args.queryKey}=${args.queryVal}`);
      console.log('');

      // Prepare request parameters
      const params: Record<string, string> = {
        action: 'DescribeDevInstances',
        pageNumber: (args.pageNumber || 1).toString(),
        pageSize: (args.pageSize || 10).toString(),
        onlyMyDevs: args.onlyMyDevs ? 'true' : 'false',
      };

      // Add optional parameters
      if (args.resourcePoolId) params['resourcePoolId'] = args.resourcePoolId;
      if (args.queueName) params['queueName'] = args.queueName;
      if (args.status) params['status'] = args.status;
      if (args.queryKey) params['queryKey'] = args.queryKey;
      if (args.queryVal) params['queryVal'] = args.queryVal;

      console.log('🔍 Making request to AIHC API...');

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
      const devs = responseData;

      // Display results
      console.log('✅ Dev instances retrieved successfully!');
      console.log(`   Total count: ${devs.totalCount || 0}`);
      console.log('');

      if (!devs.devInstances || devs.devInstances.length === 0) {
        console.log('📭 No dev instances found.');
        return;
      }

      // Format and display dev instances
      console.log('📊 Dev Instance List:');
      console.log('┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ ID                │ Name                                        │ Status │ Queue               │ Pool ID           │ Creator             │ CPU │ Mem(GB) │ GPU │ Created              │ Updated              │');
      console.log('├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤');

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
        
        console.log(`│ ${id} │ ${name} │ ${status} │ ${queueName} │ ${poolId} │ ${creator} │ ${cpus} │ ${memory} │ ${gpus} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │`);
      });

      console.log('└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘');

      // Show pagination info if applicable
      const pageSize = args.pageSize || 10;
      if (devs.totalCount > pageSize) {
        const totalPages = Math.ceil(devs.totalCount / pageSize);
        console.log('');
        console.log(`📄 Page ${args.pageNumber || 1} of ${totalPages} (${devs.totalCount} total dev instances)`);
        console.log(`   Use --pageNumber to navigate through pages`);
      }

    } catch (error) {
      console.error('❌ Error fetching dev instances:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },
};

