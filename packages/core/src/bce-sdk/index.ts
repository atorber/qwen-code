/* eslint-disable @typescript-eslint/no-explicit-any */
import { BceBaseClient } from '@atorber/baiducloud-sdk';
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
    
    // 打印配置信息用于调试
    console.log('Baidu Cloud Config:', {
      endpoint: bceConfig.endpoint,
      ak: bceConfig.credentials.ak ? `${bceConfig.credentials.ak.substring(0, 8)}...` : 'undefined',
      sk: bceConfig.credentials.sk ? `${bceConfig.credentials.sk.substring(0, 8)}...` : 'undefined'
    });
    
    console.log('Request details:', {
      query,
      method: req.method,
      body: req.body
    });
    
    const client = new BceBaseClient(bceConfig as any, 'aihc');

    const params = query;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      version: 'v2',
    };

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
    };

    const action = query.action;

    if (actions.job.includes(action)) {
      headers['X-API-Version'] = 'v2';
      delete headers['version'];
    } else if (actions.service.includes(action)) {
      // 服务相关操作使用 v2 版本，根据官方文档
      headers['X-API-Version'] = 'v2';
      delete headers['version'];
    }

    if (req.method === 'POST') {
      console.log('Sending POST request with headers:', headers);
      const response = await client.sendRequest(req.method, '/', {
        params,
        config: {},
        headers,
        body: JSON.stringify(req.body) || null,
      });
      console.log('POST response received:', response);
      return response;
    } else {
      console.log('Sending GET request with headers:', headers);
      const response = await client.sendRequest(req.method, '/', {
        params,
        config: {},
        headers,
      });
      console.log('GET response received:', response);
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
      fullError: error
    });
    return error;
  }
}
