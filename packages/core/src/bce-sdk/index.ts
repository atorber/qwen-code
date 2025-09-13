/**
 * Copyright (c) 2014 Baidu.com, Inc. All Rights Reserved
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * @file src/aihc_client.ts
 * @author atorber
 */

// 导入模块
import * as u from 'underscore';
import { BceBaseClient } from '@atorber/baiducloud-sdk';
import type { BceConfig, BceResponse } from '@atorber/baiducloud-sdk';

// 正确定义 debug 函数
function debug(...args: unknown[]): void {
  if (process.env['DEBUG']) {
    console.log('[DEBUG]', ...args);
  }
}

// ==================== 类型定义 ====================

/** 资源池配置 */
interface ResourcePool {
  id: string;
  name: string;
  description?: string;
  status: string;
  createTime: string;
}

/** 节点信息 */
interface NodeInfo {
  id: string;
  name: string;
  status: string;
  // 可以根据实际需要添加更多字段
}

/** 队列配置 */
interface Queue {
  name: string;
  description?: string;
  deserved: {
    cpu: number;
    memory: number;
  };
  parentQueue: string;
  queueType: 'Regular' | 'Preemptible';
  disableOversell?: boolean;
}

/** AI 任务配置 */
interface AIJob {
  jobId?: string;
  name: string;
  description?: string;
  queue: string;
  framework: string;
  image: string;
  command: string[];
  workingDir?: string;
  env?: Record<string, string>;
  resources: {
    cpu: number;
    memory: number;
    gpu?: number;
  };
}

/** 客户端选项 */
interface AihcClientOptions {
  maxKeys?: number;
  marker?: string;
  config?: Partial<BceConfig>;
}

/**
 * AIHC service API client
 *
 * @see https://cloud.baidu.com/doc/AIHC/s/dly5i8vfs
 */
export default class AihcClient extends BceBaseClient {
  /**
   * 构造函数
   * @param config AIHC 客户端配置
   */
  constructor(config: BceConfig) {
    super(config, 'aihc', true);
  }

  // --- 资源池管理 ---

  /**
   * 获取资源池列表
   * 
   * @param options 选项
   * @returns Promise 解析为资源池列表
   */
  async listResourcePools(options?: AihcClientOptions): Promise<BceResponse<{ resourcePools: ResourcePool[] }>> {
    const opts = options || {};
    const params = { maxKeys: 1000, ...u.pick(opts, 'maxKeys', 'marker') };

    return this.sendRequest('GET', '/api/v1/resourcepools', {
      params,
      config: opts.config
    });
  }

  /**
   * 获取资源池详情
   * 
   * @param resourcePoolId 资源池ID
   * @param options 选项
   * @returns Promise 解析为资源池详情
   */
  async getResourcePool(resourcePoolId: string, options?: AihcClientOptions): Promise<BceResponse<ResourcePool>> {
    const opts = options || {};

    return this.sendRequest('GET', `/api/v1/resourcepools/${resourcePoolId}`, {
      config: opts.config
    });
  }

  /**
   * 获取资源池节点列表
   * 
   * @param resourcePoolId 资源池ID
   * @param options 选项
   * @returns Promise 解析为节点列表
   */
  async listResourcePoolNodes(resourcePoolId: string, options?: AihcClientOptions): Promise<BceResponse<{ nodes: NodeInfo[] }>> {
    const opts = options || {};
    const params = { maxKeys: 1000, ...u.pick(opts, 'maxKeys', 'marker') };

    return this.sendRequest('GET', `/api/v1/resourcepools/${resourcePoolId}/nodes`, {
      params,
      config: opts.config
    });
  }

  // --- 队列管理 ---

  /**
   * 获取队列列表
   * 
   * @param resourcePoolId 资源池ID
   * @param options 选项
   * @returns Promise 解析为队列列表
   */
  async listResourcePoolQueues(resourcePoolId: string, options?: AihcClientOptions): Promise<BceResponse<{ queues: Queue[] }>> {
    const opts = options || {};
    const params = { maxKeys: 1000, ...u.pick(opts, 'maxKeys', 'marker') };

    return this.sendRequest('GET', `/api/v1/resourcepools/${resourcePoolId}/queue`, {
      params,
      config: opts.config
    });
  }

