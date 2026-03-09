import type { PreSignUpTriggerHandler } from 'aws-lambda';

export const handler: PreSignUpTriggerHandler = async (event) => {
    // Confirm the user immediately to allow custom auth to proceed
    event.response.autoConfirmUser = true;

    // Set the email as verified if it is provided
    if (event.request.userAttributes.hasOwnProperty('email')) {
        event.response.autoVerifyEmail = true;
    }

    // Set the phone number as verified if it is provided
    if (event.request.userAttributes.hasOwnProperty('phone_number')) {
        event.response.autoVerifyPhone = true;
    }

    return event;
};
