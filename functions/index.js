import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

setGlobalOptions({
  region: "us-central1",
  maxInstances: 5
});

// Bootstrap owner UID: this is an identifier, not a secret.
// The real authorization is enforced server-side before any claim is written.
const BOOTSTRAP_ADMIN_UID = "pPIFw9YSgMd4Exp2vobl1CMOqJ3";

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Une authentification Firebase est requise."
    );
  }
  return request.auth;
}

function isAdmin(request) {
  return request.auth?.token?.admin === true;
}

export const bootstrapAdmin = onCall(async (request) => {
  const auth = requireAuth(request);

  // Only the predefined owner can bootstrap the first administrator.
  // Once the claim exists, the owner can continue to use the normal admin flow.
  if (auth.uid !== BOOTSTRAP_ADMIN_UID) {
    throw new HttpsError(
      "permission-denied",
      "Cette opération est réservée au propriétaire IAMTRADER."
    );
  }

  const target = await getAuth().getUser(BOOTSTRAP_ADMIN_UID);
  const claims = {
    ...(target.customClaims || {}),
    admin: true
  };

  await getAuth().setCustomUserClaims(BOOTSTRAP_ADMIN_UID, claims);

  await getFirestore().collection("users").doc(BOOTSTRAP_ADMIN_UID).set(
    {
      role: "admin",
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return {
    success: true,
    uid: BOOTSTRAP_ADMIN_UID,
    admin: true
  };
});

export const setAdminAccess = onCall(async (request) => {
  requireAuth(request);

  if (!isAdmin(request)) {
    throw new HttpsError(
      "permission-denied",
      "Accès administrateur requis."
    );
  }

  const targetUid = String(request.data?.uid || "").trim();
  const enabled = request.data?.enabled === true;

  if (!targetUid) {
    throw new HttpsError(
      "invalid-argument",
      "L'UID de l'utilisateur est requis."
    );
  }

  if (targetUid === BOOTSTRAP_ADMIN_UID && !enabled) {
    throw new HttpsError(
      "failed-precondition",
      "Le propriétaire IAMTRADER ne peut pas être rétrogradé depuis cette fonction."
    );
  }

  const target = await getAuth().getUser(targetUid);
  const claims = { ...(target.customClaims || {}) };

  if (enabled) {
    claims.admin = true;
  } else {
    delete claims.admin;
  }

  await getAuth().setCustomUserClaims(
    targetUid,
    Object.keys(claims).length ? claims : null
  );

  await getFirestore().collection("users").doc(targetUid).set(
    {
      role: enabled ? "admin" : "retail",
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return {
    success: true,
    uid: targetUid,
    admin: enabled
  };
});
