/**
 * Sidebar Component
 * Minimal navigation sidebar
 */
import { NavLink } from 'react-router-dom';
import {
  Home,
  MessageSquare,
  Radio,
  Puzzle,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
}

function NavItem({ to, icon, label, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
          collapsed && 'justify-center px-2',
          isActive
            ? 'text-foreground bg-accent'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        )
      }
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          {/* Active indicator bar */}
          {isActive && !collapsed && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-foreground" />
          )}
          <span className={cn('shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
            {icon}
          </span>
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);

  const openDevConsole = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as {
        success: boolean;
        url?: string;
        error?: string;
      };
      if (result.success && result.url) {
        window.electron.openExternal(result.url);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  const { t } = useTranslation();

  const navItems = [
    { to: '/', icon: <MessageSquare className="h-[18px] w-[18px]" />, label: t('sidebar.chat') },
    { to: '/cron', icon: <Clock className="h-[18px] w-[18px]" />, label: t('sidebar.cronTasks') },
    { to: '/skills', icon: <Puzzle className="h-[18px] w-[18px]" />, label: t('sidebar.skills') },
    { to: '/channels', icon: <Radio className="h-[18px] w-[18px]" />, label: t('sidebar.channels') },
    { to: '/dashboard', icon: <Home className="h-[18px] w-[18px]" />, label: t('sidebar.dashboard') },
    { to: '/settings', icon: <Settings className="h-[18px] w-[18px]" />, label: t('sidebar.settings') },
  ];

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border/60 bg-card/50 transition-all duration-200',
        sidebarCollapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo area */}
      {!sidebarCollapsed && (
        <div className="px-4 py-3 border-b border-border/40">
          <span className="text-sm font-semibold tracking-tight">Easy-claw</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-auto p-2">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border/40 space-y-1">
        {devModeUnlocked && !sidebarCollapsed && (
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8 text-muted-foreground hover:text-foreground" onClick={openDevConsole}>
            <Terminal className="h-3.5 w-3.5 mr-2" />{t('sidebar.devConsole')}
            <ExternalLink className="h-3 w-3 ml-auto opacity-40" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="w-full h-8 text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
