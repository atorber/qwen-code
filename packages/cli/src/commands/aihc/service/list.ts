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

      // Format and display services
      console.log('📊 Service List:');
      console.log('┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ ID                        │ Name                                        │ Network      │ Public │ Queue               │ Pool ID           │ CPU │ Mem(GB) │ GPU │ GPU Type          │ Created              │ Updated              │');
      console.log('├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤');

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
        
        console.log(`│ ${id} │ ${name} │ ${networkType} │ ${publicAccess} │ ${queueName} │ ${poolId} │ ${cpus} │ ${memory} │ ${gpus} │ ${gpuType} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │`);
      });

      console.log('└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘');

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

