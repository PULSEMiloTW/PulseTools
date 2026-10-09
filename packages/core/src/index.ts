import type { FoundationRepository } from '../../database/src/repository.js';
import { moduleCatalog } from '../../modules/src/catalog.js';
import { PermissionManager } from './permission-manager.js';
import { GuildManager } from './guild-manager.js';
import { ConfigurationManager } from './configuration-manager.js';
import { ModuleManager } from './module-manager.js';

export function createCore(repository: FoundationRepository, ownerId: string) {
  const permissions = new PermissionManager(repository, ownerId);
  return {
    repository, permissions,
    guilds: new GuildManager(repository, permissions),
    configuration: new ConfigurationManager(repository, permissions),
    modules: new ModuleManager(repository, permissions, moduleCatalog),
  };
}
export type Core = ReturnType<typeof createCore>;
