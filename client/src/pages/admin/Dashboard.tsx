import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, DollarSign, Map, Users, TrendingUp, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice, getStatusColor, getStatusLabel } from '@/lib/utils';

interface Stats {
  totalBookings: number;
  totalRevenue: number;
  totalTrips: number;
  totalCustomers: number;
  recentBookings: Array<{
    id: string;
    bookingNumber: string;
    tripTitle: string;
    status: string;
    finalAmount: number;
    createdAt: string;
  }>;
  popularTrips: Array<{
    id: string;
    title: string;
    bookingsCount: number;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(({ data }) => setStats(data))
      .catch(() => {
        // Fallback: set empty stats
        setStats({
          totalBookings: 0, totalRevenue: 0, totalTrips: 0, totalCustomers: 0,
          recentBookings: [], popularTrips: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'إجمالي الحجوزات', value: stats?.totalBookings || 0, icon: CalendarCheck, color: 'bg-blue-500', format: (v: number) => v.toString() },
    { label: 'إجمالي الأرباح', value: stats?.totalRevenue || 0, icon: DollarSign, color: 'bg-emerald-500', format: formatPrice },
    { label: 'الرحلات النشطة', value: stats?.totalTrips || 0, icon: Map, color: 'bg-purple-500', format: (v: number) => v.toString() },
    { label: 'العملاء', value: stats?.totalCustomers || 0, icon: Users, color: 'bg-orange-500', format: (v: number) => v.toString() },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse"><div className="h-16 bg-gray-200 rounded" /></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-gray-500 text-sm mt-1">نظرة عامة على النظام</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.format(card.value)}</p>
                </div>
                <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">آخر الحجوزات</h2>
            <Link to="/admin/bookings" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {(stats?.recentBookings || []).slice(0, 5).map((booking) => (
              <div key={booking.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">#{booking.bookingNumber}</p>
                  <p className="text-xs text-gray-500">{booking.tripTitle}</p>
                </div>
                <div className="text-left">
                  <span className={`badge ${getStatusColor(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{formatPrice(booking.finalAmount)}</p>
                </div>
              </div>
            ))}
            {(!stats?.recentBookings || stats.recentBookings.length === 0) && (
              <p className="p-5 text-sm text-gray-400 text-center">لا توجد حجوزات</p>
            )}
          </div>
        </div>

        {/* Popular Trips */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">الرحلات الأكثر طلباً</h2>
            <Link to="/admin/trips" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {(stats?.popularTrips || []).slice(0, 5).map((trip, i) => (
              <div key={trip.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-sm font-bold text-primary-700">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{trip.title}</span>
                </div>
                <span className="text-sm text-gray-500">{trip.bookingsCount} حجز</span>
              </div>
            ))}
            {(!stats?.popularTrips || stats.popularTrips.length === 0) && (
              <p className="p-5 text-sm text-gray-400 text-center">لا توجد بيانات</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
