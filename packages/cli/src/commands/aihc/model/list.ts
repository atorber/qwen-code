/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc model list' command
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { bceSdk } from '@qwen-code/qwen-code-core';

interface ModelListArgs {
  pageNumber?: number;
  pageSize?: number;
  keyword?: string;
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List AIHC models',
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
        description: 'Search keyword for model name',
      })
      .version(false),
  handler: async (args: ArgumentsCamelCase<ModelListArgs>) => {
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

      console.log('🔍 Fetching AIHC models...');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Page: ${args.pageNumber || 1}, Size: ${args.pageSize || 10}`);
      if (args.keyword) console.log(`   Keyword: ${args.keyword}`);
      console.log('');

      // Prepare request parameters
      const params: Record<string, string> = {
        action: 'DescribeModels',
        pageNumber: (args.pageNumber || 1).toString(),
        pageSize: (args.pageSize || 10).toString(),
      };

      // Add optional parameters
      if (args.keyword) params['keyword'] = args.keyword;

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
      const models = responseData;

      // Display results
      console.log('✅ Models retrieved successfully!');
      console.log(`   Total count: ${models.totalCount || 0}`);
      console.log('');

      if (!models.models || models.models.length === 0) {
        console.log('📭 No models found.');
        return;
      }

      // Format and display models (dual-row format without borders)
      console.log('📊 Model List:');
      console.log('');
      console.log(`${'Name/ID'.padEnd(50)} ${'Format/Source'.padEnd(25)} ${'Owner'.padEnd(20)} ${'Visibility'.padEnd(15)} ${'Version'.padEnd(10)} ${'Created'.padEnd(19)} ${'Updated'.padEnd(19)}`);
      console.log('─'.repeat(165));

      models.models.forEach((model: any) => {
        const createdAt = model.createdAt ? new Date(model.createdAt).toLocaleString() : '';
        const updatedAt = model.updatedAt ? new Date(model.updatedAt).toLocaleString() : '';
        
        // First row: Name, Format, Owner, Visibility, Version, Created, Updated
        const name = (model.name || '').padEnd(50);
        const format = (model.modelFormat || '').padEnd(25);
        const owner = (model.ownerName || '').padEnd(20);
        const visibility = (model.visibilityScope || '').padEnd(15);
        const version = (model.latestVersion || '').padEnd(10);
        console.log(`${name} ${format} ${owner} ${visibility} ${version} ${createdAt.padEnd(19)} ${updatedAt.padEnd(19)}`);
        
        // Second row: ID, Source
        const id = (model.id || '').padEnd(50);
        const source = (model.initSource || '').padEnd(25);
        console.log(`${id} ${source} ${' '.repeat(20)} ${' '.repeat(15)} ${' '.repeat(10)} ${' '.repeat(19)} ${' '.repeat(19)}`);
        console.log('');
      });

      // Show pagination info if applicable
      const pageSize = args.pageSize || 10;
      if (models.totalCount > pageSize) {
        const totalPages = Math.ceil(models.totalCount / pageSize);
        console.log('');
        console.log(`📄 Page ${args.pageNumber || 1} of ${totalPages} (${models.totalCount} total models)`);
        console.log(`   Use --pageNumber to navigate through pages`);
      }

    } catch (error) {
      console.error('❌ Error fetching models:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },
};

