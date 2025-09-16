/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, getBaiduCloudAuthCacheManager, validateBaiduCloudAuth } from '@qwen-code/qwen-code-core';
import { Box, Text } from 'ink';
import React, { useState, useCallback } from 'react';
import {
  setOpenAIApiKey,
  setOpenAIBaseUrl,
  setOpenAIModel,
  validateAuthMethod,
} from '../../config/auth.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { OpenAIKeyPrompt } from './OpenAIKeyPrompt.js';
import { BaiduCloudAuthForm } from './BaiduCloudAuthForm.js';
import { ServiceSelectionForm } from './ServiceSelectionForm.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';

interface AuthDialogProps {
  onSelect: (authMethod: AuthType | undefined, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: AuthDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [showOpenAIKeyPrompt, setShowOpenAIKeyPrompt] = useState(false);
  const [showBaiduCloudAuthForm, setShowBaiduCloudAuthForm] = useState(false);
  const [baiduCloudLoading, setBaiduCloudLoading] = useState(false);
  const [baiduCloudError, setBaiduCloudError] = useState<string | null>(null);
  const [showServiceSelection, setShowServiceSelection] = useState(false);
  const [availableServices, setAvailableServices] = useState<unknown[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [, setSelectedService] = useState<unknown>(null);
  const [isBaiduCloudAuthenticated, setIsBaiduCloudAuthenticated] = useState(false);
  const items = [
    { label: 'Qwen OAuth', value: AuthType.QWEN_OAUTH },
    { label: 'OpenAI', value: AuthType.USE_OPENAI },
    { 
      label: isBaiduCloudAuthenticated ? 
        `Baidu Cloud (已认证) - ${process.env['BAIDU_CLOUD_SERVICE_NAME'] || '未知服务'}` : 
        'Baidu Cloud', 
      value: AuthType.BAIDU_CLOUD 
    },
  ];

  const initialAuthIndex = Math.max(
    0,
    items.findIndex((item) => {
      if (settings.merged.selectedAuthType) {
        return item.value === settings.merged.selectedAuthType;
      }

      const defaultAuthType = parseDefaultAuthType(
        process.env['GEMINI_DEFAULT_AUTH_TYPE'],
      );
      if (defaultAuthType) {
        return item.value === defaultAuthType;
      }

      if (process.env['GEMINI_API_KEY']) {
        return item.value === AuthType.USE_GEMINI;
      }

      return item.value === AuthType.LOGIN_WITH_GOOGLE;
    }),
  );

  const handleAuthSelect = async (authMethod: AuthType) => {
    // 特殊处理百度云认证 - 优先检查认证状态
    if (authMethod === AuthType.BAIDU_CLOUD) {
      try {
        // 重新检查认证状态（因为环境变量可能在运行时被设置）
        const isCurrentlyAuthenticated = await checkBaiduCloudAuthStatus();
        
        if (isCurrentlyAuthenticated) {
          // 检查是否已经选择了服务
          const hasSelectedService = process.env['BAIDU_CLOUD_SERVICE_ID'] && 
                                    process.env['BAIDU_CLOUD_SERVICE_NAME'] && 
                                    process.env['BAIDU_CLOUD_MODEL_NAME'];
          
          if (hasSelectedService) {
            console.log('✅ 百度云已认证并已选择服务，直接使用现有认证');
            onSelect(AuthType.BAIDU_CLOUD, SettingScope.User);
            return;
          } else {
            console.log('✅ 百度云已认证但未选择服务，显示服务选择界面');
            // 已认证但未选择服务，显示服务选择界面
            const ak = process.env['BAIDU_CLOUD_AK'] || '';
            const sk = process.env['BAIDU_CLOUD_SK'] || '';
            const endpoint = process.env['BAIDU_CLOUD_ENDPOINT'] || '';
            
            if (ak && sk && endpoint) {
              await loadAvailableServices(ak, sk, endpoint);
            } else {
              console.log('🔧 百度云环境变量不完整，显示认证表单');
              setShowBaiduCloudAuthForm(true);
              setErrorMessage(null);
            }
            return;
          }
        }
        
        // 如果未认证，检查是否有必要的环境变量
        if (!process.env['BAIDU_CLOUD_AK'] || !process.env['BAIDU_CLOUD_SK'] || !process.env['BAIDU_CLOUD_ENDPOINT']) {
          console.log('🔧 百度云环境变量未设置，显示认证表单');
          setShowBaiduCloudAuthForm(true);
          setErrorMessage(null);
          return;
        }
        
        // 如果有环境变量但未认证，验证认证信息并加载服务列表
        console.log('🔧 百度云环境变量已设置但未认证，验证认证信息');
        const ak = process.env['BAIDU_CLOUD_AK'] || '';
        const sk = process.env['BAIDU_CLOUD_SK'] || '';
        const endpoint = process.env['BAIDU_CLOUD_ENDPOINT'] || '';
        
        try {
          // 验证认证信息
          await validateBaiduCloudAuth(ak, sk, endpoint);
          console.log('✅ 百度云认证验证成功，加载服务列表');
          await loadAvailableServices(ak, sk, endpoint);
        } catch (_error) {
          console.log('❌ 百度云认证验证失败，显示认证表单');
          setShowBaiduCloudAuthForm(true);
          setErrorMessage(null);
        }
        return;
      } catch (error) {
        console.error('❌ 检查百度云认证状态失败:', error);
        setErrorMessage('Failed to check authentication status');
        return;
      }
    }
    
    // 处理其他认证方式
    const error = validateAuthMethod(authMethod);
    if (error) {
      if (
        authMethod === AuthType.USE_OPENAI &&
        !process.env['OPENAI_API_KEY']
      ) {
        setShowOpenAIKeyPrompt(true);
        setErrorMessage(null);
      } else {
        setErrorMessage(error);
      }
    } else {
      setErrorMessage(null);
      onSelect(authMethod, SettingScope.User);
    }
  };

  const handleOpenAIKeySubmit = (
    apiKey: string,
    baseUrl: string,
    model: string,
  ) => {
    setOpenAIApiKey(apiKey);
    setOpenAIBaseUrl(baseUrl);
    setOpenAIModel(model);
    setShowOpenAIKeyPrompt(false);
    onSelect(AuthType.USE_OPENAI, SettingScope.User);
  };

  const handleOpenAIKeyCancel = () => {
    setShowOpenAIKeyPrompt(false);
    setErrorMessage('OpenAI API key is required to use OpenAI authentication.');
  };

  const handleBaiduCloudAuthSubmit = async (ak: string, sk: string, endpoint: string) => {
    setBaiduCloudLoading(true);
    setBaiduCloudError(null);
    
    try {
      // 设置环境变量
      process.env['BAIDU_CLOUD_AK'] = ak;
      process.env['BAIDU_CLOUD_SK'] = sk;
      process.env['BAIDU_CLOUD_ENDPOINT'] = endpoint;
      
      // 使用专门的验证函数来测试认证
      // 按照百度云官方 API 文档：GET ?action=DescribeServices&pageNumber=pageNumber&pageSize=pageSize&orderBy=orderBy&order=order
      const serviceListResponse = await validateBaiduCloudAuth(ak, sk, endpoint);
      
      // 如果验证成功，服务列表响应格式正确
      console.log(`Baidu Cloud authentication successful. Found ${serviceListResponse.totalCount} services.`);
      
      setBaiduCloudLoading(false);
      setBaiduCloudError(null);
      setShowBaiduCloudAuthForm(false);
      
      // 认证成功后获取服务列表供用户选择
      await loadAvailableServices(ak, sk, endpoint);
    } catch (error) {
      setBaiduCloudLoading(false);
      
      // 详细打印错误信息
      console.error('Baidu Cloud authentication error details:', {
        errorType: error?.constructor?.name,
        errorMessage: (error as Error)?.message,
        errorStack: (error as Error)?.stack,
        errorCode: (error as { code?: unknown })?.code,
        errorStatus: (error as { status?: unknown })?.status,
        errorResponse: (error as { response?: unknown })?.response,
        fullError: error
      });
      
      // 根据错误类型提供更具体的错误信息
      let errorMessage = 'Authentication failed';
      if (error instanceof Error) {
        if (error.message.includes('Invalid response format')) {
          errorMessage = 'Invalid response from Baidu Cloud API. Please check your credentials and endpoint.';
        } else if (error.message.includes('Failed to connect')) {
          errorMessage = 'Failed to connect to Baidu Cloud API. Please check your network and endpoint.';
        } else if (error.message.includes('authorization')) {
          errorMessage = 'Authentication failed. Please check your Access Key and Secret Key.';
        } else {
          errorMessage = `Authentication failed: ${error.message}`;
        }
      }
      
      setBaiduCloudError(errorMessage);
    }
  };

  const handleBaiduCloudAuthCancel = () => {
    setShowBaiduCloudAuthForm(false);
    setErrorMessage('Baidu Cloud AK/SK is required to use Baidu Cloud authentication.');
  };

  // 加载可用的服务列表
  const loadAvailableServices = async (ak: string, sk: string, endpoint: string) => {
    setServiceLoading(true);
    setServiceError(null);
    
    try {
      // 使用validateBaiduCloudAuth函数来获取服务列表
      const serviceListResponse = await validateBaiduCloudAuth(ak, sk, endpoint);
      
      console.log('Loaded services:', serviceListResponse);
      
      setAvailableServices(serviceListResponse.services || []);
      setServiceLoading(false);
      setShowServiceSelection(true);
      
    } catch (error) {
      console.error('Failed to load services:', error);
      setServiceLoading(false);
      setServiceError(error instanceof Error ? error.message : 'Failed to load services');
    }
  };

  // 处理服务选择
  const handleServiceSelect = async (service: unknown) => {
    console.log('Selected service:', service);
    setSelectedService(service);
    setShowServiceSelection(false);
    
    try {
      // 获取选中的服务对象 - 使用更准确的类型定义
      const serviceObj = service as { 
        id: string; 
        name: string;
        config: {
          apiKey: string;
          baseUrl: string;
          model: string;
        };
        [key: string]: unknown; // 允许其他属性
      };
      
      // 添加调试日志，查看服务对象的实际结构
      console.log('🔍 服务对象结构检查:', {
        serviceObj,
        hasId: 'id' in serviceObj,
        hasName: 'name' in serviceObj,
        hasConfig: 'config' in serviceObj,
        configType: typeof serviceObj.config,
        configValue: serviceObj.config
      });
      
      // 验证必需的字段
      if (!serviceObj.id) {
        throw new Error('Service ID is missing');
      }
      
      if (!serviceObj.name) {
        throw new Error('Service name is missing');
      }
      
      if (!serviceObj.config) {
        throw new Error('Service configuration is missing');
      }
      
      if (!serviceObj.config.apiKey) {
        throw new Error('Service API key is missing');
      }
      
      if (!serviceObj.config.baseUrl) {
        throw new Error('Service base URL is missing');
      }
      
      if (!serviceObj.config.model) {
        throw new Error('Service model is missing');
      }
      
      const serviceId = serviceObj.id;
      const serviceName = serviceObj.name;
      const modelName = serviceObj.config.model;
      
      // 获取认证信息
      const accessKey = process.env['BAIDU_CLOUD_AK'] || '';
      const secretKey = process.env['BAIDU_CLOUD_SK'] || '';
      const endpoint = process.env['BAIDU_CLOUD_ENDPOINT'] || '';
      const region = process.env['BAIDU_CLOUD_REGION'] || 'bj';
      
      // 保存到认证缓存，包含服务配置信息
      const authCacheManager = getBaiduCloudAuthCacheManager();
      await authCacheManager.saveCredentials({
        accessKey,
        secretKey,
        endpoint,
        region,
        serviceId,
        serviceName,
        modelName,
        // 添加服务配置信息
        serviceConfig: {
          apiKey: serviceObj.config.apiKey,
          baseUrl: serviceObj.config.baseUrl,
          model: serviceObj.config.model
        },
        authenticated: true,
        lastLoginTime: Date.now()
      });
      
      // 同时保存到环境变量（向后兼容）
      process.env['BAIDU_CLOUD_SERVICE_ID'] = serviceId;
      process.env['BAIDU_CLOUD_SERVICE_NAME'] = serviceName;
      process.env['BAIDU_CLOUD_MODEL_NAME'] = modelName;
      process.env['BAIDU_CLOUD_AUTHENTICATED'] = 'true';
      process.env['BAIDU_CLOUD_LAST_LOGIN'] = Date.now().toString();
      
      // 保存服务配置信息到环境变量
      process.env['BAIDU_CLOUD_API_KEY'] = serviceObj.config.apiKey;
      process.env['BAIDU_CLOUD_BASE_URL'] = serviceObj.config.baseUrl;
      process.env['BAIDU_CLOUD_SERVICE_MODEL'] = serviceObj.config.model;
      
      console.log('✅ 百度云认证成功，已保存认证状态到缓存和环境变量');
      console.log('认证信息:', {
        serviceId,
        serviceName,
        accessKey,
        secretKey: '******',
        endpoint,
        hasServiceConfig: true
      });
      
      // 完成认证流程
      onSelect(AuthType.BAIDU_CLOUD, SettingScope.User);
    } catch (error) {
      console.error('❌ 保存百度云认证信息失败:', error);
      setErrorMessage('Failed to save authentication information: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 处理服务选择取消
  const handleServiceCancel = () => {
    setShowServiceSelection(false);
    setAvailableServices([]);
    setErrorMessage('Service selection cancelled.');
  };

  // 检查百度云认证状态
  const checkBaiduCloudAuthStatus = useCallback(async () => {
    try {
      // 首先尝试从认证缓存获取
      const authCacheManager = getBaiduCloudAuthCacheManager();
      const cachedCredentials = await authCacheManager.getValidCredentials();
      
      if (cachedCredentials) {
        console.log('✅ 从认证缓存获取有效的百度云认证信息');
        // 将认证信息设置到环境变量中
        process.env['BAIDU_CLOUD_SERVICE_ID'] = cachedCredentials.serviceId || '';
        process.env['BAIDU_CLOUD_SERVICE_NAME'] = cachedCredentials.serviceName || '';
        process.env['BAIDU_CLOUD_MODEL_NAME'] = cachedCredentials.modelName || '';
        process.env['BAIDU_CLOUD_ENDPOINT'] = cachedCredentials.endpoint || '';
        process.env['BAIDU_CLOUD_AUTHENTICATED'] = 'true';
        process.env['BAIDU_CLOUD_LAST_LOGIN'] = cachedCredentials.lastLoginTime?.toString() || '';
        process.env['BAIDU_CLOUD_AK'] = cachedCredentials.accessKey || '';
        process.env['BAIDU_CLOUD_SK'] = cachedCredentials.secretKey || '';
        process.env['BAIDU_CLOUD_REGION'] = cachedCredentials.region || 'bj';
        
        
        // 如果有服务配置信息，也设置到环境变量中
        if (cachedCredentials.serviceConfig) {
          process.env['BAIDU_CLOUD_API_KEY'] = cachedCredentials.serviceConfig.apiKey;
          process.env['BAIDU_CLOUD_BASE_URL'] = cachedCredentials.serviceConfig.baseUrl;
          process.env['BAIDU_CLOUD_SERVICE_MODEL'] = cachedCredentials.serviceConfig.model;
        } else {
          // 如果缓存中没有服务配置信息，尝试从其他环境变量获取
          console.log('⚠️ 缓存中没有服务配置信息，尝试从环境变量获取');
        }
        
        setIsBaiduCloudAuthenticated(true);
        return true;
      }
      
      // 回退到环境变量检查
      const isAuthenticated = process.env['BAIDU_CLOUD_AUTHENTICATED'] === 'true';
      const lastLoginTime = process.env['BAIDU_CLOUD_LAST_LOGIN'];
      const hasCredentials = process.env['BAIDU_CLOUD_AK'] && process.env['BAIDU_CLOUD_SK'] && process.env['BAIDU_CLOUD_ENDPOINT'];
      
      console.log('🔍 检查百度云认证状态 (环境变量):', {
        isAuthenticated,
        lastLoginTime,
        hasCredentials,
        ak: process.env['BAIDU_CLOUD_AK'] ? '已设置' : '未设置',
        sk: process.env['BAIDU_CLOUD_SK'] ? '已设置' : '未设置',
        endpoint: process.env['BAIDU_CLOUD_ENDPOINT'] ? '已设置' : '未设置'
      });
      
      if (isAuthenticated && lastLoginTime && hasCredentials) {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000; // 24小时
        const isExpired = now - parseInt(lastLoginTime, 10) > twentyFourHours;
        
        if (isExpired) {
          console.log('🔧 百度云认证已过期，需要重新登录');
          handleBaiduCloudLogout();
          return false;
        }
        
        console.log('✅ 百度云认证状态有效 (环境变量)');
        setIsBaiduCloudAuthenticated(true);
        return true;
      }
      
      console.log('❌ 百度云认证状态无效');
      setIsBaiduCloudAuthenticated(false);
      return false;
    } catch (error) {
      console.error('❌ 检查百度云认证状态失败:', error);
      setIsBaiduCloudAuthenticated(false);
      return false;
    }
  }, []);

  // 处理百度云注销
  const handleBaiduCloudLogout = async () => {
    console.log('🔧 用户主动注销百度云认证');
    
    try {
      // 清除认证缓存
      const authCacheManager = getBaiduCloudAuthCacheManager();
      await authCacheManager.clearCredentials();
      
      // 清除环境变量
      delete process.env['BAIDU_CLOUD_AUTHENTICATED'];
      delete process.env['BAIDU_CLOUD_LAST_LOGIN'];
      delete process.env['BAIDU_CLOUD_SERVICE_ID'];
      delete process.env['BAIDU_CLOUD_SERVICE_NAME'];
      delete process.env['BAIDU_CLOUD_MODEL_NAME'];
      
      setIsBaiduCloudAuthenticated(false);
      setShowBaiduCloudAuthForm(false);
      setShowServiceSelection(false);
      setAvailableServices([]);
      
      console.log('✅ 百度云认证已注销');
    } catch (error) {
      console.error('❌ 注销百度云认证失败:', error);
    }
  };

  // 组件初始化时检查认证状态
  React.useEffect(() => {
    checkBaiduCloudAuthStatus().catch(error => {
      console.error('❌ 初始化时检查百度云认证状态失败:', error);
    });
  }, [checkBaiduCloudAuthStatus]);

  useKeypress(
    (key) => {
      // 添加调试日志，查看按键事件
      console.log('🔍 按键事件:', key);
      
      // 如果显示了OpenAI密钥提示或百度云认证表单，只处理这些表单相关的按键
      if (showOpenAIKeyPrompt || showBaiduCloudAuthForm) {
        console.log('📝 处理表单相关按键');
        return;
      }

      // 如果显示了服务选择表单，只处理服务选择相关的按键
      if (showServiceSelection) {
        console.log('📝 处理服务选择相关按键');
        return;
      }

      // 如果已认证，处理注销和继续使用的按键
      if (isBaiduCloudAuthenticated) {
        console.log('📝 处理已认证状态下的按键');
        if (key.name === 'return') {
          console.log('✅ 按下Enter键，总是显示服务列表供用户选择');
          // 总是显示服务列表，不检查是否已经选择了服务
          // 从配置中获取AK、SK和Endpoint

          const baiduCloudConfig = {
            accessKey: process.env['BAIDU_CLOUD_AK'] || process.env['BCE_AK'] || '',
            secretKey: process.env['BAIDU_CLOUD_SK'] || process.env['BCE_SK'] || '',
            endpoint: process.env['BAIDU_CLOUD_ENDPOINT'] || 
                     process.env['BAIDU_MODEL_ENDPOINT'] || 
                     process.env['BCE_ENDPOINT'] || 
                     `https://aihc.bj.baidubce.com`
          };
          
          const ak = baiduCloudConfig.accessKey;
          const sk = baiduCloudConfig.secretKey;
          const endpoint = baiduCloudConfig.endpoint;
          
          if (ak && sk && endpoint) {
            loadAvailableServices(ak, sk, endpoint).catch((error) => {
              console.error('❌ 加载服务列表失败:', error);
              setErrorMessage('Failed to load service list');
            });
          } else {
            console.log('❌ 百度云环境变量不完整');
            setErrorMessage('Baidu Cloud credentials are incomplete');
          }
        } else if (key.name === 'l' || key.name === 'L') {
          console.log('🔧 按下L键，注销认证');
          // 注销认证
          handleBaiduCloudLogout();
        }
        return;
      }

      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (errorMessage) {
          return;
        }
        if (settings.merged.selectedAuthType === undefined) {
          // Prevent exiting if no auth method is set
          setErrorMessage(
            'You must select an auth method to proceed. Press Ctrl+C again to exit.',
          );
          return;
        }
        onSelect(undefined, SettingScope.User);
      }
    },
    { isActive: true },
  );

  if (showOpenAIKeyPrompt) {
    return (
      <OpenAIKeyPrompt
        onSubmit={handleOpenAIKeySubmit}
        onCancel={handleOpenAIKeyCancel}
      />
    );
  }

  if (showBaiduCloudAuthForm) {
    return (
      <BaiduCloudAuthForm
        onSubmit={handleBaiduCloudAuthSubmit}
        onCancel={handleBaiduCloudAuthCancel}
        loading={baiduCloudLoading}
        error={baiduCloudError}
      />
    );
  }

  if (showServiceSelection) {
    return (
      <ServiceSelectionForm
        services={availableServices as any} // eslint-disable-line @typescript-eslint/no-explicit-any
        onSelect={handleServiceSelect}
        onCancel={handleServiceCancel}
        loading={serviceLoading}
        error={serviceError}
      />
    );
  }

  // 如果已认证，显示认证状态和注销选项
  if (isBaiduCloudAuthenticated) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">✅ 百度云认证成功！</Text>
        <Text color="gray">服务: {process.env['BAIDU_CLOUD_SERVICE_NAME'] || '未知服务'}</Text>
        <Text color="gray">模型: {process.env['BAIDU_CLOUD_MODEL_NAME'] || '未知模型'}</Text>
        <Text color="gray">Endpoint: {process.env['BAIDU_CLOUD_ENDPOINT'] || '未知端点'}</Text>
        
        <Box marginTop={1}>
          <Text color="yellow">按 Enter 显示服务列表，按 L 注销认证</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Get started</Text>
      <Box marginTop={1}>
        <Text>How would you like to authenticate for this project?</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.AccentPurple}>(Use Enter to Set Auth)</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Terms of Services and Privacy Notice for Qwen Code</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {'https://github.com/QwenLM/Qwen3-Coder/blob/main/README.md'}
        </Text>
      </Box>
    </Box>
  );
}
