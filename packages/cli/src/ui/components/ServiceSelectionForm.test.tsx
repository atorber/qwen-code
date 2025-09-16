/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ServiceSelectionForm } from './ServiceSelectionForm.js';

describe('ServiceSelectionForm', () => {
  const mockServices = [
    {
      id: 'service-1',
      name: 'Test Service 1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      region: 'bj',
      resourcePoolId: 'pool-1',
      resourcePoolName: 'Pool 1',
      networkType: 'vpc',
      queueName: 'queue-1',
      resourceSpec: {
        cpus: 2,
        memory: 4096,
      },
      hpa: {},
      config: {
        apiKey: 'test-api-key-1',
        baseUrl: 'https://test-service-1.example.com',
        model: 'test-model-1',
      },
      status: 2,
    },
    {
      id: 'service-2',
      name: 'Test Service 2',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      region: 'bj',
      resourcePoolId: 'pool-2',
      resourcePoolName: 'Pool 2',
      networkType: 'vpc',
      queueName: 'queue-2',
      resourceSpec: {
        cpus: 4,
        memory: 8192,
      },
      hpa: {},
      config: {
        apiKey: '', // Empty API key to test the new functionality
        baseUrl: 'https://test-service-2.example.com',
        model: 'test-model-2',
      },
      status: 2,
    },
    {
      id: 'service-3',
      name: 'Test Service 3',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      region: 'bj',
      resourcePoolId: 'pool-3',
      resourcePoolName: 'Pool 3',
      networkType: 'vpc',
      queueName: 'queue-3',
      resourceSpec: {
        cpus: 4,
        memory: 8192,
      },
      hpa: {},
      config: {
        apiKey: 'test-api-key-3',
        baseUrl: 'https://test-service-3.example.com',
        model: '', // Empty model to test the new functionality
      },
      status: 2,
    },
    {
      id: 'service-4',
      name: 'Test Service 4',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      region: 'bj',
      resourcePoolId: 'pool-4',
      resourcePoolName: 'Pool 4',
      networkType: 'vpc',
      queueName: 'queue-4',
      resourceSpec: {
        cpus: 4,
        memory: 8192,
      },
      hpa: {},
      config: {
        apiKey: '', // Empty API key
        baseUrl: 'https://test-service-4.example.com',
        model: '', // Empty model
      },
      status: 2,
    },
  ];

  const mockOnSelect = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render services list correctly', () => {
    const { lastFrame } = render(
      <ServiceSelectionForm
        services={mockServices}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    expect(lastFrame()).toContain('Test Service 1');
    expect(lastFrame()).toContain('Test Service 2');
    expect(lastFrame()).toContain('Test Service 3');
    expect(lastFrame()).toContain('Test Service 4');
    expect(lastFrame()).toContain('apiKey: test-api-k'); // apiKey is truncated to 10 characters
    expect(lastFrame()).toContain('model: test-mode'); // model is truncated
    expect(lastFrame()).toContain('apiKey: N/A'); // Empty apiKey should show as N/A
    expect(lastFrame()).toContain('model: N/A'); // Empty model should show as N/A
  });

  it('should call onSelect when a service with apiKey and model is selected', () => {
    const { stdin } = render(
      <ServiceSelectionForm
        services={mockServices}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    // Press Enter to select the first service (which has both apiKey and model)
    stdin.write('\r');

    expect(mockOnSelect).toHaveBeenCalledWith(mockServices[0]);
  });

  // Note: Testing the API key and model input forms would require more complex testing setup
  // that involves multiple render cycles and state changes, which is beyond
  // the scope of this basic test.
});