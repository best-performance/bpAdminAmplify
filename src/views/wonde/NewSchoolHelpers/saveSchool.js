import { v4 } from 'uuid'
import dayjs from 'dayjs'
import AWS from 'aws-sdk'
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials.js'
/** ----------------------------------------------------------------------- */
export async function saveSchool(
  selectedSchool,
  countriesLookup,
  statesLookup,
  tableName,
  indexName,
) {
  //This puts and entry in table School if not already there
  console.log('inside SaveSchool')
  console.log(selectedSchool)
  console.log('tableName', tableName)
  await updateAWSCredentials()
  let docClient = new AWS.DynamoDB.DocumentClient()
  // first check if the WondeID already exists (ie the school is already saved)
  const queryParams = {
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: '#wondeID = :wondeID',
    ExpressionAttributeNames: {
      '#wondeID': 'wondeID',
    },
    ExpressionAttributeValues: {
      ':wondeID': selectedSchool.wondeID,
    },
  }
  try {
    let response = await docClient.query(queryParams).promise()
    if (response.Count > 0) {
      console.log('school already in School table')
      return { alreadyLoaded: true, schoolID: response.Items[0].id } // the schoolID
    }
  } catch (err) {
    console.log('Error locating school in School table', err)
    return { alreadyLoaded: null, schoolID: null }
  }

  // Save the school since its not already in the database
  let schoolID = v4() // random uuid generator
  // locate the EdCompanion countryID

  let country = countriesLookup.find((country) => country.name === selectedSchool.country)

  const noCountry = countriesLookup.find((country) => country.name === 'NO COUNTRY')

  const noState = statesLookup.find((state) => state.name === 'NO STATE')

  //console.log("Country:", country);
  const params = {
    TableName: tableName,
    Item: {
      id: schoolID, // this is the EdC id
      wondeID: selectedSchool.wondeID, // not in EdC
      schoolName: selectedSchool.schoolName,
      // address: selectedSchool.address1, // not in EdC
      // country: selectedSchool.country, // not in EdC
      countryID: country ? country.id : noCountry.id, // not in Wonde
      stateID: noState.id, // not in Wonde
      // town: selectedSchool.town, // not in EdC
      motto: `May the force be with the students of ${selectedSchool.schoolName}`, // not in Wonde
      dummy: 'school',
      studentLoginEnabled: false, // not in Wonde
      __typename: 'School', // used hard coded as tableName may change with env
      createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
      updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
      // other optional EdC fields not loaded
      // ealdProgress:Boolean
      // logo:        S3Object
      // networkID:
      //
    },
  }
  try {
    await docClient.put(params).promise()
    console.log(`Successfull saved school ${schoolID}`)
    return { alreadyLoaded: false, schoolID: schoolID }
  } catch (err) {
    console.log(`Error saving school ${schoolID}`, err)
    return { alreadyLoaded: null, schoolID: null }
  }
} // end of saveSchool
