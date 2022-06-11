// All this code was copied from the EdCompanion project - with local edits as needed

import { CognitoIdentityServiceProvider } from 'aws-sdk'
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials.js'

// Frank's original code had a global CognitoIdentityServiceProvider object
// but thats not suitable for React, so create a new one in each function

// To make call we have to retrieve the credentials of the current logged user
//
// let credentials = await Auth.currentCredentials()
// then
// AWS.config.update({
//   credentials: credentials,
//   region: process.env.REACT_APP_REGION,
// })

// alternatively
// let credentials = await Auth.currentCredentials()
// const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider({
//  credentials: credentials,
//  region: 'ap-southeast-2',
// })

// Note: the AWS.credentials object is described here
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html

const FAILED = 'failed'

// When adding a student to Cognito we set a default password and make it permanent
// so the student does not have to change password and remember it
export async function addNewStudentCognitoUser(
  email, // the student's email
  userPoolId,
  studentFirstName,
  studentLastName,
) {
  await updateAWSCredentials()
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()

  try {
    // set the params for the adminCreate user
    let params = {
      UserPoolId: userPoolId,
      Username: email,
      MessageAction: 'SUPPRESS', // don't send a confirmation email
      UserAttributes: [
        { Name: 'email', Value: email },
        {
          Name: 'email_verified',
          Value: 'true',
        },
        {
          Name: 'name' /* required */,
          Value: `${studentFirstName} ${studentLastName}`,
        },
      ],
      ForceAliasCreation: false,
      TemporaryPassword: `Student${new Date().getFullYear().toString().slice(2)}!`,
    }
    const { User } = await cognitoIdentityServiceProvider.adminCreateUser(params).promise()
    // if the call fails Cognito throws and exception so if we reach here we can assume all is good
    // So we can go ahead and set the password fianlly
    params = {
      UserPoolId: userPoolId,
      Username: User.Username,
      Password: `Student${new Date().getFullYear().toString().slice(2)}`,
      Permanent: true,
    }
    await cognitoIdentityServiceProvider.adminSetUserPassword(params).promise()
    // again if we reach here all is good.
    return {
      username: User.Username,
    }
  } catch (err) {
    // it can fail because the user already exists
    if (err.code === 'UsernameExistsException') {
      const params = {
        UserPoolId: userPoolId,
        Username: email,
      }
      try {
        const { Username } = await cognitoIdentityServiceProvider.adminGetUser(params).promise()
        console.log('User already exists in Cognito, so not adding again', email)
        return { username: Username }
      } catch (err) {
        console.error('error getting existing user for adding', params, err)
        return { username: FAILED }
      }
    } else {
      // or can fail for some other unknown reason
      console.error('error adding new user', err)
      return { username: FAILED }
    }
  }
}

// When adding a teacher to Cognito we set a default password and force them to change it
export async function addNewTeacherCognitoUser(
  email,
  userPoolId,
  teacherFirstName,
  teacherLastName,
) {
  await updateAWSCredentials()
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()

  try {
    let params = {
      UserPoolId: userPoolId,
      Username: email,
      MessageAction: 'SUPPRESS', // don't send a confirmation email
      UserAttributes: [
        { Name: 'email', Value: email },
        {
          Name: 'email_verified',
          Value: 'true',
        },
        {
          Name: 'name' /* required */,
          Value: `${teacherFirstName} ${teacherLastName}`,
        },
      ],
      ForceAliasCreation: false,
      TemporaryPassword: `Password${new Date().getFullYear().toString().slice(2)}!`,
    }
    const { User } = await cognitoIdentityServiceProvider.adminCreateUser(params).promise()
    return {
      username: User.Username,
    }
  } catch (err) {
    // it can fail because the user already exists
    if (err.code === 'UsernameExistsException') {
      const params = {
        UserPoolId: userPoolId,
        Username: email,
      }
      try {
        const { Username } = await cognitoIdentityServiceProvider.adminGetUser(params).promise()
        // no need to set the final password as the teacher is required to do that herself.
        return { username: Username }
      } catch (err) {
        console.error('error getting existing user for adding', params, err)
        return { username: FAILED }
      }
    } else {
      // or can fail for some other unknown reason
      console.error('error adding new user', err)
      return { username: FAILED }
    }
  }
}

