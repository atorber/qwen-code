/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'qwen aihc job list' command
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { bceSdk } from '@qwen-code/qwen-code-core';

interface JobListArgs {
  resourcePoolId?: string;
  queueID?: string;
  queue?: string;
  status?: string;
  keywordType?: 'name' | 'queueName';
  keyword?: string;
  orderBy?: 'createdAt' | 'finishedAt';
  order?: 'asc' | 'desc';
  pageNumber?: number;
  pageSize?: number;
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List AIHC training jobs',
  builder: (yargs: Argv) =>
    yargs
      .option('resourcePoolId', {
        alias: 'r',
        type: 'string',
        demandOption: true,
        description: 'Resource pool ID (required)',
      })
      .option('queueID', {
        type: 'string',
        description: 'Queue ID (for dedicated resource pools)',
      })
      .option('queue', {
        alias: 'q',
        type: 'string',
        description: 'Queue name or ID',
      })
      .option('status', {
        type: 'string',
        description: 'Filter by job status',
      })
      .option('keywordType', {
        type: 'string',
        choices: ['name', 'queueName'],
        description: 'Keyword search type (name, queueName)',
      })
      .option('keyword', {
        alias: 'k',
        type: 'string',
        description: 'Search keyword',
      })
      .option('orderBy', {
        type: 'string',
        choices: ['createdAt', 'finishedAt'],
        default: 'createdAt',
        description: 'Order by field (default: createdAt)',
      })
      .option('order', {
        type: 'string',
        choices: ['asc', 'desc'],
        default: 'desc',
        description: 'Order direction (default: desc)',
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
  handler: async (args: ArgumentsCamelCase<JobListArgs>) => {
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

      console.log('🔍 Fetching AIHC training jobs...');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Resource Pool: ${args.resourcePoolId}`);
      console.log(`   Page: ${args.pageNumber || 1}, Size: ${args.pageSize || 10}`);
      console.log(`   Order: ${args.orderBy || 'createdAt'} ${args.order || 'desc'}`);
      if (args.queue) {
        console.log(`   Queue: ${args.queue}`);
      }
      if (args.status) {
        console.log(`   Status: ${args.status}`);
      }
      if (args.keyword) {
        console.log(`   Keyword: ${args.keyword} (${args.keywordType || 'name'})`);
      }
      console.log('');

      // Prepare query parameters (for URL)
      const queryParams: Record<string, string> = {
        action: 'DescribeJobs',
        resourcePoolId: args.resourcePoolId,
      };
      if (args.queueID) {
        queryParams['queueID'] = args.queueID;
      }

      // Prepare body parameters (for POST body)
      const bodyParams: Record<string, any> = {
        pageNumber: args.pageNumber || 1,
        pageSize: args.pageSize || 10,
        orderBy: args.orderBy || 'createdAt',
        order: args.order || 'desc',
      };
      if (args.queue) {
        bodyParams['queue'] = args.queue;
      }
      if (args.status) {
        bodyParams['status'] = args.status;
      }
      if (args.keywordType) {
        bodyParams['keywordType'] = args.keywordType;
      }
      if (args.keyword) {
        bodyParams['keyword'] = args.keyword;
      }

      console.log('🔍 Making request to AIHC API...');

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
      const jobs = responseData;

      // Display results
      console.log('✅ Training jobs retrieved successfully!');
      console.log(`   Total count: ${jobs.totalCount || 0}`);
      console.log('');

      if (!jobs.jobs || jobs.jobs.length === 0) {
        console.log('📭 No training jobs found.');
        return;
      }

      // Format and display training jobs
      console.log('📊 Training Job List:');
      console.log('┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ Job ID                    │ Name                                        │ Status      │ Type      │ Priority │ Replicas │ Queue               │ Created              │ Finished             │');
      console.log('├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤');

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
        
        console.log(`│ ${jobId} │ ${name} │ ${status} │ ${jobType} │ ${priority} │ ${replicas} │ ${queueId} │ ${createdAt.padEnd(19)} │ ${finishedAt.padEnd(19)} │`);
      });

      console.log('└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘');

      // Show pagination info if applicable
      const pageSize = args.pageSize || 10;
      if (jobs.totalCount > pageSize) {
        const totalPages = Math.ceil(jobs.totalCount / pageSize);
        console.log('');
        console.log(`📄 Page ${args.pageNumber || 1} of ${totalPages} (${jobs.totalCount} total jobs)`);
        console.log(`   Use --pageNumber to navigate through pages`);
      }

    } catch (error) {
      console.error('❌ Error fetching training jobs:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },
};
