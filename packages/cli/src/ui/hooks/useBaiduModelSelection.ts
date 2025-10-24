/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { Config } from '@qwen-code/qwen-code-core';

export const useBaiduModelSelection = (config: Config) => {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [models, setModels] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 百度云认证现在使用OpenAI内容生成器，不需要特殊的模型处理
      // 使用默认的模型列表
      const defaultModels = [
        { id: 'qwen-7b-chat', name: 'Qwen-7B-Chat', description: '7B参数的Qwen对话模型' },
        { id: 'qwen-14b-chat', name: 'Qwen-14B-Chat', description: '14B参数的Qwen对话模型' },
        { id: 'qwen-72b-chat', name: 'Qwen-72B-Chat', description: '72B参数的Qwen对话模型' }
      ];
      
      setModels(defaultModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    // 百度云认证现在使用OpenAI内容生成器，不需要特殊的模型设置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // 组件挂载时加载模型列表
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return {
    selectedModel,
    models,
    loading,
    error,
    loadModels,
    handleModelSelect,
  };
};