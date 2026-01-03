import { Injectable, OnModuleInit } from '@nestjs/common'
import { setLogDirectoryProvider } from '@acta/logging'

import type { Profile } from '@acta/profiles'

import { createProfileServiceState, ProfileServiceCore, type ProfileUpdatePatch } from './profile'

/**
 * Code Map: ProfileService (NestJS Injectable wrapper)
 * - CID:profile-service-001 → Main service class (NestJS wrapper)
 * - CID:profile-service-002 → Constructor/delegation setup
 * - CID:profile-service-003 → Lifecycle hooks (NestJS)
 * - CID:profile-service-004 → State query methods
 * - CID:profile-service-005 → Directory resolution methods
 * - CID:profile-service-006 → Profile CRUD operations
 * 
 * Quick lookup: grep -n "CID:profile-service-" apps/runtime/src/profile.service.ts
 */

// CID:profile-service-001 - Main service class (NestJS wrapper)
// Purpose: NestJS Injectable wrapper around ProfileServiceCore
// Uses: Injectable decorator, OnModuleInit interface, ProfileServiceCore
// Used by: RuntimeWsIpcServer as dependency, task handlers, profile handlers
@Injectable()
export class ProfileService implements OnModuleInit {
  private readonly core: ProfileServiceCore

  // CID:profile-service-002 - Constructor/delegation setup
  // Purpose: Initialize core service with profile state
  // Uses: createProfileServiceState factory, ProfileServiceCore
  // Used by: NestJS dependency injection system
  constructor(profileRoot?: string) {
    this.core = new ProfileServiceCore(createProfileServiceState(profileRoot))
  }

  // CID:profile-service-003 - Lifecycle hooks (NestJS)
  // Purpose: Delegate NestJS lifecycle events and configure logging
  // Uses: OnModuleInit interface, core.init, setLogDirectoryProvider
  // Used by: NestJS framework during application startup
  async onModuleInit(): Promise<void> {
    await this.core.init()
    setLogDirectoryProvider(() => this.core.getActiveLogsDir())
  }

  async init(): Promise<void> {
    await this.core.init()
  }

  // CID:profile-service-004 - State query methods
  // Purpose: Provide read-only access to current profile state
  // Uses: ProfileServiceCore state methods
  // Used by: RuntimeWsIpcServer for profile switching and status checks
  getActiveProfileId(): string | null {
    return this.core.getActiveProfileId()
  }

  getActiveLogsDir(): string | null {
    return this.core.getActiveLogsDir()
  }

  getActiveMemoryDir(): string | null {
    return this.core.getActiveMemoryDir()
  }

  // CID:profile-service-005 - Directory resolution methods
  // Purpose: Resolve profile-specific directory paths
  // Uses: ProfileServiceCore directory resolution
  // Used by: Task execution for logs, memory, and trust directories
  async getLogsDir(profileId?: string): Promise<string> {
    return await this.core.getLogsDir(profileId)
  }

  async getMemoryDir(profileId?: string): Promise<string> {
    return await this.core.getMemoryDir(profileId)
  }

  async getTrustDir(profileId?: string): Promise<string> {
    return await this.core.getTrustDir(profileId)
  }

  // CID:profile-service-006 - Profile CRUD operations
  // Purpose: Delegate profile management operations to core
  // Uses: ProfileServiceCore CRUD methods, ProfileUpdatePatch type
  // Used by: RuntimeWsIpcServer profile handlers and IPC message routing
  async getActiveProfile(): Promise<Profile | null> {
    return await this.core.getActiveProfile()
  }

  async getProfile(profileId?: string): Promise<Profile> {
    return await this.core.getProfile(profileId)
  }

  async list(): Promise<Profile[]> {
    return await this.core.list()
  }

  async create(opts: { name: string; profileId?: string }): Promise<Profile> {
    return await this.core.create(opts)
  }

  async delete(profileId: string, opts?: { deleteFiles?: boolean }): Promise<void> {
    await this.core.delete(profileId, opts)
  }

  async switch(profileId: string): Promise<Profile> {
    return await this.core.switch(profileId)
  }

  async update(profileId: string, patch: ProfileUpdatePatch): Promise<Profile> {
    return await this.core.update(profileId, patch)
  }
}
