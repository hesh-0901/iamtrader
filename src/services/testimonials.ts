import { collection, deleteDoc, doc, limit, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase/config';


export type TestimonialInvitationTrigger = 'signup_24h' | 'signup_7d' | 'trades_5' | 'trades_10' | 'next_dashboard';
export interface TestimonialInvitationConfig {
  enabled: boolean;
  trigger: TestimonialInvitationTrigger;
  reminderIntervalHours: 1 | 4 | 24 | 72;
  maxReminders: 0 | 1 | 2 | 3;
  updatedAt: string;
}
export const DEFAULT_TESTIMONIAL_INVITATION_CONFIG: TestimonialInvitationConfig = {
  enabled: true,
  trigger: 'signup_24h',
  reminderIntervalHours: 4,
  maxReminders: 2,
  updatedAt: 'default-v1'
};
export function subscribeTestimonialInvitationConfig(callback: (config: TestimonialInvitationConfig) => void, onError?: (error: Error) => void) {
  return onSnapshot(doc(db, 'appSettings', 'testimonialInvitation'), snapshot => {
    const data = snapshot.exists() ? snapshot.data() : {};
    callback({
      enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_TESTIMONIAL_INVITATION_CONFIG.enabled,
      trigger: ['signup_24h','signup_7d','trades_5','trades_10','next_dashboard'].includes(data.trigger) ? data.trigger : DEFAULT_TESTIMONIAL_INVITATION_CONFIG.trigger,
      reminderIntervalHours: [1,4,24,72].includes(data.reminderIntervalHours) ? data.reminderIntervalHours : DEFAULT_TESTIMONIAL_INVITATION_CONFIG.reminderIntervalHours,
      maxReminders: [0,1,2,3].includes(data.maxReminders) ? data.maxReminders : DEFAULT_TESTIMONIAL_INVITATION_CONFIG.maxReminders,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : DEFAULT_TESTIMONIAL_INVITATION_CONFIG.updatedAt
    });
  }, error => onError?.(error));
}
export async function saveTestimonialInvitationConfig(input: Omit<TestimonialInvitationConfig, 'updatedAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentification administrateur requise.');
  await setDoc(doc(db, 'appSettings', 'testimonialInvitation'), { ...input, updatedAt: new Date().toISOString(), updatedBy: auth.currentUser.uid });
}

export interface TraderTestimonial {
  id: string; uid: string; fullName: string; photoURL: string; rating: number;
  message: string; status: 'pending' | 'published' | 'rejected'; createdAt: string;
}
export function subscribePublishedTestimonials(callback: (items: TraderTestimonial[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(query(collection(db, 'testimonials'), where('status', '==', 'published'), limit(30)), snapshot => {
    const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as TraderTestimonial));
    items.sort((a,b) => b.createdAt.localeCompare(a.createdAt)); callback(items);
  }, error => onError?.(error));
}
export function subscribeAllTestimonials(callback: (items: TraderTestimonial[]) => void, onError?: (error: Error) => void) {
  if (!auth.currentUser) throw new Error('Authentification administrateur requise.');
  return onSnapshot(query(collection(db, 'testimonials'), limit(300)), snapshot => {
    const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as TraderTestimonial));
    items.sort((a,b) => b.createdAt.localeCompare(a.createdAt)); callback(items);
  }, error => onError?.(error));
}
export async function submitTestimonial(input: { fullName: string; rating: number; message: string; photo: File }): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Connectez-vous à votre compte IAMTRADER pour envoyer un témoignage.');
  if (input.fullName.trim().length < 3 || input.fullName.trim().length > 90) throw new Error('Nom complet requis (90 caractères maximum).');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error('Choisissez une note entre 1 et 5 étoiles.');
  if (input.message.trim().length < 30 || input.message.trim().length > 700) throw new Error('Le témoignage doit contenir entre 30 et 700 caractères.');
  if (!input.photo || input.photo.size > 3145728 || !['image/jpeg','image/png','image/webp'].includes(input.photo.type)) throw new Error('Photo JPG, PNG ou WEBP requise (3 Mo maximum).');
  const testimonialRef = doc(db, 'testimonials', user.uid);
  const form = new FormData();
  form.append('file', input.photo, input.photo.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'profile-photo');
  form.append('upload_preset', 'piptalk_media');
  form.append('folder', 'iamtrader/testimonials/' + user.uid);
  const response = await fetch('https://api.cloudinary.com/v1_1/ocgef9bk/image/upload', { method: 'POST', body: form });
  const uploaded = await response.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!response.ok || !uploaded.secure_url || !uploaded.public_id) {
    throw new Error(uploaded.error?.message || 'Échec du téléversement Cloudinary. Vérifiez le preset piptalk_media.');
  }
  await setDoc(testimonialRef, { uid:user.uid, fullName:input.fullName.trim(), photoURL:uploaded.secure_url, photoPublicId:uploaded.public_id, rating:input.rating, message:input.message.trim(), status:'pending', createdAt:new Date().toISOString() });
}
export async function moderateTestimonial(id: string, status: 'published'|'rejected'): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentification administrateur requise.');
  await updateDoc(doc(db,'testimonials',id), { status, moderatedAt:new Date().toISOString(), moderatedBy:auth.currentUser.uid });
}
export async function removeTestimonial(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentification administrateur requise.');
  await deleteDoc(doc(db,'testimonials',id));
}
export async function updateTestimonialContent(id: string, input: { fullName: string; message: string; rating: number }): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentification administrateur requise.');
  const fullName = input.fullName.trim();
  const message = input.message.trim();
  if (fullName.length < 3 || fullName.length > 90) throw new Error('Le nom doit contenir entre 3 et 90 caractères.');
  if (message.length < 30 || message.length > 700) throw new Error('Le témoignage doit contenir entre 30 et 700 caractères.');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error('La note doit être comprise entre 1 et 5 étoiles.');
  await updateDoc(doc(db, 'testimonials', id), { fullName, message, rating: input.rating });
}
