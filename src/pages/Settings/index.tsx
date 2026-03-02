/**
 * Settings Page
 * Application configuration
 */
import { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Terminal,
  ExternalLink,
  Download,
  Copy,
  FileText,
  Settings as SettingsIcon,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { useUpdateStore } from '@/stores/update';
import { ProvidersSettings } from '@/components/settings/ProvidersSettings';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';


export function Settings() {
  const { t } = useTranslation('settings');
  const {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    language,
    setLanguage,
    gatewayAutoStart,
    setGatewayAutoStart,
    devModeUnlocked,
    setDevModeUnlocked,
    resetSetup,
  } = useSettingsStore();

  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');

  const handleShowLogs = async () => {
    try {
      const logs = await window.electron.ipcRenderer.invoke('log:readFile', 100) as string;
      setLogContent(logs);
      setShowLogs(true);
    } catch {
      setLogContent('(Failed to load logs)');
      setShowLogs(true);
    }
  };

  const handleOpenLogDir = async () => {
    try {
      const logDir = await window.electron.ipcRenderer.invoke('log:getDir') as string;
      if (logDir) {
        await window.electron.ipcRenderer.invoke('shell:showItemInFolder', logDir);
      }
    } catch {
      // ignore
    }
  };

  // Open developer console
  const openDevConsole = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as {
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
        error?: string;
      };
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        window.electron.openExternal(result.url);
      } else {
        console.error('Failed to get Dev Console URL:', result.error);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };


  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-2 mb-2">
        <SettingsIcon className="h-5 w-5 text-foreground/80" />
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      </div>

      {/* --- Appearance --- */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('appearance.title')}</h2>
        <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('appearance.theme')}</Label>
              <p className="text-xs text-muted-foreground">{t('appearance.themeDesc')}</p>
            </div>
            <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-1">
              {[
                { value: 'light', icon: Sun },
                { value: 'dark', icon: Moon },
                { value: 'system', icon: Monitor },
              ].map((m) => (
                <Button
                  key={m.value}
                  variant={theme === m.value ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn('h-8 w-10 px-0 transition-all', theme === m.value && 'bg-background shadow-sm')}
                  onClick={() => setTheme(m.value as any)}
                >
                  <m.icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>

          <Separator className="bg-border/40" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('appearance.language')}</Label>
              <p className="text-xs text-muted-foreground">{t('appearance.languageDesc')}</p>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 w-[160px] rounded-lg border border-border/60 bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring/20"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          <Separator className="bg-border/40" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('appearance.fontSize', 'UI 缩放 / 字体大小')}</Label>
              <p className="text-xs text-muted-foreground">{t('appearance.fontSizeDesc', '调整应用界面的整体文字与布局大小')}</p>
            </div>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as any)}
              className="h-9 w-[160px] rounded-lg border border-border/60 bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring/20"
            >
              <option value="small">{t('appearance.fontSizeSmall', '小 (Small)')}</option>
              <option value="medium">{t('appearance.fontSizeMedium', '中 (Medium)')}</option>
              <option value="large">{t('appearance.fontSizeLarge', '大 (Large)')}</option>
            </select>
          </div>
        </div>
      </section>

      {/* --- Providers --- */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('aiProviders.title')}</h2>
        <div className="rounded-xl border border-border/50 bg-card/30 p-5">
          <ProvidersSettings />
        </div>
      </section>

      {/* --- Gateway --- */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('gateway.title')}</h2>
        <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('gateway.autoStart')}</Label>
              <p className="text-xs text-muted-foreground">{t('gateway.autoStartDesc')}</p>
            </div>
            <Switch checked={gatewayAutoStart} onCheckedChange={setGatewayAutoStart} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3 border border-border/40">
            <div className="flex items-center gap-3">
              <div className={cn('h-3 w-3 rounded-full', gatewayStatus.state === 'running' ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-muted-foreground/30')} />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-tight">{t('gateway.status')}: {gatewayStatus.state.toUpperCase()}</p>
                {gatewayStatus.port && <p className="text-[10px] text-muted-foreground">Port {gatewayStatus.port} · PID {gatewayStatus.pid || '—'}</p>}
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs font-medium" onClick={restartGateway}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              {t('common:actions.restart')}
            </Button>
          </div>
        </div>
      </section>

      {/* --- Advanced/Dev Tools --- */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('advanced.title')}</h2>
        <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t('advanced.devMode')}</Label>
              <p className="text-xs text-muted-foreground">{t('advanced.devModeDesc')}</p>
            </div>
            <Switch checked={devModeUnlocked} onCheckedChange={setDevModeUnlocked} />
          </div>

          {devModeUnlocked && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
              <Button variant="outline" className="justify-start gap-2 h-9 text-xs" onClick={openDevConsole}>
                <Terminal className="h-3.5 w-3.5" />
                {t('developer.openConsole')}
                <ExternalLink className="h-3 w-3 ml-auto opacity-40" />
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-9 text-xs" onClick={handleShowLogs}>
                <FileText className="h-3.5 w-3.5" />
                {t('gateway.logs')}
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-9 text-xs" onClick={handleOpenLogDir}>
                <Download className="h-3.5 w-3.5" />
                {t('gateway.openFolder')}
              </Button>
              <Button variant="destructive" className="justify-start gap-2 h-9 text-xs" onClick={() => { resetSetup(); toast.success("Setup wizard reset!"); }}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reset Wizard
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* --- Updates --- */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('updates.title')}</h2>
        <div className="rounded-xl border border-border/50 bg-card/30 p-5">
          <UpdateSettings />
          <div className="mt-4 pt-4 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between items-center">
            <span>Easy-claw v{currentVersion}</span>
            <span>© 2026 iaaa00</span>
          </div>
        </div>
      </section>

      {/* Logs Dialog */}
      {showLogs && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-card">
              <h3 className="text-xs font-bold uppercase tracking-wider">Application Logs</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowLogs(false)}><XIcon className="h-4 w-4" /></Button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono leading-relaxed bg-muted/20">
              {logContent || t('chat:noLogs')}
            </pre>
            <div className="p-3 border-t bg-card/50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => { navigator.clipboard.writeText(logContent); toast.success('Logs copied'); }}
              >
                <Copy className="h-3 w-3 mr-1.5" /> Copy to Clipboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
