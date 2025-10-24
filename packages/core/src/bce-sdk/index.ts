/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-restricted-syntax */
// Use createRequire to load CommonJS version of the SDK to avoid ESM issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BceBaseClient } = require('@atorber/baiducloud-sdk');
import { Config } from '../config/config.js';

export interface BceConfig {
  endpoint: string;
  credentials: {
    ak: string;
    sk: string;
  };
}

export async function bceSdk(query: any, req: any, config: Config) {
  try {
    // 从配置文件中获取百度云配置
    const baiduCloudConfig = config.getBaiduCloudConfig();
    const bceConfig: BceConfig = {
      endpoint: baiduCloudConfig.endpoint,
      credentials: {
        ak: baiduCloudConfig.accessKey,
        sk: baiduCloudConfig.secretKey,
      },
    };

    const client = new BceBaseClient(bceConfig as any, 'aihc');

    const params = query;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      version: 'v2',
    };

    // Debug: log request details
    console.log('📤 BCE SDK Request:', {
      action: query.action,
      method: req.method || 'GET',
      params,
      headers,
    });

    const actions = {
      pool: [
        'DescribeResourcePools',
        'DescribeResourcePool',
        'DescribeResourcePoolConfiguration',
        'DescribeResourcePoolOverview',
      ],
      queue: ['DescribeQueues', 'DeleteQueue'],
      job: [
        'DescribeJobs',
        'CreateJob',
        'DeleteJob',
        'DescribeJob',
        'ModifyJob',
        'DescribeJobEvents',
        'DescribeJobLogs',
        'DescribePodEvents',
        'StopJob',
        'DescribeJobMetrics',
        'DescribeJobNodes',
        'DescribeJobWebterminal',
      ],
      service: [
        'DescribeServices',
        'DescribeService',
        'CreateService',
        'DeleteService',
        'ModifyService',
      ],
      dataset: [
        'DescribeDatasets',
        'DescribeDataset',
        'CreateDataset',
        'DeleteDataset',
        'ModifyDataset',
      ],
      model: [
        'DescribeModels',
        'DescribeModel',
        'CreateModel',
        'DeleteModel',
        'ModifyModel',
      ],
      dev: [
        'DescribeDevInstances',
        'DescribeDevInstance',
        'CreateDevInstance',
        'DeleteDevInstance',
        'ModifyDevInstance',
        'StartDevInstance',
        'StopDevInstance',
      ],
    };

    const action = query.action;

    // 只有 Job 相关接口使用 X-API-Version: v2，其他接口都使用 version: v2
    if (actions.job.includes(action)) {
      headers['X-API-Version'] = 'v2';
      delete headers['version'];
    }
    // 其他接口（service、queue、pool、dataset、model、dev）都保持默认的 version: v2

    if (req.method === 'POST') {
      const response = await client.sendRequest(req.method, '/', {
        params,
        config: {},
        headers,
        body: JSON.stringify(req.body) || null,
      });
      return response;
    } else {
      const response = await client.sendRequest(req.method, '/', {
        params,
        config: {},
        headers,
      });
      return response;
    }
  } catch (error) {
    console.error('Baidu Cloud API Error Details:', {
      errorType: error?.constructor?.name,
      errorMessage: (error as any)?.message,
      errorStack: (error as any)?.stack,
      errorCode: (error as any)?.code,
      errorStatus: (error as any)?.status,
      errorResponse: (error as any)?.response,
      fullError: error,
    });
    return error;
  }
}

export async function describeServices(config: Config) {
  return bceSdk(
    {
      action: 'DescribeServices',
      pageSize:100
    },
    {
      method: 'GET',
    },
    config,
  );
}

export async function describeService(serviceId: string, config: Config) {
  return bceSdk(
    {
      action: 'DescribeService',
      serviceId,
    },
    {
      method: 'GET',
    },
    config,
  );
}
