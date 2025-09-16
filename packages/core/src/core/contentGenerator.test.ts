/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createContentGeneratorConfig,
  AuthType,
} from './contentGenerator.js';
// 移除未使用的导入
// import { Config } from '../config/config.js';
// import { createContentGenerator } from './contentGenerator.js';

// Mock the QwenOAuth2Client
vi.mock('../qwen/qwenOAuth2.js', () => {
  return {
    getQwenOAuthClient: vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    }),
  };
});

// Mock the OpenAIContentGenerator
vi.mock('./openaiContentGenerator/index.js', () => {
  return {
    createOpenAIContentGenerator: vi.fn().mockResolvedValue({
      generateContent: vi.fn(),
      generateContentStream: vi.fn(),
      countTokens: vi.fn(),
      embedContent: vi.fn(),
    }),
  };
});

// Mock the QwenContentGenerator
vi.mock('../qwen/qwenContentGenerator.js', () => {
  return {
    QwenContentGenerator: vi.fn().mockImplementation(() => {
      return {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        countTokens: vi.fn(),
        embedContent: vi.fn(),
      };
    }),
  };
});

describe('contentGenerator', () => {
  describe('createContentGeneratorConfig', () => {
    it('should create config for Qwen OAuth', () => {
      const config = {
        getModel: vi.fn().mockReturnValue('test-model'),
        getProxy: vi.fn().mockReturnValue(undefined),
        getEnableOpenAILogging: vi.fn().mockReturnValue(false),
        getContentGeneratorTimeout: vi.fn().mockReturnValue(undefined),
        getContentGeneratorMaxRetries: vi.fn().mockReturnValue(undefined),
        getContentGeneratorDisableCacheControl: vi.fn().mockReturnValue(undefined),
        getContentGeneratorSamplingParams: vi.fn().mockReturnValue(undefined),
      } as any;

      const result = createContentGeneratorConfig(config, AuthType.QWEN_OAUTH);
      expect(result.authType).toBe(AuthType.QWEN_OAUTH);
      expect(result.apiKey).toBe('QWEN_OAUTH_DYNAMIC_TOKEN');
    });

    it('should create config for Baidu Cloud', () => {
      // Set environment variables
      process.env['BAIDU_CLOUD_AK'] = 'test-ak';
      process.env['BAIDU_CLOUD_SK'] = 'test-sk';

      const config = {
        getModel: vi.fn().mockReturnValue('test-model'),
        getSelectedBaiduModel: vi.fn().mockReturnValue(null),
        getProxy: vi.fn().mockReturnValue(undefined),
        getEnableOpenAILogging: vi.fn().mockReturnValue(false),
        getContentGeneratorTimeout: vi.fn().mockReturnValue(undefined),
        getContentGeneratorMaxRetries: vi.fn().mockReturnValue(undefined),
        getContentGeneratorDisableCacheControl: vi.fn().mockReturnValue(undefined),
        getContentGeneratorSamplingParams: vi.fn().mockReturnValue(undefined),
      } as any;

      const result = createContentGeneratorConfig(config, AuthType.BAIDU_CLOUD);
      expect(result.authType).toBe(AuthType.BAIDU_CLOUD);
      expect(result.apiKey).toBe('test-ak');

      // Clean up environment variables
      delete process.env['BAIDU_CLOUD_AK'];
      delete process.env['BAIDU_CLOUD_SK'];
    });
  });
});