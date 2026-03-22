import { useEffect, useState } from 'react';
import { Send, Bell, Users, User } from 'lucide-react';
import api from '@/lib/api';
import { formatShortDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  _count?: { userNotifications: number };
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [userId, setUserId] = useState('');

  const fetchNotifications = () => {
    setLoading(true);
    api.get('/admin/notifications')
      .then(({ data }) => setNotifications(data.notifications || data.data || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/admin/notifications', {
        title,
        message,
        type: 'CUSTOM',
        userId: target === 'specific' ? userId : undefined,
      });
      toast.success('تم إرسال الإشعار');
      setShowForm(false);
      setTitle('');
      setMessage('');
      fetchNotifications();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  const typeLabels: Record<string, string> = {
    BOOKING_CONFIRMATION: 'تأكيد حجز',
    BOOKING_CANCELLATION: 'إلغاء حجز',
    PAYMENT_SUCCESS: 'دفع ناجح',
    PAYMENT_FAILED: 'فشل دفع',
    TRIP_REMINDER: 'تذكير رحلة',
    TRIP_UPDATE: 'تحديث رحلة',
    PROMOTIONAL: 'ترويجي',
    CUSTOM: 'مخصص',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الإشعارات</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة الإشعارات والرسائل</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Send className="w-4 h-4" />
          إشعار جديد
        </button>
      </div>

      {/* Send Form */}
      {showForm && (
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">إرسال إشعار</h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="label">عنوان الإشعار *</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="label">نص الرسالة *</label>
              <textarea className="input min-h-[80px]" value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <div>
              <label className="label">إرسال إلى</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="target" value="all" checked={target === 'all'} onChange={() => setTarget('all')} className="text-primary-600" />
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">جميع العملاء</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="target" value="specific" checked={target === 'specific'} onChange={() => setTarget('specific')} className="text-primary-600" />
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">عميل محدد</span>
                </label>
              </div>
            </div>
            {target === 'specific' && (
              <div>
                <label className="label">معرف العميل</label>
                <input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="أدخل معرف العميل" dir="ltr" />
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={sending} className="btn-primary">
                <Send className="w-4 h-4" />
                {sending ? 'جاري الإرسال...' : 'إرسال'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="card">
        <div className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5"><div className="h-4 bg-gray-200 rounded animate-pulse" /></div>
            ))
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">لا توجد إشعارات</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="p-5 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{n.title}</h3>
                      <span className="badge bg-gray-100 text-gray-600">{typeLabels[n.type] || n.type}</span>
                    </div>
                    <p className="text-sm text-gray-500">{n.message}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-400">{formatShortDate(n.createdAt)}</p>
                    {n._count?.userNotifications !== undefined && (
                      <p className="text-xs text-gray-400 mt-1">{n._count.userNotifications} مستلم</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
