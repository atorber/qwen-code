/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL, DEFAULT_QWEN_MODEL } from '../config/models.js';
import { Config } from '../config/config.js';

import { UserTierId } from '../code_assist/types.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { getInstallationId } from '../utils/user_id.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai',
  QWEN_OAUTH = 'qwen-oauth',
  BAIDU_CLOUD = 'baidu-cloud',
  AIHC = 'aihc',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  enableOpenAILogging?: boolean;
  // Timeout configuration in milliseconds
  timeout?: number;
  // Maximum retries for failed requests
  maxRetries?: number;
  // Disable cache control for DashScope providers
  disableCacheControl?: boolean;
  samplingParams?: {
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    temperature?: number;
    max_tokens?: number;
  };
  proxy?: string | undefined;
  userAgent?: string;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const geminiApiKey = process.env['GEMINI_API_KEY'] || undefined;
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined;
  const googleCloudProject = process.env['GOOGLE_CLOUD_PROJECT'] || undefined;
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined;

  // openai auth
  const openaiApiKey = process.env['OPENAI_API_KEY'] || undefined;
  const openaiBaseUrl = process.env['OPENAI_BASE_URL'] || undefined;
  const openaiModel = process.env['OPENAI_MODEL'] || undefined;

  // baidu cloud auth
  const baiduCloudAk = process.env['BAIDU_CLOUD_AK'] || undefined;
  const baiduCloudSk = process.env['BAIDU_CLOUD_SK'] || undefined;

  // aihc auth
  const aihcAk = process.env['AIHC_AK'] || undefined;
  const aihcSk = process.env['AIHC_SK'] || undefined;
  const aihcEndpoint = process.env['AIHC_ENDPOINT'] || undefined;

  // Use runtime model from config if available; otherwise, fall back to parameter or default
  const effectiveModel = config.getModel() || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    proxy: config?.getProxy(),
    enableOpenAILogging: config.getEnableOpenAILogging(),
    timeout: config.getContentGeneratorTimeout(),
    maxRetries: config.getContentGeneratorMaxRetries(),
    disableCacheControl: config.getContentGeneratorDisableCacheControl(),
    samplingParams: config.getContentGeneratorSamplingParams(),
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_OPENAI && openaiApiKey) {
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.baseUrl = openaiBaseUrl;
    contentGeneratorConfig.model = openaiModel || DEFAULT_QWEN_MODEL;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.QWEN_OAUTH) {
    // For Qwen OAuth, we'll handle the API key dynamically in createContentGenerator
    // Set a special marker to indicate this is Qwen OAuth
    contentGeneratorConfig.apiKey = 'QWEN_OAUTH_DYNAMIC_TOKEN';

    // Prefer to use qwen3-coder-plus as the default Qwen model if QWEN_MODEL is not set.
    contentGeneratorConfig.model =
      process.env['QWEN_MODEL'] || DEFAULT_QWEN_MODEL;

    return contentGeneratorConfig;
  }

  // 添加百度云认证支持
  if (authType === AuthType.BAIDU_CLOUD && baiduCloudAk && baiduCloudSk) {
    // 对于百度云认证，我们将使用AK作为apiKey，SK存储在环境变量中
    contentGeneratorConfig.apiKey = baiduCloudAk;
    contentGeneratorConfig.baseUrl = process.env['BAIDU_MODEL_ENDPOINT'] || 'https://aihc.bj.baidubce.com';
    
    // 优先使用从服务列表中选中的模型配置
    const baiduCloudApiKey = process.env['BAIDU_CLOUD_API_KEY'];
    const baiduCloudBaseUrl = process.env['BAIDU_CLOUD_BASE_URL'];
    const baiduCloudModel = process.env['BAIDU_CLOUD_SERVICE_MODEL'];
    
    // 添加调试日志
    console.log('🔍 百度云配置检查:', {
      baiduCloudApiKey: baiduCloudApiKey ? '已设置' : '未设置',
      baiduCloudBaseUrl: baiduCloudBaseUrl ? '已设置' : '未设置',
      baiduCloudModel: baiduCloudModel ? '已设置' : '未设置',
      baiduCloudAk: baiduCloudAk ? '已设置' : '未设置',
      baiduCloudSk: baiduCloudSk ? '已设置' : '未设置'
    });
    
    if (baiduCloudApiKey && baiduCloudBaseUrl && baiduCloudModel) {
      // 使用从服务列表中获取的配置信息
      contentGeneratorConfig.apiKey = baiduCloudApiKey;
      contentGeneratorConfig.baseUrl = baiduCloudBaseUrl;
      contentGeneratorConfig.model = baiduCloudModel;
    } else {
      // 回退到原有的配置方式
      // 使用选中的百度云模型或默认模型
      const selectedBaiduModel = config.getSelectedBaiduModel();
      contentGeneratorConfig.model = selectedBaiduModel || DEFAULT_QWEN_MODEL;
    }

    return contentGeneratorConfig;
  }

  // 添加AIHC认证支持
  if (authType === AuthType.AIHC) {
    console.log('🔍 AIHC认证检测到，authType:', authType);
    console.log('🔍 环境变量检查:', {
      aihcAk: aihcAk ? '已设置' : '未设置',
      aihcSk: aihcSk ? '已设置' : '未设置',
      aihcEndpoint: aihcEndpoint ? '已设置' : '未设置',
    });
    
    if (!aihcAk || !aihcSk || !aihcEndpoint) {
      throw new Error('AIHC_AK, AIHC_SK, and AIHC_ENDPOINT environment variables are required for AIHC authentication');
    }
    
    // AIHC认证使用简单的配置方式，不需要选择服务
    contentGeneratorConfig.apiKey = aihcAk;
    contentGeneratorConfig.baseUrl = aihcEndpoint;
    contentGeneratorConfig.model = process.env['AIHC_MODEL'] || DEFAULT_QWEN_MODEL;
    
    console.log('✅ AIHC配置已设置:', {
      apiKey: contentGeneratorConfig.apiKey ? '已设置' : '未设置',
      baseUrl: contentGeneratorConfig.baseUrl,
      model: contentGeneratorConfig.model,
      authType: contentGeneratorConfig.authType
    });

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  console.log('🔍 createContentGenerator 被调用');
  console.log('   config.authType:', config.authType);
  console.log('   config.apiKey:', config.apiKey ? '已设置' : '未设置');
  console.log('   config.baseUrl:', config.baseUrl);
  console.log('   config.model:', config.model);
  
  const version = process.env['CLI_VERSION'] || process.version;
  const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    const httpOptions = { headers: baseHeaders };
    return new LoggingContentGenerator(
      await createCodeAssistContentGenerator(
        httpOptions,
        config.authType,
        gcConfig,
        sessionId,
      ),
      gcConfig,
    );
  }

  // 百度云认证方式：获取认证信息后使用OpenAI内容生成器
  if (config.authType === AuthType.BAIDU_CLOUD) {
    // 确保必要的认证信息存在
    if (!config.apiKey) {
      throw new Error('Baidu Cloud API key is required');
    }

    // 使用OpenAI内容生成器处理百度云认证
    try {
      // Import OpenAIContentGenerator dynamically to avoid circular dependencies
      const { createOpenAIContentGenerator } = await import(
        './openaiContentGenerator/index.js'
      );

      // Always use OpenAIContentGenerator, logging is controlled by enableOpenAILogging flag
      return createOpenAIContentGenerator(config, gcConfig);
    } catch (error) {
      throw new Error(
        `Failed to initialize OpenAI Content Generator for Baidu Cloud: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // AIHC认证方式：使用OpenAI内容生成器
  if (config.authType === AuthType.AIHC) {
    // 确保必要的认证信息存在
    if (!config.apiKey) {
      throw new Error('AIHC API key is required');
    }

    // 使用OpenAI内容生成器处理AIHC认证
    try {
      // Import OpenAIContentGenerator dynamically to avoid circular dependencies
      const { createOpenAIContentGenerator } = await import(
        './openaiContentGenerator/index.js'
      );

      // Always use OpenAIContentGenerator, logging is controlled by enableOpenAILogging flag
      return createOpenAIContentGenerator(config, gcConfig);
    } catch (error) {
      throw new Error(
        `Failed to initialize OpenAI Content Generator for AIHC: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    let headers: Record<string, string> = { ...baseHeaders };
    if (gcConfig?.getUsageStatisticsEnabled()) {
      const installationId = getInstallationId();
      headers = {
        ...headers,
        'x-gemini-api-privileged-user-id': `${installationId}`,
      };
    }
    const httpOptions = { headers };

    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
  }

  if (config.authType === AuthType.USE_OPENAI) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );

    // Always use OpenAIContentGenerator, logging is controlled by enableOpenAILogging flag
    return createOpenAIContentGenerator(config, gcConfig);
  }

  if (config.authType === AuthType.QWEN_OAUTH) {
    // Import required classes dynamically
    const { getQwenOAuthClient: getQwenOauthClient } = await import(
      '../qwen/qwenOAuth2.js'
    );
    const { QwenContentGenerator } = await import(
      '../qwen/qwenContentGenerator.js'
    );

    try {
      // Get the Qwen OAuth client (now includes integrated token management)
      const qwenClient = await getQwenOauthClient(gcConfig);

      // Create the content generator with dynamic token management
      return new QwenContentGenerator(qwenClient, config, gcConfig);
    } catch (error) {
      throw new Error(
        `Failed to initialize Qwen: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
