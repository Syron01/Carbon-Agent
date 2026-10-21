import { useEffect, useState } from 'react';
import { IconBolt, IconCircleCheck, IconLoader2, IconRefresh } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface SkillEntry {
  name: string;
  description: string;
}

export function SkillsPanel() {
  const { status } = useApp();
  const active = status?.activeSkills ?? [];
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSkill, setLoadingSkill] = useState<string | null>(null);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const data = await api.getSkills();
      setSkills(data?.skills || []);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
    const id = setInterval(fetchSkills, 15000);
    return () => clearInterval(id);
  }, []);

  const load = async (name: string) => {
    setLoadingSkill(name);
    try {
      await api.loadSkill(name);
    } catch {
      /* ignore */
    } finally {
      setLoadingSkill(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Skills</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-subtle">{active.length} active</span>
          <button onClick={fetchSkills} className="text-fg-subtle hover:text-fg-muted transition-colors" title="Refresh">
            <IconRefresh size={14} stroke={1.5} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {active.length > 0 && (
          <div className="px-3 pt-3">
            <div className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">Active this session</div>
            <div className="flex flex-wrap gap-1.5">
              {active.map((name) => (
                <span key={name} className="flex items-center gap-1 px-2 py-1 text-2xs rounded-full badge-accent">
                  <IconCircleCheck size={12} stroke={1.5} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="px-3 pt-3 text-2xs font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">Available</div>

        {loading && skills.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-fg-subtle text-sm gap-2">
            <IconLoader2 size={18} className="animate-spin" />
            Loading...
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-fg-subtle text-sm gap-2 px-4 text-center">
            <IconBolt size={28} stroke={1} className="opacity-30" />
            <span>No skills found</span>
            <span className="text-xs opacity-70">Place .md files in .opencode/skills/</span>
          </div>
        ) : (
          skills.map((skill) => {
            const isActive = active.includes(skill.name);
            return (
              <div key={skill.name} className="px-3 py-2.5 border-b border-border-default/50 hover:bg-sidebar-hover transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate font-medium">{skill.name}</span>
                  <button
                    onClick={() => load(skill.name)}
                    disabled={loadingSkill === skill.name}
                    className={cn('text-2xs px-2 py-1 rounded-full transition-colors',
                      isActive ? 'text-fg-success' : 'btn btn-secondary')}
                    title={isActive ? 'Reload skill' : 'Load skill'}
                  >
                    {loadingSkill === skill.name ? <IconLoader2 size={13} className="animate-spin" /> : isActive ? 'Active' : 'Load'}
                  </button>
                </div>
                {skill.description && <div className="text-xs text-fg-subtle mt-0.5 line-clamp-2">{skill.description}</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
