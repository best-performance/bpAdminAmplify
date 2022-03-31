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
  // Note: the AWS.credentials object is described here
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html
  AWS.config.update({
    credentials: credentials,
    region: process.env.REACT_APP_REGION,
  })
}
