import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Plane } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }
    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined });
      toast.success('تم إنشاء الحساب بنجاح');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في التسجيل');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">رحلات</span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-6">حساب جديد</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">الاسم الأول</label>
                <input className="input" value={form.firstName} onChange={update('firstName')} required />
              </div>
              <div>
                <label className="label">الاسم الأخير</label>
                <input className="input" value={form.lastName} onChange={update('lastName')} required />
              </div>
            </div>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input type="email" className="input" value={form.email} onChange={update('email')} required dir="ltr" />
            </div>
            <div>
              <label className="label">رقم الجوال</label>
              <input type="tel" className="input" value={form.phone} onChange={update('phone')} dir="ltr" placeholder="05xxxxxxxx" />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input type="password" className="input" value={form.password} onChange={update('password')} required minLength={8} dir="ltr" />
            </div>
            <div>
              <label className="label">تأكيد كلمة المرور</label>
              <input type="password" className="input" value={form.confirmPassword} onChange={update('confirmPassword')} required dir="ltr" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            لديك حساب؟{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">سجل دخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
