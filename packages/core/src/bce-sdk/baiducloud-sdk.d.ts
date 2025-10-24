/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

declare module '@atorber/baiducloud-sdk' {
  export interface BceConfig {
    endpoint: string;
    credentials: {
      ak: string;
      sk: string;
    };
  }

  export interface RequestOptions {
    params?: Record<string, unknown>;
    config?: Record<string, unknown>;
    headers?: Record<string, string>;
    body?: string | null;
  }

  export class BceBaseClient {
    constructor(config: BceConfig, service: string);
    sendRequest(
      method: string,
      path: string,
      options: RequestOptions,
    ): Promise<unknown>;
  }
}

