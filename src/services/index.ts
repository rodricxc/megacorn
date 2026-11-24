import type { DataService } from './dataService';
import { createDemoDataService } from './demoAdapter';
import { isFirebaseConfigured } from './firebase';
import { createFirebaseDataService } from './firebaseAdapter';

export const dataService: DataService = isFirebaseConfigured
  ? createFirebaseDataService()
  : createDemoDataService();
