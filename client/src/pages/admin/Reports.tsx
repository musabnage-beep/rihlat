import { useEffect, useState } from 'react';
import { CalendarCheck, DollarSign, TrendingUp, Users } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';

interface ReportData {
  totalRevenue: number;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  averageOrderValue: number;
  topTrips: Array<{ id: string; title: string; bookingsCount: number; revenue: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number; bookings: number }>;
}

export default function AdminReports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/reports', { params: { days: period } })
      .then(({ data }) => setData(data))
      .catch(() => {
        setData({
          totalRevenue: 0, totalBookings: 0, confirmedBookings: 0, cancelledBookings: 0,
          averageOrderValue: 0, topTrips: [], monthlyRevenue: [],
        });
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="card p-6 animate-pulse"><div className="h-16 bg-gray-200 rounded" /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير والإحصائيات</h1>
          <p className="text-gray-500 text-sm mt-1">نظرة شاملة على أداء المنصة</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input w-48">
          <option value="7">آخر 7 أيام</option>
          <option value="30">آخر 30 يوم</option>
          <option value="90">آخر 3 أشهر</option>
          <option value="365">آخر سنة</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(data?.totalRevenue || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">إجمالي الحجوزات</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data?.totalBookings || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <CalendarCheck className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">الحجوزات المؤكدة</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data?.confirmedBookings || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">متوسط قيمة الطلب</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(data?.averageOrderValue || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-2">نسبة التأكيد</h3>
          <div className="relative pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">مؤكدة</span>
              <span className="text-sm font-bold text-emerald-600">
                {data?.totalBookings ? Math.round((data.confirmedBookings / data.totalBookings) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all"
                style={{ width: `${data?.totalBookings ? (data.confirmedBookings / data.totalBookings) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-2">نسبة الإلغاء</h3>
          <div className="relative pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">ملغاة</span>
              <span className="text-sm font-bold text-red-600">
                {data?.totalBookings ? Math.round((data.cancelledBookings / data.totalBookings) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-red-500 h-3 rounded-full transition-all"
                style={{ width: `${data?.totalBookings ? (data.cancelledBookings / data.totalBookings) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-2">معدل الحجز اليومي</h3>
          <p className="text-3xl font-black text-primary-600 mt-2">
            {data?.totalBookings ? (data.totalBookings / parseInt(period)).toFixed(1) : 0}
          </p>
          <p className="text-sm text-gray-400">حجز / يوم</p>
        </div>
      </div>

      {/* Top Trips */}
      <div className="card">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">الرحلات الأكثر طلباً</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(data?.topTrips || []).map((trip, i) => (
            <div key={trip.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-sm font-bold text-primary-700">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-gray-900">{trip.title}</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{trip.bookingsCount} حجز</p>
                <p className="text-xs text-gray-400">{formatPrice(trip.revenue)}</p>
              </div>
            </div>
          ))}
          {(!data?.topTrips || data.topTrips.length === 0) && (
            <p className="p-5 text-sm text-gray-400 text-center">لا توجد بيانات كافية</p>
          )}
        </div>
      </div>

      {/* Monthly Revenue */}
      {data?.monthlyRevenue && data.monthlyRevenue.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">الإيرادات الشهرية</h2>
          <div className="space-y-3">
            {data.monthlyRevenue.map((m) => {
              const maxRev = Math.max(...data.monthlyRevenue.map((r) => r.revenue));
              const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
              return (
                <div key={m.month} className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 w-20">{m.month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div className="bg-primary-500 h-6 rounded-full flex items-center justify-end px-2 transition-all" style={{ width: `${Math.max(pct, 5)}%` }}>
                      <span className="text-[10px] text-white font-bold">{formatPrice(m.revenue)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-left">{m.bookings} حجز</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
