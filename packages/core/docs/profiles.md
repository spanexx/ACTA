# Profile Management

## Purpose
Multi-user, multi-profile support with complete isolation on one machine.

## Profile Isolation
Nothing leaks across profiles. Ever.
- Memory
- Permissions
- Trust rules
- Plugins
- Configuration

## Profile Structure
```
{dataDir}/profiles/{profileId}/
├── config.json      # Profile-specific settings
├── memory/          # Short-term memory
├── long-term/       # Long-term memory (opt-in)
├── plugins/         # Installed plugins
└── logs/           # Profile-specific logs
```

## Profile Manager API
```ts
interface ProfileManager {
  listProfiles(): Promise<ProfileInfo[]>
  createProfile(profileId: string, initialConfig?: Partial<ActaConfig>): Promise<void>
  deleteProfile(profileId: string): Promise<void>
  switchProfile(profileId: string): Promise<void>
  getActiveProfile(): Promise<Profile>
}
```

## Profile Schema
```ts
interface Profile {
  id: string
  name: string
  createdAt: Date
  lastActive: Date
  config: ActaConfig
  isActive: boolean
}
```

## Default Profile
- ID: `default`
- Created on first run if none exists
- Conservative security settings
- Local-first model preferences

## Profile Lifecycle
1. **Creation**: Initialize directory structure
2. **Activation**: Load config, set as active
3. **Isolation**: Separate memory, permissions, plugins
4. **Deletion**: Archive or purge data

## Security Rules
- Profiles cannot access each other's data
- Plugin isolation per profile
- Memory never shared across profiles
- Trust rules are profile-specific

## Configuration Inheritance
- System defaults → Profile defaults → User overrides
- Profile config overrides system config
- Environment variables apply globally

## Future Enhancements
- Profile templates
- Profile import/export
- Multi-profile sessions
- Profile sharing (collaboration)
