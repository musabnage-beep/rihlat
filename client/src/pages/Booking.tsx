import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { TripDetail } from 'shared';

interface PassengerForm {
  firstName: string;
  lastName: string;
  age: string;
  idNumber: string;
  tierName: string;
}

export default function BookingPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [passengers, setPassengers] = useState<PassengerForm[]>([
    { firstName: '', lastName: '', age: '', idNumber: '', tierName: '' },
  ]);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');

  // Guest info
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');

  useEffect(() => {
    api.get(`/trips/${tripId}`)
      .then(({ data }) => setTrip(data.trip || data))
      .catch(() => toast.error('خطأ في تحميل بيانات الرحلة'))
      .finally(() => setLoading(false));
  }, [tripId]);

  const addPassenger = () => {
    setPassengers([...passengers, { firstName: '', lastName: '', age: '', idNumber: '', tierName: '' }]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length > 1) setPassengers(passengers.filter((_, i) => i !== index));
  };

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const getPassengerPrice = (p: PassengerForm): number => {
    if (!trip) return 0;
    if (p.tierName) {
      const tier = trip.pricingTiers?.find((t) => t.name === p.tierName);
      if (tier) return tier.price;
    }
    return trip.pricePerPerson;
  };

  const subtotal = passengers.reduce((sum, p) => sum + getPassengerPrice(p), 0);
  const totalAfterDiscount = subtotal - discount;

  const applyCoupon = async () => {
    if (!couponCode) return;
    try {
      const { data } = await api.post('/coupons/validate', { code: couponCode, orderAmount: subtotal });
      setDiscount(data.discountAmount || 0);
      toast.success('تم تطبيق الكوبون');
    } catch {
      toast.error('كوبون غير صالح');
      setDiscount(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    const hasEmpty = passengers.some((p) => !p.firstName || !p.lastName);
    if (hasEmpty) {
      toast.error('يرجى إدخال أسماء جميع المسافرين');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        tripId: trip.id,
        passengers: passengers.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          age: p.age ? parseInt(p.age) : undefined,
          idNumber: p.idNumber || undefined,
          tierName: p.tierName || trip.pricingTiers?.[0]?.name || 'standard',
        })),
        specialRequests: specialRequests || undefined,
        couponCode: couponCode || undefined,
      };

      if (!user) {
        payload.guest = { email: guestEmail, phone: guestPhone, firstName: guestFirstName, lastName: guestLastName };
      }

      const { data } = await api.post('/bookings', payload);
      toast.success('تم إنشاء الحجز بنجاح!');

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        navigate('/');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحجز');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!trip) {
    return <div className="text-center py-20"><h2 className="text-xl font-bold text-gray-700">الرحلة غير موجودة</h2></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">حجز رحلة</h1>
      <p className="text-gray-500 mb-8">{trip.title}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Guest info */}
        {!user && (
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">بيانات التواصل</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">الاسم الأول *</label>
                <input className="input" value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="label">الاسم الأخير *</label>
                <input className="input" value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} required />
              </div>
              <div>
                <label className="label">البريد الإلكتروني *</label>
                <input type="email" className="input" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">رقم الجوال *</label>
                <input type="tel" className="input" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
              </div>
            </div>
          </div>
        )}

        {/* Passengers */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">بيانات المسافرين</h2>
            <button
              type="button"
              onClick={addPassenger}
              disabled={passengers.length >= trip.availableSeats}
              className="btn-secondary text-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة مسافر
            </button>
          </div>

          <div className="space-y-4">
            {passengers.map((p, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">المسافر {i + 1}</span>
                  {passengers.length > 1 && (
                    <button type="button" onClick={() => removePassenger(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">الاسم الأول *</label>
                    <input className="input" value={p.firstName} onChange={(e) => updatePassenger(i, 'firstName', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">الاسم الأخير *</label>
                    <input className="input" value={p.lastName} onChange={(e) => updatePassenger(i, 'lastName', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">العمر</label>
                    <input type="number" className="input" value={p.age} onChange={(e) => updatePassenger(i, 'age', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">رقم الهوية</label>
                    <input className="input" value={p.idNumber} onChange={(e) => updatePassenger(i, 'idNumber', e.target.value)} />
                  </div>
                  {trip.pricingTiers && trip.pricingTiers.length > 0 && (
                    <div className="md:col-span-2">
                      <label className="label">فئة السعر</label>
                      <select className="input" value={p.tierName} onChange={(e) => updatePassenger(i, 'tierName', e.target.value)}>
                        <option value="">اختر الفئة</option>
                        {trip.pricingTiers.map((tier) => (
                          <option key={tier.id} value={tier.name}>{tier.name} - {formatPrice(tier.price)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coupon */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">كوبون الخصم</h2>
          <div className="flex gap-3">
            <input className="input" placeholder="أدخل كود الخصم" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            <button type="button" onClick={applyCoupon} className="btn-secondary whitespace-nowrap">تطبيق</button>
          </div>
        </div>

        {/* Special Requests */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">ملاحظات خاصة</h2>
          <textarea className="input min-h-[80px]" placeholder="أي طلبات أو ملاحظات خاصة..." value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
        </div>

        {/* Summary */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">ملخص الحجز</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">عدد المسافرين</span>
              <span className="font-medium">{passengers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">المجموع</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>الخصم</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-100 text-lg font-bold">
              <span>الإجمالي</span>
              <span className="text-primary-600">{formatPrice(totalAfterDiscount)}</span>
            </div>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full text-base py-3">
          {submitting ? 'جاري الحجز...' : 'تأكيد الحجز والدفع'}
        </button>
      </form>
    </div>
  );
}
