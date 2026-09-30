import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle
} from 'lucide-react';
import { SubscriptionPlan, UserProfile, UserStatus } from '../types';
import {
  confirmUserPlan,
  extendUserSubscription,
  getAllUsers,
  updateUserRoleAndPlan
} from '../services/firestore';
import { useToast } from '../components/common/Toast';

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'pending';

const DAY = 24 * 60 * 60 * 1000;

function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function getExpiry(user: UserProfile) {
  return user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
}

function getDaysLeft(user: UserProfile) {
  const expiry = getExpiry(user);
  if (!expiry || Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / DAY);
}

function formatDate(value?: string) {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non renseignée';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function planLabel(plan: SubscriptionPlan) {
  return plan === 'pro' ? 'Pro Trader' : plan === 'community' ? 'Community' : 'Free';
}

function planClass(plan: SubscriptionPlan) {
  return plan === 'pro'
    ? 'bg-[#eef4ff] text-[#315fc7] border-[#dbe5ff]'
    : plan === 'community'
      ? 'bg-[#f4f1ff] text-[#6852c7] border-[#e6e0ff]'
      : 'bg-[#f4f6f8] text-[#637386] border-[#e5e9ed]';
}

export function AdminConsole() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error: any) {
      setUsers([]);
      setLoadError(error?.code === 'permission-denied'
        ? 'Accès Firestore refusé. Le compte doit avoir le rôle admin dans Firestore.'
        : error?.message || 'Impossible de charger les utilisateurs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const stats = useMemo(() => {
    const expiring = users.filter(user => {
      const days = getDaysLeft(user);
      return days !== null && days >= 0 && days <= 5;
    }).length;
    const expired = users.filter(user => {
      const days = getDaysLeft(user);
      return days !== null && days < 0;
    }).length;
    const pending = users.filter(user => !!user.pendingPlan).length;

    return {
      total: users.length,
      active: users.filter(user => user.status === 'active').length,
      paid: users.filter(user => user.paymentStatus === 'paid').length,
      expiring,
      expired,
      pending
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter(user => {
      const matchesSearch =
        !q ||
        user.email.toLowerCase().includes(q) ||
        (user.displayName || '').toLowerCase().includes(q);

      const days = getDaysLeft(user);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && user.status === 'active') ||
        (filter === 'expiring' && days !== null && days >= 0 && days <= 5) ||
        (filter === 'expired' && days !== null && days < 0) ||
        (filter === 'pending' && !!user.pendingPlan);

      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  const patchUser = (uid: string, patch: Partial<UserProfile>) => {
    setUsers(previous => previous.map(user => user.uid === uid ? { ...user, ...patch } : user));
    setSelectedUser(previous => previous?.uid === uid ? { ...previous, ...patch } : previous);
  };

  const handleStatus = async (user: UserProfile) => {
    const status: UserStatus = user.status === 'active' ? 'suspended' : 'active';
    setBusyUid(user.uid);
    try {
      await updateUserRoleAndPlan(user.uid, { status });
      patchUser(user.uid, { status });
      showToast(status === 'active' ? 'Utilisateur réactivé.' : 'Utilisateur suspendu.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Modification refusée par Firestore.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const handleConfirmPlan = async (user: UserProfile) => {
    const plan = user.pendingPlan || user.plan;
    const paymentDate = new Date();
    const start = paymentDate;
    const expiry = addOneMonth(start);

    setBusyUid(user.uid);
    try {
      await confirmUserPlan(
        user.uid,
        plan,
        paymentDate.toISOString(),
        start.toISOString(),
        expiry.toISOString()
      );

      patchUser(user.uid, {
        plan,
        pendingPlan: undefined,
        planChangeRequestedAt: undefined,
        planChangeConfirmedAt: new Date().toISOString(),
        paymentDate: paymentDate.toISOString(),
        subscriptionStartAt: start.toISOString(),
        subscriptionExpiresAt: expiry.toISOString(),
        subscriptionStatus: 'active',
        paymentStatus: 'paid'
      });
      showToast('Abonnement confirmé pour 1 mois.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Confirmation refusée par Firestore.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const handleExtend = async (user: UserProfile) => {
    const now = new Date();
    const currentExpiry = getExpiry(user);
    const start = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const expiry = addOneMonth(start);

    setBusyUid(user.uid);
    try {
      await extendUserSubscription(
        user.uid,
        user.plan,
        now.toISOString(),
        now.toISOString(),
        expiry.toISOString()
      );

      patchUser(user.uid, {
        paymentDate: now.toISOString(),
        subscriptionStartAt: now.toISOString(),
        subscriptionExpiresAt: expiry.toISOString(),
        subscriptionStatus: 'active',
        paymentStatus: 'paid'
      });
      showToast('Abonnement prolongé d’un mois.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Prolongation refusée par Firestore.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const handlePlanRequest = async (user: UserProfile, plan: SubscriptionPlan) => {
    setBusyUid(user.uid);
    try {
      await updateUserRoleAndPlan(user.uid, {
        pendingPlan: plan,
        planChangeRequestedAt: new Date().toISOString()
      });
      patchUser(user.uid, {
        pendingPlan: plan,
        planChangeRequestedAt: new Date().toISOString()
      });
      showToast('Changement de plan enregistré en attente de confirmation.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Impossible d’enregistrer le changement.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] font-bold text-[#00a86b]">
            <ShieldCheck className="w-4 h-4" />
            Centre de contrôle
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#10233a] mt-1">Administration IAMTRADER</h2>
          <p className="text-xs text-[#71839a] mt-1">Utilisateurs, abonnements, paiements et échéances depuis un seul espace.</p>
        </div>
        <button
          onClick={loadUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[#dce6e2] text-xs font-semibold text-[#314861] hover:border-[#bcd9cf] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ['Utilisateurs', stats.total, Users, 'text-[#315fc7]'],
          ['Actifs', stats.active, UserCheck, 'text-[#00a86b]'],
          ['Paiements', stats.paid, CreditCard, 'text-[#6852c7]'],
          ['À 5 jours', stats.expiring, AlertTriangle, 'text-[#d99020]'],
          ['Expirés', stats.expired, XCircle, 'text-[#ef476f]'],
          ['À confirmer', stats.pending, Clock3, 'text-[#315fc7]']
        ].map(([label, value, Icon, color]) => (
          <div key={String(label)} className="p-4 rounded-2xl bg-white border border-[#e0e9e5] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8091a2]">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-[#10233a] mt-2">{value}</div>
          </div>
        ))}
      </section>

      {loadError && (
        <div className="p-4 rounded-2xl bg-[#fff8ec] border border-[#f2dfb5] text-xs text-[#7b5a20]">
          <div className="font-semibold mb-1">Accès administrateur requis</div>
          {loadError}
        </div>
      )}

      <section className="bg-white border border-[#e0e9e5] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#edf2f0]">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#10233a]">Utilisateurs & abonnements</h3>
              <p className="text-[11px] text-[#8091a2] mt-1">{filteredUsers.length} utilisateur(s) affiché(s)</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8da0b1] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="w-full sm:w-64 bg-[#f8fafb] border border-[#e0e8e5] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#203a53] outline-none focus:border-[#9fd8c5]"
                />
              </div>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as Filter)}
                className="bg-[#f8fafb] border border-[#e0e8e5] rounded-xl px-3 py-2.5 text-xs text-[#314861] outline-none"
              >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="expiring">Échéance ≤ 5 jours</option>
                <option value="expired">Expirés</option>
                <option value="pending">Plans à confirmer</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#8091a2]">Chargement des utilisateurs...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 mx-auto text-[#b3c0ca]" />
            <p className="text-sm font-semibold text-[#314861] mt-3">Aucun utilisateur disponible</p>
            <p className="text-xs text-[#8091a2] mt-1">Vérifiez les droits Firestore si la liste devrait être accessible.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-[#f8fafb]">
                <tr className="text-[10px] uppercase tracking-wider text-[#8091a2] border-b border-[#edf2f0]">
                  <th className="px-5 py-3">Utilisateur</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Paiement</th>
                  <th className="px-3 py-3">Échéance</th>
                  <th className="px-3 py-3">Temps restant</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const days = getDaysLeft(user);
                  const expiring = days !== null && days >= 0 && days <= 5;
                  const expired = days !== null && days < 0;
                  const pending = !!user.pendingPlan;

                  return (
                    <tr key={user.uid} className="border-b border-[#edf2f0] last:border-0 hover:bg-[#fbfdfc]">
                      <td className="px-5 py-4">
                        <button onClick={() => setSelectedUser(user)} className="text-left">
                          <div className="font-semibold text-[#203a53]">{user.displayName || 'Sans nom'}</div>
                          <div className="text-[10px] text-[#8a9aab] mt-0.5">{user.email}</div>
                        </button>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-bold ${planClass(user.plan)}`}>
                          {planLabel(user.plan)}
                        </span>
                        {pending && <div className="text-[9px] text-[#315fc7] mt-1">→ {planLabel(user.pendingPlan!)}</div>}
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-medium text-[#314861]">{formatDate(user.paymentDate)}</div>
                        <div className="text-[9px] text-[#8a9aab] mt-0.5">{user.paymentStatus === 'paid' ? 'Confirmé' : 'Non confirmé'}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div className={`font-medium ${expired ? 'text-[#ef476f]' : expiring ? 'text-[#d99020]' : 'text-[#314861]'}`}>
                          {formatDate(user.subscriptionExpiresAt)}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {days === null ? (
                          <span className="text-[#8a9aab]">Non calculable</span>
                        ) : expired ? (
                          <span className="font-semibold text-[#ef476f]">Expiré depuis {Math.abs(days)} j</span>
                        ) : (
                          <span className={`font-semibold ${expiring ? 'text-[#d99020]' : 'text-[#00a86b]'}`}>
                            {days} jour{days > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${user.status === 'active' ? 'bg-[#e9faf3] text-[#008f63]' : 'bg-[#fff0f3] text-[#d9365a]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-[#08b77a]' : 'bg-[#ef476f]'}`} />
                          {user.status === 'active' ? 'Actif' : 'Suspendu'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end items-center gap-1.5">
                          {pending && (
                            <button
                              onClick={() => handleConfirmPlan(user)}
                              disabled={busyUid === user.uid}
                              className="px-2.5 py-1.5 rounded-lg bg-[#e9faf3] text-[#008f63] border border-[#ccecdf] text-[10px] font-semibold disabled:opacity-50"
                            >
                              <Check className="w-3 h-3 inline mr-1" />Confirmer
                            </button>
                          )}
                          <button
                            onClick={() => handleExtend(user)}
                            disabled={busyUid === user.uid}
                            className="px-2.5 py-1.5 rounded-lg bg-[#f3f6ff] text-[#315fc7] border border-[#dce5ff] text-[10px] font-semibold disabled:opacity-50"
                          >
                            +1 mois
                          </button>
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#f7f9fa] text-[#52677c] border border-[#e2e9e6] text-[10px] font-semibold"
                          >
                            Gérer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {stats.expiring > 0 && (
        <section className="p-4 rounded-2xl bg-[#fff8ec] border border-[#f1dfb7] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#d99020] shrink-0" />
          <div>
            <div className="text-xs font-bold text-[#7b5a20]">{stats.expiring} abonnement(s) arrivent à échéance dans 5 jours ou moins.</div>
            <div className="text-[11px] text-[#94713a] mt-1">Utilisez le filtre « Échéance ≤ 5 jours » pour traiter les renouvellements.</div>
          </div>
        </section>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#10233a]/25 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-xl bg-white rounded-2xl border border-[#dfe8e4] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[#edf2f0] flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-[#10233a]">{selectedUser.displayName || 'Utilisateur'}</div>
                <div className="text-[11px] text-[#8091a2] mt-1">{selectedUser.email}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-[#8a9aab] hover:text-[#314861] text-lg">×</button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#f8fafb] border border-[#e6ece9]">
                <div className="text-[9px] uppercase tracking-wider text-[#8a9aab]">Plan actuel</div>
                <div className="text-sm font-bold text-[#314861] mt-1">{planLabel(selectedUser.plan)}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#f8fafb] border border-[#e6ece9]">
                <div className="text-[9px] uppercase tracking-wider text-[#8a9aab]">Échéance</div>
                <div className="text-sm font-bold text-[#314861] mt-1">{formatDate(selectedUser.subscriptionExpiresAt)}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#f8fafb] border border-[#e6ece9]">
                <div className="text-[9px] uppercase tracking-wider text-[#8a9aab]">Dernier paiement</div>
                <div className="text-sm font-bold text-[#314861] mt-1">{formatDate(selectedUser.paymentDate)}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#f8fafb] border border-[#e6ece9]">
                <div className="text-[9px] uppercase tracking-wider text-[#8a9aab]">Jours restants</div>
                <div className="text-sm font-bold text-[#00a86b] mt-1">{getDaysLeft(selectedUser) ?? '—'}</div>
              </div>
            </div>

            <div className="px-5 pb-5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#8091a2] mb-2">Changer le plan</div>
              <div className="grid grid-cols-3 gap-2">
                {(['free', 'community', 'pro'] as SubscriptionPlan[]).map(plan => (
                  <button
                    key={plan}
                    onClick={() => handlePlanRequest(selectedUser, plan)}
                    disabled={busyUid === selectedUser.uid}
                    className={`py-2.5 rounded-xl border text-xs font-semibold ${selectedUser.plan === plan ? planClass(plan) : 'bg-white border-[#e0e8e5] text-[#52677c]'}`}
                  >
                    {planLabel(plan)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-[#edf2f0] flex flex-wrap justify-end gap-2 bg-[#fbfcfc]">
              <button
                onClick={() => handleStatus(selectedUser)}
                disabled={busyUid === selectedUser.uid}
                className={`px-3 py-2 rounded-xl text-xs font-semibold ${selectedUser.status === 'active' ? 'bg-[#fff1f3] text-[#d9365a]' : 'bg-[#e9faf3] text-[#008f63]'}`}
              >
                {selectedUser.status === 'active' ? 'Suspendre' : 'Réactiver'}
              </button>
              <button
                onClick={() => handleExtend(selectedUser)}
                disabled={busyUid === selectedUser.uid}
                className="px-3 py-2 rounded-xl bg-[#315fc7] text-white text-xs font-semibold"
              >
                Confirmer paiement +1 mois
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
