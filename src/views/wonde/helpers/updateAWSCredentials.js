import { Auth } from 'aws-amplify'
import AWS from 'aws-sdk'

export async function updateAWSCredentials() {
  let credentials
  try {
    credentials = await Auth.currentCredentials()
  } catch (err) {
    console.log(err)
    return
  }

  AWS.config.update({
    credentials: credentials,
    region: 'ap-southeast-2',
  })
}