export async function getCognitoUser(Username, userPoolId) {
  await updateAWSCredentials()
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username,
  }
  try {
    // Note: Cognito considers it an error if user can't be found!!
    const result = await cognitoIdentityServiceProvider.adminGetUser(params).promise()
    return result
  } catch (err) {
    if (err.code === 'UserNotFoundException') return FAILED
    else return err
  }
}

export async function addUserToGroup(username, groupname, userPoolId) {
  await updateAWSCredentials()
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    GroupName: groupname,
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    await cognitoIdentityServiceProvider.adminAddUserToGroup(params).promise()
    return {
      message: `Success adding ${username} to ${groupname}`,
    }
  } catch (err) {
    console.error('error adding user to group', params, err)
    throw err
  }
}

export async function setUserPassword(username, password, temp = false, userPoolId) {
  await updateAWSCredentials()
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
    Password: password,
    Permanent: temp,
  }

  try {
    await cognitoIdentityServiceProvider.adminSetUserPassword(params).promise()
    return {
      message: `Success setting password for ${username}`,
    }
  } catch (err) {
    console.error('error setting password for user', params, err)
    throw err
  }
}

export async function deleteUser(username, userPoolId) {
  await updateAWSCredentials()
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()
  const params = {
    UserPoolId: userPoolId,
    Username: username,
  }

  try {
    await cognitoIdentityServiceProvider.adminDeleteUser(params).promise()
    return {
      message: `Success deleting ${username}`,
    }
  } catch (err) {
    console.error('error deleting user', params, err.code)
  }
}

export async function removeUserFromGroup(username, groupname, userPoolId) {
  await updateAWSCredentials()
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
export async function confirmUserSignUp(username, userPoolId) {
  await updateAWSCredentials()
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

export async function disableUser(username, userPoolId) {
  await updateAWSCredentials()
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

export async function enableUser(username, userPoolId) {
  await updateAWSCredentials()
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

export async function getUser(Username, userPoolId) {
  await updateAWSCredentials()
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

export async function changeUserEmail(Username, email, userPoolId) {
  await updateAWSCredentials()
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

export async function listUsers(Limit, PaginationToken, userPoolId) {
  await updateAWSCredentials()
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
    return FAILED
  }
}

export async function listUsersInGroup(groupname, Limit, NextToken, userPoolId) {
  await updateAWSCredentials()
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
export async function signUserOut(username, userPoolId) {
  await updateAWSCredentials()
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

// // This may not be used any more (check and delete as appropriate)
// export async function addNewCognitoUser(username, userPoolId) {
//   await updateAWSCredentials()
//   const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()

//   const params = {
//     UserPoolId: userPoolId,
//     Username: username,
//     MessageAction: 'SUPPRESS', // don't send a confirmation email
//     UserAttributes: [
//       { Name: 'email', Value: username },
//       {
//         Name: 'email_verified',
//         Value: 'true',
//       },
//     ],
//     ForceAliasCreation: false,
//     TemporaryPassword: `Password${new Date().getFullYear().toString().slice(2)}!`,
//   }

//   try {
//     const result = await cognitoIdentityServiceProvider.adminCreateUser(params).promise()
//     return {
//       username: result.User.Username,
//     }
//   } catch (err) {
//     // it can fail because the user already exists
//     if (err.code === 'UsernameExistsException') {
//       const params = {
//         UserPoolId: userPoolId,
//         Username: username,
//       }
//       try {
//         const result = await cognitoIdentityServiceProvider.adminGetUser(params).promise()
//         return { username: result.Username }
//       } catch (err) {
//         console.error('error getting existing user for adding', params, err)
//         return { username: FAILED }
//       }
//     } else {
//       // or can fail for some other unknown reason
//       console.error('error adding new user', err)
//       return { username: FAILED }
//     }
//   }
// }
