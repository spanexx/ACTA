/*
 * Code Map: Tool Loader
 * - ToolLoader class orchestrates loading core tools, plugin manifests, and plugin modules.
 * - Helper methods for reading manifests + importing tool modules from directories.
 *
 * CID Index:
 * CID:tools-loader-001 -> ToolLoader class
 * CID:tools-loader-002 -> loadCoreTools
 * CID:tools-loader-003 -> loadPluginManifests
 * CID:tools-loader-004 -> loadPlugin
 * CID:tools-loader-005 -> loadToolFromDirectory
 * CID:tools-loader-006 -> resolveManifest
 *
 * Lookup: rg -n "CID:tools-loader-" packages/tools/src/loader.ts
 */
import { ToolRegistry } from './registry'
import { ActaTool, ToolManifest } from '@acta/core'
import { Logger } from '@acta/logging'
import * as fs from 'fs/promises'
import * as path from 'path'

// CID:tools-loader-001 - ToolLoader
// Purpose: Coordinates registry, logger, and filesystem paths for tool loading.
// Uses: ToolRegistry, Logger, fs/path
// Used by: tools package consumers (runtime startup)
export class ToolLoader {
  private registry: ToolRegistry
  private logger: Logger
  private coreToolsPath: string

  constructor(registry: ToolRegistry, logger: Logger, coreToolsPath?: string) {
    this.registry = registry
    this.logger = logger
    this.coreToolsPath = coreToolsPath || path.join(__dirname, '..', 'core')
  }

  // CID:tools-loader-002 - loadCoreTools
  // Purpose: Loads all tools from the bundled core directory and registers them.
  // Uses: fs.readdir, loadToolFromDirectory()
  async loadCoreTools(): Promise<void> {
    this.logger.info('Loading core tools', { path: this.coreToolsPath })

    try {
      const coreToolsDir = await fs.readdir(this.coreToolsPath, { withFileTypes: true })
      
      for (const entry of coreToolsDir) {
        if (entry.isDirectory()) {
          const tool = await this.loadToolFromDirectory(path.join(this.coreToolsPath, entry.name))
          this.registry.register(tool)
        }
      }

      this.logger.info('Core tools loaded successfully', {
        count: this.registry.getToolCount()
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn('Core tools directory not found, skipping core tool loading', {
          path: this.coreToolsPath
        })
      } else {
        this.logger.error('Error loading core tools', error)
        throw error
      }
    }
  }

  // CID:tools-loader-003 - loadPluginManifests
  // Purpose: Resolves manifests from plugin directory for previewing available tools.
  // Uses: fs.stat/readdir, resolveManifest()
  async loadPluginManifests(pluginPath: string): Promise<ToolManifest[]> {
    this.logger.info('Resolving plugin manifests', { path: pluginPath })

    try {
      const resolvedPath = path.resolve(pluginPath)
      const stats = await fs.stat(resolvedPath)

      if (!stats.isDirectory()) {
        throw new Error(`Plugin path is not a directory: ${resolvedPath}`)
      }

      const pluginDir = await fs.readdir(resolvedPath, { withFileTypes: true })
      const manifests: ToolManifest[] = []

      for (const entry of pluginDir) {
        if (entry.isDirectory()) {
          const manifest = await this.resolveManifest(path.join(resolvedPath, entry.name))
          if (manifest) {
            manifests.push(manifest)
          }
        }
      }

      this.logger.info('Plugin manifests resolved successfully', {
        path: pluginPath,
        count: manifests.length
      })

      return manifests
    } catch (error) {
      this.logger.error('Error resolving plugin manifests', error)
      throw error
    }
  }

  // CID:tools-loader-004 - loadPlugin
  // Purpose: Loads a specific plugin tool directory and registers it.
  async loadPlugin(pluginPath: string, toolId: string): Promise<void> {
    this.logger.info('Loading plugin tool', { path: pluginPath, toolId })

    try {
      const tool = await this.loadToolFromDirectory(pluginPath, toolId)
      this.registry.register(tool)
      this.logger.info('Plugin tool loaded successfully', { toolId })
    } catch (error) {
      this.logger.error('Error loading plugin tool', { toolId, error })
      throw error
    }
  }

  // CID:tools-loader-005 - loadToolFromDirectory
  // Purpose: Reads manifest + dynamic imports tool entry module; validates structure.
  // Uses: fs.readFile, import(), manifest parsing
  private async loadToolFromDirectory(toolDir: string, expectedToolId?: string): Promise<ActaTool> {
    const manifestPath = path.join(toolDir, 'manifest.json')
    
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      const manifest: ToolManifest = JSON.parse(manifestContent)

      if (expectedToolId && manifest.id !== expectedToolId) {
        throw new Error(
          `Tool ID mismatch: expected ${expectedToolId}, found ${manifest.id}`
        )
      }

      const entryPath = path.join(toolDir, manifest.entry)
      
      const toolModule = await import(entryPath)
      const tool: ActaTool = toolModule.default || toolModule[manifest.id.replace(/\./g, '_')]

      if (!tool) {
        throw new Error(`Tool not found in module: ${manifest.id}`)
      }

      if (!tool.meta || !tool.execute) {
        throw new Error(`Invalid tool structure: ${manifest.id}`)
      }

      return tool
    } catch (error) {
      this.logger.error(`Failed to load tool from directory: ${toolDir}`, error)
      throw error
    }
  }

  // CID:tools-loader-006 - resolveManifest
  // Purpose: Reads manifest.json for plugin listing; logs warning on failure.
  private async resolveManifest(toolDir: string): Promise<ToolManifest | null> {
    try {
      const manifestPath = path.join(toolDir, 'manifest.json')
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      return JSON.parse(manifestContent)
    } catch (error) {
      this.logger.warn(`Failed to resolve manifest from: ${toolDir}`, error)
      return null
    }
  }
}
