/**
 * Dobs were uploaded incorrectly by BPAmdin
 * This routine locates students in DynamoDB by WondeID and updates their DoB
 */
import { GetAllSchoolsFromDynamoDB } from './GetAllSchoolsFromDynamoDB'
import { getStudentsFromWonde } from './getStudentsFromWonde'
import { getUploadedSchoolData } from './getUploadedSchoolData'
import AWS from 'aws-sdk' // for update queries
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials'
import dayjs from 'dayjs'
var customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)

// Utility to remove spaces and hyphens from string and convert to upper case
function compressString(str) {
  return str.replace(/'|\s/g, '').toUpperCase()
}

export async function fixDobs(selectedSchool) {
  console.log('selected school', selectedSchool)

  /*******************************************
   *  Retrieve all available schools from Wonde and
   *  and check if there is a matching school name in EdCompanion/Elastik
   ******************************************/
  let dynamoSchools = await GetAllSchoolsFromDynamoDB()

  let matchingDynamoDBSchool = dynamoSchools.find(
    (x) => compressString(x.schoolName) === compressString(selectedSchool.schoolName),
  )
  if (matchingDynamoDBSchool) {
    console.log('Selected School found', matchingDynamoDBSchool)
  } else {
    // Should not reach here...
    console.log('Exiting addWondeIDs()......')
    console.log('Selected school not found in DynamoDB', selectedSchool.schoolName)
    return
  }

  /*******************************************
   *  Retrieve the Wonde data for this school
   *  and make unique lists, with firstname-surname keys
   ******************************************/
  let { wondeStudentsTemp } = await getStudentsFromWonde(selectedSchool.wondeID)
  console.log('Student->classrooms->teachers read from Wonde', wondeStudentsTemp)
  // Make unique lists of Students, Classrooms and Teachers from the Wonde Data
  let uniqueWondeStudentsMap = new Map() // unique map with wondeID as key
  let dynamoDBstudentsForUpdate = [] // array of students in DynamoDB with DoBs not matching Wonde

  // Make a map of the wonde students (presumably all unique wondeIDs)
  wondeStudentsTemp.forEach((student) => {
    let birthDate = 'not valid'
    if (
      student.date_of_birth &&
      student.date_of_birth.date &&
      dayjs(student.date_of_birth.date).isValid()
    ) {
      birthDate = dayjs(student.date_of_birth.date).format('YYYY-MM-DD')
    }
    let newStudent = {
      wondeID: student.id, // to identify the DynamoDB student
      firstName: student.forename,
      lastName: student.surname,
      birthDate: birthDate, // Either a valid correctly formatted date or ""
    }
    uniqueWondeStudentsMap.set(newStudent.wondeID, { ...newStudent })
  })

  /*******************************************
   *  Retrieve the DynamoDB data for this school
   *  based on the school's id in DynamoDB
   *  and make unique lists
   ******************************************/
  let { uploadedStudents } = await getUploadedSchoolData(selectedSchool.id)

  uploadedStudents.forEach((student) => {
    let birthDate = 'not valid'
    if (student.student.birthDate && dayjs(student.student.birthDate, 'YYYY-MM-DD').isValid()) {
      birthDate = dayjs(student.student.birthDate, 'YYYY-MM-DD').format('YYYY-MM-DD')
    }
    let newStudent = {
      id: student.student.id, // the primary key to locate the record in dynamoDB
      firstName: student.student.firstName,
      lastName: student.student.lastName,
      wondeID: student.student.wondeID,
      birthDate: birthDate,
    }
    // locate the stduent in the Wonde list, and if needed add it to the list of students to be updated
    let foundWondeStudent = uniqueWondeStudentsMap.get(student.student.wondeID)
    if (foundWondeStudent) {
      if (
        foundWondeStudent.birthDate !== 'not valid' && // wonde date is valid
        newStudent.birthDate !== foundWondeStudent.birthDate // wonde date different from DynamoDB
      ) {
        console.log('WondeDoB', foundWondeStudent.birthDate, 'Dynamo Dob', newStudent.birthDate)
        dynamoDBstudentsForUpdate.push({ ...newStudent, birthDate: foundWondeStudent.birthDate })
      }
    } else {
      console.log('DynamoDB student not found in Wonde', student)
    }
  })

  console.log('WondeStudents')
  console.dir(uniqueWondeStudentsMap)
  console.log('DynamoDB students for Update', dynamoDBstudentsForUpdate)

  // return

  /*************************************************************
   * Update the student birthdates if any are wrong
   ************************************************************/
  // Note: There is no batchWrite for update operations apparently - so do them one at a time
  console.time('Update students time')
  await updateAWSCredentials()
  let docClient = new AWS.DynamoDB.DocumentClient()
  let returnValArray = [] // what dynamoDB returns after an update operation

  try {
    let count = dynamoDBstudentsForUpdate.length
    for (let n = 0; n < count; n++) {
      let returnVal = await docClient
        .update({
          TableName: process.env.REACT_APP_STUDENT_TABLE,
          Key: { id: dynamoDBstudentsForUpdate[n].id },
          UpdateExpression: 'set birthDate = :d',
          ExpressionAttributeValues: {
            ':d': dynamoDBstudentsForUpdate[n].birthDate,
          },
          ReturnValues: 'UPDATED_NEW',
        })
        .promise()
      returnValArray.push(returnVal)
    }
  } catch (err) {
    console.log('Error updating student DoBs', err)
    return
  }
  console.timeEnd('Update students time')
  console.log(returnValArray)
  return
}
