/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc dataset list' command
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { bceSdk } from '@qwen-code/qwen-code-core';

interface DatasetListArgs {
  pageNumber?: number;
  pageSize?: number;
  keyword?: string;
  storageType?: string;
  storageInstances?: string;
  importFormat?: string;
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List AIHC datasets',
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
      .option('keyword', {
        alias: 'k',
        type: 'string',
        description: 'Search keyword',
      })
      .option('storageType', {
        type: 'string',
        description: 'Storage type filter',
      })
      .option('storageInstances', {
        type: 'string',
        description: 'Storage instances filter',
      })
      .option('importFormat', {
        type: 'string',
        description: 'Import format filter',
      })
      .version(false),
  handler: async (args: ArgumentsCamelCase<DatasetListArgs>) => {
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

      console.log('🔍 Fetching AIHC datasets...');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Page: ${args.pageNumber || 1}, Size: ${args.pageSize || 10}`);
      if (args.keyword) console.log(`   Keyword: ${args.keyword}`);
      if (args.storageType) console.log(`   Storage Type: ${args.storageType}`);
      if (args.storageInstances) console.log(`   Storage Instances: ${args.storageInstances}`);
      if (args.importFormat) console.log(`   Import Format: ${args.importFormat}`);
      console.log('');

      // Prepare request parameters
      const params: Record<string, string> = {
        action: 'DescribeDatasets',
        pageNumber: (args.pageNumber || 1).toString(),
        pageSize: (args.pageSize || 10).toString(),
      };

      // Add optional parameters
      if (args.keyword) params['keyword'] = args.keyword;
      if (args.storageType) params['storageType'] = args.storageType;
      if (args.storageInstances) params['storageInstances'] = args.storageInstances;
      if (args.importFormat) params['importFormat'] = args.importFormat;

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

      // Use responseData instead of data for the rest
      const datasets = responseData;

      // Display results
      console.log('✅ Datasets retrieved successfully!');
      console.log(`   Total count: ${datasets.totalCount || 0}`);
      console.log('');

      if (!datasets.datasets || datasets.datasets.length === 0) {
        console.log('📭 No datasets found.');
        return;
      }

      // Format and display datasets
      console.log('📊 Dataset List:');
      console.log('┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ ID                │ Name                                        │ Storage │ Instance              │ Format │ Owner               │ Permission │ Version │ Created              │ Updated              │');
      console.log('├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤');

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
        
        console.log(`│ ${id} │ ${name} │ ${storage} │ ${instance} │ ${format} │ ${owner} │ ${permission} │ ${version} │ ${createdAt.padEnd(19)} │ ${updatedAt.padEnd(19)} │`);
      });

      console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘');

      // Show pagination info if applicable
      if (datasets.totalCount > (args.pageSize || 10)) {
        const totalPages = Math.ceil(datasets.totalCount / (args.pageSize || 10));
        console.log('');
        console.log(`📄 Page ${args.pageNumber || 1} of ${totalPages} (${datasets.totalCount} total datasets)`);
        console.log(`   Use --pageNumber to navigate through pages`);
      }

    } catch (error) {
      console.error('❌ Error fetching datasets:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },
};

