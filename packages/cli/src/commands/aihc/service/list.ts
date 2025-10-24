/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc service list' command
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { bceSdk } from '@qwen-code/qwen-code-core';

interface ServiceListArgs {
  pageNumber?: number;
  pageSize?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List AIHC services',
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
      .option('orderBy', {
        type: 'string',
        default: 'createdAt',
        description: 'Order by field (default: createdAt)',
      })
      .option('order', {
        type: 'string',
        choices: ['asc', 'desc'],
        default: 'desc',
        description: 'Order direction (default: desc)',
      })
      .version(false),
  handler: async (args: ArgumentsCamelCase<ServiceListArgs>) => {
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

      console.log('🔍 Fetching AIHC services...');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Page: ${args.pageNumber || 1}, Size: ${args.pageSize || 10}`);
      console.log(`   Order: ${args.orderBy || 'createdAt'} ${args.order || 'desc'}`);
      console.log('');

      // Prepare request parameters
      const params: Record<string, string> = {
        action: 'DescribeServices',
        pageNumber: (args.pageNumber || 1).toString(),
        pageSize: (args.pageSize || 10).toString(),
        orderBy: args.orderBy || 'createdAt',
        order: args.order || 'desc',
      };

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
      const services = responseData;

      // Display results
      console.log('✅ Services retrieved successfully!');
      console.log(`   Total count: ${services.totalCount || 0}`);
      console.log('');

      if (!services.services || services.services.length === 0) {
        console.log('📭 No services found.');
        return;
      }

      // Format and display services (dual-row format without borders)
      console.log('📊 Service List:');
      console.log('');
      console.log(`${'Name/ID'.padEnd(50)} ${'Queue/Pool'.padEnd(30)} ${'Network'.padEnd(15)} ${'Public'.padEnd(8)} ${'Resources'.padEnd(25)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}`);
      console.log('─'.repeat(165));

      services.services.forEach((service: any) => {
        const createdAt = service.createdAt ? new Date(service.createdAt * 1000).toLocaleString() : '';
        const updatedAt = service.updatedAt ? new Date(service.updatedAt * 1000).toLocaleString() : '';
        
        const cpus = service.resourceSpec?.cpus || 0;
        const memory = service.resourceSpec?.memory || 0;
        const gpus = service.resourceSpec?.acceleratorCount || 0;
        const gpuType = service.resourceSpec?.acceleratorType || '';
        const resources = `CPU:${cpus} Mem:${memory}GB GPU:${gpus}${gpuType ? ` (${gpuType})` : ''}`;
        
        // First row: Name, Queue, Network, Public, Resources, Created, Updated
        const name = (service.name || '').padEnd(50);
        const queueName = (service.queueName || '').padEnd(30);
        const networkType = (service.networkType || '').padEnd(15);
        const publicAccess = (service.publicAccess ? 'Yes' : 'No').padEnd(8);
        console.log(`${name} ${queueName} ${networkType} ${publicAccess} ${resources.padEnd(25)} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}`);
        
        // Second row: ID, Pool
        const id = (service.id || '').padEnd(50);
        const poolId = (service.resourcePoolId || '').padEnd(30);
        console.log(`${id} ${poolId} ${' '.repeat(15)} ${' '.repeat(8)} ${' '.repeat(25)} ${' '.repeat(19)} ${' '.repeat(19)}`);
        console.log('');
      });

      // Show pagination info if applicable
      const pageSize = args.pageSize || 10;
      if (services.totalCount > pageSize) {
        const totalPages = Math.ceil(services.totalCount / pageSize);
        console.log('');
        console.log(`📄 Page ${args.pageNumber || 1} of ${totalPages} (${services.totalCount} total services)`);
        console.log(`   Use --pageNumber to navigate through pages`);
      }

    } catch (error) {
      console.error('❌ Error fetching services:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },
};

