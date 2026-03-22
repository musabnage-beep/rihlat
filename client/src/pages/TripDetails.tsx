import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Clock, Users, ChevronLeft, ChevronRight, Check, X as XIcon } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice, formatDate, getDaysRemaining } from '@/lib/utils';
import type { TripDetail } from 'shared';

export default function TripDetails() {
  const { slug } = useParams();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    api.get(`/trips/${slug}`)
      .then(({ data }) => setTrip(data.trip || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-96 bg-gray-200 rounded-xl" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-700">الرحلة غير موجودة</h2>
        <Link to="/trips" className="btn-primary mt-4">العودة للرحلات</Link>
      </div>
    );
  }

  const daysLeft = getDaysRemaining(trip.departureDate);
  const images = trip.images?.length ? trip.images : trip.primaryImage ? [{ id: '0', url: trip.primaryImage, altText: trip.title, sortOrder: 0, isPrimary: true }] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="relative rounded-xl overflow-hidden">
              <img
                src={images[activeImage].url}
                alt={images[activeImage].altText || trip.title}
                className="w-full h-80 lg:h-[450px] object-cover"
              />
              {images.length > 1 && (
                <>
                  <button onClick={() => setActiveImage((p) => (p + 1) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setActiveImage((p) => (p - 1 + images.length) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(i)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImage ? 'border-primary-500' : 'border-transparent'}`}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">{trip.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{trip.destination}</span>
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(trip.departureDate)}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{trip.duration} أيام</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" />{trip.availableSeats} مقعد متاح</span>
            </div>
          </div>

          {/* Description */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">وصف الرحلة</h2>
            <div className="prose prose-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {trip.description}
            </div>
          </div>

          {/* Itinerary */}
          {trip.itinerary && trip.itinerary.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">البرنامج اليومي</h2>
              <div className="space-y-4">
                {trip.itinerary.map((day) => (
                  <div key={day.day} className="flex gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary-700">{day.day}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{day.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{day.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inclusions / Exclusions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trip.inclusions?.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">يشمل</h2>
                <ul className="space-y-2">
                  {trip.inclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {trip.exclusions?.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">لا يشمل</h2>
                <ul className="space-y-2">
                  {trip.exclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <XIcon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Booking Card */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <div className="mb-4">
              <span className="text-sm text-gray-400">السعر يبدأ من</span>
              <p className="text-3xl font-black text-primary-600">{formatPrice(trip.pricePerPerson)}</p>
              <span className="text-sm text-gray-400">للشخص</span>
            </div>

            {trip.childPrice && (
              <p className="text-sm text-gray-500 mb-4">
                سعر الطفل: <span className="font-bold text-gray-700">{formatPrice(trip.childPrice)}</span>
              </p>
            )}

            {/* Pricing Tiers */}
            {trip.pricingTiers?.length > 0 && (
              <div className="mb-4 space-y-2">
                <h3 className="text-sm font-medium text-gray-700">فئات الأسعار</h3>
                {trip.pricingTiers.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2.5">
                    <span className="text-gray-600">{tier.name}</span>
                    <span className="font-bold text-gray-900">{formatPrice(tier.price)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">تاريخ المغادرة</span>
                <span className="font-medium text-gray-900">{formatDate(trip.departureDate)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">تاريخ العودة</span>
                <span className="font-medium text-gray-900">{formatDate(trip.returnDate)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">المدة</span>
                <span className="font-medium text-gray-900">{trip.duration} أيام</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500">المقاعد المتاحة</span>
                <span className="font-medium text-gray-900">{trip.availableSeats}</span>
              </div>
            </div>

            {daysLeft > 0 && (
              <p className="text-center text-sm text-orange-600 font-medium mb-4">
                باقي {daysLeft} يوم على موعد الرحلة
              </p>
            )}

            {trip.availableSeats > 0 ? (
              <Link to={`/booking/${trip.id}`} className="btn-primary w-full text-base py-3">
                احجز الآن
              </Link>
            ) : (
              <button disabled className="btn w-full bg-gray-200 text-gray-500 cursor-not-allowed py-3">
                مكتمل
              </button>
            )}

            {trip.meetingPoint && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                <span className="font-medium text-blue-800">نقطة التجمع:</span>
                <p className="text-blue-700 mt-1">{trip.meetingPoint}</p>
                {trip.meetingTime && <p className="text-blue-600">الساعة: {trip.meetingTime}</p>}
              </div>
            )}

            {trip.terms && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm">
                <span className="font-medium text-yellow-800">الشروط والأحكام:</span>
                <p className="text-yellow-700 mt-1 whitespace-pre-line text-xs">{trip.terms}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
