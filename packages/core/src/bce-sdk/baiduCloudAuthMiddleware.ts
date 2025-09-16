/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'crypto';

/**
 * 百度云认证中间件类
 * 实现百度云AK/SK签名认证机制
 */
export class BaiduCloudAuthMiddleware {
  private ak: string;
  private sk: string;

  constructor(ak: string, sk: string) {
    this.ak = ak;
    this.sk = sk;
  }

  /**
   * 生成签名
   * @param method HTTP方法
   * @param url 请求URL
   * @param headers 请求头
   * @param params 查询参数
   * @returns 签名字符串
   */
  generateSignature(method: string, url: string, headers: Record<string, string>, params: Record<string, string>): string {
    // 构建规范请求
    const canonicalRequest = this.buildCanonicalRequest(method, url, headers, params);
    
    // 生成签名密钥
    const signingKey = this.getSignatureKey(this.sk, new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    
    // 生成签名
    const signature = crypto.createHmac('sha256', signingKey).update(canonicalRequest).digest('hex');
    
    return signature;
  }

  /**
   * 构建规范请求
   * @param method HTTP方法
   * @param url 请求URL
   * @param headers 请求头
   * @param params 查询参数
   * @returns 规范请求字符串
   */
  private buildCanonicalRequest(method: string, url: string, headers: Record<string, string>, params: Record<string, string>): string {
    // 解析URL
    const urlObj = new URL(url);
    
    // 构建规范URI
    const canonicalUri = urlObj.pathname;
    
    // 构建规范查询字符串
    const searchParams = new URLSearchParams(urlObj.search);
    // 添加额外参数
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value);
    });
    
    // 按字典序排序参数
    const sortedParams: string[] = [];
    searchParams.forEach((value, key) => {
      sortedParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    sortedParams.sort();
    
    const canonicalQueryString = sortedParams.join('&');
    
    // 构建规范头部
    const canonicalHeaders: string[] = [];
    const signedHeaders: string[] = [];
    
    // 添加标准头部
    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      canonicalHeaders.push(`${lowerKey}:${value.trim()}`);
      signedHeaders.push(lowerKey);
    });
    
    // 按字典序排序头部
    canonicalHeaders.sort();
    signedHeaders.sort();
    
    const canonicalHeadersStr = canonicalHeaders.join('\n') + '\n';
    const signedHeadersStr = signedHeaders.join(';');
    
    // 构建负载哈希（这里简化处理）
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');
    
    // 组合规范请求
    return [
      method.toUpperCase(),
      canonicalUri,
      canonicalQueryString,
      canonicalHeadersStr,
      signedHeadersStr,
      payloadHash
    ].join('\n');
  }

  /**
   * 生成签名密钥
   * @param key 密钥
   * @param date 日期（格式：YYYYMMDD）
   * @returns 签名密钥
   */
  private getSignatureKey(key: string, date: string): Buffer {
    const kDate = crypto.createHmac('sha256', 'bce-auth-v1/' + key).update(date).digest();
    const kService = crypto.createHmac('sha256', kDate).update('bce').digest();
    return crypto.createHmac('sha256', kService).update('request').digest();
  }

  /**
   * 为请求添加认证头部
   * @param method HTTP方法
   * @param url 请求URL
   * @param headers 请求头
   * @param params 查询参数
   * @returns 添加认证头部后的请求头
   */
  addAuthHeaders(method: string, url: string, headers: Record<string, string>, params: Record<string, string>): Record<string, string> {
    // 生成签名
    const signature = this.generateSignature(method, url, headers, params);
    
    // 添加认证头部
    const authHeader = `bce-auth-v1/${this.ak}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/`;
    
    return {
      ...headers,
      'Authorization': authHeader + signature
    };
  }
}