# @acta/profiles — Profile Management

> Multi-user, multi-profile support with complete isolation on one machine.

## Purpose
- Manage user profiles with isolated data and configurations
- Enable profile switching without data leakage
- Provide profile-specific trust rules and permissions
- Support profile inheritance and templates

## Core Responsibilities
- **Profile Creation**: Initialize new user profiles with defaults
- **Profile Switching**: Change active profile and reload configuration
- **Profile Isolation**: Ensure complete data separation between profiles
- **Profile Deletion**: Safe removal with data archival options
- **Configuration Management**: Profile-specific settings and preferences
- **Profile Templates**: Standardized profile creation templates

## Expected Files (when fully implemented)
- `src/profile-manager.ts` — Main profile management logic
- `src/profile.ts` — Profile data structure and methods
- `src/templates.ts` — Profile creation templates
- `src/isolation.ts` — Profile isolation enforcement
- `src/config.ts` — Profile configuration management
- `src/types.ts` — Profile-specific interfaces
- `src/index.ts` — Public exports

## Profile Structure
```ts
interface Profile {
  id: string
  name: string
  createdAt: Date
  lastActive: Date
  config: ActaConfig
  isActive: boolean
  metadata?: {
    description?: string
    avatar?: string
    theme?: string
    preferences?: Record<string, any>
  }
}
```

## Profile Manager Interface
```ts
interface ProfileManager {
  listProfiles(): Promise<ProfileInfo[]>
  createProfile(profileId: string, template?: string, initialConfig?: Partial<ActaConfig>): Promise<Profile>
  updateProfile(profileId: string, updates: Partial<Profile>): Promise<Profile>
  deleteProfile(profileId: string, archive?: boolean): Promise<void>
  switchProfile(profileId: string): Promise<void>
  getActiveProfile(): Promise<Profile>
  getProfile(profileId: string): Promise<Profile>
  archiveProfile(profileId: string): Promise<string> // Returns archive path
}
```

## Profile Information
```ts
interface ProfileInfo {
  id: string
  name: string
  description?: string
  createdAt: Date
  lastActive: Date
  isActive: boolean
  config?: Partial<ActaConfig>
}
```

## Profile Templates
```ts
interface ProfileTemplate {
  id: string
  name: string
  description: string
  config: Partial<ActaConfig>
  metadata?: Record<string, any>
}
```

### Default Profile Template
```ts
const defaultProfileTemplate: ProfileTemplate = {
  id: 'default',
  name: 'Default Profile',
  description: 'Standard profile with balanced security settings',
  config: {
    trustLevel: 'medium',
    autoApprove: {
      read_files: true,
      explain_content: true
    },
    blockedTools: [
      'kernel.*',
      'system.*',
      'banking.*',
      'password_manager.*'
    ]
  },
  metadata: {
    category: 'standard',
    recommendedFor: 'general_use'
  }
}
```

### Developer Profile Template
```ts
const developerProfileTemplate: ProfileTemplate = {
  id: 'developer',
  name: 'Developer Profile',
  description: 'Profile with relaxed security for development',
  config: {
    trustLevel: 'high',
    autoApprove: {
      read_files: true,
      write_files: true,
      shell_execute: true,
      network_access: true,
      system_config: true
    },
    blockedTools: []
  },
  metadata: {
    category: 'development',
    recommendedFor: 'software_development'
  }
}
```

## Profile Isolation
```ts
interface ProfileIsolation {
  dataDir: string
  configDir: string
  memoryDir: string
  pluginsDir: string
  logsDir: string
  tempDir: string
}
```

### Directory Structure
```
{dataDir}/profiles/{profileId}/
├── config.json      # Profile-specific configuration
├── memory/          # Short-term memory (JSON)
├── long-term/       # Long-term memory (Phase-2+)
├── plugins/         # Installed plugins
├── logs/           # Profile-specific logs
└── temp/           # Temporary files
```

## Configuration Management
```ts
interface ProfileConfigManager {
  load(profileId: string): Promise<ActaConfig>
  save(profileId: string, config: ActaConfig): Promise<void>
  validate(config: ActaConfig): ValidationResult
  merge(baseConfig: Partial<ActaConfig>, overrideConfig: Partial<ActaConfig>): ActaConfig
  getDefaults(): Partial<ActaConfig>
}
```

## Profile Switching
```ts
interface ProfileSwitcher {
  switch(profileId: string): Promise<ProfileSwitchResult>
  getCurrent(): Promise<string>
  getHistory(): Promise<ProfileSwitchHistory[]>
}
```

### Profile Switch Result
```ts
interface ProfileSwitchResult {
  success: boolean
  profile: Profile
  previousProfile?: string
  message?: string
}
```

### Profile Switch History
```ts
interface ProfileSwitchHistory {
  timestamp: Date
  fromProfile: string
  toProfile: string
  reason?: string
  userId: string
}
```

## Security Considerations
- **Data Isolation**: Complete separation of profile data
- **Permission Isolation**: Trust rules never cross-profile boundaries
- **Path Validation**: All paths validated and normalized
- **Access Control**: File permissions (600 or 600) on profile directories
- **Audit Trail**: All profile operations logged
- **Encryption**: Optional encryption for sensitive profile data

## Best Practices
- **Profile Templates**: Use standardized templates for consistency
- **Configuration Validation**: Strict validation of all profile settings
- **Graceful Migration**: Handle profile format changes
- **User Privacy**: Never share profile data without consent
- **Backup & Recovery**: Regular profile backups with restore capability
- **Performance**: Optimize profile loading and switching speed

## Profile Events
```ts
interface ProfileEvent {
  type: 'created' | 'updated' | 'deleted' | 'switched' | 'login' | 'logout'
  timestamp: number
  profileId: string
  userId: string
  data?: any
}
```

## Profile Analytics
```ts
interface ProfileAnalytics {
  getActiveUsers(): Promise<string[]>
  getProfileUsage(profileId: string): Promise<ProfileUsageStats>
  getSwitchFrequency(): Promise<ProfileSwitchFrequency>
  exportProfileData(profileId: string, format: 'json' | 'csv'): Promise<string>
}
```

### Usage Statistics
```ts
interface ProfileUsageStats {
  totalSessions: number
  averageSessionDuration: number
  mostUsedTools: string[]
  commonActions: string[]
  lastActivity: Date
}
```

## Future Enhancements
- **Profile Synchronization**: Cloud-based profile sync
- **Multi-Device Support**: Profile continuity across devices
- **Profile Analytics**: Advanced usage insights and recommendations
- **Profile Templates Marketplace**: Community-contributed templates
- **Role-Based Profiles**: Different permission sets per user role
