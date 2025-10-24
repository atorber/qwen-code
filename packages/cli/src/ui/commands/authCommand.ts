/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  CommandKind, 
  OpenDialogActionReturn, 
  SlashCommand, 
  MessageActionReturn,
  CommandContext,
} from './types.js';
import { AuthType } from '@qwen-code/qwen-code-core';

const logoutCommand: SlashCommand = {
  name: 'logout',
  description: 'Clear authentication credentials',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, _args: string): Promise<MessageActionReturn> => {
    try {
      const { saveToEnvFile } = await import('../../utils/envFile.js');
      
      // Get current auth type
      const currentAuthType = context.services.settings?.merged.selectedAuthType;
      
      let clearedVars: string[] = [];
      
      // Clear environment variables based on auth type
      if (currentAuthType === AuthType.AIHC) {
        // Clear AIHC credentials
        delete process.env['AIHC_AK'];
        delete process.env['AIHC_SK'];
        delete process.env['AIHC_ENDPOINT'];
        
        // Remove from .env file
        try {
          saveToEnvFile({
            AIHC_AK: '',
            AIHC_SK: '',
            AIHC_ENDPOINT: '',
          });
        } catch (envError) {
          console.warn('⚠️  Could not update .env file:', envError);
        }
        
        clearedVars = ['AIHC_AK', 'AIHC_SK', 'AIHC_ENDPOINT'];
      } else if (currentAuthType === AuthType.BAIDU_CLOUD) {
        // Clear Baidu Cloud credentials
        delete process.env['BAIDU_CLOUD_AK'];
        delete process.env['BAIDU_CLOUD_SK'];
        delete process.env['BAIDU_CLOUD_ENDPOINT'];
        delete process.env['BAIDU_CLOUD_SERVICE_ID'];
        delete process.env['BAIDU_CLOUD_SERVICE_NAME'];
        delete process.env['BAIDU_CLOUD_MODEL_NAME'];
        
        // Remove from .env file
        try {
          saveToEnvFile({
            BAIDU_CLOUD_AK: '',
            BAIDU_CLOUD_SK: '',
            BAIDU_CLOUD_ENDPOINT: '',
            BAIDU_CLOUD_SERVICE_ID: '',
            BAIDU_CLOUD_SERVICE_NAME: '',
            BAIDU_CLOUD_MODEL_NAME: '',
          });
        } catch (envError) {
          console.warn('⚠️  Could not update .env file:', envError);
        }
        
        clearedVars = ['BAIDU_CLOUD_AK', 'BAIDU_CLOUD_SK', 'BAIDU_CLOUD_ENDPOINT', 'BAIDU_CLOUD_SERVICE_*'];
      } else if (currentAuthType === AuthType.USE_OPENAI) {
        // Clear OpenAI credentials
        delete process.env['OPENAI_API_KEY'];
        delete process.env['OPENAI_BASE_URL'];
        delete process.env['OPENAI_MODEL'];
        
        // Remove from .env file
        try {
          saveToEnvFile({
            OPENAI_API_KEY: '',
            OPENAI_BASE_URL: '',
            OPENAI_MODEL: '',
          });
        } catch (envError) {
          console.warn('⚠️  Could not update .env file:', envError);
        }
        
        clearedVars = ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL'];
      } else if (currentAuthType === AuthType.USE_GEMINI) {
        // Clear Gemini API key
        delete process.env['GEMINI_API_KEY'];
        
        // Remove from .env file
        try {
          saveToEnvFile({
            GEMINI_API_KEY: '',
          });
        } catch (envError) {
          console.warn('⚠️  Could not update .env file:', envError);
        }
        
        clearedVars = ['GEMINI_API_KEY'];
      } else {
        return {
          type: 'message',
          messageType: 'info',
          content: `No credentials to clear for authentication type: ${currentAuthType || 'unknown'}`,
        };
      }
      
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Successfully logged out and cleared credentials:\n   ${clearedVars.join(', ')}\n\nUse /auth to log in again.`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Error during logout: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const authCommand: SlashCommand = {
  name: 'auth',
  description: 'change the auth method or logout',
  kind: CommandKind.BUILT_IN,
  subCommands: [logoutCommand],
  action: (_context, args): OpenDialogActionReturn => {
    // If no subcommand, open auth dialog
    if (!args || args.trim().length === 0) {
      return {
        type: 'dialog',
        dialog: 'auth',
      };
    }
    
    // Otherwise, let subcommand handler deal with it
    return {
      type: 'dialog',
      dialog: 'auth',
    };
  },
};
