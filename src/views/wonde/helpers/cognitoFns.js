// All this code was copied from the EdCompanion project - with local edits as needed

import { CognitoIdentityServiceProvider } from 'aws-sdk'
import { updateAWSCredentials } from './updateAWSCredentials.js'

// Frank's original code had a global CognitoIdentityServiceProvider object
// His code however was running in a lambda that recreated the object for every
// api call
// In our approach we are calling the fns directly and between React renders
// so the CognitoIdentityServiceProvider object is not guaranteed to exist
// The simplest workaround was to creat a new object for each call and
// update the permissions and region as described below:

// NB: All these calls are being done with the security credentials attached to
// the CognitoIdentityPool where users log in.
// There to make a call we have to retrieve the credentials of the current logged
// in user, lookup the region and make an object like:
// {
//  credentials: credentials,
//  region: process.env.REACT_APP_REGION,
// }
// Then Either
// 1) update the AWS.config global object (see below)
// 2) or - Add the credentials,region object to the service call
// I tested both and they worked
// Later I made and external updateAWSCredentials() to update the AWS.config global object
// I am leaving addNewUser() fully commented so you can see the alternatives

// Note: the AWS.credentials object is described here
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html

// This is a temp userpool created in sandbox fro test purposes
const userPoolId = process.env.REACT_APP_USER_POOL_ID2

export async function addNewUser(username, userPoolId_passedIn) {
  // let credentials = await Auth.currentCredentials()
  // then set the global AWS.config object
  // AWS.config.update({
  //   credentials: credentials,
  //   region: process.env.REACT_APP_REGION,
  // })

  // alternatively
  // let credentials = await Auth.currentCredentials()
  // Then make the service call with the credentials/region in the params
  // const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider({
  //  credentials: credentials,
  //  region: 'ap-southeast-2',
  // })

  // final cleanest way to do things (but they all work)
  await updateAWSCredentials()
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()

  const params = {
    UserPoolId: userPoolId_passedIn,
    Username: username,
    MessageAction: 'SUPPRESS',
    UserAttributes: [
      { Name: 'email', Value: username },
      {
        Name: 'email_verified',
        Value: 'true',
      },
    ],
    ForceAliasCreation: false,
    TemporaryPassword: `Password${new Date().getFullYear().toString().slice(2)}!`,
  }

  try {
    const result = await cognitoIdentityServiceProvider.adminCreateUser(params).promise()
    return {
      Username: result.User.Username,
      message: `Success adding ${username}`,
    }
  } catch (err) {
    console.error('error adding new user', params, err)
    if (err.code === 'UsernameExistsException') {
      const params = {
        UserPoolId: userPoolId,
        Username: username,
      }

      try {
        const result = await cognitoIdentityServiceProvider.adminGetUser(params).promise()
        return { Username: result.Username, code: err.code }
      } catch (err) {
        console.error('error getting existing user for adding', params, err)
        throw err
      }
    } else {
      throw err
    }
  }
}
// Adds a new user to Cognito
export async function addNewUserBeforeIChangeditBC(username, userPoolId_passedIn) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId_passedIn,
    Username: username,
    MessageAction: 'SUPPRESS',
    UserAttributes: [
      { Name: 'email', Value: username },
      {
        Name: 'email_verified',
        Value: 'true',
      },
    ],
    ForceAliasCreation: false,
    TemporaryPassword: `Password${new Date().getFullYear().toString().slice(2)}!`,
  }

  try {
    const result = await cognitoIdentityServiceProvider.adminCreateUser(params).promise()
    return {
      Username: result.User.Username,
      message: `Success adding ${username}`,
    }
  } catch (err) {
    console.error('error adding new user', params, err)
    if (err.code === 'UsernameExistsException') {
      const params = {
        UserPoolId: userPoolId,
        Username: username,
      }

      try {
        const result = await cognitoIdentityServiceProvider.adminGetUser(params).promise()
        return { Username: result.Username, code: err.code }
      } catch (err) {
        console.error('error getting existing user for adding', params, err)
        throw err
      }
    } else {
      throw err
    }
  }
}

export async function setUserPassword(username, password, temp = false) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
    Password: password,
    Permanent: temp,
  }

  try {
    const result = await cognitoIdentityServiceProvider.adminSetUserPassword(params).promise()
    return {
      message: `Success setting password for ${username}`,
    }
  } catch (err) {
    console.error('error setting password for user', params, err)
    throw err
  }
}

