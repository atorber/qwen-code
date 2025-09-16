import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { Colors } from '../colors.js';

interface ModelInputFormProps {
  serviceName: string;
  onSubmit: (model: string) => void;
  onCancel: () => void;
}

export function ModelInputForm({
  serviceName,
  onSubmit,
  onCancel,
}: ModelInputFormProps) {
  const [model, setModel] = useState('');
  const [focusedField, setFocusedField] = useState<'input' | 'submit' | 'cancel'>('input');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = () => {
    // 如果用户没有输入model，直接按回车，则设置为'aihc'
    const finalModel = model.trim() || 'aihc';
    setSubmitError(null);
    onSubmit(finalModel);
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
      if (focusedField === 'input') {
        setModel((prev) => prev + cleanInput);
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
        // 在输入框中按回车，提交表单
        handleSubmit();
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    // Handle Tab key for field navigation
    if (key.tab) {
      if (focusedField === 'input') {
        setFocusedField('submit');
      } else if (focusedField === 'submit') {
        setFocusedField('cancel');
      } else {
        setFocusedField('input');
      }
      return;
    }

    // Handle arrow keys for field navigation
    if (key.upArrow) {
      if (focusedField === 'submit') {
        setFocusedField('input');
      } else if (focusedField === 'cancel') {
        setFocusedField('submit');
      }
      return;
    }

    if (key.downArrow) {
      if (focusedField === 'input') {
        setFocusedField('submit');
      } else if (focusedField === 'submit') {
        setFocusedField('cancel');
      }
      return;
    }

    // Handle backspace - check both key.backspace and delete key
    if (key.backspace || key.delete) {
      if (focusedField === 'input') {
        setModel((prev) => prev.slice(0, -1));
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
      <Text bold>Model Required</Text>

      <Box marginTop={1}>
        <Text>The selected service &quot;{serviceName}&quot; requires a model.</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>Model:</Text>
        <Box>
          <Text>
            {focusedField === 'input' ? '> ' : '  '}
            {model || ' '}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Note: Press Enter to use &apos;aihc&apos; if you don&apos;t have a model.
        </Text>
      </Box>

      {(submitError) && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{submitError}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text
          color={focusedField === 'submit' ? Colors.AccentBlue : undefined}
          bold={focusedField === 'submit'}
        >
          {focusedField === 'submit' ? '→ ' : '  '}
          Submit
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
    </Box>
  );
}