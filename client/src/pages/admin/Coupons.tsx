import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy } from 'lucide-react';
import api from '@/lib/api';
import { formatShortDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Coupon {
  id: string;
  code: string;
  discountPercent: number | null;
  discountAmount: number | null;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

interface CouponForm {
  code: string;
  discountPercent: string;
  discountAmount: string;
  minOrderAmount: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
}

const defaultForm: CouponForm = {
  code: '', discountPercent: '', discountAmount: '', minOrderAmount: '', maxUses: '', expiresAt: '', isActive: true,
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchCoupons = () => {
    setLoading(true);
    api.get('/admin/coupons')
      .then(({ data }) => setCoupons(data.coupons || data.data || data || []))
      .catch(() => toast.error('خطأ في تحميل الكوبونات'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCoupons(); }, []);

  const openNew = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };

  const openEdit = (c: Coupon) => {
    setEditId(c.id);
    setForm({
      code: c.code,
      discountPercent: c.discountPercent?.toString() || '',
      discountAmount: c.discountAmount?.toString() || '',
      minOrderAmount: c.minOrderAmount?.toString() || '',
      maxUses: c.maxUses?.toString() || '',
      expiresAt: c.expiresAt?.split('T')[0] || '',
      isActive: c.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      code: form.code,
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : null,
      discountAmount: form.discountAmount ? parseFloat(form.discountAmount) : null,
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : null,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
      isActive: form.isActive,
    };

    try {
      if (editId) {
        await api.put(`/admin/coupons/${editId}`, payload);
        toast.success('تم تعديل الكوبون');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('تم إنشاء الكوبون');
      }
      setShowModal(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف الكوبون؟')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('تم حذف الكوبون');
      fetchCoupons();
    } catch {
      toast.error('خطأ في حذف الكوبون');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الكوبونات والعروض</h1>
          <p className="text-gray-500 text-sm mt-1">{coupons.length} كوبون</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" />كوبون جديد</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-right px-5 py-3 font-medium text-gray-600">الكود</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الخصم</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الحد الأدنى</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الاستخدام</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">تاريخ الانتهاء</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الحالة</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td></tr>
                ))
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">لا توجد كوبونات</td></tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">{c.code}</code>
                        <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success('تم النسخ'); }} className="text-gray-400 hover:text-gray-600">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {c.discountPercent ? `${c.discountPercent}%` : c.discountAmount ? `${c.discountAmount} ريال` : '-'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.minOrderAmount ? `${c.minOrderAmount} ريال` : '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{c.usedCount}/{c.maxUses || '∞'}</td>
                    <td className="px-5 py-3 text-gray-600">{c.expiresAt ? formatShortDate(c.expiresAt) : 'غير محدد'}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        {c.isActive ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'تعديل كوبون' : 'كوبون جديد'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">كود الخصم *</label>
                <input className="input font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">نسبة الخصم (%)</label>
                  <input type="number" className="input" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} min="0" max="100" />
                </div>
                <div>
                  <label className="label">مبلغ الخصم (ريال)</label>
                  <input type="number" className="input" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">الحد الأدنى للطلب</label>
                  <input type="number" className="input" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} min="0" />
                </div>
                <div>
                  <label className="label">الحد الأقصى للاستخدام</label>
                  <input type="number" className="input" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} min="1" />
                </div>
              </div>
              <div>
                <label className="label">تاريخ الانتهاء</label>
                <input type="date" className="input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                <label htmlFor="isActive" className="text-sm text-gray-700">كوبون نشط</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
