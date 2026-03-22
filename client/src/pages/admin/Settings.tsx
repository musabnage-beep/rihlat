import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface SettingsData {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  aboutText: string;
  termsText: string;
  privacyText: string;
  socialTwitter: string;
  socialInstagram: string;
  socialFacebook: string;
  socialWhatsapp: string;
}

const defaultSettings: SettingsData = {
  companyName: '', companyEmail: '', companyPhone: '', companyAddress: '',
  aboutText: '', termsText: '', privacyText: '',
  socialTwitter: '', socialInstagram: '', socialFacebook: '', socialWhatsapp: '',
};

export default function AdminSettings() {
  const [form, setForm] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'company' | 'legal' | 'social'>('company');

  useEffect(() => {
    api.get('/admin/settings')
      .then(({ data }) => {
        const s = data.settings || data;
        setForm({
          companyName: s.companyName || '',
          companyEmail: s.companyEmail || '',
          companyPhone: s.companyPhone || '',
          companyAddress: s.companyAddress || '',
          aboutText: s.aboutText || '',
          termsText: s.termsText || '',
          privacyText: s.privacyText || '',
          socialTwitter: s.socialTwitter || '',
          socialInstagram: s.socialInstagram || '',
          socialFacebook: s.socialFacebook || '',
          socialWhatsapp: s.socialWhatsapp || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/settings', form);
      toast.success('تم حفظ الإعدادات');
    } catch {
      toast.error('خطأ في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof SettingsData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const tabs = [
    { key: 'company' as const, label: 'معلومات الشركة' },
    { key: 'legal' as const, label: 'النصوص القانونية' },
    { key: 'social' as const, label: 'وسائل التواصل' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 text-sm mt-1">إعدادات الموقع والشركة</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {activeTab === 'company' && (
          <div className="card p-6 space-y-4">
            <div>
              <label className="label">اسم الشركة</label>
              <input className="input" value={form.companyName} onChange={update('companyName')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">البريد الإلكتروني</label>
                <input type="email" className="input" value={form.companyEmail} onChange={update('companyEmail')} dir="ltr" />
              </div>
              <div>
                <label className="label">رقم الهاتف</label>
                <input type="tel" className="input" value={form.companyPhone} onChange={update('companyPhone')} dir="ltr" />
              </div>
            </div>
            <div>
              <label className="label">العنوان</label>
              <input className="input" value={form.companyAddress} onChange={update('companyAddress')} />
            </div>
            <div>
              <label className="label">عن الشركة</label>
              <textarea className="input min-h-[100px]" value={form.aboutText} onChange={update('aboutText')} />
            </div>
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="card p-6 space-y-4">
            <div>
              <label className="label">الشروط والأحكام</label>
              <textarea className="input min-h-[150px]" value={form.termsText} onChange={update('termsText')} />
            </div>
            <div>
              <label className="label">سياسة الخصوصية</label>
              <textarea className="input min-h-[150px]" value={form.privacyText} onChange={update('privacyText')} />
            </div>
          </div>
        )}

        {activeTab === 'social' && (
          <div className="card p-6 space-y-4">
            <div>
              <label className="label">تويتر (X)</label>
              <input className="input" value={form.socialTwitter} onChange={update('socialTwitter')} dir="ltr" placeholder="https://x.com/..." />
            </div>
            <div>
              <label className="label">انستقرام</label>
              <input className="input" value={form.socialInstagram} onChange={update('socialInstagram')} dir="ltr" placeholder="https://instagram.com/..." />
            </div>
            <div>
              <label className="label">فيسبوك</label>
              <input className="input" value={form.socialFacebook} onChange={update('socialFacebook')} dir="ltr" placeholder="https://facebook.com/..." />
            </div>
            <div>
              <label className="label">واتساب</label>
              <input className="input" value={form.socialWhatsapp} onChange={update('socialWhatsapp')} dir="ltr" placeholder="966500000000" />
            </div>
          </div>
        )}

        <div className="mt-6">
          <button type="submit" disabled={saving} className="btn-primary px-8">
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </form>
    </div>
  );
}
