import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Star, ArrowLeft, Plane, Shield, Headphones } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import type { TripSummary } from 'shared';

export default function Home() {
  const [featured, setFeatured] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trips', { params: { limit: 6, sortBy: 'popular' } })
      .then(({ data }) => setFeatured(data.trips || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-bl from-primary-900 via-primary-800 to-primary-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-primary-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-36">
          <div className="max-w-2xl">
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              اكتشف أجمل
              <br />
              <span className="text-primary-300">الوجهات السياحية</span>
            </h1>
            <p className="text-lg text-primary-200 mb-8 leading-relaxed">
              نقدم لك باقات سياحية مميزة بأسعار تنافسية. احجز رحلتك الآن واستمتع بتجربة لا تُنسى مع فريقنا المتخصص.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/trips" className="btn bg-white text-primary-900 hover:bg-gray-100 text-base px-8 py-3">
                تصفح الرحلات
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'حجز آمن', desc: 'عمليات دفع مشفرة وآمنة بالكامل' },
              { icon: Star, title: 'أفضل الأسعار', desc: 'أسعار تنافسية وعروض حصرية' },
              { icon: Headphones, title: 'دعم متواصل', desc: 'فريق دعم متاح على مدار الساعة' },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="text-center">
                  <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Trips */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">رحلات مميزة</h2>
              <p className="text-gray-500 mt-1">أحدث الرحلات والباقات السياحية</p>
            </div>
            <Link to="/trips" className="btn-outline text-sm">
              عرض الكل
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-xl" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-20">
              <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500">لا توجد رحلات حالياً</h3>
              <p className="text-gray-400 text-sm mt-1">ترقب إضافة رحلات جديدة قريباً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">جاهز لمغامرتك القادمة؟</h2>
          <p className="text-primary-100 mb-8 text-lg">سجل الآن واحصل على عروض حصرية وخصومات مميزة</p>
          <Link to="/register" className="btn bg-white text-primary-700 hover:bg-gray-100 text-base px-8 py-3">
            سجل مجاناً
          </Link>
        </div>
      </section>
    </div>
  );
}

function TripCard({ trip }: { trip: TripSummary }) {
  return (
    <Link to={`/trips/${trip.slug}`} className="card group hover:shadow-md transition-shadow overflow-hidden">
      <div className="relative h-48 overflow-hidden">
        {trip.primaryImage ? (
          <img
            src={trip.primaryImage}
            alt={trip.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-bl from-primary-100 to-primary-200 flex items-center justify-center">
            <Plane className="w-12 h-12 text-primary-400" />
          </div>
        )}
        {trip.availableSeats <= 5 && trip.availableSeats > 0 && (
          <span className="absolute top-3 left-3 badge bg-red-500 text-white text-[10px]">
            باقي {trip.availableSeats} مقاعد
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
          {trip.title}
        </h3>
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {trip.destination}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {trip.duration} أيام
          </span>
        </div>
        {trip.shortDescription && (
          <p className="text-sm text-gray-400 mb-4 line-clamp-2">{trip.shortDescription}</p>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <span className="text-xs text-gray-400">يبدأ من</span>
            <p className="text-lg font-bold text-primary-600">{formatPrice(trip.pricePerPerson)}</p>
          </div>
          <span className="text-xs text-gray-400">{formatDate(trip.departureDate)}</span>
        </div>
      </div>
    </Link>
  );
}
