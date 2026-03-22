import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Upload, GripVertical } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface TripFormData {
  title: string;
  description: string;
  shortDescription: string;
  destination: string;
  departureCity: string;
  departureDate: string;
  returnDate: string;
  pricePerPerson: string;
  childPrice: string;
  totalSeats: string;
  status: string;
  isFeatured: boolean;
  meetingPoint: string;
  meetingTime: string;
  terms: string;
  inclusions: string[];
  exclusions: string[];
  itinerary: Array<{ day: number; title: string; description: string }>;
}

const defaultForm: TripFormData = {
  title: '', description: '', shortDescription: '', destination: '', departureCity: '',
  departureDate: '', returnDate: '', pricePerPerson: '', childPrice: '', totalSeats: '',
  status: 'DRAFT', isFeatured: false, meetingPoint: '', meetingTime: '', terms: '',
  inclusions: [''], exclusions: [''], itinerary: [{ day: 1, title: '', description: '' }],
};

export default function TripForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<TripFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<File[]>([]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.get(`/admin/trips/${id}`)
        .then(({ data }) => {
          const t = data.trip || data;
          setForm({
            title: t.title || '',
            description: t.description || '',
            shortDescription: t.shortDescription || '',
            destination: t.destination || '',
            departureCity: t.departureCity || '',
            departureDate: t.departureDate?.split('T')[0] || '',
            returnDate: t.returnDate?.split('T')[0] || '',
            pricePerPerson: String(t.pricePerPerson || ''),
            childPrice: String(t.childPrice || ''),
            totalSeats: String(t.totalSeats || ''),
            status: t.status || 'DRAFT',
            isFeatured: t.isFeatured || false,
            meetingPoint: t.meetingPoint || '',
            meetingTime: t.meetingTime || '',
            terms: t.terms || '',
            inclusions: t.inclusions?.length ? t.inclusions : [''],
            exclusions: t.exclusions?.length ? t.exclusions : [''],
            itinerary: t.itinerary?.length ? t.itinerary : [{ day: 1, title: '', description: '' }],
          });
        })
        .catch(() => toast.error('خطأ في تحميل بيانات الرحلة'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const update = (field: keyof TripFormData, value: unknown) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      pricePerPerson: parseFloat(form.pricePerPerson),
      childPrice: form.childPrice ? parseFloat(form.childPrice) : null,
      totalSeats: parseInt(form.totalSeats),
      inclusions: form.inclusions.filter(Boolean),
      exclusions: form.exclusions.filter(Boolean),
      itinerary: form.itinerary.filter((d) => d.title),
    };

    try {
      let tripId = id;
      if (isEdit) {
        await api.put(`/admin/trips/${id}`, payload);
      } else {
        const { data } = await api.post('/admin/trips', payload);
        tripId = data.trip?.id || data.id;
      }

      // Upload images
      if (images.length > 0 && tripId) {
        const formData = new FormData();
        images.forEach((f) => formData.append('images', f));
        await api.post(`/admin/trips/${tripId}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(isEdit ? 'تم تعديل الرحلة' : 'تم إنشاء الرحلة');
      navigate('/admin/trips');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'تعديل رحلة' : 'رحلة جديدة'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">المعلومات الأساسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">عنوان الرحلة *</label>
              <input className="input" value={form.title} onChange={(e) => update('title', e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">وصف مختصر</label>
              <input className="input" value={form.shortDescription} onChange={(e) => update('shortDescription', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">وصف الرحلة *</label>
              <textarea className="input min-h-[120px]" value={form.description} onChange={(e) => update('description', e.target.value)} required />
            </div>
            <div>
              <label className="label">الوجهة *</label>
              <input className="input" value={form.destination} onChange={(e) => update('destination', e.target.value)} required />
            </div>
            <div>
              <label className="label">مدينة المغادرة</label>
              <input className="input" value={form.departureCity} onChange={(e) => update('departureCity', e.target.value)} />
            </div>
            <div>
              <label className="label">تاريخ المغادرة *</label>
              <input type="date" className="input" value={form.departureDate} onChange={(e) => update('departureDate', e.target.value)} required />
            </div>
            <div>
              <label className="label">تاريخ العودة *</label>
              <input type="date" className="input" value={form.returnDate} onChange={(e) => update('returnDate', e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">التسعير والمقاعد</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">سعر الشخص (ريال) *</label>
              <input type="number" className="input" value={form.pricePerPerson} onChange={(e) => update('pricePerPerson', e.target.value)} required min="0" step="0.01" />
            </div>
            <div>
              <label className="label">سعر الطفل (ريال)</label>
              <input type="number" className="input" value={form.childPrice} onChange={(e) => update('childPrice', e.target.value)} min="0" step="0.01" />
            </div>
            <div>
              <label className="label">عدد المقاعد *</label>
              <input type="number" className="input" value={form.totalSeats} onChange={(e) => update('totalSeats', e.target.value)} required min="1" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">الحالة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">حالة الرحلة</label>
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="DRAFT">مسودة</option>
                <option value="PUBLISHED">منشور</option>
                <option value="ARCHIVED">مؤرشف</option>
                <option value="CANCELLED">ملغي</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="featured"
                checked={form.isFeatured}
                onChange={(e) => update('isFeatured', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="featured" className="text-sm text-gray-700">رحلة مميزة</label>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">صور الرحلة</h2>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-primary-400 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">اضغط لرفع الصور</span>
            <span className="text-xs text-gray-400 mt-1">PNG, JPG حتى 5MB</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => setImages(Array.from(e.target.files || []))}
            />
          </label>
          {images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((f, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inclusions/Exclusions */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">يشمل / لا يشمل</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label mb-3">يشمل</label>
              {form.inclusions.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    className="input"
                    value={item}
                    onChange={(e) => {
                      const updated = [...form.inclusions];
                      updated[i] = e.target.value;
                      update('inclusions', updated);
                    }}
                    placeholder="مثال: الإقامة في فندق 5 نجوم"
                  />
                  <button type="button" onClick={() => update('inclusions', form.inclusions.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => update('inclusions', [...form.inclusions, ''])} className="text-sm text-primary-600 hover:underline mt-1">
                + إضافة عنصر
              </button>
            </div>
            <div>
              <label className="label mb-3">لا يشمل</label>
              {form.exclusions.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    className="input"
                    value={item}
                    onChange={(e) => {
                      const updated = [...form.exclusions];
                      updated[i] = e.target.value;
                      update('exclusions', updated);
                    }}
                    placeholder="مثال: تذاكر الطيران"
                  />
                  <button type="button" onClick={() => update('exclusions', form.exclusions.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => update('exclusions', [...form.exclusions, ''])} className="text-sm text-primary-600 hover:underline mt-1">
                + إضافة عنصر
              </button>
            </div>
          </div>
        </div>

        {/* Itinerary */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">البرنامج اليومي</h2>
          <div className="space-y-3">
            {form.itinerary.map((day, i) => (
              <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700">{day.day}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    className="input"
                    value={day.title}
                    onChange={(e) => {
                      const updated = [...form.itinerary];
                      updated[i] = { ...updated[i], title: e.target.value };
                      update('itinerary', updated);
                    }}
                    placeholder="عنوان اليوم"
                  />
                  <textarea
                    className="input min-h-[60px]"
                    value={day.description}
                    onChange={(e) => {
                      const updated = [...form.itinerary];
                      updated[i] = { ...updated[i], description: e.target.value };
                      update('itinerary', updated);
                    }}
                    placeholder="وصف نشاطات اليوم"
                  />
                </div>
                <button type="button" onClick={() => update('itinerary', form.itinerary.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 self-start">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => update('itinerary', [...form.itinerary, { day: form.itinerary.length + 1, title: '', description: '' }])}
            className="text-sm text-primary-600 hover:underline mt-3"
          >
            + إضافة يوم
          </button>
        </div>

        {/* Meeting & Terms */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">معلومات إضافية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">نقطة التجمع</label>
              <input className="input" value={form.meetingPoint} onChange={(e) => update('meetingPoint', e.target.value)} />
            </div>
            <div>
              <label className="label">وقت التجمع</label>
              <input type="time" className="input" value={form.meetingTime} onChange={(e) => update('meetingTime', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">الشروط والأحكام</label>
              <textarea className="input min-h-[80px]" value={form.terms} onChange={(e) => update('terms', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء الرحلة'}
          </button>
          <button type="button" onClick={() => navigate('/admin/trips')} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
