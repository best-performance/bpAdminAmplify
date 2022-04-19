import { Auth } from 'aws-amplify'
import AWS, { CognitoIdentityServiceProvider } from 'aws-sdk'
import { getRegion } from 'src/views/wonde/CommonHelpers/featureToggles'
import notify from 'devextreme/ui/notify'

// Method to return all the users that exist in the cognito pool of the admin app.
export async function loadUsersFromCognito() {
  return Auth.currentCredentials().then(async (credentials) => {
    AWS.config.update({
      credentials: credentials,
      region: getRegion(),
    })

    const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
    let params = {
      UserPoolId: `${process.env.REACT_APP_USER_POOL_ID}`,
      AttributesToGet: ['email'],
      Limit: 60,
    }

    let rawUsers = await cognitoIdentityServiceProvider.listUsers(params).promise()
    return rawUsers.Users
  })
}

// This method disable/enables a current user received as parameter, based on the result, it notifies in the view.
export async function disableUser(username, isEnabled) {
  Auth.currentCredentials().then(async (credentials) => {
    AWS.config.update({
      credentials: credentials,
      region: getRegion(),
    })

    const params = {
      UserPoolId: `${process.env.REACT_APP_USER_POOL_ID}`,
      Username: username,
    }

    const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()

    try {
      if (isEnabled) {
        await cognitoIdentityServiceProvider.adminDisableUser(params).promise()
        notify('👋 The user has been disabled', 'success', 3000)
      } else {
        await cognitoIdentityServiceProvider.adminEnableUser(params).promise()
        notify('👋 The user has been enabled', 'success', 3000)
      }
    } catch (e) {
      notify(
        'It was not possible to disable the user due to an error, please try again later',
        'error',
        3000,
      )
    }
  })
}

// This method resets the password of a user received in the parameters, this password is set as permanent
export async function resetPassword(resetPasswordFormData) {
  Auth.currentCredentials().then(async (credentials) => {
    AWS.config.update({
      credentials: credentials,
      region: getRegion(),
    })

    try {
      const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
      await cognitoIdentityServiceProvider
        .adminSetUserPassword(resetPasswordFormData.current)
        .promise()
      notify('👋 The password of the user has been reset', 'success', 3000)
    } catch (error) {
      console.error('error when trying to reset the password of the user', error)
      notify('The password was not reset, please try again later', 'error', 3000)
    }
  })
}
