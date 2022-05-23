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

export async function addWondeIDs(selectedSchool, setUnmatchedStudents) {
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
  }

  /*******************************************
   *  Retrieve the Wonde data for this school
   *  and make unique lists, with firstname-surname keys
   ******************************************/
  let { wondeStudentsTemp } = await getStudentsFromWonde(selectedSchool.wondeID)
  console.log('raw wonde data', wondeStudentsTemp)

  // Make unique lists of Students, Classrooms and Teachers from the Wonde Data
  let uniqueWondeClassroomsMap = new Map()
  let uniqueWondeTeachersMap = new Map()
  let uniqueWondeStudentsMap = new Map() // unique map with firstname,lastname as key
  let duplicateWondeStudents = [] // an array of duplicate firstname,lastname pairs in Wonde

  wondeStudentsTemp.forEach((student) => {
    // Make a unique list of Wonde students with firstname,lastname as key
    // If a duplicate if found remove the duplicate from the unique list and add
    // both records to duplicateWondeStudents[]
    let studentKey = compressString(student.forename + student.surname)
    let foundStudent = uniqueWondeStudentsMap.get(studentKey)
    let newStudent = {
      // save anything that will help to identify the student later in DynamoDB
      // Note: yearCode is set by getStudentsFromWonde() as 1,2,......12,13,FY etc
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
      console.log('Duplicate name,surname pair found in Wonde', student)
    }

    // Build the unique list of classrooms
    // Classroom names may not be unique even within year levels
    // If not unique with year level then add to a duplicates list
    student.classes.data.forEach((classroom) => {
      // Add "Y" in front of numeric yearCode to match whats in Dynamo
      let yearCode = student.yearCode
      if (!isNaN(Number(student.yearCode))) yearCode = 'Y' + yearCode
      let classroomKey = compressString(yearCode + classroom.name)
      if (!uniqueWondeClassroomsMap.get(classroom.id)) {
        // locate the first teacher
        let teacherEmail = 'No Email'
        if (classroom.employees.data && classroom.employees.data.length > 0) {
          teacherEmail = classroom.employees.data[0].email
        }
        uniqueWondeClassroomsMap.set(classroom.id, {
          // save anything that will help to identify the classroom later in DynamoDB
          wondeID: classroom.id,
          MISID: classroom.mis_id,
          classroomName: classroom.name,
          classroomKey: classroomKey,
          teacherEmail: teacherEmail,
        })
      }
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
    })
  })
  console.log('uniqueWondeStudentsMap')
  console.dir(uniqueWondeStudentsMap)
  console.log('uniqueWondeClassroomsMap')
  console.dir(uniqueWondeClassroomsMap)
  console.log('uniqueWondeTeachersMap')
  console.dir(uniqueWondeTeachersMap)
  console.log('Duplicate student firstname,lastname pairs in Wonde:', duplicateWondeStudents)

  /*******************************************
   *  Retrieve the DynamoDB data for this school
   *  based on the school's id in DynamoDB
   *  and make unique lists
   ******************************************/

  let { uploadedClassrooms, uploadedTeachers, uploadedStudents } = await getUploadedSchoolData(
    selectedSchool.id,
  )

  // Note: uploaded DynamoDB students may not all be matched to a Wonde student for 3 reasons:
  //   1) if the DynamoDB student has no matches in Wonde
  //   2) if the DynamoDB student matches more than one record in Wonde and cant be resolved by DoB
  //   3) if the DynamoDB student has the same name as another DynamoDB student
  // So make 2 lists of students:
  //   First list has the dynamoDB students that are matched (uniqueDynamoStudentsMap)
  //   Second list has the dynamoDB students that are unmatched (unMatchedStudent[])
  // Need to display the unmatched list for the user - showing the reason.

  /**
   *    foundInWonde = false
   *    unresolvedDuplicate = false
   * 1) if the student is in uniqueWondeStudents
   *       foundInWonde = true
   *    else
   *       if the student is in duplicateWondeStudents
   *           if resolved by Dob
   * 2)           foundInWonde = true
   *           else
   *              add to unmatched[] reason:"unmatched Wonde Duplicate"
   *       else
   *           add to unmatched[] reason: "not found in Wonde"
   * 3) if (foundInWonde)
   *       if student is already in uniqueDynamoDBStudents
   *           add to unmatched[] reason: "DynamoDB Duplicate"
   *       else
   *           add to uniqueDynamoDBStudents
   *           add the Wonde IDs etc
   */

  let unMatchedStudents = [] // an array of students that cant be matched as above
  let uniqueDynamoStudentsMap = new Map()
  uploadedStudents.forEach((student, index) => {
    let newStudent = {
      firstName: student.student.firstName,
      lastName: student.student.lastName,
      birthDate: student.student.birthDate,
      id: student.student.id,
    }
    // Try to find the DynamoDB record in either uniqueWondeStudents or duplicateWondeStudents
    let foundWondeStudent = null
    let studentKey = compressString(student.student.firstName + student.student.lastName)
    // is the student in uniqueWondeStudentsMap?
    foundWondeStudent = uniqueWondeStudentsMap.get(studentKey)
    if (!foundWondeStudent) {
      // check if the student is in duplicateWondeStudents[]
      let foundInWondeDuplicates = duplicateWondeStudents.filter(
        (duplicateStudent) => duplicateStudent.key === studentKey,
      )
      if (foundInWondeDuplicates.length <= 0) {
        // not in either wonde lists so we can bail out
        unMatchedStudents.push({ ...newStudent, key: studentKey, reason: 'Not in Wonde' })
      } else {
        // its in the duplicate list so look for exactly one match
        let doBMatches = foundInWondeDuplicates.filter((student) => {
          if (
            dayjs(student.birthDate).format('YYYY-MM-DD') ===
            dayjs(newStudent.birthDate).format('YYYY-MM-DD')
          ) {
            return true
          }
          return false
        })
        if (doBMatches.length === 1) {
          foundWondeStudent = doBMatches[0] // found a unique match on dob
          console.log('Unique match on DoB found in duplicateWondeStudents', foundWondeStudent)
        } else {
          // is in the duplicate list but dobs dont match - so bail out
          unMatchedStudents.push({
            ...newStudent,
            key: studentKey,
            reason: 'Unmatched Duplicate in Wonde',
          })
        }
      }
    }
    // if the student was found in Wonde can now check for duplicates in uniqueDynamoStudents
    if (foundWondeStudent) {
      // is the student already in uniqueDynamoDBMap?
      let foundDynamDBStudent = uniqueDynamoStudentsMap.get(studentKey)
      if (foundDynamDBStudent) {
        // Its a duplicate so remove from unique map
        uniqueDynamoStudentsMap.delete(studentKey)
        // add both to the unmatched array
        unMatchedStudents.push({
          ...foundDynamDBStudent,
          key: studentKey,
          reason: 'Duplicate in DynamoDB',
        })
        unMatchedStudents.push({ ...newStudent, key: studentKey, reason: 'Duplicate in DynamoDB' })
      } else {
        // compare the birthdates, and print them out if different (just for info)
        let wondeDob = dayjs(foundWondeStudent.birthDate).format('YYYY-MM-DD')
        let dynamoDBDob = dayjs(newStudent.birthDate).format('YYYY-MM-DD')
        if (wondeDob !== dynamoDBDob) {
          console.log(index, studentKey, 'Wonde DoB', wondeDob, 'dynamoDB', dynamoDBDob)
        }
        // Update the birthdates in case they were uploaded wrongly
        let wondeData = {
          birthDate: wondeDob,
          MISID: foundWondeStudent.MISID,
          wondeID: foundWondeStudent.wondeID,
        }
        // add the expanded record to the uniqueDynamoStudentsMap
        uniqueDynamoStudentsMap.set(studentKey, { ...newStudent, ...wondeData })
      }
    }
  })

  // pass the unmatched list of students back to parent to display it
  setUnmatchedStudents(unMatchedStudents)

  // make the map into an array for simpler processing
  let uniqueDynamoStudents = Array.from(uniqueDynamoStudentsMap.values())

  let uniqueDynamoClasses = Array.from(uniqueWondeClassroomsMap.values())
  console.log('unique DynamoDB Classes Array', uniqueDynamoClasses)

  // Match up Wonde and Dynamo Classrooms
  uploadedClassrooms.forEach((classroom) => {
    let teacherEmail =
      classroom.teachers && classroom.teachers.items && classroom.teachers.items.length > 0
        ? classroom.teachers.items[0].email
        : 'No Email'
    let yearCode = classroom.yearLevels.items[0].yearLevel.yearCode
    let classroomKey = compressString(yearCode + classroom.className)
    let classroomMatches = uniqueDynamoClasses.filter(
      (classroom) =>
        classroomKey === classroom.classroomKey && teacherEmail === classroom.teacherEmail,
    )
    if (classroomMatches.length === 0) {
      console.log('Classroom not found in Wonde', classroomKey)
    } else if (classroomMatches.length > 1)
      console.log('Classroom yearLevel name duplicates found', classroomKey, classroomMatches)
    else {
      classroom.wondeID = classroomMatches[0].wondeID
      classroom.MISID = classroomMatches[0].MISID
      classroom.classroomName = classroomMatches[0].classroomName
      classroomKey = classroomMatches[0].classroomKey
    }
  })

  // Match up Wonde and Dynamo Teachers
  uploadedTeachers.forEach((teacher) => {
    if (teacher.lastName === 'Walsh') console.log('+++++++Found teacher Walsh')
    let foundTeacher = uniqueWondeTeachersMap.get(
      compressString(teacher.firstName + teacher.lastName),
    )
    if (foundTeacher) {
      teacher.wondeID = foundTeacher.wondeID
      teacher.MISID = foundTeacher.MISID
      teacher.isInWonde = true
    } else {
      console.log(`Teacher not found`, teacher)
    }
  })
  console.log('Uploaded Students raw', uploadedStudents)
  console.log('Unmatched students from DynamoDB', unMatchedStudents)
  console.log('Uploaded Unique Classrooms with id, WondeIDs and MISID', uploadedClassrooms)
  console.log('Uploaded Unique Teachers with with email, WondeIDs and MISIDs', uploadedTeachers)
  console.log('Uploaded Unique Students with id, WondeIDs and MISID', uniqueDynamoStudents)

  /*************************************************************
   * Save the WondeIDs and MISIDs and fix student birthDates if wrong
   ************************************************************/
  return
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
  // Note: There is no batchWrite for update operations apparently - so do them one at a time
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
  console.log('Updated students as reported by DynamoDB', returns)
}
