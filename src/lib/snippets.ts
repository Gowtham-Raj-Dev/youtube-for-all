// Text the user copies into their own Google Cloud / Firebase consoles.

export const siteOrigin = () => window.location.origin;

export function storageRules(email: string) {
  return `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only you (signed in with ${email || "your Gmail"}) can read or write your queue files.
    match /tubeflow/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email == "${email}";
    }
  }
}`;
}

export function corsCommand(bucket: string) {
  const json = JSON.stringify([{ origin: [siteOrigin()], method: ["GET"], maxAgeSeconds: 3600 }]);
  return `echo '${json}' > cors.json
gcloud storage buckets update gs://${bucket || "YOUR-BUCKET"} --cors-file=cors.json`;
}
