/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaiduCloudAuthMiddleware } from './baiduCloudAuthMiddleware.js';

describe('BaiduCloudAuthMiddleware', () => {
  const ak = 'test-ak';
  const sk = 'test-sk';
  let middleware: BaiduCloudAuthMiddleware;

  beforeEach(() => {
    middleware = new BaiduCloudAuthMiddleware(ak, sk);
  });

  it('should create a BaiduCloudAuthMiddleware instance', () => {
    expect(middleware).toBeInstanceOf(BaiduCloudAuthMiddleware);
  });

  it('should generate a signature', () => {
    const method = 'GET';
    const url = 'https://aihc.bj.baidubce.com/api/v1/services';
    const headers = {
      'host': 'aihc.bj.baidubce.com',
      'x-bce-date': new Date().toISOString()
    };
    const params = {
      action: 'DescribeServices'
    };

    const signature = middleware.generateSignature(method, url, headers, params);
    // 签名应该是十六进制字符串
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should add auth headers to a request', () => {
    const method = 'GET';
    const url = 'https://aihc.bj.baidubce.com/api/v1/services';
    const headers = {
      'host': 'aihc.bj.baidubce.com',
      'x-bce-date': new Date().toISOString()
    };
    const params = {
      action: 'DescribeServices'
    };

    const newHeaders = middleware.addAuthHeaders(method, url, headers, params);
    expect(newHeaders).toHaveProperty('Authorization');
    expect(newHeaders['Authorization']).toContain('bce-auth-v1');
  });
});