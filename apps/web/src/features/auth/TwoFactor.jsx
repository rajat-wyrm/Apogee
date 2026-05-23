import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { Shield, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthShell } from './Login';

export default function TwoFactor() {
  const navigate = useNavigate();
  const location = useLocation();
  const verify = useAuthStore((s) => s.verify2fa);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const userId = location.state?.userId;

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verify(userId, code);
      toast.success('Verified!');
      navigate('/app');
    } catch (err) {} finally { setLoading(false); }
  };

  return (
    <AuthShell title="Two-factor code" subtitle="Enter the 6-digit code from your authenticator app.">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Verification code</label>
          <div className="relative">
            <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input type="text" required maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="input pl-9 tracking-widest font-mono" autoFocus />
          </div>
        </div>
        <button type="submit" disabled={loading || code.length < 4} className="btn-primary w-full justify-center">
          {loading ? <span className="loader" /> : <>Verify <ArrowRight size={14} /></>}
        </button>
      </form>
    </AuthShell>
  );
}
