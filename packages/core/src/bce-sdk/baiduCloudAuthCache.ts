/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { promises as fs, unlinkSync } from 'node:fs';
import * as os from 'os';
// 导入bceSdk
import { bceSdk, describeService } from './index.js';
import { console } from 'node:inspector';

// 文件系统配置
const QWEN_DIR = '.qwen';
const BAIDU_CLOUD_CREDENTIAL_FILENAME = 'baidu_cloud_creds.json';
const BAIDU_CLOUD_LOCK_FILENAME = 'baidu_cloud_creds.lock';

// 认证缓存配置
const AUTH_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24小时

export interface ServiceInfo {
  status: {
    accessIPs: {
      internal: string;
      external: string;
    };
    accessPorts: Array<{
      containerPort: number;
      servicePort: number;
      name: string;
    }>;
    briefStat: {
      status: number;
    };
  };
}

// 推理服务模型 - 根据百度云官方文档定义
interface InferenceService {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  networkType: string;
  publicAccess?: boolean;
  queueName: string;
  region: string;
  resourcePoolId: string;
  resourcePoolName: string;
  resourcePoolType?: string;
  creator?: string;
  hpa?: {
    metricBased?: {
      scaleIndicators?: Record<string, unknown>;
    };
  };
  resourceSpec: {
    acceleratorCount?: number;
    acceleratorType?: string;
    cpus: number;
    memory: number;
  };
  config: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  serviceInfo: ServiceInfo;
  status: number;
}

// 服务列表响应模型 - 根据百度云官方文档定义
export interface ServiceListResponse {
  services: InferenceService[];
  totalCount: number;
  requestId: string;
  pageNumber: number;
  pageSize: number;
  orderBy: string;
  order: string;
}

export interface BaiduCloudCredentials {
  accessKey: string;
  secretKey: string;
  endpoint: string;
  region?: string;
  serviceId?: string;
  serviceName?: string;
  modelName?: string;
  // 新增配置信息
  serviceConfig?: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  authenticated: boolean;
  lastLoginTime: number;
  expiresAt: number;
}

export interface BaiduCloudAuthCache {
  credentials: BaiduCloudCredentials | null;
  fileModTime: number;
}

export class BaiduCloudAuthCacheManager {
  private static instance: BaiduCloudAuthCacheManager | null = null;
  private memoryCache: BaiduCloudAuthCache = {
    credentials: null,
    fileModTime: 0,
  };
  private cleanupHandlersRegistered = false;

  private constructor() {
    this.registerCleanupHandlers();
  }

  static getInstance(): BaiduCloudAuthCacheManager {
    if (!BaiduCloudAuthCacheManager.instance) {
      BaiduCloudAuthCacheManager.instance = new BaiduCloudAuthCacheManager();
    }
    return BaiduCloudAuthCacheManager.instance;
  }

  /**
   * 注册清理处理器
   */
  private registerCleanupHandlers(): void {
    if (this.cleanupHandlersRegistered) {
      return;
    }

    // 进程退出时清理
    process.on('exit', () => {
      this.clearLock();
    });

    process.on('SIGINT', () => {
      this.clearLock();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.clearLock();
      process.exit(0);
    });

    this.cleanupHandlersRegistered = true;
  }

  /**
   * 获取认证文件路径
   */
  private getCredentialFilePath(): string {
    return path.join(os.homedir(), QWEN_DIR, BAIDU_CLOUD_CREDENTIAL_FILENAME);
  }

  /**
   * 获取锁文件路径
   */
  private getLockFilePath(): string {
    return path.join(os.homedir(), QWEN_DIR, BAIDU_CLOUD_LOCK_FILENAME);
  }

  /**
   * 检查认证是否有效
   */
  private isAuthValid(credentials: BaiduCloudCredentials): boolean {
    const now = Date.now();
    return (
      credentials.authenticated === true &&
      Boolean(credentials.accessKey) &&
      Boolean(credentials.secretKey) &&
      Boolean(credentials.endpoint) &&
      now < credentials.expiresAt
    );
  }

