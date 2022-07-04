import AWS from 'aws-sdk'
import { Auth } from 'aws-amplify'
import { getRegion } from '../CommonHelpers/featureToggles'

//Function to get the list of Wonde schools already uploaded into DynamoDB
export async function GetAllSchoolsFromDynamoDB() {
  let credentials
  try {
    credentials = await Auth.currentCredentials()

    AWS.config.update({
      credentials: credentials,
      region: getRegion(),
    })
    const docClient = new AWS.DynamoDB.DocumentClient()
    let response
    response = await docClient.scan({ TableName: process.env.REACT_APP_SCHOOL_TABLE }).promise()
    return response.Items
  } catch (err) {
    console.log(err)
    return []
  }
} // end GetAllSchoolsFromDynamoDB()
