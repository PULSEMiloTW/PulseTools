import type { ZodType } from 'zod';
import type { FoundationRepository } from '../../database/src/repository.js';
import type { ModuleHealth, ModuleId } from '../../shared/src/models.js';

export interface ModuleContext { guildId: string; repository: FoundationRepository }
export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  version: string;
  description: string;
  available: boolean;
  dependencies: readonly ModuleId[];
  requiredPermissions: readonly string[];
  requiredGatewayIntents: readonly string[];
  configurationSchema: ZodType;
  slashCommands: readonly string[];
  eventHandlers: Readonly<Record<string, (context: ModuleContext, payload: unknown) => Promise<void>>>;
  initialize(context: ModuleContext): Promise<void>;
  shutdown(context: ModuleContext): Promise<void>;
  health(context: ModuleContext): Promise<ModuleHealth>;
}