  /**
   * 获取有效的认证信息
   */
  async getValidCredentials(): Promise<BaiduCloudCredentials | null> {
    try {
      // 检查文件是否被其他进程更新
      await this.checkAndReloadIfNeeded();

      // 如果内存中有有效凭证，直接返回
      if (
        this.memoryCache.credentials &&
        this.isAuthValid(this.memoryCache.credentials)
      ) {
        console.log('✅ 从内存缓存获取有效的百度云认证信息');
        return this.memoryCache.credentials;
      }

      // 尝试从文件加载
      await this.loadCredentialsFromFile();

      if (
        this.memoryCache.credentials &&
        this.isAuthValid(this.memoryCache.credentials)
      ) {
        console.log('✅ 从文件缓存获取有效的百度云认证信息');
        return this.memoryCache.credentials;
      }

      console.log('❌ 没有找到有效的百度云认证信息');
      return null;
    } catch (_error) {
      console.error('❌ 获取百度云认证信息失败:', _error);
      return null;
    }
  }

  /**
   * 保存认证信息
   */
  async saveCredentials(
    credentials: Omit<BaiduCloudCredentials, 'expiresAt'>,
  ): Promise<void> {
    try {
      const now = Date.now();
      const fullCredentials: BaiduCloudCredentials = {
        ...credentials,
        expiresAt: now + AUTH_CACHE_DURATION_MS,
      };

      // 更新内存缓存
      this.memoryCache.credentials = fullCredentials;
      this.memoryCache.fileModTime = now;

      // 保存到文件
      await this.saveCredentialsToFile(fullCredentials);

      console.log('✅ 百度云认证信息已保存到缓存');
    } catch (error) {
      console.error('❌ 保存百度云认证信息失败:', error);
      throw error;
    }
  }

  /**
   * 清除认证信息
   */
  async clearCredentials(): Promise<void> {
    try {
      // 清除内存缓存
      this.memoryCache.credentials = null;
      this.memoryCache.fileModTime = 0;

      // 删除文件
      const filePath = this.getCredentialFilePath();
      try {
        await fs.unlink(filePath);
        console.log('✅ 百度云认证文件已删除');
      } catch (_error) {
        // 文件可能不存在，忽略错误
        console.log('ℹ️ 认证文件不存在，无需删除');
      }

      console.log('✅ 百度云认证信息已清除');
    } catch (error) {
      console.error('❌ 清除百度云认证信息失败:', error);
      throw error;
    }
  }

  /**
   * 检查并重新加载文件（如果被其他进程更新）
   */
  private async checkAndReloadIfNeeded(): Promise<void> {
    try {
      const filePath = this.getCredentialFilePath();
      const stats = await fs.stat(filePath);
      const fileModTime = stats.mtime.getTime();

      if (fileModTime > this.memoryCache.fileModTime) {
        console.log('🔄 检测到认证文件更新，重新加载');
        await this.loadCredentialsFromFile();
      }
    } catch (_error) {
      // 文件可能不存在，忽略错误
      console.log('ℹ️ 认证文件不存在或无法访问');
    }
  }

  /**
   * 从文件加载认证信息
   */
  private async loadCredentialsFromFile(): Promise<void> {
    try {
      const filePath = this.getCredentialFilePath();
      const content = await fs.readFile(filePath, 'utf-8');
      const credentials = JSON.parse(content) as BaiduCloudCredentials;

      // 验证凭证格式
      if (!this.validateCredentials(credentials)) {
        throw new Error('Invalid credentials format');
      }

      this.memoryCache.credentials = credentials;
      this.memoryCache.fileModTime = Date.now();
    } catch (_error) {
      console.log('ℹ️ 无法从文件加载认证信息:', _error);
      this.memoryCache.credentials = null;
      this.memoryCache.fileModTime = 0;
    }
  }

