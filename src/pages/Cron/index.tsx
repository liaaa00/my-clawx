/**
 * Cron Page
 * Manage scheduled tasks — premium redesign
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Clock,
  Play,
  Pause,
  Trash2,
  Edit,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Timer,
  History,
  Zap,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
// Card imports removed as part of UI refactor
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCronStore } from '@/stores/cron';
import { useChannelsStore } from '@/stores/channels';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CronJob, CronJobCreateInput, ScheduleType } from '@/types/cron';
import { CHANNEL_ICONS } from '@/types/channel';
import { useTranslation } from 'react-i18next';

// Common cron schedule presets
const schedulePresets: { label: string; value: string; type: ScheduleType }[] = [
  { label: 'Every minute', value: '* * * * *', type: 'interval' },
  { label: 'Every 5 minutes', value: '*/5 * * * *', type: 'interval' },
  { label: 'Every 15 minutes', value: '*/15 * * * *', type: 'interval' },
  { label: 'Every hour', value: '0 * * * *', type: 'interval' },
  { label: 'Daily at 9am', value: '0 9 * * *', type: 'daily' },
  { label: 'Daily at 6pm', value: '0 18 * * *', type: 'daily' },
  { label: 'Weekly (Mon 9am)', value: '0 9 * * 1', type: 'weekly' },
  { label: 'Monthly (1st at 9am)', value: '0 9 1 * *', type: 'monthly' },
];

// Parse cron schedule to human-readable format
function parseCronSchedule(schedule: unknown): string {
  if (schedule && typeof schedule === 'object') {
    const s = schedule as { kind?: string; expr?: string; tz?: string; everyMs?: number; at?: string };
    if (s.kind === 'cron' && typeof s.expr === 'string') return parseCronExpr(s.expr);
    if (s.kind === 'every' && typeof s.everyMs === 'number') {
      const ms = s.everyMs;
      if (ms < 60_000) return `Every ${Math.round(ms / 1000)}s`;
      if (ms < 3_600_000) return `Every ${Math.round(ms / 60_000)} min`;
      if (ms < 86_400_000) return `Every ${Math.round(ms / 3_600_000)}h`;
      return `Every ${Math.round(ms / 86_400_000)}d`;
    }
    if (s.kind === 'at' && typeof s.at === 'string') {
      try { return `Once at ${new Date(s.at).toLocaleString()}`; } catch { return `Once at ${s.at}`; }
    }
    return String(schedule);
  }
  if (typeof schedule === 'string') return parseCronExpr(schedule);
  return String(schedule ?? 'Unknown');
}

