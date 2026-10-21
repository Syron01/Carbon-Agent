import { useState, useEffect } from 'react';
import { IconX, IconBrain, IconRefresh } from '@tabler/icons-react';
import { api } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MemoryModal({ open, onClose }: Props) {
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) fetchExperiences();
  }, [open]);

  const fetchExperiences = async () => {
    setLoading(true);
    try {
      const data = await api.getMemoryExperiences();
      setExperiences(data?.experiences || []);
    } catch { setExperiences([]); }
    finally { setLoading(false); }
  };

  const filtered = search
    ? experiences.filter(e => JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))
    : experiences;

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title"><IconBrain size={18} /> Semantic Memory</span>
          <div className="flex items-center gap-2">
            <button onClick={fetchExperiences} className="btn btn-ghost btn-icon"><IconRefresh size={16} /></button>
            <button className="modal-close" onClick={onClose}><IconX size={18} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div className="flex items-center gap-2 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memory..."
              className="input text-sm flex-1" />
            <span className="text-xs text-fg-subtle">{filtered.length} entries</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-fg-subtle text-sm">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading memory...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-fg-subtle text-sm">
              <IconBrain size={32} stroke={1} className="opacity-30 mb-2" />
              <span>{search ? 'No matches' : 'No memory data yet'}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((exp, i) => (
                <div key={i} className="p-3 rounded-[var(--radius-md)] border border-border-default bg-base-2">
                  <pre className="text-xs text-fg-muted whitespace-pre-wrap font-sans">{JSON.stringify(exp, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
