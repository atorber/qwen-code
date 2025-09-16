/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { BaiduModelSelector } from './BaiduModelSelector.js';
import { Config } from '@qwen-code/qwen-code-core';
import { useBaiduModelSelection } from '../hooks/useBaiduModelSelection.js';

interface BaiduModelSelectionDialogProps {
  config: Config;
  onModelSelected: () => void;
  onCancel: () => void;
}

export function BaiduModelSelectionDialog({
  config,
  onModelSelected,
  onCancel,
}: BaiduModelSelectionDialogProps) {
  const {
    models,
    loading,
    error,
    handleModelSelect,
  } = useBaiduModelSelection(config);

  const handleModelSelectWrapper = (modelId: string) => {
    handleModelSelect(modelId);
    onModelSelected();
  };

  return (
    <Box flexDirection="column">
      <BaiduModelSelector
        models={models}
        loading={loading}
        error={error}
        onModelSelect={handleModelSelectWrapper}
        onCancel={onCancel}
      />
    </Box>
  );
}