function parseCronExpr(cron: string): string {
  const preset = schedulePresets.find((p) => p.value === cron);
  if (preset) return preset.label;
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  if (minute === '*' && hour === '*') return 'Every minute';
  if (minute.startsWith('*/')) return `Every ${minute.slice(2)} min`;
  if (hour === '*' && minute === '0') return 'Every hour';
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Weekly ${days[parseInt(dayOfWeek)]} ${hour}:${minute.padStart(2, '0')}`;
  }
  if (dayOfMonth !== '*') return `Monthly day ${dayOfMonth} ${hour}:${minute.padStart(2, '0')}`;
  if (hour !== '*') return `Daily ${hour}:${minute.padStart(2, '0')}`;
  return cron;
}

// ──────────────────────────── Task Dialog ────────────────────────────

interface TaskDialogProps {
  job?: CronJob;
  onClose: () => void;
  onSave: (input: CronJobCreateInput) => Promise<void>;
}

function TaskDialog({ job, onClose, onSave }: TaskDialogProps) {
  const { t } = useTranslation('cron');
  const { channels } = useChannelsStore();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(job?.name || '');
  const [message, setMessage] = useState(job?.message || '');
  const initialSchedule = (() => {
    const s = job?.schedule;
    if (!s) return '0 9 * * *';
    if (typeof s === 'string') return s;
    if (typeof s === 'object' && 'expr' in s && typeof (s as { expr: string }).expr === 'string') {
      return (s as { expr: string }).expr;
    }
    return '0 9 * * *';
  })();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [customSchedule, setCustomSchedule] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [channelId, setChannelId] = useState(job?.target.channelId || '');
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [enabled, setEnabled] = useState(job?.enabled ?? true);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const isDiscord = selectedChannel?.type === 'discord';

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error(t('toast.nameRequired')); return; }
    if (!message.trim()) { toast.error(t('toast.messageRequired')); return; }
    if (!channelId) { toast.error(t('toast.channelRequired')); return; }
    if (selectedChannel?.type === 'discord' && !discordChannelId.trim()) { toast.error(t('toast.discordIdRequired')); return; }
    const finalSchedule = useCustom ? customSchedule : schedule;
    if (!finalSchedule.trim()) { toast.error(t('toast.scheduleRequired')); return; }

    setSaving(true);
    try {
      const actualChannelId = selectedChannel!.type === 'discord' ? discordChannelId.trim() : '';
      await onSave({
        name: name.trim(),
        message: message.trim(),
        schedule: finalSchedule,
        target: { channelType: selectedChannel!.type, channelId: actualChannelId, channelName: selectedChannel!.name },
        enabled,
      });
      onClose();
      toast.success(job ? t('toast.updated') : t('toast.created'));
    } catch (err) { toast.error(String(err)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col rounded-xl border border-border/50 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-row items-start justify-between p-6 pb-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{job ? t('dialog.editTitle') : t('dialog.createTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('dialog.description')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2 -mt-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dialog.taskName')}</Label>
            <Input id="name" placeholder={t('dialog.taskNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dialog.message')}</Label>
            <Textarea id="message" placeholder={t('dialog.messagePlaceholder')} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="resize-none" />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dialog.schedule')}</Label>
            {!useCustom ? (
              <div className="grid grid-cols-2 gap-1.5">
                {schedulePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={schedule === preset.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSchedule(preset.value)}
                    className={cn('justify-start h-8 text-xs', schedule === preset.value && 'shadow-md')}
                  >
                    <Timer className="h-3 w-3 mr-1.5 shrink-0" />
                    {preset.label === 'Every minute' ? t('presets.everyMinute') :
                      preset.label === 'Every 5 minutes' ? t('presets.every5Min') :
                        preset.label === 'Every 15 minutes' ? t('presets.every15Min') :
                          preset.label === 'Every hour' ? t('presets.everyHour') :
                            preset.label === 'Daily at 9am' ? t('presets.daily9am') :
                              preset.label === 'Daily at 6pm' ? t('presets.daily6pm') :
                                preset.label === 'Weekly (Mon 9am)' ? t('presets.weeklyMon') :
                                  preset.label === 'Monthly (1st at 9am)' ? t('presets.monthly1st') : preset.label}
                  </Button>
                ))}
              </div>
            ) : (
              <Input placeholder={t('dialog.cronPlaceholder')} value={customSchedule} onChange={(e) => setCustomSchedule(e.target.value)} />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setUseCustom(!useCustom)} className="text-xs h-7">
              {useCustom ? t('dialog.usePresets') : t('dialog.useCustomCron')}
            </Button>
          </div>

          {/* Target Channel */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dialog.targetChannel')}</Label>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dialog.noChannels')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {channels.map((channel) => (
                  <Button key={channel.id} type="button" variant={channelId === channel.id ? 'default' : 'outline'} size="sm" onClick={() => setChannelId(channel.id)} className="justify-start h-8 text-xs">
                    <span className="mr-1.5">{CHANNEL_ICONS[channel.type]}</span>
                    {channel.name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Discord Channel ID */}
          {isDiscord && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dialog.discordChannelId')}</Label>
              <Input value={discordChannelId} onChange={(e) => setDiscordChannelId(e.target.value)} placeholder={t('dialog.discordChannelIdPlaceholder')} />
              <p className="text-xs text-muted-foreground">{t('dialog.discordChannelIdDesc')}</p>
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
            <div>
              <Label className="text-sm">{t('dialog.enableImmediately')}</Label>
              <p className="text-xs text-muted-foreground">{t('dialog.enableImmediatelyDesc')}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
            <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} size="sm">
              {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</> : <><CheckCircle2 className="h-4 w-4 mr-1.5" />{job && job.id ? t('dialog.saveChanges') : t('dialog.createTitle')}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Job Card ────────────────────────────

interface CronJobCardProps {
  job: CronJob;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => Promise<void>;
}

function CronJobCard({ job, onToggle, onEdit, onDelete, onTrigger }: CronJobCardProps) {
  const { t } = useTranslation('cron');
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = async () => {
    setTriggering(true);
    try { await onTrigger(); toast.success(t('toast.triggered')); }
    catch (error) { toast.error(`Failed: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setTriggering(false); }
  };

  return (
    <div className={cn(
      'group relative rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-lg',
      job.enabled ? 'border-primary/20 hover:border-primary/40' : 'border-border/50 opacity-75 hover:opacity-100'
    )}>
      {/* Subtle gradient accent for active jobs */}
      {job.enabled && (
        <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
      )}

      <div className="flex items-start justify-between gap-3">
        {/* Left: Icon + Info */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={cn(
            'shrink-0 rounded-lg p-2 transition-colors',
            job.enabled
              ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20'
              : 'bg-muted'
          )}>
            <Zap className={cn('h-4 w-4', job.enabled ? 'text-green-500' : 'text-muted-foreground')} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{job.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{parseCronSchedule(job.schedule)}</span>
            </div>
          </div>
        </div>

        {/* Right: Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={job.enabled ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0">
            {job.enabled ? t('stats.active') : t('stats.paused')}
          </Badge>
          <Switch checked={job.enabled} onCheckedChange={onToggle} />
        </div>
      </div>

      {/* Message Preview */}
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 p-2.5 border border-border/30">
        <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{job.message}</p>
      </div>

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          {CHANNEL_ICONS[job.target.channelType]}
          {job.target.channelName}
        </span>
        {job.lastRun && (
          <span className="flex items-center gap-1">
            <History className="h-3 w-3" />
            {formatRelativeTime(job.lastRun.time)}
            {job.lastRun.success ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
          </span>
        )}
        {job.nextRun && job.enabled && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(job.nextRun).toLocaleString()}
          </span>
        )}
      </div>

      {/* Last Run Error */}
      {job.lastRun && !job.lastRun.success && job.lastRun.error && (
        <div className="mt-2 flex items-start gap-1.5 p-2 rounded-md bg-red-500/5 border border-red-500/10 text-[11px] text-red-500">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="line-clamp-1">{job.lastRun.error}</span>
        </div>
      )}

      {/* Actions — slide up on hover */}
      <div className="mt-3 flex justify-end gap-0.5 pt-2 border-t border-border/20">
        <Button variant="ghost" size="sm" onClick={handleTrigger} disabled={triggering} className="h-7 px-2 text-xs">
          {triggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          <span className="ml-1">{t('card.runNow')}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs">
          <Edit className="h-3 w-3" /><span className="ml-1">Edit</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { if (confirm(t('card.deleteConfirm'))) onDelete(); }} className="h-7 px-2 text-xs text-destructive hover:text-destructive">
          <Trash2 className="h-3 w-3" /><span className="ml-1">Delete</span>
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────── Template definitions ────────────────────────────

function useTemplates() {
  const { t } = useTranslation('cron');
  return [
    {
      icon: '📋', color: 'from-blue-500/15 to-cyan-500/15 dark:from-blue-500/25 dark:to-cyan-500/25',
      border: 'hover:border-blue-400/50',
      name: t('templates.daily.name', '每日工作摘要'),
      desc: t('templates.daily.desc', '每天早上自动汇总昨日消息和待办'),
      message: '请帮我整理一份简洁的工作日报：\n1. 汇总昨天的重要消息和讨论\n2. 列出今天需要跟进的待办事项\n3. 提醒今天的日程安排\n\n请用简洁的格式输出，重点突出。',
      schedule: '0 9 * * *',
    },
    {
      icon: '💻', color: 'from-violet-500/15 to-purple-500/15 dark:from-violet-500/25 dark:to-purple-500/25',
      border: 'hover:border-violet-400/50',
      name: t('templates.codeReview.name', '代码周报'),
      desc: t('templates.codeReview.desc', '每周五自动生成代码提交摘要'),
      message: '请帮我生成本周代码工作周报：\n1. 总结本周完成的主要开发任务\n2. 列出代码变更的关键点\n3. 记录遇到的技术问题和解决方案\n4. 列出下周计划\n\n请用 Markdown 格式输出。',
      schedule: '0 17 * * 5',
    },
    {
      icon: '📧', color: 'from-amber-500/15 to-orange-500/15 dark:from-amber-500/25 dark:to-orange-500/25',
      border: 'hover:border-amber-400/50',
      name: t('templates.email.name', '邮件/消息整理'),
      desc: t('templates.email.desc', '定时汇总未读消息和重要通知'),
      message: '请帮我整理和汇总近期的未读消息：\n1. 按重要程度分类\n2. 标注需要回复的消息\n3. 提取关键信息和行动项\n\n请用简洁的列表格式输出。',
      schedule: '0 9,18 * * *',
    },
    {
      icon: '🔍', color: 'from-emerald-500/15 to-green-500/15 dark:from-emerald-500/25 dark:to-green-500/25',
      border: 'hover:border-emerald-400/50',
      name: t('templates.healthCheck.name', '系统健康检查'),
      desc: t('templates.healthCheck.desc', '定期检查开发环境和服务状态'),
      message: '请帮我检查以下内容并报告状态：\n1. 当前系统资源使用情况（CPU、内存、磁盘）\n2. 正在运行的开发服务状态\n3. 是否有异常日志或错误\n4. 需要关注的安全更新\n\n请以简洁的状态报告格式输出。',
      schedule: '0 10 * * *',
    },
    {
      icon: '📝', color: 'from-rose-500/15 to-pink-500/15 dark:from-rose-500/25 dark:to-pink-500/25',
      border: 'hover:border-rose-400/50',
      name: t('templates.todo.name', '待办事项提醒'),
      desc: t('templates.todo.desc', '每天提醒你需要完成的事项'),
      message: '请根据之前的对话记录，帮我整理待办事项清单：\n1. 列出未完成的任务\n2. 按优先级排序\n3. 标注截止日期（如有）\n4. 给出今天应该优先处理的 3 件事\n\n请用 checklist 格式输出。',
      schedule: '0 8 * * 1-5',
    },
    {
      icon: '💡', color: 'from-sky-500/15 to-indigo-500/15 dark:from-sky-500/25 dark:to-indigo-500/25',
      border: 'hover:border-sky-400/50',
      name: t('templates.inspiration.name', '内容灵感收集'),
      desc: t('templates.inspiration.desc', '定期收集和整理创意灵感'),
      message: '请帮我收集和整理一些有价值的内容灵感：\n1. 当前技术领域的热门趋势\n2. 值得关注的开源项目或工具\n3. 有启发性的技术文章摘要\n4. 可以写的技术博客主题建议\n\n请提供 3-5 个有价值的建议。',
      schedule: '0 12 * * 1,4',
    },
  ];
}

// ──────────────────────────── Main Page ────────────────────────────

export function Cron() {
  const { t } = useTranslation('cron');
  const { jobs, loading, error, fetchJobs, createJob, updateJob, toggleJob, deleteJob, triggerJob, startAutoRefresh } = useCronStore();
  const { fetchChannels } = useChannelsStore();
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [showDialog, setShowDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>();
  const templates = useTemplates();

  const isGatewayRunning = gatewayStatus.state === 'running';

  useEffect(() => {
    if (isGatewayRunning) {
      fetchJobs();
      fetchChannels();
      return startAutoRefresh();
    }
  }, [fetchJobs, fetchChannels, startAutoRefresh, isGatewayRunning]);

  const activeJobs = jobs.filter((j) => j.enabled);
  const pausedJobs = jobs.filter((j) => !j.enabled);
  const failedJobs = jobs.filter((j) => j.lastRun && !j.lastRun.success);

  const handleSave = useCallback(async (input: CronJobCreateInput) => {
    if (editingJob && editingJob.id) {
      await updateJob(editingJob.id, input);
    } else {
      await createJob(input);
    }
  }, [editingJob, createJob, updateJob]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try { await toggleJob(id, enabled); toast.success(enabled ? t('toast.enabled') : t('toast.paused')); }
    catch { toast.error(t('toast.failedUpdate')); }
  }, [toggleJob, t]);

  const handleDelete = useCallback(async (id: string) => {
    try { await deleteJob(id); toast.success(t('toast.deleted')); }
    catch { toast.error(t('toast.failedDelete')); }
  }, [deleteJob, t]);

  const openTemplate = (tpl: typeof templates[0]) => {
    setEditingJob({
      id: '', name: tpl.name, message: tpl.message, schedule: tpl.schedule,
      target: { channelType: 'terminal' as any, channelId: '', channelName: '' },
      enabled: true, createdAt: '', updatedAt: '',
    } as CronJob);
    setShowDialog(true);
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchJobs} disabled={!isGatewayRunning} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />{t('refresh')}
          </Button>
          <Button size="sm" onClick={() => { setEditingJob(undefined); setShowDialog(true); }} disabled={!isGatewayRunning} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" />{t('newTask')}
          </Button>
        </div>
      </div>

      {/* ── Gateway Warning ── */}
      {!isGatewayRunning && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
          <span className="text-sm text-yellow-600 dark:text-yellow-400">{t('gatewayWarning')}</span>
        </div>
      )}

      {/* ── Statistics ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Clock, label: t('stats.total'), value: jobs.length, gradient: 'from-slate-500/10 to-slate-600/10', iconColor: 'text-slate-500' },
          { icon: Play, label: t('stats.active'), value: activeJobs.length, gradient: 'from-green-500/10 to-emerald-500/10', iconColor: 'text-green-500' },
          { icon: Pause, label: t('stats.paused'), value: pausedJobs.length, gradient: 'from-amber-500/10 to-yellow-500/10', iconColor: 'text-amber-500' },
          { icon: XCircle, label: t('stats.failed'), value: failedJobs.length, gradient: 'from-red-500/10 to-rose-500/10', iconColor: 'text-red-500' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/40 bg-card p-3.5 transition-colors hover:border-border/70">
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg bg-gradient-to-br p-2', stat.gradient)}>
                <stat.icon className={cn('h-4 w-4', stat.iconColor)} />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Proactive Task Templates ── */}
      {isGatewayRunning && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-wider">
                {t('templates.title', '主动任务模板')}
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {t('templates.subtitle', '一键启用预设的智能任务，让 AI 主动为你工作')}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {templates.map((tpl) => (
              <button
                key={tpl.name}
                className={cn(
                  'group relative flex flex-col gap-2 p-3.5 rounded-xl border border-border/40 bg-card',
                  'hover:shadow-md transition-all duration-200 text-left cursor-pointer',
                  tpl.border
                )}
                onClick={() => openTemplate(tpl)}
              >
                {/* Gradient background on hover */}
                <div className={cn('absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity', tpl.color)} />

                <div className="relative flex items-center gap-2">
                  <span className="text-xl leading-none">{tpl.icon}</span>
                  <span className="font-medium text-xs group-hover:text-foreground transition-colors">{tpl.name}</span>
                </div>
                <span className="relative text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{tpl.desc}</span>

                {/* Quick add hint */}
                <div className="relative flex items-center gap-1 mt-auto pt-1">
                  <Plus className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  <span className="text-[10px] text-muted-foreground/50 group-hover:text-primary/70 transition-colors">
                    {t('templates.clickToAdd', '点击快速创建')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Error Display ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Jobs List ── */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border/50">
          <div className="rounded-2xl bg-muted/50 p-4 mb-4">
            <Clock className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-base font-medium mb-1">{t('empty.title')}</h3>
          <p className="text-sm text-muted-foreground text-center mb-5 max-w-sm">{t('empty.description')}</p>
          <Button size="sm" onClick={() => { setEditingJob(undefined); setShowDialog(true); }} disabled={!isGatewayRunning}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />{t('empty.create')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('stats.total')} ({jobs.length})
            </span>
          </div>
          {jobs.map((job) => (
            <CronJobCard
              key={job.id}
              job={job}
              onToggle={(enabled) => handleToggle(job.id, enabled)}
              onEdit={() => { setEditingJob(job); setShowDialog(true); }}
              onDelete={() => handleDelete(job.id)}
              onTrigger={() => triggerJob(job.id)}
            />
          ))}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      {showDialog && (
        <TaskDialog
          job={editingJob}
          onClose={() => { setShowDialog(false); setEditingJob(undefined); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default Cron;
