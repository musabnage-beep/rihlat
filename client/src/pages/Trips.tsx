import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Calendar, Plane, SlidersHorizontal, X } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import type { TripSummary } from 'shared';

export default function Trips() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [destination, setDestination] = useState(searchParams.get('destination') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'date_asc');
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, limit: 9, sortBy };
    if (search) params.search = search;
    if (destination) params.destination = destination;

    api.get('/trips', { params })
      .then(({ data }) => {
        setTrips(data.trips || data.data || []);
        setTotal(data.total || data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, sortBy, search, destination]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (destination) params.set('destination', destination);
    if (sortBy !== 'date_asc') params.set('sortBy', sortBy);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearch('');
    setDestination('');
    setSortBy('date_asc');
    setSearchParams({});
  };

  const totalPages = Math.ceil(total / 9);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">جميع الرحلات</h1>
        <p className="text-gray-500 mt-1">اختر وجهتك المفضلة واحجز رحلتك الآن</p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث عن رحلة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pr-10"
            />
          </div>
          <input
            type="text"
            placeholder="الوجهة"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="input lg:w-48"
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input lg:w-48">
            <option value="date_asc">الأقرب تاريخاً</option>
            <option value="date_desc">الأبعد تاريخاً</option>
            <option value="price_asc">الأقل سعراً</option>
            <option value="price_desc">الأعلى سعراً</option>
            <option value="popular">الأكثر طلباً</option>
          </select>
          <button type="submit" className="btn-primary">بحث</button>
          {(search || destination || sortBy !== 'date_asc') && (
            <button type="button" onClick={clearFilters} className="btn-secondary">
              <X className="w-4 h-4" />
              مسح
            </button>
          )}
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t-xl" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-20">
          <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">لا توجد رحلات مطابقة</h3>
          <p className="text-gray-400 text-sm mt-1">جرب تغيير معايير البحث</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{total} رحلة</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.slug}`}
                className="card group hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="relative h-48 overflow-hidden">
                  {trip.primaryImage ? (
                    <img src={trip.primaryImage} alt={trip.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-bl from-primary-100 to-primary-200 flex items-center justify-center">
                      <Plane className="w-12 h-12 text-primary-400" />
                    </div>
                  )}
                  {trip.availableSeats <= 5 && trip.availableSeats > 0 && (
                    <span className="absolute top-3 left-3 badge bg-red-500 text-white text-[10px]">باقي {trip.availableSeats} مقاعد</span>
                  )}
                  {trip.availableSeats === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">مكتمل</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">{trip.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{trip.destination}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{trip.duration} أيام</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <span className="text-xs text-gray-400">يبدأ من</span>
                      <p className="text-lg font-bold text-primary-600">{formatPrice(trip.pricePerPerson)}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(trip.departureDate)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => { const p = new URLSearchParams(searchParams); p.set('page', String(i + 1)); setSearchParams(p); }}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
