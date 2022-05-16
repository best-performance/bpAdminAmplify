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
  let uniqueWondeStudentsMap = new Map() // unique map with firstname,lastname,dob as key
  let uniqueWondeStudentsMap2 = new Map() // unique map with WondeID as key
  let uniqueWondeStudentsMap3 = new Map() // unique map with firstname,lastname as key

  wondeStudentsTemp.forEach((student) => {
    // Make a unique list of students with wonde id as key
    if (!uniqueWondeStudentsMap2.get(student.id)) {
      uniqueWondeStudentsMap2.set(student.id, {
        wondeID: student.id,
        firstName: student.forename,
        lastName: student.surname,
        dob: student.date_of_birth.date,
      })
    }
    // Make a unique list of students with wonde firstname,lastname as key
    if (!uniqueWondeStudentsMap3.get(compressString(student.forename + student.surname))) {
      uniqueWondeStudentsMap3.set(compressString(student.forename + student.surname), {
        wondeID: student.id,
        firstName: student.forename,
        lastName: student.surname,
        dob: student.date_of_birth.date,
      })
    } else {
      console.log('duplicate name,surname found in Wonde', student.forename, student.surname)
    }
    // Make another unique list of students with firstname,lastname,birthday as key
    let studentKey = compressString(
      student.forename + student.surname + dayjs(student.date_of_birth.date).format('YYYY-MM-DD'),
    )
    if (student.surname === 'Dandoush') {
      console.log('--------------------------------------Wonde', student)
    }
    if (!uniqueWondeStudentsMap.get(studentKey)) {
      uniqueWondeStudentsMap.set(studentKey, {
        // save anything that will help to identify the student later in DynamoDB
        wondeID: student.id,
        mis_id: student.mis_id,
        firstName: student.forename,
        middleName: student.middle_names ? student.middle_names : null,
        lastName: student.surname,
        yearCode: student.yearCode, // not a wonde attribute - put there by getStudentsFromWonde()
        gender: student.gender,
        dob: student.date_of_birth.date,
      })
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
    }
  })

  // 2 student maps have the same length if no name duplicates
  console.dir(uniqueWondeStudentsMap)
  console.dir(uniqueWondeStudentsMap2)
  console.dir(uniqueWondeClassroomsMap)
  console.dir(uniqueWondeTeachersMap)

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
  // Check if duplicates of firstName, lastName in Dynamo
  let uniqueDynamoStudentsMap = new Map()
  uploadedStudents.forEach((student) => {
    let key = compressString(student.student.firstName + student.student.lastName)
    if (!uniqueDynamoStudentsMap.get(key)) {
      uniqueDynamoStudentsMap.set(key, {})
    } else {
      console.log('Duplicate student name found', student)
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

  // check if we need to use DoB as a differentiator
  if (uniqueWondeStudentsMap.size === uniqueWondeStudentsMap2.size) {
    // There are no duplicate names
    uploadedStudents.forEach((student) => {
      if (student.student.lastName === 'Dandoush') {
        console.log('-------------------------------------- Dynamo', student)
        console.log('key', compressString(student.student.firstName + student.student.lastName))
      }
      let foundStudent = uniqueWondeStudentsMap3.get(
        compressString(student.student.firstName + student.student.lastName),
      )
      if (foundStudent) {
        student.student.wondeID = foundStudent.wondeID
        student.student.mis_id = foundStudent.mis_id
      } else {
        console.log('Student not found', student)
      }
    })
  } else {
    console.log('There are duplicate students by name')
  }
  console.log('uploaded Classrooms with WondeIDs', uploadedClassrooms)
  console.log('uploaded Teachers with WondeIDs', uploadedTeachers)
  console.log('uploaded Students with WondeIDs', uploadedStudents)
}
