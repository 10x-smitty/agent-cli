/**
 * Configuration Loader
 * 
 * Loads and validates multi-provider configurations from various sources
 * with support for environment variables and user settings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProviderConfig, AgentConfig } from '../types/provider-config';

export class ConfigLoader {
  /**
   * Load configuration from multiple sources with priority order:
   * 1. Current directory .grok/config.json
   * 2. Home directory ~/.grok/config.json  
   * 3. Current directory grok.config.json
   * 4. Default configuration
   */
  static async loadConfig(): Promise<AgentConfig> {
    const configPaths = [
      path.join(process.cwd(), '.grok', 'config.json'),
      path.join(os.homedir(), '.grok', 'config.json'),
      path.join(process.cwd(), 'grok.config.json'),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configData = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(configData) as AgentConfig;
          console.log(`Loaded configuration from: ${configPath}`);
          return this.validateAndEnhanceConfig(config);
        } catch (error: any) {
          console.warn(`Failed to load config from ${configPath}:`, error.message);
        }
      }
    }

    console.log('Using default configuration');
    return this.getDefaultConfig();
  }

  /**
   * Validate and enhance configuration with defaults and environment variables
   */
  private static validateAndEnhanceConfig(config: AgentConfig): AgentConfig {
    // Validate required fields
    if (!config.providers || Object.keys(config.providers).length === 0) {
      throw new Error('No providers configured');
    }

    if (!config.defaultProvider || !config.providers[config.defaultProvider]) {
      throw new Error('Invalid default provider');
    }

    // Enhance provider configs with environment variables
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      config.providers[name] = this.enhanceProviderConfig(providerConfig);
    }

    // Apply global setting defaults
    config.globalSettings = {
      timeout: 30000,
      maxRetries: 3,
      enableFallback: true,
      ...config.globalSettings,
    };

    return config;
  }

  /**
   * Enhance individual provider config with environment variables
   */
  private static enhanceProviderConfig(config: ProviderConfig): ProviderConfig {
    const enhanced = { ...config };

    // Apply environment variable overrides based on provider type
    switch (config.type) {
      case 'grok':
        enhanced.apiKey = enhanced.apiKey || process.env.GROK_API_KEY;
        enhanced.baseURL = enhanced.baseURL || process.env.GROK_BASE_URL;
        break;
      case 'openai':
        enhanced.apiKey = enhanced.apiKey || process.env.OPENAI_API_KEY;
        enhanced.baseURL = enhanced.baseURL || process.env.OPENAI_BASE_URL;
        break;
      case 'claude':
        enhanced.apiKey = enhanced.apiKey || process.env.ANTHROPIC_API_KEY;
        break;
      case 'gemini':
        enhanced.apiKey = enhanced.apiKey || process.env.GOOGLE_API_KEY;
        break;
    }

    return enhanced;
  }

  /**
   * Get default configuration (backward compatible with existing setup)
   */
  private static getDefaultConfig(): AgentConfig {
    return {
      providers: {
        grok: {
          type: 'grok',
          name: 'Grok',
          apiKey: process.env.GROK_API_KEY || '',
          baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
        } as ProviderConfig,
      },
      defaultProvider: 'grok',
      globalSettings: {
        timeout: 30000,
        maxRetries: 3,
        enableFallback: true,
      },
    };
  }

  /**
   * Save configuration to user's home directory
   */
  static async saveConfig(config: AgentConfig): Promise<void> {
    const configDir = path.join(os.homedir(), '.grok');
    const configPath = path.join(configDir, 'config.json');

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Remove sensitive information before saving
    const sanitizedConfig = this.sanitizeConfig(config);
    
    fs.writeFileSync(configPath, JSON.stringify(sanitizedConfig, null, 2));
    console.log(`Configuration saved to: ${configPath}`);
  }

  /**
   * Create a sanitized version of config without API keys for saving
   */
  private static sanitizeConfig(config: AgentConfig): AgentConfig {
    const sanitized: AgentConfig = {
      ...config,
      providers: {},
    };

    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const { apiKey, ...publicConfig } = providerConfig;
      sanitized.providers[name] = {
        ...publicConfig,
        // Only save apiKey if it's not from environment variables
        ...(apiKey && !this.isFromEnvironment(providerConfig) ? { apiKey } : {}),
      };
    }

    return sanitized;
  }

  /**
   * Check if provider config is likely using environment variables
   */
  private static isFromEnvironment(config: ProviderConfig): boolean {
    switch (config.type) {
      case 'grok':
        return config.apiKey === process.env.GROK_API_KEY;
      case 'openai':
        return config.apiKey === process.env.OPENAI_API_KEY;
      case 'claude':
        return config.apiKey === process.env.ANTHROPIC_API_KEY;
      case 'gemini':
        return config.apiKey === process.env.GOOGLE_API_KEY;
      default:
        return false;
    }
  }

  /**
   * Merge user settings from legacy ~/.grok/user-settings.json (backward compatibility)
   */
  static loadLegacyUserSettings(): Partial<ProviderConfig> | null {
    try {
      const settingsPath = path.join(os.homedir(), '.grok', 'user-settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return {
          apiKey: settings.apiKey,
          baseURL: settings.baseURL,
        };
      }
    } catch (error) {
      // Ignore errors, return null
    }
    return null;
  }
}
