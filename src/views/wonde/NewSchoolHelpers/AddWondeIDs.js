/**
 * addWondeIDs() adds WondeIds to Wonde schools that were uploaded manually
 * Schools with WondeIds can be updated automatically
 * WondeIDs are added to School, Student, Classroom and User table records
 */
import { GetAllSchoolsFromDynamoDB } from './GetAllSchoolsFromDynamoDB'
import { getStudentsFromWonde } from './getStudentsFromWonde'
import { getUploadedSchoolData } from './getUploadedSchoolData'

// Utility to remove spaces and hyphens from string and convert to upper case
function compressString(str) {
  return str.replace(/'|\s/g, '').toUpperCase()
}

export async function addWondeIDs(selectedSchool) {
  console.log('selected school', selectedSchool)
  //   let dynamoSchools = await GetAllSchoolsFromDynamoDB()

  //   // check if there is a matching school name in EdCompanion/Elastik
  //   let matchingSchool = dynamoSchools.find(
  //     (x) => compressString(x.schoolName) === compressString(selectedSchool.schoolName),
  //   )
  //   let schoolDynamoID
  //   if (matchingSchool) {
  //     console.log('Selected School found', matchingSchool)
  //     schoolDynamoID = matchingSchool.id
  //   }

  /*******************************************
   *  Retrieve the Wonde data for this school
   *  and make unique lists
   ******************************************/
  //   let { wondeStudentsTemp } = await getStudentsFromWonde(selectedSchool.wondeID)
  //   console.log('wonde data', wondeStudentsTemp)

  //   // Make unique lists of Students, Classrooms and Teachers from the Wonde Data
  //   let uniqueWondeClassroomsMap = new Map()
  //   let uniqueWondeTeachersMap = new Map()
  //   let uniqueWondeStudentsMap = new Map()

  //   wondeStudentsTemp.forEach((student) => {
  //     // Make a unique list of students with wonde id as key
  //     if (!uniqueWondeStudentsMap.get(student.SwondeId)) {
  //       uniqueWondeStudentsMap.set(student.id, {
  //         // save anything that will help to identify the student later in DynamoDB
  //         wondeID: student.id,
  //         mis_id: student.mis_id,
  //         firstName: student.forename,
  //         middleName: student.middle_names ? student.middle_names : null,
  //         lastName: student.surname,
  //         yearCode: student.yearCode, // not a wonde attribute - put there by getStudentsFromWonde()
  //         gender: student.gender,
  //         dob: student.date_of_birth.date,
  //       })
  //       // Build the unique list of classrooms
  //       student.classes.data.forEach((classroom) => {
  //         if (!uniqueWondeClassroomsMap.get(classroom.id)) {
  //           uniqueWondeClassroomsMap.set(classroom.id, {
  //             // save anything that will help to identify the student later in DynamoDB
  //             wondeID: classroom.id,
  //             mis_id: classroom.mis_id,
  //             classroomName: classroom.name,
  //           })
  //           // Build the unique list of teachers
  //           classroom.employees.data.forEach((teacher) => {
  //             if (!uniqueWondeTeachersMap.get(teacher.id)) {
  //               uniqueWondeTeachersMap.set(teacher.id, {
  //                 wondeID: teacher.id,
  //                 firstName: teacher.forename,
  //                 middleName: student.middle_names ? student.middle_names : null,
  //                 lastName: teacher.surname,
  //               })
  //             }
  //           })
  //         }
  //       })
  //     }
  //   })

  //   console.dir(uniqueWondeStudentsMap)
  //   console.dir(uniqueWondeClassroomsMap)
  //   console.dir(uniqueWondeTeachersMap)

  /*******************************************
   *  Retrieve the DynamoDB data for this school
   *  based on the schools id in DnamoDB
   *  and make unique lists
   ******************************************/

  let { uploadedClassrooms, uploadedTeachers, uploadedStudents } = await getUploadedSchoolData(
    selectedSchool.id,
  )
}