  /**
   * 保存认证信息到文件
   */
  private async saveCredentialsToFile(
    credentials: BaiduCloudCredentials,
  ): Promise<void> {
    const filePath = this.getCredentialFilePath();
    const dirPath = path.dirname(filePath);

    // 确保目录存在
    await fs.mkdir(dirPath, { recursive: true });

    // 保存文件
    const content = JSON.stringify(credentials, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 验证凭证格式
   */
  private validateCredentials(
    credentials: unknown,
  ): credentials is BaiduCloudCredentials {
    if (!credentials || typeof credentials !== 'object') {
      return false;
    }

    const creds = credentials as BaiduCloudCredentials;

    return (
      typeof creds.accessKey === 'string' &&
      typeof creds.secretKey === 'string' &&
      typeof creds.endpoint === 'string' &&
      typeof creds.authenticated === 'boolean' &&
      typeof creds.lastLoginTime === 'number' &&
      typeof creds.expiresAt === 'number'
    );
  }

  /**
   * 清除锁文件
   */
  private clearLock(): void {
    try {
      const lockPath = this.getLockFilePath();
      unlinkSync(lockPath);
    } catch (_error) {
      // 锁文件可能不存在，忽略错误
    }
  }

  /**
   * 获取认证状态信息
   */
  getAuthStatus(): {
    isAuthenticated: boolean;
    hasValidCredentials: boolean;
    expiresAt: number | null;
    timeUntilExpiry: number | null;
  } {
    const credentials = this.memoryCache.credentials;
    const now = Date.now();

    return {
      isAuthenticated: credentials?.authenticated === true,
      hasValidCredentials: credentials ? this.isAuthValid(credentials) : false,
      expiresAt: credentials?.expiresAt || null,
      timeUntilExpiry: credentials
        ? Math.max(0, credentials.expiresAt - now)
        : null,
    };
  }
}

/**
 * 获取百度云认证缓存管理器实例
 */
export function getBaiduCloudAuthCacheManager(): BaiduCloudAuthCacheManager {
  return BaiduCloudAuthCacheManager.getInstance();
}

/**
 * 验证百度云认证
 * 通过调用 DescribeServices API 来验证 AK/SK 是否有效
 */
export async function validateBaiduCloudAuth(
  accessKey: string,
  secretKey: string,
  endpoint: string,
): Promise<ServiceListResponse> {
  // 创建临时配置对象
  const tempConfig = {
    getBaiduCloudConfig: () => ({
      accessKey,
      secretKey,
      endpoint,
      region: 'bj',
    }),
  };

  // 构建查询参数
  const query = {
    action: 'DescribeServices',
    pageNumber: 1,
    pageSize: 100,
    orderBy: 'createdAt',
    order: 'desc',
  };

  const req = {
    method: 'GET',
    body: null,
  };

  const response = await bceSdk(query, req, tempConfig as any);

  // 详细打印响应信息用于调试
  console.log('Baidu Cloud API Response:', JSON.stringify(response, null, 2));

  if (response && typeof response === 'object' && 'body' in response) {
    const body = (response as { body: ServiceListResponse }).body;
    console.log('请求服务列表Response body:', JSON.stringify(body, null, 2));

    // 验证响应格式是否符合官方文档
    if (
      body &&
      Array.isArray(body.services) &&
      typeof body.totalCount === 'number' &&
      typeof body.requestId === 'string' &&
      typeof body.pageNumber === 'number' &&
      typeof body.pageSize === 'number'
    ) {
      // service中增加config信息，这里是暂时的固定赋值，修改代码时不要动，直到后端可以支持为止
      body.services.forEach(async (service) => {
        try {
          const res = await describeService(service.id, tempConfig as any);
          const serviceInfo: ServiceInfo = (res as any).body;
          service.serviceInfo = serviceInfo;
          service.status = serviceInfo.status.briefStat.status;

          let baseUrl = `http://${serviceInfo.status.accessIPs.internal}:${serviceInfo.status.accessPorts.filter((item: any) => item.name === 'HTTP')[0].servicePort}`;

          if (service.networkType === 'aiGateway') {
            baseUrl = `http://${serviceInfo.status.accessIPs.internal}/auth/${service.id}/${serviceInfo.status.accessPorts.filter((item: any) => item.name === 'HTTP')[0].servicePort}`;
          }
          service.config = {
            apiKey:'',
            baseUrl,
            model: service.name,
          };
        } catch (error) {
          service.status = 0;
          console.error('获取服务详情失败：', error);
          return;
        }
      });

      console.info('获取服务详情成功：', body);

      // 只保留运行中状态的服务
      // const services = body.services;
      // const servicesRunning = [];
      // for (const service of services) {
      //   console.info('服务详情：', service);
      //   if (service.status) {
      //     servicesRunning.push(service);
      //   }
      // }
      // body.services = servicesRunning;

      return body;
    } else {
      console.error('Invalid response format. Expected fields:', {
        hasServices: Array.isArray(body?.services),
        hasTotalCount: typeof body?.totalCount === 'number',
        hasRequestId: typeof body?.requestId === 'string',
        hasPageNumber: typeof body?.pageNumber === 'number',
        hasPageSize: typeof body?.pageSize === 'number',
        actualBody: body,
      });
      throw new Error('Invalid response format from Baidu Cloud API');
    }
  }

  console.error('No response body received. Full response:', response);
  throw new Error('Failed to connect to Baidu Cloud API');
}

/**
 * 清除百度云认证缓存
 */
export async function clearBaiduCloudAuthCache(): Promise<void> {
  const manager = getBaiduCloudAuthCacheManager();
  await manager.clearCredentials();
}
