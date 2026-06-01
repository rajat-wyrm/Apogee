import { useAuthStore, useUIStore } from '../../store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';

export default function Profile() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useUIStore();

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar name={user?.full_name} src={user?.avatar_url} size="xl" />
          <div>
            <h2 className="text-xl font-bold">{user?.full_name}</h2>
            <p className="text-sm text-fg-2">{user?.email}</p>
            <p className="text-xs text-fg-3 mt-1">Member since {new Date(user?.created_at).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <CardContent>
          <label className="label">Theme</label>
          <div className="flex gap-2">
            {['light', 'dark', 'system'].map((t) => (
              <button key={t} onClick={() => setTheme(t)} className={`btn-secondary capitalize ${theme === t ? 'bg-brand-100 text-brand-700' : ''}`}>{t}</button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
