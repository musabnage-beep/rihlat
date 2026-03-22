import { useEffect, useState } from 'react';
import { Search, Eye, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice, formatShortDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Booking {
  id: string;
  bookingNumber: string;
  tripTitle: string;
  tripDestination: string;
  tripDepartureDate: string;
  status: string;
  numberOfPersons: number;
  finalAmount: number;
  paymentStatus: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string };
  guest?: { firstName: string; lastName: string; email: string };
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);

  const fetchBookings = () => {
    setLoading(true);
    api.get('/admin/bookings', { params: { search: filter || undefined, status: statusFilter || undefined, limit: 50 } })
      .then(({ data }) => setBookings(data.bookings || data.data || []))
      .catch(() => toast.error('خطأ في تحميل الحجوزات'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, [statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/bookings/${id}/status`, { status });
      toast.success('تم تحديث حالة الحجز');
      fetchBookings();
      setSelected(null);
    } catch {
      toast.error('خطأ في تحديث الحالة');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إدارة الحجوزات</h1>
        <p className="text-gray-500 text-sm mt-1">{bookings.length} حجز</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            placeholder="بحث برقم الحجز أو اسم العميل..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchBookings()}
            className="input pr-10"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-48">
          <option value="">جميع الحالات</option>
          <option value="PENDING">قيد الانتظار</option>
          <option value="CONFIRMED">مؤكد</option>
          <option value="CANCELLED">ملغي</option>
          <option value="COMPLETED">مكتمل</option>
          <option value="REFUNDED">مسترجع</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-right px-5 py-3 font-medium text-gray-600">رقم الحجز</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">العميل</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الرحلة</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">التاريخ</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">عدد الأشخاص</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">المبلغ</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">حالة الحجز</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الدفع</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td></tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-400">لا توجد حجوزات</td></tr>
              ) : (
                bookings.map((b) => {
                  const customer = b.user || b.guest;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">#{b.bookingNumber}</td>
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-gray-900">{customer?.firstName} {customer?.lastName}</p>
                          <p className="text-xs text-gray-400">{customer?.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{b.tripTitle}</td>
                      <td className="px-5 py-3 text-gray-600">{formatShortDate(b.createdAt)}</td>
                      <td className="px-5 py-3 text-gray-600">{b.numberOfPersons}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{formatPrice(b.finalAmount)}</td>
                      <td className="px-5 py-3"><span className={`badge ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span></td>
                      <td className="px-5 py-3">
                        {b.paymentStatus && <span className={`badge ${getStatusColor(b.paymentStatus)}`}>{getStatusLabel(b.paymentStatus)}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {b.status === 'PENDING' && (
                            <>
                              <button onClick={() => updateStatus(b.id, 'CONFIRMED')} title="تأكيد" className="p-1.5 text-emerald-500 hover:text-emerald-700 rounded-lg hover:bg-gray-100">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => updateStatus(b.id, 'CANCELLED')} title="إلغاء" className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-gray-100">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {b.status === 'CONFIRMED' && (
                            <button onClick={() => updateStatus(b.id, 'COMPLETED')} title="إكمال" className="p-1.5 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-gray-100">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