export async function deleteUser(username, userPoolId) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    const result = await cognitoIdentityServiceProvider.adminDeleteUser(params).promise()
    return {
      message: `Success deleting ${username}`,
    }
  } catch (err) {
    console.error('error deleting user', params, err)
    throw err
  }
}

export async function addUserToGroup(username, groupname) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    GroupName: groupname,
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    const result = await cognitoIdentityServiceProvider.adminAddUserToGroup(params).promise()
    return {
      message: `Success adding ${username} to ${groupname}`,
    }
  } catch (err) {
    console.error('error adding user to group', params, err)
    throw err
  }
}

export async function removeUserFromGroup(username, groupname) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    GroupName: groupname,
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    await cognitoIdentityServiceProvider.adminRemoveUserFromGroup(params).promise()
    return {
      message: `Removed ${username} from ${groupname}`,
    }
  } catch (err) {
    console.error('error removing user from group', params, err)
    throw err
  }
}

// Confirms as an admin without using a confirmation code.
export async function confirmUserSignUp(username) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    await cognitoIdentityServiceProvider.adminConfirmSignUp(params).promise()
    return {
      message: `Confirmed ${username} registration`,
    }
  } catch (err) {
    console.error('error confirming user', params, err)
    throw err
  }
}

async function disableUser(username) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    await cognitoIdentityServiceProvider.adminDisableUser(params).promise()
    return {
      message: `Disabled ${username}`,
    }
  } catch (err) {
    console.error('error disabling', params, err)
    throw err
  }
}

export async function enableUser(username) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    await cognitoIdentityServiceProvider.adminEnableUser(params).promise()
    return {
      message: `Enabled ${username}`,
    }
  } catch (err) {
    console.error('error enabling user', params, err)
    throw err
  }
}

export async function getUser(Username) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username,
  }

  try {
    const result = await cognitoIdentityServiceProvider.adminGetUser(params).promise()
    return result
  } catch (err) {
    console.error('error getting user', params, err)
    throw err
  }
}

export async function changeUserEmail(Username, email) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username,
    UserAttributes: [
      {
        Name: 'email',
        Value: email, //NEW Email
      },
    ],
  }

  try {
    const result = await cognitoIdentityServiceProvider.adminUpdateUserAttributes(params).promise()
    return result
  } catch (err) {
    console.error('error changing user email', params, err)
    throw err
  }
}

export async function listUsers(Limit, PaginationToken) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    ...(Limit && { Limit }),
    ...(PaginationToken && { PaginationToken }),
  }

  try {
    const result = await cognitoIdentityServiceProvider.listUsers(params).promise()

    // Rename to NextToken for consistency with other Cognito APIs
    result.NextToken = result.PaginationToken
    delete result.PaginationToken

    return result
  } catch (err) {
    console.error('error listing users', params, err)
    throw err
  }
}

// async function listGroupsForUser(username, Limit, NextToken) {
//   const params = {
// UserPoolId: userPoolId,
// Username: username,
// ...(Limit && { Limit }),
// ...(NextToken && { NextToken }),
//   }
//
//   try {
// const result = await cognitoIdentityServiceProvider.adminListGroupsForUser(params).promise()
// /**
//  * We are filtering out the results that seem to be innapropriate for client applications
//  * to prevent any informaiton disclosure. Customers can modify if they have the need.
//  */
// result.Groups.forEach((val) => {
//   delete val.UserPoolId,
// delete val.LastModifiedDate,
// delete val.CreationDate,
// delete val.Precedence,
// delete val.RoleArn
// })
//
// return result
//   } catch (err) {
// console.error('error listing groups for user', params, err)
// throw err
//   }
// }

export async function listUsersInGroup(groupname, Limit, NextToken) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    GroupName: groupname,
    UserPoolId: userPoolId,
    ...(Limit && { Limit }),
    ...(NextToken && { NextToken }),
  }

  try {
    const result = await cognitoIdentityServiceProvider.listUsersInGroup(params).promise()
    return result
  } catch (err) {
    console.error('error listing users in group', params, err)
    throw err
  }
}

// Signs out from all devices, as an administrator.
export async function signUserOut(username) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    await cognitoIdentityServiceProvider.adminUserGlobalSignOut(params).promise()
    return {
      message: `Signed out ${username} from all devices`,
    }
  } catch (err) {
    console.error('error signing user out', params, err)
    throw err
  }
}
