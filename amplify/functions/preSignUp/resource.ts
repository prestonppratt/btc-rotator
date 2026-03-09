import { defineFunction } from '@aws-amplify/backend';

export const preSignUpFunction = defineFunction({
    name: 'preSignUp',
    entry: './index.ts',
});
