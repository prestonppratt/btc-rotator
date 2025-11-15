import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

// Minimal backend - just auth for now
// We'll add Lambda triggers once this deploys successfully
const backend = defineBackend({
  auth,
});

