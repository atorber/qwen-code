/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';

interface BaiduModelSelectorProps {
  models: Array<{ id: string; name: string; description: string }>;
  loading: boolean;
  error: string | null;
  onModelSelect: (modelId: string) => void;
  onCancel: () => void;
}

export function BaiduModelSelector({
  models,
  loading,
  error,
  onModelSelect,
  onCancel,
}: BaiduModelSelectorProps) {
  const items = models.map(model => ({
    label: `${model.name} - ${model.description}`,
    value: model.id
  }));

  const handleSelect = (modelId: string) => {
    onModelSelect(modelId);
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onCancel();
      }
    },
    { isActive: true },
  );

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>Select Baidu Cloud Model</Text>
        <Box marginTop={1}>
          <Text>Loading models...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>Select Baidu Cloud Model</Text>
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={Colors.AccentBlue}>(Press Esc to cancel)</Text>
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
      <Text bold>Select Baidu Cloud Model</Text>

      <Box marginTop={1}>
        <Text>Choose a model to use for inference:</Text>
      </Box>

      {models.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <RadioButtonSelect
            items={items}
            onSelect={handleSelect}
          />
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text>No models available.</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select, Esc to cancel.</Text>
      </Box>
    </Box>
  );
}