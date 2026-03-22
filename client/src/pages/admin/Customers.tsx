import { useEffect, useState } from 'react';
import { Search, Mail, Phone, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { formatShortDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  _count?: { bookings: number };
  bookingsCount?: number;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = () => {
    setLoading(true);
    api.get('/admin/customers', { params: { search: search || undefined, limit: 50 } })
      .then(({ data }) => setCustomers(data.customers || data.data || []))
      .catch(() => toast.error('خطأ في تحميل العملاء'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إدارة العملاء</h1>
        <p className="text-gray-500 text-sm mt-1">{customers.length} عميل</p>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            placeholder="ابحث عن عميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()}
            className="input pr-10"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-right px-5 py-3 font-medium text-gray-600">العميل</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">البريد الإلكتروني</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الجوال</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">عدد الحجوزات</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td></tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">لا يوجد عملاء</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-primary-700">{c.firstName[0]}</span>
                        </div>
                        <span className="font-medium text-gray-900">{c.firstName} {c.lastName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{c.email}</td>
                    <td className="px-5 py-3 text-gray-600">{c.phone || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{c._count?.bookings ?? c.bookingsCount ?? 0}</td>
                    <td className="px-5 py-3 text-gray-600">{formatShortDate(c.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
