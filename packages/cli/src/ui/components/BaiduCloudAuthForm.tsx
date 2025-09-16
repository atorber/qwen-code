/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { Colors } from '../colors.js';

interface BaiduCloudAuthFormProps {
  onSubmit: (ak: string, sk: string, endpoint: string) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export function BaiduCloudAuthForm({
  onSubmit,
  onCancel,
  loading = false,
  error = null,
}: BaiduCloudAuthFormProps) {
  const [ak, setAk] = useState('');
  const [sk, setSk] = useState('');
  const [endpoint, setEndpoint] = useState('https://aihc.bj.baidubce.com');
  const [focusedField, setFocusedField] = useState<'ak' | 'sk' | 'endpoint' | 'submit' | 'cancel'>('ak');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!ak.trim() || !sk.trim() || !endpoint.trim()) {
      setSubmitError('Access Key, Secret Key, and Endpoint are all required.');
      return;
    }
    
    setSubmitError(null);
    try {
      await onSubmit(ak.trim(), sk.trim(), endpoint.trim());
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Authentication failed');
    }
  };

  useInput((input, key) => {
    // 过滤粘贴相关的控制序列
    let cleanInput = (input || '')
      // 过滤 ESC 开头的控制序列（如 \u001b[200~、\u001b[201~ 等）
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // eslint-disable-line no-control-regex
      // 过滤粘贴开始标记 [200~
      .replace(/\[200~/g, '')
      // 过滤粘贴结束标记 [201~
      .replace(/\[201~/g, '')
      // 过滤单独的 [ 和 ~ 字符（可能是粘贴标记的残留）
      .replace(/^\[|~$/g, '');

    // 再过滤所有不可见字符（ASCII < 32，除了回车换行）
    cleanInput = cleanInput
      .split('')
      .filter((ch) => ch.charCodeAt(0) >= 32)
      .join('');

    if (cleanInput.length > 0) {
      if (focusedField === 'ak') {
        setAk((prev) => prev + cleanInput);
      } else if (focusedField === 'sk') {
        setSk((prev) => prev + cleanInput);
      } else if (focusedField === 'endpoint') {
        setEndpoint((prev) => prev + cleanInput);
      }
      return;
    }

    // 检查是否是 Enter 键（通过检查输入是否包含换行符）
    if (input.includes('\n') || input.includes('\r')) {
      if (focusedField === 'submit') {
        handleSubmit();
      } else if (focusedField === 'cancel') {
        onCancel();
      } else {
        // Move to next field
        if (focusedField === 'ak') {
          setFocusedField('sk');
        } else if (focusedField === 'sk') {
          setFocusedField('endpoint');
        } else if (focusedField === 'endpoint') {
          setFocusedField('submit');
        }
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    // Handle Tab key for field navigation
    if (key.tab) {
      if (focusedField === 'ak') {
        setFocusedField('sk');
      } else if (focusedField === 'sk') {
        setFocusedField('endpoint');
      } else if (focusedField === 'endpoint') {
        setFocusedField('submit');
      } else if (focusedField === 'submit') {
        setFocusedField('cancel');
      } else {
        setFocusedField('ak');
      }
      return;
    }

    // Handle arrow keys for field navigation
    if (key.upArrow) {
      if (focusedField === 'sk') {
        setFocusedField('ak');
      } else if (focusedField === 'endpoint') {
        setFocusedField('sk');
      } else if (focusedField === 'submit') {
        setFocusedField('endpoint');
      } else if (focusedField === 'cancel') {
        setFocusedField('submit');
      }
      return;
    }

    if (key.downArrow) {
      if (focusedField === 'ak') {
        setFocusedField('sk');
      } else if (focusedField === 'sk') {
        setFocusedField('endpoint');
      } else if (focusedField === 'endpoint') {
        setFocusedField('submit');
      } else if (focusedField === 'submit') {
        setFocusedField('cancel');
      }
      return;
    }

    // Handle backspace - check both key.backspace and delete key
    if (key.backspace || key.delete) {
      if (focusedField === 'ak') {
        setAk((prev) => prev.slice(0, -1));
      } else if (focusedField === 'sk') {
        setSk((prev) => prev.slice(0, -1));
      } else if (focusedField === 'endpoint') {
        setEndpoint((prev) => prev.slice(0, -1));
      }
      return;
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Baidu Cloud Authentication</Text>

      <Box marginTop={1}>
        <Text>Enter your Baidu Cloud credentials:</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>Access Key (AK):</Text>
        <Box>
          <Text>
            {focusedField === 'ak' ? '> ' : '  '}
            {ak || ' '}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>Secret Key (SK):</Text>
        <Box>
          <Text>
            {focusedField === 'sk' ? '> ' : '  '}
            {sk || ' '}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>Endpoint:</Text>
        <Box>
          <Text>
            {focusedField === 'endpoint' ? '> ' : '  '}
            {endpoint || ' '}
          </Text>
        </Box>
      </Box>

      {(submitError || error) && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{submitError || error}</Text>
        </Box>
      )}

      {loading && (
        <Box marginTop={1}>
          <Text color={Colors.AccentBlue}>Authenticating...</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text
          color={focusedField === 'submit' ? Colors.AccentBlue : undefined}
          bold={focusedField === 'submit'}
        >
          {focusedField === 'submit' ? '→ ' : '  '}
          Authenticate
        </Text>

        <Box marginLeft={1}>
          <Text
            color={focusedField === 'cancel' ? Colors.AccentBlue : undefined}
            bold={focusedField === 'cancel'}
          >
            {focusedField === 'cancel' ? '→ ' : '  '}
            Cancel
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Note: Your credentials will be stored securely in environment variables.
        </Text>
      </Box>
    </Box>
  );
}