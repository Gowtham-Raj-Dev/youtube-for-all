// App-wide settings. The Firebase web config is public by design (it identifies the project,
// it is not a secret); access is protected by firestore.rules.

export const APP_NAME = "UTubeFlow";
export const APP_URL = "https://utubeflow.codelove.in";

export const firebaseConfig = {
  apiKey: "AIzaSyD3z-PwK6qjGft7EHRfsKRENGIfBii1iCg",
  authDomain: "for-all-cd03b.firebaseapp.com",
  projectId: "for-all-cd03b",
  storageBucket: "for-all-cd03b.firebasestorage.app",
  messagingSenderId: "1097448063845",
  appId: "1:1097448063845:web:0f9797d7719777f2b4178c",
};

export const firebaseConfigured = !firebaseConfig.apiKey.startsWith("REPLACE");
