/**
 * Provider Factory
 * 
 * Central factory for creating and managing LLM provider instances.
 * Supports registration of new providers and validation of configurations.
 */

import { BaseLLMProvider } from './base-provider';
import { ProviderConfig } from '../types/provider-config';

export class ProviderFactory {
  private static providers: Map<string, typeof BaseLLMProvider> = new Map();

  /**
   * Register a provider class with the factory
   */
  static registerProvider(type: string, providerClass: typeof BaseLLMProvider): void {
    if (this.providers.has(type)) {
      console.warn(`Provider type '${type}' is being overridden`);
    }
    this.providers.set(type, providerClass);
  }

  /**
   * Create a provider instance from configuration
   */
  static async createProvider(config: ProviderConfig): Promise<BaseLLMProvider> {
    const ProviderClass = this.providers.get(config.type);
    
    if (!ProviderClass) {
      const availableTypes = Array.from(this.providers.keys()).join(', ');
      throw new Error(
        `Unknown provider type: ${config.type}. Available types: ${availableTypes}`
      );
    }

    const provider = new (ProviderClass as any)(config) as BaseLLMProvider;
    
    // Validate configuration
    if (!provider.validateConfig()) {
      throw new Error(`Invalid configuration for provider: ${config.type}`);
    }

    try {
      // Initialize provider
      await provider.initialize();
    } catch (error: any) {
      throw new Error(
        `Failed to initialize ${config.type} provider: ${error.message}`
      );
    }
    
    return provider;
  }

  /**
   * Get list of supported provider types
   */
  static getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider type is supported
   */
  static isProviderSupported(type: string): boolean {
    return this.providers.has(type);
  }

  /**
   * Validate provider configuration without creating instance
   */
  static validateConfig(config: ProviderConfig): boolean {
    const ProviderClass = this.providers.get(config.type);
    if (!ProviderClass) {
      return false;
    }

    try {
      const tempProvider = new (ProviderClass as any)(config) as BaseLLMProvider;
      return tempProvider.validateConfig();
    } catch {
      return false;
    }
  }

  /**
   * Get provider class for a given type (for advanced use cases)
   */
  static getProviderClass(type: string): typeof BaseLLMProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Create multiple providers from a configuration object
   */
  static async createProviders(
    configs: Record<string, ProviderConfig>
  ): Promise<Record<string, BaseLLMProvider>> {
    const providers: Record<string, BaseLLMProvider> = {};
    const errors: string[] = [];

    for (const [name, config] of Object.entries(configs)) {
      try {
        providers[name] = await this.createProvider(config);
      } catch (error: any) {
        errors.push(`${name}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Failed to create some providers:\n${errors.join('\n')}`
      );
    }

    return providers;
  }

  /**
   * Get information about all registered providers
   */
  static getProviderInfo(): Array<{
    type: string;
    className: string;
    supported: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([type, providerClass]) => ({
      type,
      className: providerClass.name,
      supported: true,
    }));
  }
}
