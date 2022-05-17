/**
 * addWondeIDs() adds WondeIds to Wonde schools that were uploaded manually
 * Schools with WondeIds can be updated automatically
 * WondeIDs are added to School, Student, Classroom and User table records
 */
import { GetAllSchoolsFromDynamoDB } from './GetAllSchoolsFromDynamoDB'
import { getStudentsFromWonde } from './getStudentsFromWonde'
import { getUploadedSchoolData } from './getUploadedSchoolData'
import dayjs from 'dayjs'

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

  let matchingSchool = dynamoSchools.find(
    (x) => compressString(x.schoolName) === compressString(selectedSchool.schoolName),
  )
  let schoolDynamoID
  if (matchingSchool) {
    console.log('Selected School found', matchingSchool)
    schoolDynamoID = matchingSchool.id
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
      mis_id: student.mis_id,
      firstName: student.forename,
      middleName: student.middle_names ? student.middle_names : null,
      lastName: student.surname,
      yearCode: student.yearCode, // not a wonde attribute - put there by getStudentsFromWonde()
      gender: student.gender,
      dob: student.date_of_birth.date,
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
          mis_id: classroom.mis_id,
          classroomName: classroom.name,
        })
        // Build the unique list of teachers (maybe add email as a better unique identifier)
        classroom.employees.data.forEach((teacher) => {
          let teacherKey = compressString(teacher.forename + teacher.surname)
          if (!uniqueWondeTeachersMap.get(teacherKey)) {
            uniqueWondeTeachersMap.set(teacherKey, {
              wondeID: teacher.id,
              mis_id: teacher.mis_id,
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

  // Make a unique list of students with DynamoDB students with firstname,lastname as key
  // If a duplicate if found remove the duplicate from the unique list and add
  // both records to duplicateWondeStudents[]

  let duplicateDynamoStudents = []
  let uniqueDynamoStudentsMap = new Map()
  uploadedStudents.forEach((student) => {
    let newStudent = {
      firstName: student.student.firstName,
      lastName: student.student.lastName,
      dob: student.student.birthDate,
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

  // make the maps into arrays for simpler processing
  const uniqueDynamoStudents = Array.from(uniqueDynamoStudentsMap.values())

  uniqueDynamoStudents.forEach((student, index) => {
    let studentKey = compressString(student.firstName + student.lastName)
    let foundStudent = uniqueWondeStudentsMap.get(studentKey)
    if (foundStudent) {
      // compare the birthdates for fun, so we can update it if its wrong in Dynamo
      if (
        dayjs(foundStudent.dob).format('YYYY-MM-DD') !== dayjs(student.dob).format('YYYY-MM-DD')
      ) {
        console.log(
          index,
          'Birthdates no match:',
          studentKey,
          'Wonde:',
          foundStudent.dob,
          'DynamoDB',
          student.dob,
        )
      }
      student.wondeID = foundStudent.wondeID
      student.mis_id = foundStudent.mis_id
    } else {
      console.log('DynamoDB Student not found in Wonde', foundStudent)
    }
  })

  uploadedClassrooms.forEach((classroom) => {
    let foundClassroom = uniqueWondeClassroomsMap.get(compressString(classroom.className))
    if (foundClassroom) {
      classroom.wondeID = foundClassroom.wondeID
      classroom.mis_id = foundClassroom.mis_id
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
      teacher.mis_id = foundTeacher.mis_id
    } else {
      console.log(`teacher ${teacher} not found`)
    }
  })
  console.log('uploaded Students raw', uploadedStudents)
  console.log('Duplicate student firstname,lastname pairs in DynamoDB', duplicateDynamoStudents)
  console.log('uploaded Classrooms with id, WondeIDs and mis_ids', uploadedClassrooms)
  console.log('uploaded Teachers with with email, WondeIDs and mis_ids', uploadedTeachers)
  console.log('Uniquely named Students with id, WondeIDs and mis_ids', uniqueDynamoStudents)
}
