/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateAuthMethod } from './auth.js';
import { AuthType } from '@qwen-code/qwen-code-core';

describe('auth', () => {
  beforeEach(() => {
    // Clear all environment variables before each test
    delete process.env['GEMINI_API_KEY'];
    delete process.env['GOOGLE_CLOUD_PROJECT'];
    delete process.env['GOOGLE_CLOUD_LOCATION'];
    delete process.env['GOOGLE_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['BAIDU_CLOUD_AK'];
    delete process.env['BAIDU_CLOUD_SK'];
  });

  afterEach(() => {
    // Clear all environment variables after each test
    delete process.env['GEMINI_API_KEY'];
    delete process.env['GOOGLE_CLOUD_PROJECT'];
    delete process.env['GOOGLE_CLOUD_LOCATION'];
    delete process.env['GOOGLE_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['BAIDU_CLOUD_AK'];
    delete process.env['BAIDU_CLOUD_SK'];
  });

  it('should validate Qwen OAuth auth method', () => {
    const result = validateAuthMethod(AuthType.QWEN_OAUTH);
    expect(result).toBeNull();
  });

  it('should validate Google OAuth auth method', () => {
    const result = validateAuthMethod(AuthType.LOGIN_WITH_GOOGLE);
    expect(result).toBeNull();
  });

  it('should validate Cloud Shell auth method', () => {
    const result = validateAuthMethod(AuthType.CLOUD_SHELL);
    expect(result).toBeNull();
  });

  it('should validate Gemini API key auth method with valid key', () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    const result = validateAuthMethod(AuthType.USE_GEMINI);
    expect(result).toBeNull();
  });

  it('should invalidate Gemini API key auth method without key', () => {
    const result = validateAuthMethod(AuthType.USE_GEMINI);
    expect(result).toContain('GEMINI_API_KEY environment variable not found');
  });

  it('should validate Vertex AI auth method with project and location', () => {
    process.env['GOOGLE_CLOUD_PROJECT'] = 'test-project';
    process.env['GOOGLE_CLOUD_LOCATION'] = 'test-location';
    const result = validateAuthMethod(AuthType.USE_VERTEX_AI);
    expect(result).toBeNull();
  });

  it('should validate Vertex AI auth method with API key', () => {
    process.env['GOOGLE_API_KEY'] = 'test-key';
    const result = validateAuthMethod(AuthType.USE_VERTEX_AI);
    expect(result).toBeNull();
  });

  it('should invalidate Vertex AI auth method without config', () => {
    const result = validateAuthMethod(AuthType.USE_VERTEX_AI);
    expect(result).toContain('When using Vertex AI, you must specify either');
  });

  it('should validate OpenAI auth method with valid key', () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    const result = validateAuthMethod(AuthType.USE_OPENAI);
    expect(result).toBeNull();
  });

  it('should invalidate OpenAI auth method without key', () => {
    const result = validateAuthMethod(AuthType.USE_OPENAI);
    expect(result).toContain('OPENAI_API_KEY environment variable not found');
  });

  it('should validate Baidu Cloud auth method with valid AK/SK', () => {
    process.env['BAIDU_CLOUD_AK'] = 'test-ak';
    process.env['BAIDU_CLOUD_SK'] = 'test-sk';
    const result = validateAuthMethod(AuthType.BAIDU_CLOUD);
    expect(result).toBeNull();
  });

  it('should invalidate Baidu Cloud auth method without AK', () => {
    process.env['BAIDU_CLOUD_SK'] = 'test-sk';
    const result = validateAuthMethod(AuthType.BAIDU_CLOUD);
    expect(result).toContain('BAIDU_CLOUD_AK and BAIDU_CLOUD_SK environment variables are required');
  });

  it('should invalidate Baidu Cloud auth method without SK', () => {
    process.env['BAIDU_CLOUD_AK'] = 'test-ak';
    const result = validateAuthMethod(AuthType.BAIDU_CLOUD);
    expect(result).toContain('BAIDU_CLOUD_AK and BAIDU_CLOUD_SK environment variables are required');
  });

  it('should invalidate Baidu Cloud auth method without AK/SK', () => {
    const result = validateAuthMethod(AuthType.BAIDU_CLOUD);
    expect(result).toContain('BAIDU_CLOUD_AK and BAIDU_CLOUD_SK environment variables are required');
  });

  it('should invalidate unknown auth method', () => {
    const result = validateAuthMethod('unknown-auth-method' as AuthType);
    expect(result).toBe('Invalid auth method selected.');
  });
});