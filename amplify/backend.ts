import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

// Minimal backend - just auth and data
// We'll add Lambda functions back one at a time after this deploys successfully
const backend = defineBackend({
  auth,
  data,
});

