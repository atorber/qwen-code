/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Find .env file in current directory or parent directories
 */
export function findEnvFile(startDir: string): string | null {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    currentDir = path.dirname(currentDir);
  }

  // If not found, return path in current working directory
  return path.join(startDir, '.env');
}

/**
 * Save or update environment variables in .env file
 */
export function saveToEnvFile(variables: Record<string, string>): void {
  const envPath = findEnvFile(process.cwd());
  
  if (!envPath) {
    throw new Error('Could not determine .env file location');
  }
  
  let envContent = '';
  
  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Parse existing environment variables
  const lines = envContent.split('\n');
  const existingVars = new Map<string, number>();
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        existingVars.set(key, index);
      }
    }
  });

  // Update or add new variables
  Object.entries(variables).forEach(([key, value]) => {
    const lineIndex = existingVars.get(key);
    if (lineIndex !== undefined) {
      if (value === '') {
        // Remove the variable by clearing the line
        lines[lineIndex] = '';
      } else {
        // Update existing variable
        lines[lineIndex] = `${key}=${value}`;
      }
    } else if (value !== '') {
      // Add new variable (only if not empty)
      lines.push(`${key}=${value}`);
    }
  });

  // Filter out empty lines and write back to file
  const filteredLines = lines.filter(line => line.trim() !== '');
  fs.writeFileSync(envPath, filteredLines.join('\n') + '\n', 'utf-8');
}

