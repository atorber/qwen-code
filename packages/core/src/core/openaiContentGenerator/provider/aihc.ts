/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenAICompatibleProvider } from './types.js';
import { ContentGeneratorConfig, AuthType } from '../../contentGenerator.js';
import { Config } from '../../../config/config.js';
import { BaiduCloudAuthMiddleware } from '../../../bce-sdk/baiduCloudAuthMiddleware.js';
import OpenAI from 'openai';

/**
 * Provider for AIHC (using Baidu Cloud AK/SK signature authentication)
 * AIHC uses BCE signature authentication, not simple API key
 */
export class AIHCOpenAICompatibleProvider implements OpenAICompatibleProvider {
  private contentGeneratorConfig: ContentGeneratorConfig;
  private cliConfig: Config;
  private authMiddleware: BaiduCloudAuthMiddleware;
  private ak: string;
  private sk: string;

  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    this.contentGeneratorConfig = contentGeneratorConfig;
    this.cliConfig = cliConfig;

    // Validate AK and SK exist
    this.ak = process.env['AIHC_AK'] || '';
    this.sk = process.env['AIHC_SK'] || '';

    if (!this.ak || !this.sk) {
      throw new Error('AIHC_AK and AIHC_SK are required for AIHC authentication');
    }

    // Initialize BCE authentication middleware
    this.authMiddleware = new BaiduCloudAuthMiddleware(this.ak, this.sk);
    
    console.log('🔍 AIHCProvider 初始化完成，使用 BCE 签名认证');
  }

  /**
   * Check if the provider is an AIHC provider
   */
  static isAIHCProvider(config: ContentGeneratorConfig): boolean {
    return config.authType === AuthType.AIHC;
  }

  /**
   * Build headers for AIHC requests (with BCE signature)
   */
  buildHeaders(): Record<string, string | undefined> {
    const version = this.cliConfig.getCliVersion() || 'unknown';
    const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;

    // Base headers - BCE signature will be added in fetch override
    return {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Build OpenAI client for AIHC with custom fetch that adds BCE signature
   */
  buildClient(): OpenAI {
    const baseUrl = this.contentGeneratorConfig.baseUrl || 'https://aihc.bj.baidubce.com';
    const timeout = this.contentGeneratorConfig.timeout;
    const maxRetries = this.contentGeneratorConfig.maxRetries;
    
    // Create custom fetch function that adds BCE signature
    const originalFetch = global.fetch;
    const authMiddleware = this.authMiddleware;
    
    const customFetch: typeof fetch = async (input, init?) => {
      const url = typeof input === 'string' 
        ? input 
        : input instanceof URL 
          ? input.toString() 
          : (input as Request).url;
      const method = init?.method || 'GET';
      const headers = new Headers(init?.headers || {});
      
      console.log('🔍 AIHC 请求:', { method, url });
      
      // Convert Headers to plain object
      const headersObj: Record<string, string> = {};
      headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      
      // Add BCE signature using auth middleware
      const signedHeaders = authMiddleware.addAuthHeaders(
        method,
        url,
        headersObj,
        {}
      );
      
      console.log('✅ BCE 签名已添加到请求头');
      
      // Create new headers with signature
      const signedHeadersObj = new Headers(init?.headers || {});
      Object.entries(signedHeaders).forEach(([key, value]) => {
        signedHeadersObj.set(key, value);
      });
      
      // Call original fetch with signed headers
      return originalFetch(input, {
        ...init,
        headers: signedHeadersObj,
      });
    };

    return new OpenAI({
      apiKey: 'aihc-no-auth', // Dummy key, actual auth is via signature
      baseURL: baseUrl,
      timeout,
      maxRetries,
      defaultHeaders: this.buildHeaders(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: customFetch as any, // Use custom fetch with BCE signature
    });
  }

  /**
   * Build request parameters for AIHC
   */
  buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    _userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    // Apply model override if configured
    const model = this.contentGeneratorConfig.model || request.model;

    console.log('🔍 AIHC buildRequest:', { model });

    return {
      ...request,
      model,
    };
  }
}

