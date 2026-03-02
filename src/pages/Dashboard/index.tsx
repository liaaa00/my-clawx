/**
 * Dashboard Page
 * Clean overview showing system status and quick actions
 */
import { useEffect, useState } from 'react';
import {
  Activity,
  MessageSquare,
  Radio,
  Puzzle,
  Clock,
  Settings,
  Plus,
  Terminal,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { useChannelsStore } from '@/stores/channels';
import { useSkillsStore } from '@/stores/skills';
import { useSettingsStore } from '@/stores/settings';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { t } = useTranslation('dashboard');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const { channels, fetchChannels } = useChannelsStore();
  const { skills, fetchSkills } = useSkillsStore();
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);

  const isGatewayRunning = gatewayStatus.state === 'running';
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    if (isGatewayRunning) { fetchChannels(); fetchSkills(); }
  }, [fetchChannels, fetchSkills, isGatewayRunning]);

  const connectedChannels = Array.isArray(channels) ? channels.filter((c) => c.status === 'connected').length : 0;
  const enabledSkills = Array.isArray(skills) ? skills.filter((s) => s.enabled).length : 0;

  useEffect(() => {
    const updateUptime = () => {
      if (gatewayStatus.connectedAt) {
        setUptime(Math.floor((Date.now() - gatewayStatus.connectedAt) / 1000));
      } else { setUptime(0); }
    };
    updateUptime();
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [gatewayStatus.connectedAt]);

  const openDevConsole = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as { success: boolean; url?: string; error?: string };
      if (result.success && result.url) window.electron.openExternal(result.url);
    } catch (err) { console.error('Error opening Dev Console:', err); }
  };

  const stats = [
    { label: t('gateway'), value: <StatusBadge status={gatewayStatus.state} />, sub: isGatewayRunning ? `${t('port', { port: gatewayStatus.port })} · PID ${gatewayStatus.pid || '—'}` : undefined, icon: Activity },
    { label: t('channels'), value: connectedChannels, sub: t('connectedOf', { connected: connectedChannels, total: channels.length }), icon: Radio },
    { label: t('skills'), value: enabledSkills, sub: t('enabledOf', { enabled: enabledSkills, total: skills.length }), icon: Puzzle },
    { label: t('uptime'), value: uptime > 0 ? formatUptime(uptime) : '—', sub: isGatewayRunning ? t('sinceRestart') : t('gatewayNotRunning'), icon: Clock },
  ];

  const quickActions = [
    { to: '/channels', icon: Plus, label: t('quickActions.addChannel') },
    { to: '/skills', icon: Puzzle, label: t('quickActions.browseSkills') },
    { to: '/', icon: MessageSquare, label: t('quickActions.openChat') },
    { to: '/settings', icon: Settings, label: t('quickActions.settings') },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
              <s.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="text-xl font-semibold tabular-nums">{s.value}</div>
            {s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('quickActions.title')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to} className="group flex items-center gap-3 rounded-xl border border-border/50 p-3.5 transition-colors hover:bg-accent/50 hover:border-border">
              <a.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{a.label}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-all" />
            </Link>
          ))}
          {devModeUnlocked && (
            <button onClick={openDevConsole} className="group flex items-center gap-3 rounded-xl border border-border/50 p-3.5 transition-colors hover:bg-accent/50 hover:border-border text-left">
              <Terminal className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{t('quickActions.devConsole')}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-all" />
            </button>
          )}
        </div>
      </div>

      {/* Two column details */}
      <div className="grid grid-cols-2 gap-4">
        {/* Channels */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('connectedChannels')}</h2>
          {channels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 py-10 text-center">
              <Radio className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('noChannels')}</p>
              <Button variant="link" size="sm" asChild className="mt-1 text-xs"><Link to="/channels">{t('addFirst')}</Link></Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {channels.slice(0, 5).map((channel) => (
                <div key={channel.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">
                      {channel.type === 'whatsapp' && '📱'}
                      {channel.type === 'telegram' && '✈️'}
                      {channel.type === 'discord' && '🎮'}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{channel.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{channel.type}</p>
                    </div>
                  </div>
                  <StatusBadge status={channel.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skills */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('activeSkills')}</h2>
          {skills.filter((s) => s.enabled).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 py-10 text-center">
              <Puzzle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('noSkills')}</p>
              <Button variant="link" size="sm" asChild className="mt-1 text-xs"><Link to="/skills">{t('enableSome')}</Link></Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skills.filter((s) => s.enabled).slice(0, 12).map((skill) => (
                <Badge key={skill.id} variant="secondary" className="text-xs font-normal">
                  {skill.icon && <span className="mr-1">{skill.icon}</span>}
                  {skill.name}
                </Badge>
              ))}
              {skills.filter((s) => s.enabled).length > 12 && (
                <Badge variant="outline" className="text-xs font-normal">{t('more', { count: skills.filter((s) => s.enabled).length - 12 })}</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default Dashboard;
