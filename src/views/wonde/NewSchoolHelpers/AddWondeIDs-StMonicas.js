/**
 * addWondeIDs() adds WondeIds to Wonde schools that were uploaded manually
 * Schools with WondeIds can be updated automatically
 * WondeIDs are added to School, Student, Classroom, User (teacher and student) table records
 * Note: Only processes the selected school - not all schools
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

/* St Monica Notes
When the data was manually loaded for St Monica's we loaded data for years 3,4,5,6. 
In Wonde each of these classes have 2 teachers listed.
On manual upload we have split these into separate classes - one per teacher, 
leading to a total of 8 classes in Dynamo. The classes are named like
"Y4 McNeill 2022" and 'Y4 Ware 2022". These 2 classes will have the same WondeIDs.
Same for y3,y4,y5 and y6 classes
 */

/**
 * The steps are as follows:
 * 0. We call addWondeIDs() passing in a selected school from the list of available Wonde schools
 * 1. Read all the schools in DynamoDB and locate which one matches the selected school (matchingDynamoDBschool)
 * 2. Read all the data from Wonde for the selected school
 * 3. Make unique maps of Wonde records, adding duplicates to duplicate lists
 *        Students    -> uniqueWondeStudentsMap, duplicateWondeStudents
 *           key: compressString(student.forename + student.surname + dayjs(student.date_of_birth.date).format('YYYY-MM-DD')
 *        Teachers    -> uniqueWondeClassroomsMap
 *           key: compressString(teacher.forename + teacher.surname + teacher.email)
 *        Classrooms  -> uniqueWondeTeachersMap
 *           key: compressString(yearCode + classroom.name + teacherEmail)
 * 4. Retrieve from DynamoDB
 *        Students    -> uploadedStudents
 *        Teachers    -> uploadedTeachers
 *        Users       -> uploadedUsers (to be done)
 *        Classrooms  -> uploadedClassrooms
 * 5. Match each Wonde student (uniqueWondeStudentsMap) to its partner in DynamoDB (uploadedStudents)
 *        push matched records with WondeIDs -> uniqueDynamoStudents[]
 *        push unmatched records to          -> unMatchedStudents[]
 * 5a. Match each Wonde student (uniqueWondeStudentsMap) to its partner in DynamoDB (uploadedUsers)
 *
 *
 * 6. Match each classroom (uniqueWondeClassrooms) to its partner in DynamoDB (uploadedClassrooms)
 *        push matched records with WondeIDs -> uniqueDynamoClasses
 *        push unmatched records to          -> unMatchedClasses
 * 7. Match each teacher (uniqueWondeClassrooms) to its partner in DynamoDB (uploadedClassrooms)
 *        push matched records with WondeIDs -> uniqueDynamoClasses
 *        push unmatched records to          -> unMatchedClasses
 *
 */
