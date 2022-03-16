import React from 'react'
import { useEffect } from 'react'
import { Auth } from 'aws-amplify'
import AWS, { CognitoIdentityServiceProvider } from 'aws-sdk'
import { getRegion } from 'src/views/wonde/helpers/featureToggles'

function ManageUsers() {
  useEffect(() => {
    Auth.currentCredentials().then(async (credentials) => {
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
      console.log('result', rawUsers)
    })
  }, [])

  return <div>Manage Users</div>
}
export default ManageUsers
