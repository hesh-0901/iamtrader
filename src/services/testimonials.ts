import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase/config';

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
  const ext = input.photo.type === 'image/png' ? 'png' : input.photo.type === 'image/webp' ? 'webp' : 'jpg';
  const uploaded = await uploadBytes(ref(storage, 'testimonials/' + user.uid + '/profile-' + Date.now() + '.' + ext), input.photo, { contentType: input.photo.type });
  const photoURL = await getDownloadURL(uploaded.ref);
  await addDoc(collection(db, 'testimonials'), { uid:user.uid, fullName:input.fullName.trim(), photoURL, rating:input.rating, message:input.message.trim(), status:'pending', createdAt:new Date().toISOString() });
}
export async function moderateTestimonial(id: string, status: 'published'|'rejected'): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentification administrateur requise.');
  await updateDoc(doc(db,'testimonials',id), { status, moderatedAt:new Date().toISOString(), moderatedBy:auth.currentUser.uid });
}
export async function removeTestimonial(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentification administrateur requise.');
  await deleteDoc(doc(db,'testimonials',id));
}