export async function addWondeIDs(selectedSchool) {
  console.log('selected school', selectedSchool)

  /*******************************************
   * Step 1.
   * Retrieve all available schools from Wonde and
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
   *  Step 2.
   *  Retrieve the Wonde data for this school
   ******************************************/
  let { wondeStudentsTemp } = await getStudentsFromWonde(selectedSchool.wondeID)
  console.log('Student->classrooms->teachers read from Wonde', wondeStudentsTemp)

  /*******************************************
   *  Step 3.
   *  Make unique lists of Students, StudentUsers, Classrooms and Teachers from the Wonde Data
   *  saving data that will help matching with the DynamoDB data
   *  Make duplicate lists of students and classrooms as needed.
   ******************************************/
  let uniqueWondeClassroomsMap = new Map()
  let uniqueWondeIDClassroomsMap = new Map()
  let duplicateWondeClassrooms = [] // an array of duplicate classroom names- yearlevel in Wonde
  let uniqueWondeTeachersMap = new Map()
  let uniqueWondeStudentsMap = new Map() // unique map with firstname,lastname,dob as key
  let duplicateWondeStudents = [] // an array of duplicate student firstname,lastname,dobs in Wonde
  //let uniqueWondeStudentUsersMap = new Map() // unique map with firstname,lastname as key
  //let duplicateWondeStudentUsers = [] // an array of duplicate student firstname,lastname in Wonde
  //let duplicateWondeTeachers = [] // an array of duplicate teachers in Wonde (unlikely due to unique emails)
  //let duplicateWondeClassrooms = [] // an array of duplicate classname-yearLevel in Wonde

  // dont forget wondStudentsTemp has teh full hierarchy of
  // student->classes->teachers
  wondeStudentsTemp.forEach((student) => {
    // Extract fields to identfiy the student and when matched
    // record the ids to be added to the matching DynamoDB record
    // Note: yearCode is set by getStudentsFromWonde() as 1,2,......12,13,FY etc
    let wondeStudent = {
      wondeID: student.id,
      MISID: student.mis_id,
      firstName: student.forename,
      middleName: student.middle_names ? student.middle_names : null,
      lastName: student.surname,
      yearCode: student.yearCode, //put there by getStudentsFromWonde()
      gender: student.gender,
      birthDate: dayjs(student.date_of_birth.date).format('YYYY-MM-DD'),
    }
    // Make a unique list of Wonde students with (firstname,lastname,Dob) as key
    // Check if the (firstname,lastname,dob) key is already in either the
    // duplicate list or the uniques list. If so remove from the unique list and
    // add to the duplicate list.
    let studentKeyOld = compressString(
      student.forename + student.surname + dayjs(student.date_of_birth.date).format('YYYY-MM-DD'),
    )

    let studentKey = compressString(student.forename + student.surname)
    switch (studentKey) {
      case 'BILLYFLANNERY':
        studentKey = 'WILLIAMFLANNERY'
        break
      case 'JAMESLESLIEEDGE':
        studentKey = 'JAMESEDGE'
        break
      case 'TYLERJACKASHWORTH':
        studentKey = 'TYLERASHWORTH'
        break
      case 'CAITLYN-ELISEMURPHY':
        studentKey = 'CAITLYNMURPHY'
        break
      case 'CHARLIEMCPHERSON':
        studentKey = 'CHARLESMCPHERSON'
        break
      case 'BOBBY-JACKCORRIN':
        studentKey = 'BOBBYCORRIN'
        break
      case 'MILLIECANNELL':
        studentKey = 'AMELIACANNELL'
        break
      case 'EMILY-ROSEMITCHELLDUNN':
        studentKey = 'EMILY-ROSEDUNN'
        break
      case 'MADISONGREENWOOD':
        studentKey = 'MADISONGREENWOOD-RITSON'
        break
      case 'KEEGANALANROBERTBROWN':
        studentKey = 'KEEGANBROWN'
        break
      default:
        break
    }
    // If the student is already a duplicate, push it to the duplicate array
    if (duplicateWondeStudents.find((student) => student.key === studentKey)) {
      duplicateWondeStudents.push({ ...wondeStudent, key: studentKey })
      console.log('Duplicate Wonde student found in duplicate list', student)
    } else {
      // not in duplicate list so look for it in the unique list
      let foundDuplicateStudent = uniqueWondeStudentsMap.get(studentKey)
      if (foundDuplicateStudent) {
        // remove from unique map and add to duplicate array
        uniqueWondeStudentsMap.delete(studentKey)
        duplicateWondeStudents.push({ ...foundDuplicateStudent, key: studentKey })
        duplicateWondeStudents.push({ ...wondeStudent, key: studentKey })
        console.log('Duplicate Wonde student found in unique list', student)
      } else {
        // its unique so add to the unique map
        uniqueWondeStudentsMap.set(studentKey, wondeStudent)
      }
    }

    // Build the unique list of classrooms
    // First Make unique list of classrooms based on WondeID
    student.classes.data.forEach((classroom) => {
      // Add "Y" in front of numeric yearCode to match whats in Dynamo
      let yearCode = student.yearCode
      if (!isNaN(Number(student.yearCode))) yearCode = 'Y' + yearCode

      let teacherEmail = 'NoEmail'
      if (classroom.employees.data.length > 0) teacherEmail = classroom.employees.data[0].email

      let wondeClassroom = {
        // save anything that will help to identify the classroom later in DynamoDB
        wondeID: classroom.id,
        MISID: classroom.mis_id,
        classroomName: classroom.name,
        classroomYearCode: yearCode,
        teacherEmail: teacherEmail,
      }

      // Populate a unique classroom list based on the classroom id (Wonde id)
      if (!uniqueWondeIDClassroomsMap.get(classroom.id)) {
        uniqueWondeIDClassroomsMap.set(classroom.id, wondeClassroom)
      } else {
        //console.log('Duplicate Classroom in Wonde', classroom)
      }

      // Build the unique list of teachers (maybe add email as a better unique identifier)
      classroom.employees.data.forEach((teacher) => {
        let teacherKeyOld = compressString(teacher.forename + teacher.surname + teacher.email)
        let teacherKey = teacher.email
        if (!uniqueWondeTeachersMap.get(teacherKey)) {
          uniqueWondeTeachersMap.set(teacherKey, {
            wondeID: teacher.id,
            MISID: teacher.mis_id,
            firstName: teacher.forename,
            middleName: student.middle_names ? student.middle_names : null,
            lastName: teacher.surname,
            email: teacher.email,
          })
        } else {
          // Do nothing because duplicate teachers will be found
        }
      })
    })
  })

  console.log('uniqueWondeIDClassroomsMap')
  console.dir(uniqueWondeIDClassroomsMap)

  // Now see how many classname-yearCode duplicates there are
  uniqueWondeIDClassroomsMap.forEach((classroom) => {
    let classroomKeyOl2 = compressString(
      classroom.classroomYearCode + classroom.classroomName + classroom.teacherEmail,
    )
    let classroomKeyOld = compressString(classroom.classroomYearCode + classroom.teacherEmail)
    let classroomKey = compressString(classroom.classroomYearCode + classroom.classroomName) // like "Y44"
    let foundClassroom = uniqueWondeClassroomsMap.get(classroomKey)
    if (!foundClassroom) {
      uniqueWondeClassroomsMap.set(classroomKey, classroom)
    } else {
      console.log('Duplicate classname, yearCode found', classroom)
      console.log('Duplicated with', foundClassroom)
    }
  })

  console.log('uniqueWondeStudentsMap')
  console.dir(uniqueWondeStudentsMap)
  console.log('Duplicate students in Wonde:', duplicateWondeStudents)
  console.log('uniqueWondeClassroomsMap')
  console.dir(uniqueWondeClassroomsMap)
  console.log('Duplicate Classrooms in Wonde:', duplicateWondeClassrooms)
  console.log('uniqueWondeTeachersMap')
  console.dir(uniqueWondeTeachersMap)

  /*******************************************
   * Step 4.
   * Retrieve the DynamoDB data for this school
   *  based on the school's id
   ******************************************/

  let { uploadedClassrooms, uploadedTeachers, uploadedStudents } = await getUploadedSchoolData(
    selectedSchool.id,
  )
  if (!(uploadedClassrooms && uploadedTeachers && uploadedStudents)) {
    console.log('Problem reading DynamoDB tables ... exiting')
    return
  }

  /*******************************************
   * 5. Match each Wonde student (uniqueWondeStudentsMap) to its partner in DynamoDB (uploadedStudents)
   *        push matched records with WondeIDs -> uniqueDynamoStudentsMap
   *        push unmatched records to          -> unMatchedStudents
   ******************************************/

  // Note: DynamoDB students may not match positively to a Wonde student if
  //   1) the DynamoDB student has no matches in Wonde (has been deleted from Wonde)
  //   2) the DynamoDB student has multiple matches in Wonde
  //   3) the DynamoDB student has multiples matches in Dynamo
  // So make 2 lists of students:
  //   First list has the dynamoDB students that are matched (uniqueDynamoStudentsMap)
  //   Second list has the dynamoDB students that are unmatched (unMatchedStudent[])
  // Need to display the unmatched list for the user - showing the reason.

  let unMatchedDynamoDBStudents = [] // for DynamoDB students unmatched to WondeStudents
  let matchedDynamoStudentsMap = new Map() // DynamoDB students uniquely matched to WondeStudents
  console.log('uploadedStudents length', uploadedStudents.length)
  uploadedStudents.forEach((student) => {
    // Try to find the DynamoDB student in either uniqueWondeStudents or duplicateWondeStudents
    let foundWondeStudent = null
    let studentKeyOld = compressString(
      student.student.firstName +
        student.student.lastName +
        dayjs(student.student.birthDate).format('YYYY-MM-DD'),
    )

    // a large no of St Monica names have firstName and LastName reversed in Elastic
    // So we make 2 keys as below in teh attempt to find them
    let studentKey = ''
    let studentKey1 = compressString(student.student.firstName + student.student.lastName)
    let studentKey2 = compressString(student.student.lastName + student.student.firstName)
    // is the student in uniqueWondeStudentsMap?
    foundWondeStudent = uniqueWondeStudentsMap.get(studentKey1)
    if (!foundWondeStudent) {
      foundWondeStudent = uniqueWondeStudentsMap.get(studentKey2)
      if (!foundWondeStudent) {
        unMatchedDynamoDBStudents.push({
          ...student,
          key: studentKey1,
          reason: 'Student not found in Wonde with FL key',
        })
        unMatchedDynamoDBStudents.push({
          ...student,
          key: studentKey2,
          reason: 'Student not found in Wonde wih LF key',
        })
      } else {
        studentKey = studentKey2
      }
    } else {
      studentKey = studentKey1
    }

    // // check if in the duplicates list
    // let reason = ''
    // if (duplicateWondeStudents.find((student) => student.studentKey === studentKey1)) {
    //   reason = 'DynamoDB student has duplicates in Wonde'
    // } else {
    //   reason = 'DynamoDB student not found in Wonde'
    // }
    // unMatchedDynamoDBStudents.push({ ...student, key: studentKey1, reason: reason })
    if (foundWondeStudent) {
      // The student is uniquely matched to a Wonde student
      // Is the student already in matchedDynamoStudentsMap?
      let foundDynamoDBStudent =
        matchedDynamoStudentsMap.get(studentKey1) || matchedDynamoStudentsMap.get(studentKey2)
      if (foundDynamoDBStudent) {
        console.log('duplicate matched student found')
        // // Its a duplicate so remove from unique map
        // matchedDynamoStudentsMap.delete(studentKey)
        // // add both to the unmatched array
        // unMatchedDynamoDBStudents.push({
        //   ...foundDynamoDBStudent,
        //   key: studentKey,
        //   reason: 'Duplicate in DynamoDB',
        // })
        // unMatchedDynamoDBStudents.push({
        //   ...student,
        //   key: studentKey,
        //   reason: 'Duplicate in DynamoDB',
        // })
      } else {
        // Add the WondeIDs to the student record, and correct the birthdate if needed
        // if (foundWondeStudent.birthDate !== dayjs(student.student.birthDate).format('YYYY-MM-DD')) {
        //   console.log(
        //     'Updating birthdate for student:',
        //     foundWondeStudent.firstName,
        //     foundWondeStudent.lastName,
        //     foundWondeStudent.birthDate,
        //     dayjs(student.student.birthDate).format('YYYY-MM-DD'),
        //   )
        // }

        let wondeData = {
          MISID: foundWondeStudent.MISID,
          wondeID: foundWondeStudent.wondeID,
          birthDate: foundWondeStudent.birthDate, //updating the dynamoDB birthdate
        }
        // add the wondeID fields to the uniqueDynamoStudentsMap
        // "student" is the full record from Dynamo
        matchedDynamoStudentsMap.set(studentKey, { ...student, ...wondeData })
      }
    }
  })

  // make the map into an array for simpler processing
  let matchedDynamoStudents = Array.from(matchedDynamoStudentsMap.values())
  console.log('Matched DynamoDB Students with id, WondeIDs and MISID', matchedDynamoStudents)
  console.log('Unmatched students from DynamoDB', unMatchedDynamoDBStudents)

  /*******************************************
   * 6. Match each classroom (uniqueWondeClassrooms) to its partner in DynamoDB (uploadedClassrooms)
   *    push matched records with WondeIDs -> uniqueDynamoClassroomMap
   *    push unmatched records to          -> unMatchedClasses
   ******************************************/
  //let matchedDynamoClassroomsMap = new Map() // DynamoDB classrooms uniquely matched to Wonde Classrooms
  let matchedDynamoClassrooms = []
  uploadedClassrooms.forEach((classroom) => {
    // note: for Parkside community - if there is no yearlevel in the dynamoDB record, then its a focus
    // group that will not be found in Wonde, so we can skip it
    if (classroom.yearLevels.items.length > 0) {
      let yearCode = classroom.yearLevels.items[0].yearLevel.yearCode

      let teacherEmail = 'No Email'
      if (classroom.teachers && classroom.teachers.items.length > 0) {
        teacherEmail = classroom.teachers.items[0].email
      }
      let classroomKeyOld2 = compressString(yearCode + classroom.className + teacherEmail)
      let classroomKeyOld = compressString(yearCode + teacherEmail)
      let classroomKeyOld3 = compressString(yearCode + classroom.className)
      let classroomKey = compressString(yearCode + classroom.className.charAt(1))
      let foundWondeClassroom = uniqueWondeClassroomsMap.get(classroomKey)

      // for St Moonicas and possibly other schools, must allow for situation where
      // the classroom is split into 2 or more in Dynamo - see notes at top
      // So a map is no longer appropriate, so use an array

      if (!foundWondeClassroom) {
        console.log('Classroom not found in Wonde', classroomKey, classroom)
      } else {
        let wondeData = {
          MISID: foundWondeClassroom.MISID,
          wondeID: foundWondeClassroom.wondeID,
        }
        // add the wondeID fields to the uniqueDynamoStudentsMap
        // 'classroom" is the full classroom record from DynamoDB
        // TODO: add t
        matchedDynamoClassrooms.push({ ...classroom, ...wondeData })
      }

      // if (!foundWondeClassroom) {
      //   console.log('Classroom not found in Wonde', classroomKey, classroom)
      // } else {
      //   let wondeData = {
      //     MISID: foundWondeClassroom.MISID,
      //     wondeID: foundWondeClassroom.wondeID,
      //   }
      //   // add the wondeID fields to the uniqueDynamoStudentsMap
      //   // 'classroom" is the full classroom record from DynamoDB
      //   // TODO: add t
      //   matchedDynamoClassroomsMap.set(classroomKey, { ...classroom, ...wondeData })
      // }
    } else {
      // classroom has no year level attached - so probably its a focus group
      console.log('skipping classroom:', classroom.className, classroom.classType)
    }
  })

  // make the map into an array for simpler processing
  //let matchedDynamoClassrooms = Array.from(matchedDynamoClassroomsMap.values())
  console.log('Matched Dynamo Classrooms with id, WondeIDs and MISID', matchedDynamoClassrooms)

  /*******************************************
   * 7. Match each teacher (uniqueWondeTeachersMap) to its partner in DynamoDB (uploadedTeachers)
   *        push matched records with WondeIDs -> uniqueDynamoTeachersMap
   *        (push unmatched records to          -> unMatchedTeachers)
   ******************************************/
  let matchedDynamoTeachersMap = new Map() // DynamoDB teachers uniquely matched to WondeStudents
  uploadedTeachers.forEach((teacher) => {
    let teacherEmail = 'No Email'
    if (teacher.email) {
      teacherEmail = teacher.email
    }
    let teacherKeyOld = compressString(teacher.firstName + teacher.lastName + teacherEmail)
    let teacherKey = teacherEmail
    let foundWondeTeacher = uniqueWondeTeachersMap.get(teacherKey)
    if (!foundWondeTeacher) {
      console.log('Dynamo Teacher not found in Wonde', teacher.email)
    } else {
      let wondeData = {
        MISID: foundWondeTeacher.MISID,
        wondeID: foundWondeTeacher.wondeID,
      }
      // add the wondeID fields to the uniqueDynamoStudentsMap
      matchedDynamoTeachersMap.set(teacherKey, { ...teacher, ...wondeData })
    }
  })
  // make the map into an array for simpler processing
  let matchedDynamoTeachers = Array.from(matchedDynamoTeachersMap.values())
  console.log('Matched Dynamo Teachers with id, WondeIDs and MISID', matchedDynamoTeachers)

  //return

  /*************************************************************
   * READY FOR THE TABLE UPDATES
   * Save the WondeIDs and MISIDs to the school table
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
  console.log('Updated school return value from update query', returns)

  /*************************************************************
   * Save the WondeIDs and MISIDs to the Student table
   * and fix student birthDates if wrong
   ************************************************************/
  // Note: There is no batchWrite for update operations apparently - so doing batches
  // of individual promises
  console.time('Update students time')
  try {
    // we dont want to exceed the throttling rates so split the transactions into batches
    const BATCH_SIZE = 25
    let batchesCount = Math.floor(matchedDynamoStudents.length / BATCH_SIZE) + 1 // allow for remainder
    let lastBatchSize = matchedDynamoStudents.length % BATCH_SIZE // which could be 0
    // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    // process each batch
    let index = 0 //index to uniqueDynamoStudents
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
      if (batchSize === 0) break // must have been an even no of batches

      // polulate the batch to write
      let batchToWrite = []
      for (let n = 0; n < batchSize; n++) {
        batchToWrite.push(matchedDynamoStudents[index])
        index++
      } // end batch loop
      console.log('Student batchToWrite', batchToWrite)
      // do the batch update and wait for the batch to finish
      let promisesArray = batchToWrite.map((student) => {
        return docClient
          .update({
            TableName: process.env.REACT_APP_STUDENT_TABLE,
            Key: { id: student.student.id },
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
      console.log('Updated students return value from update query', returns)
    } // end for loop
  } catch (err) {
    console.log('Error updating students', err)
    return
  }
  console.timeEnd('Update students time')

  /*************************************************************
   * Save the WondeIDs and MISIDs to the User table for Students
   ************************************************************/
  // Note: Make sure the studnt has a valid userId and email
  console.time('Update student Users time')

  try {
    // we dont want to exceed the throttling rates so split the transactions into batches
    const BATCH_SIZE = 25
    let batchesCount = Math.floor(matchedDynamoStudents.length / BATCH_SIZE) + 1 // allow for remainder
    let lastBatchSize = matchedDynamoStudents.length % BATCH_SIZE // which could be 0
    // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    // process each batch
    let index = 0 //index to uniqueDynamoStudents
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
      if (batchSize === 0) break // must have been an even no of batches

      // polulate the batch to write
      let batchToWrite = []
      for (let n = 0; n < batchSize; n++) {
        if (
          matchedDynamoStudents[index].userId &&
          matchedDynamoStudents[index].user.items[0].email
        ) {
          batchToWrite.push(matchedDynamoStudents[index])
        } else {
          console.log('student has no userId', matchedDynamoStudents[index])
        }
        index++
      } // end batch loop
      console.log('Student User batchToWrite', batchToWrite)
      // do the batch update and wait for the batch to finish
      let promisesArray = batchToWrite.map((student) => {
        return docClient
          .update({
            TableName: process.env.REACT_APP_USER_TABLE,
            Key: { email: student.user.items[0].email },
            UpdateExpression: 'set MISID = :m, wondeID = :w',
            ExpressionAttributeValues: {
              ':m': student.MISID,
              ':w': student.wondeID,
            },
            ReturnValues: 'UPDATED_NEW',
          })
          .promise()
      })
      returns = await Promise.all(promisesArray)
      console.log('Updated students return value from update query', returns)
    } // end for loop
  } catch (err) {
    console.log('Error updating students Users', err)
    return
  }
  console.timeEnd('Update student Users time')

  /*************************************************************
   * Save the WondeIDs and MISIDs to the Teachers into the User table
   ************************************************************/
  // There is usually a small no of teachers so not bothering to batch up
  // Also might be better to use the "userid" index
  console.time('Update teachers time')
  try {
    let promisesArray = matchedDynamoTeachers.map((teacher) => {
      return docClient
        .update({
          TableName: process.env.REACT_APP_USER_TABLE,
          Key: { email: teacher.email },
          UpdateExpression: 'set MISID = :m, wondeID = :w',
          ExpressionAttributeValues: {
            ':m': teacher.MISID,
            ':w': teacher.wondeID,
          },
          ReturnValues: 'UPDATED_NEW',
        })
        .promise()
    })
    returns = await Promise.all(promisesArray)
  } catch (err) {
    console.log('Error updating teachers', err)
    return
  }
  console.timeEnd('Update teachers time')
  console.log('Updated teachers return value from update query', returns)

  /*************************************************************
   * Save the WondeIDs and MISIDs to the Classroom table
   ************************************************************/
  console.time('Update classrooms time')
  try {
    let promisesArray = matchedDynamoClassrooms.map((classroom) => {
      return docClient
        .update({
          TableName: process.env.REACT_APP_CLASSROOM_TABLE,
          Key: { id: classroom.id },
          UpdateExpression: 'set MISID = :m, wondeID = :w',
          ExpressionAttributeValues: {
            ':m': classroom.MISID,
            ':w': classroom.wondeID,
          },
          ReturnValues: 'UPDATED_NEW',
        })
        .promise()
    })
    returns = await Promise.all(promisesArray)
  } catch (err) {
    console.log('Error updating classrooms', err)
    return
  }
  console.timeEnd('Update classrooms time')
  console.log('Updated classrooms return value from update query', returns)
}
