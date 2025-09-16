import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InferenceService {
  id: string;                    // 服务ID
  name: string;                  // 服务名称
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  region: string;                // 区域
  resourcePoolId: string;        // 资源池ID
  resourcePoolName: string;      // 资源池名称
  resourcePoolType?: string;     // 资源池类型
  networkType: string;           // 网络类型
  publicAccess?: boolean;        // 是否公开访问
  queueName: string;             // 队列名称
  creator?: string;              // 创建者
  resourceSpec: {                // 资源配置
    cpus: number;                // CPU数量
    memory: number;              // 内存大小
    acceleratorCount?: number;   // 加速器数量
    acceleratorType?: string;    // 加速器类型
  };
  hpa: Record<string, unknown>;  // 水平扩展配置
  config: {
    apiKey: string;
    baseUrl: string;
    model: string;
  }
  status: number
}

interface ServiceSelectionFormProps {
  services: InferenceService[];
  onSelect: (service: InferenceService) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export function ServiceSelectionForm({
  services,
  onSelect,
  onCancel,
  loading = false,
  error = null
}: ServiceSelectionFormProps) {

  // 过滤掉非运行状态
  services = services.filter(service => service.status === 2);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (loading) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(services.length - 1, prev + 1));
    } else if (key.return) {
      if (services[selectedIndex]) {
        onSelect(services[selectedIndex]);
      }
    } else if (key.escape || (key.ctrl && input === 'c')) {
      onCancel();
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">正在加载服务列表...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">加载服务列表失败: {error}</Text>
        <Text color="gray">按 ESC 返回</Text>
      </Box>
    );
  }

  if (services.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">没有找到可用的服务</Text>
        <Text color="gray">按 ESC 返回</Text>
      </Box>
    );
  }

  // 检查是否为调试模式
  const isDebugMode = process.env['BAIDU_CLOUD_DEBUG'] === 'true' || process.env['NODE_ENV'] === 'development';

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">✓ 认证成功！请选择要使用的大模型服务：</Text>
      {isDebugMode && (
        <Text color="yellow">🔧 调试模式：无论选择哪个服务都将使用写死的 API key 配置</Text>
      )}
      <Text color="gray">使用 ↑↓ 键选择，Enter 确认，ESC 取消</Text>

      <Box flexDirection="column" marginTop={1}>
        {services.map((service, index) => (
          <Box key={service.id} flexDirection="row" alignItems="center">
            <Text color={index === selectedIndex ? 'blue' : 'white'}>
              {index === selectedIndex ? '▶ ' : '  '}
            </Text>
            <Box flexDirection="column" flexGrow={1}>
              <Text color={index === selectedIndex ? 'blue' : 'white'}>
                {service.name}
              </Text>
              <Text color="gray" dimColor>
                ID: {service.id} | apiKey: {service.config?.apiKey.slice(0, 10) || 'N/A'} | model: {service.config?.model || 'N/A'} | baseUrl: {service.config?.baseUrl || 'N/A'}
              </Text>
              {service.creator && (
                <Text color="gray" dimColor>
                  networkType: {service.networkType || 'N/A'} | 状态：{service.status}
                </Text>
              )}

            </Box>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          已选择: {services[selectedIndex]?.name || '无'}
        </Text>
      </Box>
    </Box>
  );
}
