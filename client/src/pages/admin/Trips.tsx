import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, Search } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice, formatShortDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { TripSummary } from 'shared';

export default function AdminTrips() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTrips = () => {
    setLoading(true);
    api.get('/admin/trips', { params: { search: search || undefined, limit: 50 } })
      .then(({ data }) => setTrips(data.trips || data.data || []))
      .catch(() => toast.error('خطأ في تحميل الرحلات'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrips(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`هل أنت متأكد من حذف رحلة "${title}"؟`)) return;
    try {
      await api.delete(`/admin/trips/${id}`);
      toast.success('تم حذف الرحلة');
      fetchTrips();
    } catch {
      toast.error('خطأ في حذف الرحلة');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الرحلات</h1>
          <p className="text-gray-500 text-sm mt-1">{trips.length} رحلة</p>
        </div>
        <Link to="/admin/trips/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          رحلة جديدة
        </Link>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن رحلة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTrips()}
            className="input pr-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-right px-5 py-3 font-medium text-gray-600">الرحلة</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الوجهة</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">التاريخ</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">السعر</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">المقاعد</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">الحالة</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td></tr>
                ))
              ) : trips.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">لا توجد رحلات</td></tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {trip.primaryImage ? (
                          <img src={trip.primaryImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                        )}
                        <span className="font-medium text-gray-900">{trip.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{trip.destination}</td>
                    <td className="px-5 py-3 text-gray-600">{formatShortDate(trip.departureDate)}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{formatPrice(trip.pricePerPerson)}</td>
                    <td className="px-5 py-3">
                      <span className="text-gray-600">{trip.availableSeats}/{trip.totalSeats}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${getStatusColor(trip.status)}`}>{getStatusLabel(trip.status)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/trips/${trip.slug}`} target="_blank" className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link to={`/admin/trips/${trip.id}/edit`} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100">
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDelete(trip.id, trip.title)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100">
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
    </div>
  );
}
