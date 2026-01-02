import { CommonModule } from '@angular/common'
import { Component, NgZone, OnDestroy, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'

type Unsubscribe = () => void

type PermissionDecision = 'deny' | 'allow_once' | 'allow_always'

type TrustLevel = 0 | 1 | 2 | 3

type ModelProvider = 'ollama' | 'lmstudio' | 'openai' | 'anthropic'

type ProfileInfo = {
  id: string
  name: string
  isActive: boolean
  dataPath: string
}

type ProfileSetupConfig = {
  setupComplete: boolean
  modelProvider?: ModelProvider
  model?: string
  endpoint?: string
  cloudWarnBeforeSending?: boolean
  trustLevel?: TrustLevel
}

type PermissionRequestEvent = {
  id: string
  tool: string
  action?: string
  scope?: string
  input?: string
  output?: string
  reason: string
  risk?: string
  risks?: string[]
  reversible: boolean
  rememberDecision?: boolean
  trustLevel?: number
  cloud?: {
    provider: string
    model?: string
  }
}

type PermissionResponsePayload = {
  requestId: string
  decision: PermissionDecision
  remember?: boolean
}

type ActaApi = {
  ping: () => Promise<string>
  onPermissionRequest: (handler: (event: PermissionRequestEvent) => void) => Unsubscribe
  respondToPermission: (payload: PermissionResponsePayload) => Promise<{ ok: true }>
  demoPermissionRequest: () => Promise<PermissionDecision>
  getTrustLevel: () => Promise<{ trustLevel: TrustLevel; profileId: string }>
  setTrustLevel: (payload: { trustLevel: TrustLevel }) => Promise<{
    ok: true
    trustLevel: TrustLevel
    profileId: string
  }>
  listProfiles: () => Promise<{ profiles: ProfileInfo[]; activeProfileId: string }>
  getActiveProfile: () => Promise<{ profile: ProfileInfo }>
  createProfile: (payload: { name: string }) => Promise<{ ok: true; profile: ProfileInfo }>
  deleteProfile: (payload: { profileId: string; deleteFiles?: boolean }) => Promise<{ ok: true }>
  switchProfile: (payload: { profileId: string }) => Promise<{ ok: true; profile: ProfileInfo }>
  onProfileChanged: (handler: (payload: { profile: ProfileInfo }) => void) => Unsubscribe
  getSetupConfig: () => Promise<{ profileId: string; config: ProfileSetupConfig }>
  completeSetup: (payload: { config: ProfileSetupConfig }) => Promise<{
    ok: true
    profileId: string
    config: ProfileSetupConfig
  }>
  testOllama: (payload: { endpoint: string }) => Promise<{ ok: boolean; models?: string[]; error?: string }>
  openLogsFolder: () => Promise<{ ok: boolean; path: string; error?: string }>
}

declare global {
  interface Window {
    ActaAPI?: ActaApi
  }
}

type ChatMessageType = 'user' | 'acta' | 'system'

type PlanStepStatus = 'pending' | 'in-progress' | 'completed' | 'failed'

type ChatPlanStep = {
  id: string
  title: string
  status: PlanStepStatus
}

type ChatPlanBlock = {
  goal: string
  collapsed: boolean
  steps: ChatPlanStep[]
}

type Attachment = {
  id: string
  name: string
  size: number
  path?: string
}

type ChatMessage = {
  id: string
  type: ChatMessageType
  timestamp: number
  text: string
  attachments?: Attachment[]
  plan?: ChatPlanBlock
}

type ToolOutputStatus = 'waiting_permission' | 'running' | 'completed' | 'error'

type ToolOutputFilter = 'all' | 'active' | 'completed' | 'errors'

type ToolOutputArtifact = {
  path: string
}

type ToolOutputEntry = {
  id: string
  timestamp: number
  tool: string
  status: ToolOutputStatus
  scope?: string
  input?: string
  reason?: string
  preview?: string
  error?: string
  progress?: number
  artifacts?: ToolOutputArtifact[]
  raw: unknown
  expanded: boolean
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="layout">
      <aside class="sidebar" aria-label="Sidebar">
        <div class="sidebar__top">
          <div class="sidebar__logo" aria-label="Acta">A</div>
        </div>
        <div class="sidebar__bottom">
          <button type="button" class="icon-btn" title="Settings" disabled>
            Settings
          </button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="topbar__left">
            <span class="topbar__section">Chat</span>
            <span class="topbar__divider"></span>
            <span class="topbar__title">Quarterly Report Analysis</span>
            <span class="badge">Local</span>
          </div>
          <div class="topbar__right">
            <div class="topbar__trust">
              <span class="topbar__meta">Profile:</span>
              <select
                class="topbar__select"
                name="profile"
                [(ngModel)]="profileSelection"
                (ngModelChange)="onProfileSelectionChange($event)"
                [disabled]="profilesBusy || permissionModalOpen || trustConfirmOpen"
                aria-label="Profile"
              >
                <option *ngFor="let p of profiles; trackBy: trackByProfileId" [ngValue]="p.id">
                  {{ p.name }}
                </option>
              </select>
              <button
                type="button"
                class="icon-btn"
                (click)="openManageProfiles()"
                [disabled]="profilesBusy || permissionModalOpen || trustConfirmOpen"
              >
                Manage
              </button>
            </div>
            <div class="topbar__trust">
              <span class="topbar__meta">Trust:</span>
              <select
                class="topbar__select"
                name="trustLevel"
                [(ngModel)]="trustSelection"
                (ngModelChange)="onTrustSelectionChange($event)"
                [disabled]="trustBusy || permissionModalOpen || trustConfirmOpen"
                aria-label="Trust level"
              >
                <option [ngValue]="0">Deny (0)</option>
                <option [ngValue]="1">Ask every time (1)</option>
                <option [ngValue]="2">Ask once (2)</option>
                <option [ngValue]="3">Allow (logged) (3)</option>
              </select>
            </div>
            <button
              type="button"
              class="icon-btn"
              (click)="demoPermission()"
              [disabled]="demoPermissionBusy"
            >
              Demo permission
            </button>
            <button
              type="button"
              class="icon-btn"
              (click)="runDemoScenario()"
              [disabled]="demoScenarioBusy || demoPermissionBusy"
            >
              Demo scenario
            </button>
            <button
              type="button"
              class="icon-btn"
              (click)="openLogsFolder()"
              [disabled]="logsBusy"
            >
              Logs
            </button>
            <button
              type="button"
              class="icon-btn"
              (click)="openSetupWizard()"
              [disabled]="setupBusy || permissionModalOpen || trustConfirmOpen"
            >
              Setup
            </button>
            <span class="topbar__meta" *ngIf="demoPermissionStatus">{{ demoPermissionStatus }}</span>
            <span class="topbar__meta" *ngIf="demoScenarioStatus">{{ demoScenarioStatus }}</span>
            <span class="topbar__meta" *ngIf="logsStatus">{{ logsStatus }}</span>
            <span class="topbar__meta">IPC: {{ pingStatus }}</span>
          </div>
        </header>

        <div class="split">
          <section class="chat">
            <div class="chat-messages">
            <article
              *ngFor="let msg of messages; trackBy: trackByMessageId"
              class="chat-message"
              [class.chat-message--user]="msg.type === 'user'"
              [class.chat-message--acta]="msg.type === 'acta'"
              [class.chat-message--system]="msg.type === 'system'"
            >
              <header class="chat-message__meta">
                <span class="chat-message__author">{{ labelForType(msg.type) }}</span>
                <span class="chat-message__time">{{ formatTime(msg.timestamp) }}</span>
              </header>

              <div class="chat-message__text">{{ msg.text }}</div>

              <div class="chat-message__attachments" *ngIf="msg.attachments?.length">
                <span
                  *ngFor="let file of msg.attachments; trackBy: trackByAttachmentId"
                  class="file-chip"
                >
                  {{ fileLabel(file) }}
                </span>
              </div>

              <section *ngIf="msg.plan" class="plan-block">
                <button
                  type="button"
                  class="plan-block__toggle"
                  (click)="togglePlan(msg.id)"
                >
                  <span class="plan-block__toggleTitle">Goal: {{ msg.plan.goal }}</span>
                  <span class="plan-block__toggleHint">{{
                    msg.plan.collapsed ? 'expand' : 'collapse'
                  }}</span>
                </button>

                <div *ngIf="!msg.plan.collapsed" class="plan-block__body">
                  <ul class="plan-block__steps">
                    <li
                      *ngFor="let step of msg.plan.steps; trackBy: trackByPlanStepId"
                      class="plan-step"
                      [attr.data-status]="step.status"
                    >
                      <span class="plan-step__icon">{{ planStepIcon(step.status) }}</span>
                      <span class="plan-step__title">{{ step.title }}</span>
                    </li>
                  </ul>
                </div>
              </section>
            </article>

            </div>

            <form class="composer" (submit)="onSubmit($event)">
              <div class="composer__box">
                <textarea
                  name="draft"
                  [(ngModel)]="draft"
                  class="composer__input"
                  placeholder="Ask a follow up…"
                  (keydown)="onDraftKeydown($event)"
                ></textarea>

                <div class="composer__actions">
                  <div class="composer__actionsLeft">
                    <button type="button" class="icon-btn" (click)="fileInput.click()">
                      Attach
                    </button>
                    <button type="button" class="icon-btn" disabled>Tools</button>
                    <input
                      #fileInput
                      type="file"
                      multiple
                      class="composer__fileInput"
                      (change)="onFileInputChange($event)"
                    />
                  </div>

                  <button
                    type="submit"
                    class="send-btn"
                    [disabled]="!canSend()"
                    aria-label="Send"
                  >
                    Send
                  </button>
                </div>
              </div>

              <div class="composer__attachments" *ngIf="pendingAttachments.length">
                <div class="composer__attachmentsLabel">Attached:</div>
                <div class="composer__chips">
                  <span
                    *ngFor="let file of pendingAttachments; trackBy: trackByAttachmentId"
                    class="file-chip file-chip--removable"
                  >
                    {{ fileLabel(file) }}
                    <button
                      type="button"
                      class="file-chip__remove"
                      (click)="removePendingAttachment(file.id)"
                      aria-label="Remove attachment"
                    >
                      ✕
                    </button>
                  </span>
                </div>
                <div class="composer__note">
                  Note: Files are not read until you allow permission.
                </div>
              </div>
            </form>
          </section>

          <aside class="tool-panel" aria-label="Tool Outputs">
            <header class="tool-panel__header">
              <div class="tool-panel__title">
                <span>Tool Outputs</span>
                <span class="tool-panel__count">{{ toolOutputs.length }}</span>
              </div>

              <div class="tool-panel__controls">
                <select
                  class="tool-panel__select"
                  [(ngModel)]="toolFilter"
                  name="toolFilter"
                  aria-label="Filter tool outputs"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="errors">Errors</option>
                </select>

                <input
                  class="tool-panel__search"
                  type="text"
                  [(ngModel)]="toolSearch"
                  name="toolSearch"
                  placeholder="Search tool or path…"
                />
              </div>

              <div class="tool-panel__actions">
                <button
                  type="button"
                  class="tool-panel__action"
                  (click)="clearCompletedToolOutputs()"
                >
                  Clear completed
                </button>
                <button
                  type="button"
                  class="tool-panel__action"
                  (click)="exportToolOutputs()"
                >
                  Export…
                </button>
              </div>
            </header>

            <div class="tool-panel__list" *ngIf="getVisibleToolOutputs() as outputs">
              <div *ngIf="outputs.length === 0" class="tool-panel__empty">
                No tool executions yet
              </div>

              <article
                *ngFor="let out of outputs; trackBy: trackByToolOutputId"
                class="tool-card"
                [attr.data-status]="out.status"
              >
                <header class="tool-card__header">
                  <div class="tool-card__status">
                    <span class="tool-card__statusIcon">{{ toolStatusIcon(out.status) }}</span>
                    <span class="tool-card__statusText">{{ toolStatusLabel(out.status) }}</span>
                  </div>
                  <span class="tool-card__time">{{ formatTime(out.timestamp) }}</span>
                </header>

                <div class="tool-card__row">
                  <span class="tool-card__label">Tool</span>
                  <span class="tool-card__value mono">{{ out.tool }}</span>
                </div>

                <div class="tool-card__row" *ngIf="out.scope">
                  <span class="tool-card__label">Scope</span>
                  <span class="tool-card__value mono">{{ out.scope }}</span>
                </div>

                <div class="tool-card__row" *ngIf="out.input">
                  <span class="tool-card__label">Input</span>
                  <span class="tool-card__value mono">{{ out.input }}</span>
                </div>

                <div class="tool-card__row" *ngIf="out.reason">
                  <span class="tool-card__label">Reason</span>
                  <span class="tool-card__value">{{ out.reason }}</span>
                </div>

                <div class="tool-card__preview" *ngIf="out.preview">
                  {{ out.preview }}
                </div>

                <div class="tool-card__error" *ngIf="out.error">
                  Error: {{ out.error }}
                </div>

                <div
                  class="tool-card__progress"
                  *ngIf="out.status === 'running' && out.progress !== undefined"
                >
                  <div class="tool-card__progressBar">
                    <div
                      class="tool-card__progressFill"
                      [style.width.%]="out.progress"
                    ></div>
                  </div>
                  <div class="tool-card__progressText">{{ out.progress }}%</div>
                </div>

                <div class="tool-card__artifacts" *ngIf="out.artifacts?.length">
                  <div class="tool-card__artifactsLabel">Artifacts</div>
                  <div
                    class="tool-card__artifact"
                    *ngFor="let a of out.artifacts; trackBy: trackByArtifactPath"
                  >
                    <span class="mono">{{ a.path }}</span>
                    <button
                      type="button"
                      class="tool-card__link"
                      (click)="copyToClipboard(a.path)"
                    >
                      Copy path
                    </button>
                  </div>
                </div>

                <div class="tool-card__links">
                  <button
                    type="button"
                    class="tool-card__link"
                    (click)="toggleToolRaw(out.id)"
                  >
                    {{ out.expanded ? 'Hide raw output' : 'View raw output' }}
                  </button>
                  <button
                    type="button"
                    class="tool-card__link"
                    (click)="copyJson(out.raw)"
                  >
                    Copy JSON
                  </button>
                </div>

                <pre class="tool-card__raw" *ngIf="out.expanded">{{
                  formatJson(out.raw)
                }}</pre>
              </article>
            </div>
          </aside>
        </div>
      </main>

      <div
        class="permission-modal__overlay"
        *ngIf="permissionModalOpen && permissionRequest"
        (click)="cancelPermissionRequest()"
      >
        <section
          class="permission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="permissionModalTitle"
          (click)="$event.stopPropagation()"
        >
          <header class="permission-modal__header">
            <div class="permission-modal__headerTitle" id="permissionModalTitle">
              PERMISSION REQUEST
            </div>
            <button
              type="button"
              class="permission-modal__close"
              (click)="cancelPermissionRequest()"
              [disabled]="permissionSubmitting"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div class="permission-modal__body">
            <div class="permission-modal__lead">
              <div class="permission-modal__leadIcon">{{ permissionLeadIcon(permissionRequest) }}</div>
              <div class="permission-modal__leadText">Acta wants to execute a tool</div>
            </div>

            <div *ngIf="permissionRequest.cloud" class="permission-modal__cloud">
              <div class="permission-modal__cloudTitle">Cloud model is selected</div>
              <div class="permission-modal__cloudText">
                If you proceed, content may be sent to:
                <span class="mono">{{ permissionCloudLabel(permissionRequest) }}</span>
              </div>
            </div>

            <div class="permission-modal__kv">
              <div class="permission-modal__row">
                <div class="permission-modal__label">Tool</div>
                <div class="permission-modal__value mono">{{ permissionRequest.tool }}</div>
              </div>

              <div class="permission-modal__row" *ngIf="permissionRequest.scope">
                <div class="permission-modal__label">Scope</div>
                <div class="permission-modal__value mono">{{ permissionRequest.scope }}</div>
              </div>

              <div class="permission-modal__row" *ngIf="permissionRequest.input">
                <div class="permission-modal__label">Input</div>
                <div class="permission-modal__value mono">{{ permissionRequest.input }}</div>
              </div>

              <div class="permission-modal__row" *ngIf="permissionRequest.output">
                <div class="permission-modal__label">Output</div>
                <div class="permission-modal__value mono">{{ permissionRequest.output }}</div>
              </div>

              <div class="permission-modal__row">
                <div class="permission-modal__label">Reason</div>
                <div class="permission-modal__value">{{ permissionRequest.reason }}</div>
              </div>

              <div
                class="permission-modal__row"
                *ngIf="permissionRequest.risk || permissionRequest.risks?.length"
              >
                <div class="permission-modal__label">Risk</div>
                <div class="permission-modal__value">{{ permissionRiskLabel(permissionRequest) }}</div>
              </div>

              <div class="permission-modal__row" *ngIf="permissionRequest.trustLevel !== undefined">
                <div class="permission-modal__label">Trust mode</div>
                <div class="permission-modal__value">
                  {{ trustModeLabel(permissionRequest.trustLevel) }}
                </div>
              </div>
            </div>

            <div class="permission-modal__sectionTitle">This action will:</div>
            <ul class="permission-modal__bullets">
              <li>{{ permissionPrimaryEffect(permissionRequest) }}</li>
              <li>{{ permissionSecondaryEffect(permissionRequest) }}</li>
              <li>Show raw tool output in the Tool Output panel</li>
            </ul>

            <div class="permission-modal__sectionTitle">Decision (logged locally):</div>
            <div class="permission-modal__choices">
              <label class="permission-modal__choice">
                <input
                  type="radio"
                  name="permissionDecision"
                  [(ngModel)]="permissionDecision"
                  value="allow_once"
                />
                <span>Allow once</span>
              </label>
              <label class="permission-modal__choice">
                <input
                  type="radio"
                  name="permissionDecision"
                  [(ngModel)]="permissionDecision"
                  value="allow_always"
                />
                <span>
                  Always allow
                  <ng-container *ngIf="permissionFolderScope(permissionRequest) as folder">
                    for this folder: <span class="mono">{{ folder }}</span>
                  </ng-container>
                </span>
              </label>
              <label class="permission-modal__choice">
                <input
                  type="radio"
                  name="permissionDecision"
                  [(ngModel)]="permissionDecision"
                  value="deny"
                />
                <span>Deny</span>
              </label>
            </div>

            <label class="permission-modal__remember" *ngIf="permissionRequest.rememberDecision">
              <input
                type="checkbox"
                name="permissionRemember"
                [(ngModel)]="permissionRemember"
              />
              <span>Remember for this folder</span>
            </label>
          </div>

          <footer class="permission-modal__footer">
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--secondary"
              (click)="submitPermissionDecision('deny')"
              [disabled]="permissionSubmitting"
            >
              Deny
            </button>
            <div class="permission-modal__footerSpacer"></div>
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--primary"
              (click)="submitPermissionDecision('allow_once')"
              [disabled]="permissionSubmitting"
            >
              Allow once
            </button>
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--primary"
              (click)="submitPermissionDecision('allow_always')"
              [disabled]="permissionSubmitting"
            >
              Always allow
            </button>
          </footer>
        </section>
      </div>

      <div
        class="permission-modal__overlay"
        *ngIf="trustConfirmOpen"
        (click)="cancelTrustChange()"
      >
        <section
          class="permission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trustConfirmTitle"
          (click)="$event.stopPropagation()"
        >
          <header class="permission-modal__header">
            <div class="permission-modal__headerTitle" id="trustConfirmTitle">
              CHANGE TRUST LEVEL
            </div>
            <button
              type="button"
              class="permission-modal__close"
              (click)="cancelTrustChange()"
              [disabled]="trustBusy"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div class="permission-modal__body">
            <div class="permission-modal__lead">
              <div class="permission-modal__leadIcon">🛡️</div>
              <div class="permission-modal__leadText">
                Change trust level for profile "{{ profileId }}"?
              </div>
            </div>

            <div class="permission-modal__kv">
              <div class="permission-modal__row">
                <div class="permission-modal__label">From</div>
                <div class="permission-modal__value">{{ trustModeLabel(trustLevel) }}</div>
              </div>
              <div class="permission-modal__row" *ngIf="pendingTrustLevel !== null">
                <div class="permission-modal__label">To</div>
                <div class="permission-modal__value">{{ trustModeLabel(pendingTrustLevel) }}</div>
              </div>
            </div>

            <div class="permission-modal__sectionTitle">Note</div>
            <div class="permission-modal__value">
              This may allow tools to run without prompts.
            </div>
          </div>

          <footer class="permission-modal__footer">
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--secondary"
              (click)="cancelTrustChange()"
              [disabled]="trustBusy"
            >
              Cancel
            </button>
            <div class="permission-modal__footerSpacer"></div>
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--primary"
              (click)="confirmTrustChange()"
              [disabled]="trustBusy || pendingTrustLevel === null"
            >
              Confirm
            </button>
          </footer>
        </section>
      </div>

      <div
        class="permission-modal__overlay"
        *ngIf="manageProfilesOpen"
        (click)="closeManageProfiles()"
      >
        <section
          class="permission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manageProfilesTitle"
          (click)="$event.stopPropagation()"
        >
          <header class="permission-modal__header">
            <div class="permission-modal__headerTitle" id="manageProfilesTitle">PROFILES</div>
            <button
              type="button"
              class="permission-modal__close"
              (click)="closeManageProfiles()"
              [disabled]="profilesBusy"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div class="permission-modal__body">
            <div class="permission-modal__sectionTitle">Active profile</div>
            <div class="permission-modal__value">
              <span class="mono">{{ profileId }}</span>
            </div>

            <div class="permission-modal__sectionTitle">Profiles</div>
            <div class="permission-modal__kv">
              <div class="permission-modal__row" *ngFor="let p of profiles; trackBy: trackByProfileId">
                <div class="permission-modal__label">{{ p.name }}</div>
                <div class="permission-modal__value">
                  <span class="mono">{{ p.id }}</span>
                  <ng-container *ngIf="p.id === profileId"> (active)</ng-container>
                </div>
                <div class="permission-modal__value">
                  <button
                    type="button"
                    class="permission-modal__btn permission-modal__btn--secondary"
                    (click)="requestDeleteProfile(p.id)"
                    [disabled]="profilesBusy || p.id === 'default' || p.id === profileId"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div class="permission-modal__sectionTitle">Create</div>
            <div class="permission-modal__kv">
              <div class="permission-modal__row">
                <div class="permission-modal__label">Name</div>
                <div class="permission-modal__value">
                  <input
                    class="tool-panel__search"
                    type="text"
                    [(ngModel)]="newProfileName"
                    name="newProfileName"
                    placeholder="New profile name"
                  />
                </div>
              </div>
            </div>
            <div class="permission-modal__value">
              <button
                type="button"
                class="permission-modal__btn permission-modal__btn--primary"
                (click)="createProfile()"
                [disabled]="profilesBusy || !newProfileName.trim()"
              >
                Create profile
              </button>
            </div>
          </div>

          <footer class="permission-modal__footer">
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--secondary"
              (click)="closeManageProfiles()"
              [disabled]="profilesBusy"
            >
              Close
            </button>
            <div class="permission-modal__footerSpacer"></div>
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--secondary"
              (click)="refreshProfiles()"
              [disabled]="profilesBusy"
            >
              Refresh
            </button>
          </footer>
        </section>
      </div>

      <div
        class="permission-modal__overlay"
        *ngIf="deleteProfileOpen && deleteProfileId"
        (click)="cancelDeleteProfile()"
      >
        <section
          class="permission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteProfileTitle"
          (click)="$event.stopPropagation()"
        >
          <header class="permission-modal__header">
            <div class="permission-modal__headerTitle" id="deleteProfileTitle">DELETE PROFILE</div>
            <button
              type="button"
              class="permission-modal__close"
              (click)="cancelDeleteProfile()"
              [disabled]="profilesBusy"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div class="permission-modal__body">
            <div class="permission-modal__lead">
              <div class="permission-modal__leadIcon">👤</div>
              <div class="permission-modal__leadText">
                Delete profile <span class="mono">{{ deleteProfileId }}</span>?
              </div>
            </div>
            <div class="permission-modal__sectionTitle">What happens</div>
            <ul class="permission-modal__bullets">
              <li>Profile is removed from the list</li>
              <li>By default, files are archived (not permanently deleted)</li>
            </ul>
            <label class="permission-modal__remember">
              <input
                type="checkbox"
                name="deleteProfileFiles"
                [(ngModel)]="deleteProfileFiles"
              />
              <span>Permanently delete profile files</span>
            </label>
          </div>

          <footer class="permission-modal__footer">
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--secondary"
              (click)="cancelDeleteProfile()"
              [disabled]="profilesBusy"
            >
              Cancel
            </button>
            <div class="permission-modal__footerSpacer"></div>
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--primary"
              (click)="confirmDeleteProfile()"
              [disabled]="profilesBusy"
            >
              Delete
            </button>
          </footer>
        </section>
      </div>

      <div
        class="permission-modal__overlay"
        *ngIf="profileSwitchConfirmOpen && pendingProfileId"
        (click)="cancelProfileSwitch()"
      >
        <section
          class="permission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profileSwitchConfirmTitle"
          (click)="$event.stopPropagation()"
        >
          <header class="permission-modal__header">
            <div class="permission-modal__headerTitle" id="profileSwitchConfirmTitle">
              SWITCH PROFILE
            </div>
            <button
              type="button"
              class="permission-modal__close"
              (click)="cancelProfileSwitch()"
              [disabled]="profilesBusy"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div class="permission-modal__body">
            <div class="permission-modal__lead">
              <div class="permission-modal__leadIcon">⚠️</div>
              <div class="permission-modal__leadText">A tool run is active</div>
            </div>
            <div class="permission-modal__sectionTitle">Why this matters</div>
            <ul class="permission-modal__bullets">
              <li>Switching profiles changes trust defaults and model selection</li>
              <li>It also changes logs and memory scope for the UI</li>
            </ul>
            <div class="permission-modal__kv">
              <div class="permission-modal__row">
                <div class="permission-modal__label">From</div>
                <div class="permission-modal__value mono">{{ profileId }}</div>
              </div>
              <div class="permission-modal__row">
                <div class="permission-modal__label">To</div>
                <div class="permission-modal__value mono">{{ pendingProfileId }}</div>
              </div>
            </div>
          </div>

          <footer class="permission-modal__footer">
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--secondary"
              (click)="cancelProfileSwitch()"
              [disabled]="profilesBusy"
            >
              Cancel
            </button>
            <div class="permission-modal__footerSpacer"></div>
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--primary"
              (click)="confirmProfileSwitch()"
              [disabled]="profilesBusy"
            >
              Switch anyway
            </button>
          </footer>
        </section>
      </div>

      <div
        class="permission-modal__overlay"
        *ngIf="setupWizardOpen"
        (click)="closeSetupWizard()"
      >
        <section
          class="permission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="setupWizardTitle"
          (click)="$event.stopPropagation()"
        >
          <header class="permission-modal__header">
            <div class="permission-modal__headerTitle" id="setupWizardTitle">FIRST-RUN SETUP</div>
            <button
              type="button"
              class="permission-modal__close"
              (click)="closeSetupWizard()"
              [disabled]="setupBusy"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div class="permission-modal__body">
            <div class="permission-modal__lead">
              <div class="permission-modal__leadIcon">🧭</div>
              <div class="permission-modal__leadText">
                Configure profile <span class="mono">{{ profileId }}</span>
              </div>
            </div>

            <div class="permission-modal__sectionTitle">Model provider</div>
            <div class="permission-modal__kv">
              <div class="permission-modal__row">
                <div class="permission-modal__label">Provider</div>
                <div class="permission-modal__value">
                  <select
                    class="topbar__select"
                    name="setupProvider"
                    [(ngModel)]="setupConfig.modelProvider"
                    [disabled]="setupBusy"
                  >
                    <option value="ollama">Ollama (local)</option>
                    <option value="lmstudio">LM Studio (local)</option>
                    <option value="openai">OpenAI (cloud)</option>
                    <option value="anthropic">Anthropic (cloud)</option>
                  </select>
                </div>
              </div>
            </div>

            <ng-container *ngIf="setupConfig.modelProvider === 'ollama'">
              <div class="permission-modal__sectionTitle">Ollama endpoint</div>
              <div class="permission-modal__kv">
                <div class="permission-modal__row">
                  <div class="permission-modal__label">URL</div>
                  <div class="permission-modal__value">
                    <input
                      class="tool-panel__search"
                      type="text"
                      name="setupEndpoint"
                      [(ngModel)]="setupConfig.endpoint"
                      [disabled]="setupBusy"
                      placeholder="http://localhost:11434"
                    />
                  </div>
                </div>
              </div>
              <div class="permission-modal__value">
                <button
                  type="button"
                  class="permission-modal__btn permission-modal__btn--secondary"
                  (click)="testOllamaEndpoint()"
                  [disabled]="setupBusy || !(setupConfig.endpoint ?? '').trim()"
                >
                  Test endpoint
                </button>
                <span class="topbar__meta" *ngIf="setupTestStatus">{{ setupTestStatus }}</span>
              </div>

              <div class="permission-modal__sectionTitle">Model</div>
              <div class="permission-modal__kv">
                <div class="permission-modal__row">
                  <div class="permission-modal__label">Name</div>
                  <div class="permission-modal__value">
                    <select
                      class="topbar__select"
                      name="setupModel"
                      [(ngModel)]="setupConfig.model"
                      [disabled]="setupBusy"
                    >
                      <option *ngFor="let m of setupOllamaModels; trackBy: trackByString" [value]="m">
                        {{ m }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </ng-container>

            <ng-container *ngIf="setupConfig.modelProvider === 'openai' || setupConfig.modelProvider === 'anthropic'">
              <div class="permission-modal__sectionTitle">Cloud warning</div>
              <label class="permission-modal__remember">
                <input
                  type="checkbox"
                  name="cloudWarnBeforeSending"
                  [(ngModel)]="setupConfig.cloudWarnBeforeSending"
                  [disabled]="setupBusy"
                />
                <span>Warn before sending content to cloud provider</span>
              </label>
            </ng-container>

            <div class="permission-modal__sectionTitle">Default trust level</div>
            <div class="permission-modal__kv">
              <div class="permission-modal__row">
                <div class="permission-modal__label">Trust</div>
                <div class="permission-modal__value">
                  <select
                    class="topbar__select"
                    name="setupTrust"
                    [(ngModel)]="setupConfig.trustLevel"
                    [disabled]="setupBusy"
                  >
                    <option [ngValue]="0">Deny (0)</option>
                    <option [ngValue]="1">Ask every time (1)</option>
                    <option [ngValue]="2">Ask once (2)</option>
                    <option [ngValue]="3">Allow (logged) (3)</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="permission-modal__sectionTitle">Summary</div>
            <div class="permission-modal__value">{{ setupSummary() }}</div>
          </div>

          <footer class="permission-modal__footer">
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--secondary"
              (click)="closeSetupWizard()"
              [disabled]="setupBusy"
            >
              Later
            </button>
            <div class="permission-modal__footerSpacer"></div>
            <button
              type="button"
              class="permission-modal__btn permission-modal__btn--primary"
              (click)="completeSetupWizard()"
              [disabled]="setupBusy || !canCompleteSetup()"
            >
              Save
            </button>
          </footer>
        </section>
      </div>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  pingStatus = 'not checked'

  demoPermissionBusy = false
  demoPermissionStatus = ''

  demoScenarioBusy = false
  demoScenarioStatus = ''

  profileId = 'default'
  profiles: ProfileInfo[] = []
  profileSelection = 'default'
  profilesBusy = false
  manageProfilesOpen = false
  newProfileName = ''
  deleteProfileOpen = false
  deleteProfileId: string | null = null
  deleteProfileFiles = false

  profileSwitchConfirmOpen = false
  pendingProfileId: string | null = null

  setupWizardOpen = false
  setupBusy = false
  setupStep = 1
  setupConfig: ProfileSetupConfig = {
    setupComplete: false,
    modelProvider: 'ollama',
    model: 'llama3:8b',
    endpoint: 'http://localhost:11434',
    cloudWarnBeforeSending: true,
    trustLevel: 1,
  }
  setupOllamaModels: string[] = ['llama3:8b']
  setupTestStatus = ''
  modelSummary = ''

  logsBusy = false
  logsStatus = ''
  trustLevel: TrustLevel = 1
  trustSelection: TrustLevel = 1
  trustBusy = false
  trustConfirmOpen = false
  pendingTrustLevel: TrustLevel | null = null

  permissionModalOpen = false
  permissionSubmitting = false
  permissionRequest: PermissionRequestEvent | null = null
  permissionDecision: PermissionDecision = 'allow_once'
  permissionRemember = false

  private permissionUnsubscribe: Unsubscribe | null = null
  private profileUnsubscribe: Unsubscribe | null = null

  draft = ''
  pendingAttachments: Attachment[] = []
  messages: ChatMessage[] = []

  toolOutputs: ToolOutputEntry[] = []
  toolFilter: ToolOutputFilter = 'all'
  toolSearch = ''

  constructor(private zone: NgZone) {}

  async ngOnInit(): Promise<void> {
    this.attachPermissionListener()
    this.attachProfileListener()
    await this.refreshProfiles()
    await this.loadTrustLevel()
    await this.loadSetupConfigAndMaybeOpenWizard()
    this.pingStatus = await this.safePing()

    const now = Date.now()

    this.messages = [
      this.makeMessage('system', 'Renderer ready.', now),
      this.makeMessage('system', `Electron IPC: ${this.pingStatus}`, now + 1),
      this.makeMessage(
        'user',
        'Convert /Reports/Q4.pdf to text and summarize it.',
        now + 2,
      ),
      {
        ...this.makeMessage('acta', `I can do that. I'll run these steps:`, now + 3),
        plan: {
          goal: 'Convert + summarize Q4.pdf',
          collapsed: false,
          steps: [
            {
              id: this.newId(),
              title: 'Request permission to read the file',
              status: 'completed',
            },
            {
              id: this.newId(),
              title: 'Convert PDF → TXT',
              status: 'in-progress',
            },
            {
              id: this.newId(),
              title: 'Summarize text',
              status: 'pending',
            },
            {
              id: this.newId(),
              title: 'Write summary (demo failure state)',
              status: 'failed',
            },
          ],
        },
      },
    ]

    this.toolOutputs = [
      {
        id: this.newId(),
        timestamp: now + 4,
        tool: 'file.read',
        status: 'waiting_permission',
        scope: '/Reports/Q4.pdf',
        reason: 'Read the file you referenced',
        preview: 'Permission required to read file.',
        raw: {
          tool: 'file.read',
          scope: '/Reports/Q4.pdf',
          reason: 'Read the file you referenced',
          status: 'waiting_permission',
        },
        expanded: false,
      },
      {
        id: this.newId(),
        timestamp: now + 5,
        tool: 'file.convert',
        status: 'running',
        input: '/Reports/Q4.pdf',
        preview: 'Converting PDF → TXT',
        progress: 45,
        raw: {
          tool: 'file.convert',
          input: '/Reports/Q4.pdf',
          output: '/Reports/Q4.txt',
          progress: 0.45,
        },
        expanded: false,
      },
      {
        id: this.newId(),
        timestamp: now + 6,
        tool: 'file.read',
        status: 'completed',
        scope: '/Reports/Q4.pdf',
        preview: 'Pages: 12 • Extracted text: 2,412 words • Title: “Q4 Sales Report”',
        artifacts: [{ path: '/Reports/Q4.txt' }],
        raw: {
          tool: 'file.read',
          scope: '/Reports/Q4.pdf',
          pages: 12,
          extractedWords: 2412,
          title: 'Q4 Sales Report',
          artifacts: ['/Reports/Q4.txt'],
        },
        expanded: false,
      },
      {
        id: this.newId(),
        timestamp: now + 7,
        tool: 'file.read',
        status: 'error',
        scope: '/Reports/missing.pdf',
        error: 'File not found',
        preview: 'Hint: Check the path or attach the file.',
        raw: {
          tool: 'file.read',
          scope: '/Reports/missing.pdf',
          error: 'File not found',
        },
        expanded: false,
      },
    ]
  }

  ngOnDestroy(): void {
    this.permissionUnsubscribe?.()
    this.permissionUnsubscribe = null
    this.profileUnsubscribe?.()
    this.profileUnsubscribe = null
  }

  isToolRunActive(): boolean {
    return this.toolOutputs.some(out => out.status === 'running' || out.status === 'waiting_permission')
  }

  async onProfileSelectionChange(next: string): Promise<void> {
    if (this.profilesBusy) return
    const desired = (next ?? '').trim()
    if (!desired.length) return

    if (desired === this.profileId) {
      this.profileSelection = this.profileId
      return
    }

    if (this.isToolRunActive()) {
      this.pendingProfileId = desired
      this.profileSwitchConfirmOpen = true
      this.profileSelection = this.profileId
      return
    }

    await this.switchToProfile(desired)
  }

  cancelProfileSwitch(): void {
    this.profileSwitchConfirmOpen = false
    this.pendingProfileId = null
    this.profileSelection = this.profileId
  }

  async confirmProfileSwitch(): Promise<void> {
    if (!this.pendingProfileId) return
    const next = this.pendingProfileId
    this.profileSwitchConfirmOpen = false
    this.pendingProfileId = null
    await this.switchToProfile(next)
  }

  openManageProfiles(): void {
    this.manageProfilesOpen = true
  }

  closeManageProfiles(): void {
    this.manageProfilesOpen = false
    this.newProfileName = ''
  }

  async refreshProfiles(): Promise<void> {
    if (this.profilesBusy) return
    this.profilesBusy = true

    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.listProfiles()
      this.profiles = res.profiles
      this.profileId = res.activeProfileId
      this.profileSelection = res.activeProfileId
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.profilesBusy = false
    }
  }

  async createProfile(): Promise<void> {
    const name = this.newProfileName.trim()
    if (!name.length) return
    if (this.profilesBusy) return

    this.profilesBusy = true
    try {
      if (!window.ActaAPI) return
      await window.ActaAPI.createProfile({ name })
      this.newProfileName = ''
      await this.refreshProfiles()
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.profilesBusy = false
    }
  }

  requestDeleteProfile(profileId: string): void {
    if (!profileId.length) return
    if (profileId === 'default') return
    this.deleteProfileId = profileId
    this.deleteProfileFiles = false
    this.deleteProfileOpen = true
  }

  cancelDeleteProfile(): void {
    this.deleteProfileOpen = false
    this.deleteProfileId = null
    this.deleteProfileFiles = false
  }

  async confirmDeleteProfile(): Promise<void> {
    if (!this.deleteProfileId) return
    if (this.profilesBusy) return

    const profileId = this.deleteProfileId
    const deleteFiles = this.deleteProfileFiles

    this.profilesBusy = true
    try {
      if (!window.ActaAPI) return
      await window.ActaAPI.deleteProfile({ profileId, deleteFiles })
      this.cancelDeleteProfile()
      await this.refreshProfiles()
      await this.loadTrustLevel()
      await this.loadSetupConfigAndMaybeOpenWizard()
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.profilesBusy = false
    }
  }

  private async switchToProfile(profileId: string): Promise<void> {
    if (this.profilesBusy) return
    this.profilesBusy = true

    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.switchProfile({ profileId })
      this.profileId = res.profile.id
      this.profileSelection = res.profile.id

      await this.loadTrustLevel()
      await this.loadSetupConfigAndMaybeOpenWizard()

      const now = Date.now()
      this.messages = [
        ...this.messages,
        this.makeMessage('system', `Switched to profile ${res.profile.id}.`, now),
      ]
    } catch {
      this.profileSelection = this.profileId
    } finally {
      this.profilesBusy = false
    }
  }

  private attachProfileListener(): void {
    if (!window.ActaAPI) return
    if (this.profileUnsubscribe) return

    this.profileUnsubscribe = window.ActaAPI.onProfileChanged(payload => {
      this.zone.run(() => {
        this.profileId = payload.profile.id
        this.profileSelection = payload.profile.id
        void this.refreshProfiles()
        void this.loadTrustLevel()
        void this.loadSetupConfigAndMaybeOpenWizard()
      })
    })
  }

  openSetupWizard(): void {
    this.setupWizardOpen = true
  }

  closeSetupWizard(): void {
    this.setupWizardOpen = false
  }

  private async loadSetupConfigAndMaybeOpenWizard(): Promise<void> {
    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.getSetupConfig()
      this.setupConfig = { ...res.config }

      if (this.setupConfig.modelProvider === 'ollama') {
        const candidate = (this.setupConfig.model ?? '').trim()
        this.setupOllamaModels = candidate.length ? [candidate] : ['llama3:8b']
      }

      if (!this.setupConfig.setupComplete) {
        this.setupWizardOpen = true
      }
    } catch {
      // ignore (UI scaffold only)
    }
  }

  async testOllamaEndpoint(): Promise<void> {
    if (this.setupBusy) return
    const endpoint = (this.setupConfig.endpoint ?? '').trim()
    if (!endpoint.length) return

    this.setupBusy = true
    this.setupTestStatus = 'Testing…'

    try {
      if (!window.ActaAPI) {
        this.setupTestStatus = 'ActaAPI not available'
        return
      }

      const res = await window.ActaAPI.testOllama({ endpoint })
      if (!res.ok) {
        this.setupTestStatus = `Failed: ${res.error ?? 'unknown error'}`
        return
      }

      const models = (res.models ?? []).filter(m => typeof m === 'string' && m.trim().length)
      if (models.length) {
        this.setupOllamaModels = models
        if (!this.setupConfig.model || !models.includes(this.setupConfig.model)) {
          this.setupConfig.model = models[0]
        }
      }

      this.setupTestStatus = models.length ? `OK: ${models.length} model(s) found` : 'OK: no models found'
    } catch {
      this.setupTestStatus = 'Failed: request error'
    } finally {
      this.setupBusy = false
    }
  }

  canCompleteSetup(): boolean {
    const provider = this.setupConfig.modelProvider
    if (!provider) return false
    if ((this.setupConfig.trustLevel ?? null) === null) return false

    if (provider === 'ollama') {
      return !!(this.setupConfig.endpoint ?? '').trim() && !!(this.setupConfig.model ?? '').trim()
    }

    return true
  }

  setupSummary(): string {
    const provider = this.setupConfig.modelProvider ?? 'unknown'
    const trust = this.setupConfig.trustLevel === undefined ? 'unset' : this.trustModeLabel(this.setupConfig.trustLevel)

    if (provider === 'ollama') {
      const endpoint = (this.setupConfig.endpoint ?? '').trim() || 'unset'
      const model = (this.setupConfig.model ?? '').trim() || 'unset'
      return `Provider: Ollama • Endpoint: ${endpoint} • Model: ${model} • Trust: ${trust}`
    }

    const warn = this.setupConfig.cloudWarnBeforeSending ? 'warn before sending' : 'no warning'
    return `Provider: ${provider} • ${warn} • Trust: ${trust}`
  }

  async completeSetupWizard(): Promise<void> {
    if (!this.canCompleteSetup()) return
    if (this.setupBusy) return

    this.setupBusy = true
    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.completeSetup({ config: this.setupConfig })
      this.setupConfig = { ...res.config }

      if (typeof this.setupConfig.trustLevel === 'number') {
        this.trustLevel = this.setupConfig.trustLevel
        this.trustSelection = this.setupConfig.trustLevel
      }

      this.setupWizardOpen = false
      const now = Date.now()
      this.messages = [
        ...this.messages,
        this.makeMessage('system', `Setup saved for profile ${res.profileId}.`, now),
      ]
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.setupBusy = false
    }
  }

  async openLogsFolder(): Promise<void> {
    if (this.logsBusy) return
    this.logsBusy = true
    this.logsStatus = 'Opening logs…'

    try {
      if (!window.ActaAPI) {
        this.logsStatus = 'Logs: ActaAPI not available'
        return
      }

      const res = await window.ActaAPI.openLogsFolder()
      if (res.ok) {
        this.logsStatus = `Logs: opened (${res.path})`
      } else {
        this.logsStatus = `Logs: failed (${res.error ?? 'unknown error'})`
      }
    } catch {
      this.logsStatus = 'Logs: failed (request error)'
    } finally {
      this.logsBusy = false
    }
  }

  async onTrustSelectionChange(next: TrustLevel): Promise<void> {
    if (this.trustBusy) {
      this.trustSelection = this.trustLevel
      return
    }

    if (this.permissionModalOpen) {
      this.trustSelection = this.trustLevel
      return
    }

    if (next > this.trustLevel) {
      this.pendingTrustLevel = next
      this.trustConfirmOpen = true
      return
    }

    await this.applyTrustLevel(next)
  }

  cancelTrustChange(): void {
    this.trustConfirmOpen = false
    this.pendingTrustLevel = null
    this.trustSelection = this.trustLevel
  }

  async confirmTrustChange(): Promise<void> {
    if (this.pendingTrustLevel === null) return
    const next = this.pendingTrustLevel
    await this.applyTrustLevel(next)
    this.trustConfirmOpen = false
    this.pendingTrustLevel = null
  }

  private async loadTrustLevel(): Promise<void> {
    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.getTrustLevel()
      this.profileId = res.profileId
      this.trustLevel = res.trustLevel
      this.trustSelection = res.trustLevel
    } catch {
      // ignore (UI scaffold only)
    }
  }

  private async applyTrustLevel(level: TrustLevel): Promise<void> {
    if (this.trustBusy) return

    this.trustBusy = true

    try {
      if (!window.ActaAPI) {
        this.trustSelection = this.trustLevel
        return
      }

      const res = await window.ActaAPI.setTrustLevel({ trustLevel: level })
      this.profileId = res.profileId
      this.trustLevel = res.trustLevel
      this.trustSelection = res.trustLevel

      const now = Date.now()
      this.messages = [
        ...this.messages,
        this.makeMessage(
          'system',
          `Trust level set to ${this.trustModeLabel(res.trustLevel)} for profile ${res.profileId}.`,
          now,
        ),
      ]
    } catch {
      this.trustSelection = this.trustLevel
    } finally {
      this.trustBusy = false
    }
  }

  async demoPermission(): Promise<void> {
    if (this.demoPermissionBusy) return

    this.demoPermissionBusy = true
    this.demoPermissionStatus = 'Demo: waiting…'

    try {
      if (!window.ActaAPI) {
        this.demoPermissionStatus = 'Demo: ActaAPI not available'
        return
      }

      const decision = await window.ActaAPI.demoPermissionRequest()
      this.demoPermissionStatus = `Demo: ${this.permissionDecisionLabel(decision)}`
      this.messages = [
        ...this.messages,
        this.makeMessage(
          'system',
          `Demo permission resolved: ${this.permissionDecisionLabel(decision)}.`,
          Date.now(),
        ),
      ]
    } catch {
      this.demoPermissionStatus = 'Demo: failed'
    } finally {
      this.demoPermissionBusy = false
    }
  }

  async runDemoScenario(): Promise<void> {
    if (this.demoScenarioBusy) return

    this.demoScenarioBusy = true
    this.demoScenarioStatus = 'Demo: running…'
    this.permissionModalOpen = false
    this.permissionSubmitting = false
    this.permissionRequest = null

    const now = Date.now()

    const planMsgId = this.newId()
    const stepPermissionId = this.newId()
    const stepConvertId = this.newId()
    const stepSummarizeId = this.newId()

    this.messages = [
      this.makeMessage('system', 'Demo scenario started.', now),
      {
        id: this.newId(),
        type: 'user',
        timestamp: now + 1,
        text: 'Convert /Reports/Q4.pdf to text and summarize it.',
      },
      {
        id: planMsgId,
        type: 'acta',
        timestamp: now + 2,
        text: "I'll run these steps:",
        plan: {
          goal: 'Convert + summarize Q4.pdf',
          collapsed: false,
          steps: [
            { id: stepPermissionId, title: 'Request permission to read the file', status: 'in-progress' },
            { id: stepConvertId, title: 'Convert PDF → TXT', status: 'pending' },
            { id: stepSummarizeId, title: 'Summarize text', status: 'pending' },
          ],
        },
      },
    ]

    this.toolOutputs = []

    if (!window.ActaAPI) {
      this.demoScenarioStatus = 'Demo: ActaAPI not available'
      this.demoScenarioBusy = false
      return
    }

    let decision: PermissionDecision = 'deny'
    try {
      decision = await window.ActaAPI.demoPermissionRequest()
    } catch {
      decision = 'deny'
    }

    if (decision === 'deny') {
      this.demoScenarioStatus = 'Demo: denied'
      this.messages = [
        ...this.messages,
        this.makeMessage('system', 'Demo scenario ended: permission denied.', Date.now()),
      ]
      this.messages = this.messages.map(msg => {
        if (msg.id !== planMsgId || !msg.plan) return msg
        return {
          ...msg,
          plan: {
            ...msg.plan,
            steps: msg.plan.steps.map(step => {
              if (step.id === stepPermissionId) return { ...step, status: 'failed' }
              return step
            }),
          },
        }
      })
      this.demoScenarioBusy = false
      return
    }

    this.messages = this.messages.map(msg => {
      if (msg.id !== planMsgId || !msg.plan) return msg
      return {
        ...msg,
        plan: {
          ...msg.plan,
          steps: msg.plan.steps.map(step => {
            if (step.id === stepPermissionId) return { ...step, status: 'completed' }
            if (step.id === stepConvertId) return { ...step, status: 'in-progress' }
            return step
          }),
        },
      }
    })

    this.toolOutputs = this.toolOutputs.map(out => {
      if (out.tool !== 'file.read') return out
      if (out.scope !== '/Reports/Q4.pdf') return out
      if (out.status === 'completed') return out

      return {
        ...out,
        status: 'completed',
        preview: 'Read approved. File available for conversion.',
        artifacts: [{ path: '/Reports/Q4.pdf' }],
        raw: { ...(out.raw as object), decision: 'allow_once' },
      }
    })

    const convertOutId = this.newId()
    this.toolOutputs = [
      {
        id: convertOutId,
        timestamp: Date.now(),
        tool: 'file.convert',
        status: 'running',
        input: '/Reports/Q4.pdf',
        preview: 'Converting PDF → TXT',
        progress: 0,
        raw: { tool: 'file.convert', input: '/Reports/Q4.pdf', output: '/Reports/Q4.txt', progress: 0 },
        expanded: false,
      },
      ...this.toolOutputs,
    ]

    setTimeout(() => {
      this.zone.run(() => {
        this.toolOutputs = this.toolOutputs.map(out =>
          out.id === convertOutId ? { ...out, progress: 50, raw: { ...(out.raw as object), progress: 0.5 } } : out,
        )
      })
    }, 900)

    setTimeout(() => {
      this.zone.run(() => {
        this.toolOutputs = this.toolOutputs.map(out =>
          out.id === convertOutId
            ? {
                ...out,
                status: 'completed',
                progress: 100,
                preview: 'Converted PDF → TXT',
                artifacts: [{ path: '/Reports/Q4.txt' }],
                raw: { ...(out.raw as object), progress: 1, artifacts: ['/Reports/Q4.txt'] },
              }
            : out,
        )

        this.messages = this.messages.map(msg => {
          if (msg.id !== planMsgId || !msg.plan) return msg
          return {
            ...msg,
            plan: {
              ...msg.plan,
              steps: msg.plan.steps.map(step => {
                if (step.id === stepConvertId) return { ...step, status: 'completed' }
                if (step.id === stepSummarizeId) return { ...step, status: 'in-progress' }
                return step
              }),
            },
          }
        })

        const summarizeOutId = this.newId()
        const summarizeEntry: ToolOutputEntry = {
          id: summarizeOutId,
          timestamp: Date.now(),
          tool: 'llm.summarize',
          status: 'running',
          input: '/Reports/Q4.txt',
          preview: 'Summarizing extracted text',
          progress: 0,
          raw: { tool: 'llm.summarize', input: '/Reports/Q4.txt', status: 'running' },
          expanded: false,
        }

        this.toolOutputs = [summarizeEntry, ...this.toolOutputs]

        setTimeout(() => {
          this.zone.run(() => {
            this.toolOutputs = this.toolOutputs.map(out =>
              out.id === summarizeOutId
                ? {
                    ...out,
                    status: 'completed',
                    progress: 100,
                    preview: 'Summary ready',
                    raw: { ...(out.raw as object), status: 'completed' },
                  }
                : out,
            )

            this.messages = this.messages.map(msg => {
              if (msg.id !== planMsgId || !msg.plan) return msg
              return {
                ...msg,
                plan: {
                  ...msg.plan,
                  steps: msg.plan.steps.map(step =>
                    step.id === stepSummarizeId ? { ...step, status: 'completed' } : step,
                  ),
                },
              }
            })

            this.messages = [
              ...this.messages,
              {
                id: this.newId(),
                type: 'acta',
                timestamp: Date.now(),
                text:
                  'Summary (demo): Q4 sales improved vs prior quarter, with strongest growth in the enterprise segment. Key drivers include pipeline conversion and reduced churn. Suggested next steps: validate assumptions against source tables and export the summary to a shareable doc.',
              },
            ]

            this.demoScenarioStatus = 'Demo: complete'
            this.demoScenarioBusy = false
          })
        }, 1100)
      })
    }, 1900)
  }

  cancelPermissionRequest(): void {
    void this.submitPermissionDecision('deny')
  }

  async submitPermissionDecision(decision: PermissionDecision): Promise<void> {
    if (!this.permissionRequest) return
    if (this.permissionSubmitting) return

    const request = this.permissionRequest
    const remember = decision === 'allow_always' || this.permissionRemember

    this.permissionSubmitting = true

    try {
      await window.ActaAPI?.respondToPermission({
        requestId: request.id,
        decision,
        remember,
      })
    } catch {
      // ignore (UI scaffold only)
    }

    this.permissionSubmitting = false
    this.permissionModalOpen = false
    this.permissionRequest = null
    this.permissionRemember = false
    this.permissionDecision = 'allow_once'

    const now = Date.now()
    this.messages = [
      ...this.messages,
      this.makeMessage(
        'system',
        `Permission decision for ${request.tool}: ${this.permissionDecisionLabel(decision)}.`,
        now,
      ),
    ]

    this.toolOutputs = this.toolOutputs.map(out => {
      if (out.id !== request.id) return out
      if (decision === 'deny') {
        return {
          ...out,
          status: 'error',
          error: 'Permission denied',
          preview: 'Denied by user.',
          raw: { ...(out.raw as object), decision },
        }
      }

      return {
        ...out,
        status: 'running',
        preview: 'Permission granted. Awaiting runtime…',
        progress: out.progress ?? 0,
        raw: { ...(out.raw as object), decision, remember },
      }
    })
  }

  permissionLeadIcon(request: PermissionRequestEvent): string {
    if (request.cloud) return '☁️'
    if (request.tool.includes('convert')) return '📄'
    return '🛡️'
  }

  permissionCloudLabel(request: PermissionRequestEvent): string {
    if (!request.cloud) return 'local'
    if (!request.cloud.model) return request.cloud.provider
    return `${request.cloud.provider} (${request.cloud.model})`
  }

  permissionRiskLabel(request: PermissionRequestEvent): string {
    const lines: string[] = []
    if (request.risk) lines.push(request.risk)
    if (request.risks?.length) lines.push(...request.risks)
    return lines.join(' • ')
  }

  trustModeLabel(level: number): string {
    if (level <= 0) return 'Deny (0)'
    if (level === 1) return 'Ask every time (1)'
    if (level === 2) return 'Ask once (2)'
    if (level === 3) return 'Allow (3)'
    return `Trust level ${level}`
  }

  permissionPrimaryEffect(request: PermissionRequestEvent): string {
    if (request.tool.includes('file.read')) return 'Read the specified file'
    if (request.tool.includes('file.convert')) return 'Read the input file and write a converted output'
    if (request.tool.includes('file.write')) return 'Write a file to your system'
    return 'Execute the requested tool'
  }

  permissionSecondaryEffect(request: PermissionRequestEvent): string {
    if (request.cloud) {
      return `May send content to ${this.permissionCloudLabel(request)}`
    }
    return 'Process it locally'
  }

  permissionFolderScope(request: PermissionRequestEvent): string | null {
    const basis = request.scope ?? request.input
    if (!basis) return null

    const normalized = basis.replace(/\\/g, '/')
    const idx = normalized.lastIndexOf('/')
    if (idx <= 0) return null

    return `${normalized.slice(0, idx)}/*`
  }

  permissionDecisionLabel(decision: PermissionDecision): string {
    if (decision === 'deny') return 'Deny'
    if (decision === 'allow_always') return 'Always allow'
    return 'Allow once'
  }

  private attachPermissionListener(): void {
    if (!window.ActaAPI) return
    if (this.permissionUnsubscribe) return

    this.permissionUnsubscribe = window.ActaAPI.onPermissionRequest(req => {
      this.zone.run(() => {
        this.permissionRequest = req
        this.permissionDecision = 'allow_once'
        this.permissionRemember = false
        this.permissionModalOpen = true

        const now = Date.now()
        this.messages = [
          ...this.messages,
          this.makeMessage('system', `Permission requested for ${req.tool}.`, now),
        ]

        const alreadyTracked = this.toolOutputs.some(out => out.id === req.id)
        if (!alreadyTracked) {
          const entry: ToolOutputEntry = {
            id: req.id,
            timestamp: now,
            tool: req.tool,
            status: 'waiting_permission',
            scope: req.scope,
            input: req.input,
            reason: req.reason,
            preview: 'Permission required to proceed.',
            raw: req,
            expanded: false,
          }

          this.toolOutputs = [entry, ...this.toolOutputs]
        }
      })
    })
  }

  toolStatusIcon(status: ToolOutputStatus): string {
    switch (status) {
      case 'waiting_permission':
        return '🔐'
      case 'running':
        return '🔄'
      case 'completed':
        return '✅'
      case 'error':
        return '❌'
    }
  }

  toolStatusLabel(status: ToolOutputStatus): string {
    switch (status) {
      case 'waiting_permission':
        return 'Waiting permission'
      case 'running':
        return 'Running'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Error'
    }
  }

  getVisibleToolOutputs(): ToolOutputEntry[] {
    const search = this.toolSearch.trim().toLowerCase()

    return this.toolOutputs
      .filter(out => {
        if (this.toolFilter === 'all') return true
        if (this.toolFilter === 'active') {
          return out.status === 'running' || out.status === 'waiting_permission'
        }
        if (this.toolFilter === 'completed') return out.status === 'completed'
        return out.status === 'error'
      })
      .filter(out => {
        if (!search) return true

        const haystack = [
          out.tool,
          out.scope,
          out.input,
          out.reason,
          out.preview,
          out.error,
          ...(out.artifacts?.map(a => a.path) ?? []),
        ]
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
          .toLowerCase()

        return haystack.includes(search)
      })
  }

  clearCompletedToolOutputs(): void {
    this.toolOutputs = this.toolOutputs.filter(out => out.status !== 'completed')
  }

  exportToolOutputs(): void {
    const json = this.formatJson(
      this.toolOutputs.map(({ expanded, ...rest }) => rest),
    )

    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `acta-tool-outputs-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      this.copyToClipboard(json)
    }
  }

  toggleToolRaw(id: string): void {
    this.toolOutputs = this.toolOutputs.map(out => {
      if (out.id !== id) return out
      return { ...out, expanded: !out.expanded }
    })
  }

  copyJson(value: unknown): void {
    this.copyToClipboard(this.formatJson(value))
  }

  copyToClipboard(text: string): void {
    void navigator.clipboard?.writeText(text)
  }

  formatJson(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  labelForType(type: ChatMessageType): string {
    if (type === 'user') return 'You'
    if (type === 'acta') return 'Acta'
    return 'System'
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  planStepIcon(status: PlanStepStatus): string {
    switch (status) {
      case 'pending':
        return '[ ]'
      case 'in-progress':
        return '[►]'
      case 'completed':
        return '[✓]'
      case 'failed':
        return '[✕]'
    }
  }

  fileLabel(file: Attachment): string {
    return file.path ?? file.name
  }

  canSend(): boolean {
    return this.draft.trim().length > 0 || this.pendingAttachments.length > 0
  }

  onDraftKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    if (event.isComposing) return

    event.preventDefault()
    this.send()
  }

  onSubmit(event: Event): void {
    event.preventDefault()
    this.send()
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement
    this.addAttachments(input.files)
    input.value = ''
  }

  removePendingAttachment(id: string): void {
    this.pendingAttachments = this.pendingAttachments.filter(a => a.id !== id)
  }

  togglePlan(messageId: string): void {
    this.messages = this.messages.map(msg => {
      if (msg.id !== messageId) return msg
      if (!msg.plan) return msg
      return {
        ...msg,
        plan: {
          ...msg.plan,
          collapsed: !msg.plan.collapsed,
        },
      }
    })
  }

  trackByMessageId(_index: number, msg: ChatMessage): string {
    return msg.id
  }

  trackByAttachmentId(_index: number, file: Attachment): string {
    return file.id
  }

  trackByPlanStepId(_index: number, step: ChatPlanStep): string {
    return step.id
  }

  trackByToolOutputId(_index: number, out: ToolOutputEntry): string {
    return out.id
  }

  trackByArtifactPath(_index: number, artifact: ToolOutputArtifact): string {
    return artifact.path
  }

  private addAttachments(files: FileList | null): void {
    if (!files || files.length === 0) return

    const next: Attachment[] = Array.from(files).map(file => {
      const maybePath = (file as File & { path?: string }).path
      return {
        id: this.newId(),
        name: file.name,
        size: file.size,
        path: maybePath,
      }
    })

    this.pendingAttachments = [...this.pendingAttachments, ...next]

    this.messages = [
      ...this.messages,
      this.makeMessage(
        'system',
        `Attached ${next.length} file${next.length === 1 ? '' : 's'}. Permission may be required to read it.`,
        Date.now(),
      ),
    ]
  }

  private send(): void {
    const text = this.draft.trim()
    const attachments = this.pendingAttachments.length
      ? [...this.pendingAttachments]
      : undefined

    if (!text && !attachments) return

    const now = Date.now()

    const userMsg: ChatMessage = {
      id: this.newId(),
      type: 'user',
      timestamp: now,
      text: text || 'Sent attachments.',
      attachments,
    }

    const actaMsg: ChatMessage = {
      id: this.newId(),
      type: 'acta',
      timestamp: now + 1,
      text: 'Got it. (UI scaffold only — no runtime wiring yet.)',
    }

    this.messages = [...this.messages, userMsg, actaMsg]
    this.draft = ''
    this.pendingAttachments = []
  }

  private makeMessage(
    type: ChatMessageType,
    text: string,
    timestamp: number,
  ): ChatMessage {
    return {
      id: this.newId(),
      type,
      timestamp,
      text,
    }
  }

  private async safePing(): Promise<string> {
    try {
      if (!window.ActaAPI) return 'ActaAPI not available'
      return await window.ActaAPI.ping()
    } catch {
      return 'ping failed'
    }
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  trackByProfileId(_index: number, profile: ProfileInfo): string {
    return profile.id
  }

  trackByString(_index: number, value: string): string {
    return value
  }
}
