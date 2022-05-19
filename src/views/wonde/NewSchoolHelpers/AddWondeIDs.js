/**
 * addWondeIDs() adds WondeIds to Wonde schools that were uploaded manually
 * Schools with WondeIds can be updated automatically
 * WondeIDs are added to School, Student, Classroom and User table records
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

export async function addWondeIDs(selectedSchool) {
  console.log('selected school', selectedSchool)

  /*******************************************
   *  Retrieve all available schools from Wonde and
   *  and check if there is a matching school name in EdCompanion/Elastik
   ******************************************/
  let dynamoSchools = await GetAllSchoolsFromDynamoDB()

  let matchingDynamoDBSchool = dynamoSchools.find(
    (x) => compressString(x.schoolName) === compressString(selectedSchool.schoolName),
  )
  let schoolDynamoID
  if (matchingDynamoDBSchool) {
    console.log('Selected School found', matchingDynamoDBSchool)
    schoolDynamoID = matchingDynamoDBSchool.id
  }

  /*******************************************
   *  Retrieve the Wonde data for this school
   *  and make unique lists, with firstname-surname keys
   ******************************************/
  let { wondeStudentsTemp } = await getStudentsFromWonde(selectedSchool.wondeID)
  console.log('wonde data', wondeStudentsTemp)

  // Make unique lists of Students, Classrooms and Teachers from the Wonde Data
  let uniqueWondeClassroomsMap = new Map()
  let uniqueWondeTeachersMap = new Map()
  let uniqueWondeStudentsMap = new Map() // unique map with firstname,lastname as key
  let duplicateWondeStudents = [] // an array of duplicate firstname,lastname pairs in Wonde

  wondeStudentsTemp.forEach((student) => {
    // Make a unique list of students with wonde firstname,lastname as key
    // If a duplicate if found remove the duplicate from the unique list and add
    // both records to duplicateWondeStudents[]
    let studentKey = compressString(student.forename + student.surname)
    let foundStudent = uniqueWondeStudentsMap.get(studentKey)
    let newStudent = {
      // save anything that will help to identify the student later in DynamoDB
      wondeID: student.id,
      MISID: student.mis_id,
      firstName: student.forename,
      middleName: student.middle_names ? student.middle_names : null,
      lastName: student.surname,
      yearCode: student.yearCode, // not a wonde attribute - put there by getStudentsFromWonde()
      gender: student.gender,
      birthDate: student.date_of_birth.date,
    }
    if (!foundStudent) {
      // add to the unique map
      uniqueWondeStudentsMap.set(studentKey, newStudent)
    } else {
      // remove from unique map and add to duplicate array
      uniqueWondeStudentsMap.delete(studentKey)
      duplicateWondeStudents.push({ ...foundStudent, key: studentKey })
      duplicateWondeStudents.push({ ...newStudent, key: studentKey })
      console.log('Duplicate name,surname pair found in Wonde', student.forename, student.surname)
    }

    // Build the unique list of classrooms (hopefully classroom names are unique)
    student.classes.data.forEach((classroom) => {
      let classroomKey = compressString(classroom.name)
      if (!uniqueWondeClassroomsMap.get(classroomKey)) {
        uniqueWondeClassroomsMap.set(classroomKey, {
          // save anything that will help to identify the student later in DynamoDB
          wondeID: classroom.id,
          MISID: classroom.mis_id,
          classroomName: classroom.name,
        })
        // Build the unique list of teachers (maybe add email as a better unique identifier)
        classroom.employees.data.forEach((teacher) => {
          let teacherKey = compressString(teacher.forename + teacher.surname)
          if (!uniqueWondeTeachersMap.get(teacherKey)) {
            uniqueWondeTeachersMap.set(teacherKey, {
              wondeID: teacher.id,
              MISID: teacher.mis_id,
              firstName: teacher.forename,
              middleName: student.middle_names ? student.middle_names : null,
              lastName: teacher.surname,
            })
          }
        })
      }
    })
  })

  // 2 student maps have the same length if no name duplicates
  console.log('uniqueWondeStudentsMap')
  console.dir(uniqueWondeStudentsMap)
  console.log('uniqueWondeClassroomsMap')
  console.dir(uniqueWondeClassroomsMap)
  console.log('uniqueWondeTeachersMap')
  console.dir(uniqueWondeTeachersMap)
  console.log('Duplicate firstname,lastname pairs in Wonde:', duplicateWondeStudents)

  /*******************************************
   *  Retrieve the DynamoDB data for this school
   *  based on the school's id in DynamoDB
   *  and make unique lists
   ******************************************/

  let { uploadedClassrooms, uploadedTeachers, uploadedStudents } = await getUploadedSchoolData(
    selectedSchool.id,
  )

  /*******************************************
   * For every unique record from Elastik,
   *   Identify the corresponding unique record from Wonde
   *   Add the WondeID and mis_id of that record to the Elastik record
   ******************************************/

  // Make a unique list of DynamoDB students with firstname,lastname as key
  // If a duplicate if found remove the duplicate from the unique list and add
  // both records to duplicateWondeStudents[]

  let duplicateDynamoStudents = []
  let uniqueDynamoStudentsMap = new Map()
  uploadedStudents.forEach((student) => {
    let newStudent = {
      firstName: student.student.firstName,
      lastName: student.student.lastName,
      birthDate: student.student.birthDate,
      id: student.student.id,
    }
    let studentKey = compressString(student.student.firstName + student.student.lastName)
    let foundStudent = uniqueDynamoStudentsMap.get(studentKey)
    if (!foundStudent) {
      // add to the unique map
      uniqueDynamoStudentsMap.set(studentKey, newStudent)
    } else {
      // remove from unique map and add to duplicate array
      uniqueDynamoStudentsMap.delete(studentKey)
      duplicateDynamoStudents.push({ ...foundStudent, key: studentKey })
      duplicateDynamoStudents.push({ ...newStudent, key: studentKey })
      console.log(
        'Duplicate name,surname pair found in DynamoDB',
        student.student.firstName,
        student.student.lastName,
      )
    }
  })

  // make the map into an array for simpler processing
  let uniqueDynamoStudents = Array.from(uniqueDynamoStudentsMap.values())

  // Locate each Dynamo student in the Wonde list
  // If found add the WondeID and MISID
  // If not found add a NOTFOUND market so we dont try to update it
  uniqueDynamoStudents.forEach((student, index) => {
    let studentKey = compressString(student.firstName + student.lastName)
    let foundStudent = uniqueWondeStudentsMap.get(studentKey)
    if (foundStudent) {
      // compare the birthdates, so we can update it if its wrong in DynamoDB
      if (
        dayjs(foundStudent.birthDate).format('YYYY-MM-DD') !==
        dayjs(student.birthDate).format('YYYY-MM-DD')
      ) {
        let wondeFormatted = dayjs(foundStudent.birthDate).format('DD/MM/YYYY')
        console.log(
          index,
          studentKey,
          'W raw:',
          foundStudent.birthDate,
          'W csv',
          wondeFormatted,
          'W saved',
          dayjs(wondeFormatted).format('YYYY-MM-DD'),
          'W correct',
          dayjs(wondeFormatted, 'DD/MM/YYYY').format('YYYY-MM-DD'),
          'DynamoDB',
          dayjs(student.birthDate).format('YYYY-MM-DD'),
        )
      }
      // Update the birthdate in case they were uploaded wrongly
      student.birthDate = dayjs(foundStudent.birthDate).format('YYYY-MM-DD')
      student.wondeID = foundStudent.wondeID
      student.MISID = foundStudent.MISID
      student.isInWonde = true
    } else {
      console.log('DynamoDB Student not found in Wonde', student)
    }
  })

  // filter out students found in Dynamo but not in Wonde
  uniqueDynamoStudents = uniqueDynamoStudents.filter((student) => student.isInWonde)

  uploadedClassrooms.forEach((classroom) => {
    let foundClassroom = uniqueWondeClassroomsMap.get(compressString(classroom.className))
    if (foundClassroom) {
      classroom.wondeID = foundClassroom.wondeID
      classroom.MISID = foundClassroom.MISID
      classroom.isInWonde = true
    } else {
      console.log(`classroom ${classroom} not found`)
    }
  })

  uploadedTeachers.forEach((teacher) => {
    let foundTeacher = uniqueWondeTeachersMap.get(
      compressString(teacher.firstName + teacher.lastName),
    )
    if (foundTeacher) {
      teacher.wondeID = foundTeacher.wondeID
      teacher.MISID = foundTeacher.MISID
      teacher.isInWonde = true
    } else {
      console.log(`teacher ${teacher} not found`)
    }
  })
  console.log('uploaded Students raw', uploadedStudents)
  console.log('Duplicate student firstname,lastname pairs in DynamoDB', duplicateDynamoStudents)
  console.log('uploaded Classrooms with id, WondeIDs and MISID', uploadedClassrooms)
  console.log('uploaded Teachers with with email, WondeIDs and MISIDs', uploadedTeachers)
  console.log('Uniquely named Students with id, WondeIDs and MISID', uniqueDynamoStudents)

  /*************************************************************
   * Save the WondeIDs and MISIDs and fix student birthDates if wrong
   ************************************************************/

  //Note: Can run this on a Wonde updated school for test purposes.
  await updateAWSCredentials()
  let docClient = new AWS.DynamoDB.DocumentClient()
  let returns

  // First add the School WondeID and the URN
  // Note: The schema has unused MISID for school so instead storing urn there
  console.log('Updating School record')
  try {
    returns = await docClient
      .update({
        TableName: process.env.REACT_APP_SCHOOL_TABLE,
        Key: { id: matchingDynamoDBSchool.id },
        UpdateExpression: 'set MISID = :u, wondeID = :w',
        ExpressionAttributeValues: {
          ':u': selectedSchool.urn,
          ':w': selectedSchool.wondeID,
        },
        ReturnValues: 'UPDATED_NEW',
      })
      .promise()
  } catch (err) {
    console.log('Error updating school record', err)
    return
  }
  console.log('School updated values', returns)

  // Next add wondeIDs and MISIDs to all student records
  // Also fix the students birthDate which may hve been uploaded incorrectly
  console.time('Update students time')
  try {
    let promisesArray = uniqueDynamoStudents.map((student) => {
      return docClient
        .update({
          TableName: process.env.REACT_APP_STUDENT_TABLE,
          Key: { id: student.id },
          UpdateExpression: 'set birthDate = :d, MISID = :m, wondeID = :w',
          ExpressionAttributeValues: {
            ':d': student.birthDate,
            ':m': student.MISID,
            ':w': student.wondeID,
          },
          ReturnValues: 'UPDATED_NEW',
        })
        .promise()
    })
    returns = await Promise.all(promisesArray)
  } catch (err) {
    console.log('Error updating students', err)
    return
  }
  console.timeEnd('Update students time')
  console.log('returns', returns)
}
