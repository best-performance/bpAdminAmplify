import { v4 } from 'uuid'
import dayjs from 'dayjs'
/** ----------------------------------------------------------------------- */
export async function saveSchool(docClient, selectedSchool, countriesLookup, tableName, indexName) {
  //This puts and entry in table School if not already there

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
      return response.Items[0].id // the schoolID
    }
  } catch (err) {
    console.log('Error locating school in School table', err)
    return false
  }

  // Save the school since its not already in the database
  let schoolID = v4() // random uuid generator
  // locate the EdCompanion countryID

  let country = countriesLookup.find((country) => country.name === selectedSchool.country)
  //console.log("Country:", country);
  const params = {
    TableName: tableName,
    Item: {
      id: schoolID, // this is the EdC id
      wondeID: selectedSchool.wondeID, // not in EdC
      schoolName: selectedSchool.schoolName,
      address: selectedSchool.address1, // not in EdC
      country: selectedSchool.country, // not in EdC
      countryID: country ? country.id : `${selectedSchool.country} not in list`, // not in Wonde
      stateID: `Wonde has no states`, // not in Wonde
      town: selectedSchool.town, // not in Wonde
      motto: `May the force be with the students of ${selectedSchool.schoolName}`, // not in Wonde
      studentLoginEnabed: false, // not in Wonde
      __typename: 'School', // used hard coded as tableName may change with env
      createtAt: dayjs().format('YYYY-MM-DD HH-mm-sss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH-mm-sss'),
      // other optional EdC fields not loaded
      // dummy:       String
      // ealdProgress:Boolean
      // logo:        S3Object
      // networkID:
      //
    },
  }
  try {
    await docClient.put(params).promise()
    console.log('successfull saved school')
    return schoolID
  } catch (err) {
    console.log('Error saving school in School table', err)
    return false
  }
} // end of saveSchool
