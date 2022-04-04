import AWS from 'aws-sdk'
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials.js'

const SCHOOL_TABLE = process.env.REACT_APP_SCHOOL_TABLE

// Read all schools in EdC/Elastik that have been uploaded from Wonde ( ie have a wondeID )
export async function getUploadedSchools(url, token) {
  let schools = []
  try {
    await updateAWSCredentials()

    let docClient = new AWS.DynamoDB.DocumentClient()
    let response = await docClient.scan({ TableName: SCHOOL_TABLE }).promise()
    if (response.Count > 0) {
      response.Items.forEach((school) => {
        if (school.wondeID)
          schools.push({
            schoolName: school.schoolName,
            wondeID: school.wondeID,
            lastWondeUpdate: '01/01/2022',
            // TODO - add a lastWondeUpdate field to sSchool table
          })
      })
      return schools
    } else return []
  } catch (err) {
    console.log(err)
    return []
  }
}
