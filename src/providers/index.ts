/**
 * Providers Module Index
 * 
 * Exports all provider classes and handles automatic registration
 * with the ProviderFactory
 */

import { ProviderFactory } from './provider-factory';
import { GrokProvider } from './grok-provider';
import { OpenAIProvider } from './openai-provider';

// Auto-register providers with the factory
ProviderFactory.registerProvider('grok', GrokProvider);
ProviderFactory.registerProvider('openai', OpenAIProvider);

// Export all provider classes and factory
export { 
  BaseLLMProvider 
} from './base-provider';

export { 
  ProviderFactory 
} from './provider-factory';

export { 
  GrokProvider 
} from './grok-provider';

export { 
  OpenAIProvider 
} from './openai-provider';

// Export provider utilities
export const getRegisteredProviders = () => ProviderFactory.getSupportedProviders();
export const isProviderSupported = (type: string) => ProviderFactory.isProviderSupported(type);
export const createProvider = (config: any) => ProviderFactory.createProvider(config);
