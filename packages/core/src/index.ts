import type { FoundationRepository } from '../../database/src/repository.js';
import { moduleCatalog } from '../../modules/src/catalog.js';
import { PermissionManager } from './permission-manager.js';
import { GuildManager } from './guild-manager.js';
import { ConfigurationManager } from './configuration-manager.js';
import { ModuleManager } from './module-manager.js';

export function createCore(repository: FoundationRepository, ownerId: string, messageEventsEnabled = true, memberEventsEnabled = true, r2Configured = false) {
  const permissions = new PermissionManager(repository, ownerId);
  return {
    repository, permissions,
    guilds: new GuildManager(repository, permissions),
    configuration: new ConfigurationManager(repository, permissions),
    modules: new ModuleManager(repository, permissions, moduleCatalog.map((definition) => (definition.id === 'PT-01' && !messageEventsEnabled) || (definition.id === 'PT-02' && !memberEventsEnabled) || (definition.id === 'PT-10' && (!messageEventsEnabled || !r2Configured)) ? { ...definition, available: false, description: `${definition.description}；本次程序缺少所需 Gateway Intents 或選用環境設定` } : definition)),
  };
}
export type Core = ReturnType<typeof createCore>;
