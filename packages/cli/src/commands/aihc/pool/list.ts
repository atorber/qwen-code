/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc pool list' command
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { bceSdk } from '@qwen-code/qwen-code-core';

interface PoolListArgs {
  resourcePoolType?: 'common' | 'dedicatedV2';
  pageNumber?: number;
  pageSize?: number;
  keywordType?: 'resourcePoolName' | 'resourcePoolId';
  keyword?: string;
  orderBy?: 'resourcePoolName' | 'resourcePoolId' | 'createdAt';
  order?: 'ASC' | 'DESC';
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List AIHC resource pools',
  builder: (yargs: Argv) =>
    yargs
      .option('resourcePoolType', {
        alias: 't',
        type: 'string',
        choices: ['common', 'dedicatedV2'],
        demandOption: true,
        description: 'Resource pool type (common or dedicatedV2)',
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
      .option('keywordType', {
        type: 'string',
        choices: ['resourcePoolName', 'resourcePoolId'],
        default: 'resourcePoolName',
        description: 'Keyword search type (default: resourcePoolName)',
      })
      .option('keyword', {
        alias: 'k',
        type: 'string',
        description: 'Search keyword',
      })
      .option('orderBy', {
        type: 'string',
        choices: ['resourcePoolName', 'resourcePoolId', 'createdAt'],
        default: 'resourcePoolName',
        description: 'Order by field (default: resourcePoolName)',
      })
      .option('order', {
        type: 'string',
        choices: ['ASC', 'DESC'],
        default: 'ASC',
        description: 'Order direction (default: ASC)',
      })
      .version(false),
  handler: async (args: ArgumentsCamelCase<PoolListArgs>) => {
    try {
      // Check required parameters
      if (!args.resourcePoolType) {
        console.error('❌ Error: --resourcePoolType is required');
        console.error('   Use --resourcePoolType common or --resourcePoolType dedicatedV2');
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

      console.log('🔍 Fetching AIHC resource pools...');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Type: ${args.resourcePoolType}`);
      console.log(`   Page: ${args.pageNumber || 1}, Size: ${args.pageSize || 10}`);
      console.log(`   Order: ${args.orderBy || 'resourcePoolName'} ${args.order || 'ASC'}`);
      if (args.keyword) {
        console.log(`   Keyword: ${args.keyword} (${args.keywordType || 'resourcePoolName'})`);
      }
      console.log('');

      // Prepare request parameters
      const params: Record<string, string> = {
        action: 'DescribeResourcePools',
        resourcePoolType: args.resourcePoolType,
        pageNumber: (args.pageNumber || 1).toString(),
        pageSize: (args.pageSize || 10).toString(),
        keywordType: args.keywordType || 'resourcePoolName',
        orderBy: args.orderBy || 'resourcePoolName',
        order: args.order || 'ASC',
      };
      if (args.keyword) {
        params['keyword'] = args.keyword;
      }

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
      const pools = responseData;

      // Display results
      console.log('✅ Resource pools retrieved successfully!');
      console.log(`   Total count: ${pools.totalCount || 0}`);
      console.log('');

      if (!pools.resourcePools || pools.resourcePools.length === 0) {
        console.log('📭 No resource pools found.');
        return;
      }

      // Format and display resource pools (dual-row format without borders)
      console.log('📊 Resource Pool List:');
      console.log('');
      console.log(`${'Name/ID'.padEnd(50)} ${'Type'.padEnd(15)} ${'Phase'.padEnd(12)} ${'Nodes'.padEnd(8)} ${'Creator'.padEnd(20)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}`);
      console.log('─'.repeat(165));

      pools.resourcePools.forEach((pool: any) => {
        const createdAt = pool.createdAt ? new Date(pool.createdAt).toLocaleString() : '';
        const updatedAt = pool.updatedAt ? new Date(pool.updatedAt).toLocaleString() : '';
        
        // First row: Name, Type, Phase, Nodes, Creator, Created, Updated
        const name = (pool.name || '').padEnd(50);
        const type = (pool.type || '').padEnd(15);
        const phase = (pool.phase || '').padEnd(12);
        const nodeNum = (pool.nodeNum?.toString() || '0').padEnd(8);
        const createdBy = (pool.createdBy || '').padEnd(20);
        console.log(`${name} ${type} ${phase} ${nodeNum} ${createdBy} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}`);
        
        // Second row: Pool ID
        const id = (pool.resourcePoolId || '').padEnd(50);
        console.log(`${id} ${' '.repeat(15)} ${' '.repeat(12)} ${' '.repeat(8)} ${' '.repeat(20)} ${' '.repeat(19)} ${' '.repeat(19)}`);
        console.log('');
      });

      // Show pagination info if applicable
      const pageSize = args.pageSize || 10;
      if (pools.totalCount > pageSize) {
        const totalPages = Math.ceil(pools.totalCount / pageSize);
        console.log('');
        console.log(`📄 Page ${args.pageNumber || 1} of ${totalPages} (${pools.totalCount} total resource pools)`);
        console.log(`   Use --pageNumber to navigate through pages`);
      }

    } catch (error) {
      console.error('❌ Error fetching resource pools:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },
};