  /**
   * 获取队列详情
   * 
   * @param resourcePoolId 资源池ID
   * @param queueName 队列名称
   * @param options 选项
   * @returns Promise 解析为队列详情
   */
  async getResourcepoolQueue(resourcePoolId: string, queueName: string, options?: AihcClientOptions): Promise<BceResponse<Queue>> {
    const opts = options || {};

    return this.sendRequest('GET', `/api/v1/resourcepools/${resourcePoolId}/queue/${queueName}`, {
      config: opts.config
    });
  }

  /**
   * 删除队列
   * 
   * @param resourcePoolId 资源池ID
   * @param queueName 队列名称
   * @param options 选项
   * @returns Promise 解析为删除结果
   */
  async deleteResourcepoolQueue(resourcePoolId: string, queueName: string, options?: AihcClientOptions): Promise<BceResponse<void>> {
    const opts = options || {};

    return this.sendRequest('DELETE', `/api/v1/resourcepools/${resourcePoolId}/queue/${queueName}`, {
      config: opts.config
    });
  }

  /**
   * 创建队列
   * 
   * @param resourcePoolId 资源池ID
   * @param queueConfig 队列配置
   * @param options 选项
   * @returns Promise 解析为创建结果
   */
  async createResourcepoolQueue(resourcePoolId: string, queueConfig: Queue, options?: AihcClientOptions): Promise<BceResponse<Queue>> {
    // 移除未使用的变量
    // const clientToken = await this.getClientToken();
    const opts = options || {};

    debug('createResourcepoolQueue, queueConfig = %j', queueConfig);

    return this.sendRequest('POST', `/api/v1/resourcepools/${resourcePoolId}/queue`, {
      config: opts.config,
      body: JSON.stringify(queueConfig)
    });
  }

  /**
   * 更新队列
   * 
   * @param resourcePoolId 资源池ID
   * @param queueName 队列名称
   * @param queueConfig 队列配置
   * @param options 选项
   * @returns Promise 解析为更新结果
   */
  async updateResourcepoolQueue(
    resourcePoolId: string,
    queueName: string,
    queueConfig: Partial<Queue>,
    options?: AihcClientOptions
  ): Promise<BceResponse<Queue>> {
    const opts = options || {};

    return this.sendRequest('PUT', `/api/v1/resourcepools/${resourcePoolId}/queue/${queueName}`, {
      config: opts.config,
      body: JSON.stringify(queueConfig)
    });
  }

  // --- AI 任务管理 ---

  /**
   * 创建 AI 训练任务
   * 
   * @param resourcePoolId 资源池ID
   * @param jobConfig 任务配置
   * @param options 选项
   * @returns Promise 解析为创建结果
   */
  async createAIJob(resourcePoolId: string, jobConfig: AIJob, options?: AihcClientOptions): Promise<BceResponse<AIJob>> {
    const opts = options || {};

    const params = {
      resourcePoolId
    };

    debug('createAIJob, params = %j, jobConfig = %j', params, jobConfig);

    return this.sendRequest('POST', '/api/v1/aijobs', {
      config: opts.config,
      params,
      body: JSON.stringify(jobConfig)
    });
  }

  /**
   * 获取 AI 训练任务列表
   * 
   * @param resourcePoolId 资源池ID
   * @param options 选项
   * @returns Promise 解析为任务列表
   */
  async listAIJobs(resourcePoolId: string, options?: AihcClientOptions): Promise<BceResponse<{ jobs: AIJob[] }>> {
    const opts = options || {};
    const params = {
      resourcePoolId,
    };
    
    debug('listAIJobs, params = %j', params);
    debug('listAIJobs, config = %j', opts.config);
    
    return this.sendRequest('GET', '/api/v1/aijobs', {
      params,
      config: opts.config
    });
  }

  /**
   * 获取 AI 训练任务详情
   * 
   * @param resourcePoolId 资源池ID
   * @param jobId 任务ID
   * @param options 选项
   * @returns Promise 解析为任务详情
   */
  async getAIJob(resourcePoolId: string, jobId: string, options?: AihcClientOptions): Promise<BceResponse<AIJob>> {
    const opts = options || {};
    const params = {
      resourcePoolId,
    };
    
    debug('getAIJob, params = %j', params);
    debug('getAIJob, config = %j', opts.config);
    
    return this.sendRequest('GET', `/api/v1/aijobs/${jobId}`, {
      params,
      config: opts.config
    });
  }

  // --- 辅助方法 ---

}
